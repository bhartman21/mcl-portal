import { computed, effect, inject, Injectable, Injector, signal, untracked } from '@angular/core';
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  Unsubscribe,
  where,
  WriteBatch,
} from 'firebase/firestore';
import {
  Actor,
  AdContent,
  adFromDoc,
  approveAdBatch,
  auditFromDoc,
  bookFromDoc,
  createAdBatch,
  createBookBatch,
  deleteAdBatch,
  newAdId,
  newBookId,
  placeAdBatch,
  rejectAdBatch,
  reorderBookBatch,
  resetLockBatch,
  seedAdSizesBatch,
  selfApproveAdBatch,
  setAdSizeBatch,
  setBookStatusBatch,
  sizeFromDoc,
  submitAdBatch,
  unplaceAdBatch,
  undoReviewBatch,
  updateAdContentBatch,
  withdrawAdBatch,
} from '../ad-book/ad-book-firestore';
import {
  adImagePath,
  adImageUrl,
  checkAdImage,
  deleteAdImage,
  PendingAdImage,
  uploadAdImage,
} from '../ad-book/ad-image-storage';
import {
  AdBook,
  AdBookStatus,
  AdItem,
  AdSize,
  AppNotification,
  AuditAction,
  AuditEntry,
  MAX_AD_SUBMISSIONS,
  SEED_AD_BOOKS,
  SEED_AD_SIZES,
} from '../models/ad-book.model';
import { AD_REVIEWER_ROLES, ADMIN_ROLES, UserProfile } from '../models/user.model';
import { AdminService } from './admin.service';
import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';
import { NotificationService } from './notification.service';

// Local demo mode only (no Firebase config). With Firebase, Firestore + Storage are the source of
// truth and nothing Ad Book related is written to localStorage (issue #4).
const STORAGE_SIZES_KEY = 'mcl_portal_ad_sizes_v1';
const STORAGE_BOOKS_KEY = 'mcl_portal_ad_books_v1';
const STORAGE_ADS_KEY = 'mcl_portal_ads_v1';
const STORAGE_AUDITS_KEY = 'mcl_portal_audits_v1';

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // Ignore corrupt local storage
  }
  return fallback;
}

/** Fields the ad editor saves. `image` is a newly chosen file; omit it to keep the current one. */
export interface AdEditorInput {
  title: string;
  sizeId: string;
  companyName?: string;
  fit: 'cover' | 'contain';
  position: { x: number; y: number };
  image?: PendingAdImage | null;
  /** Local demo mode only: an existing data URL (tests, legacy callers). */
  imageUrl?: string;
  imageName?: string;
}

@Injectable({ providedIn: 'root' })
export class AdBookService {
  private readonly fb = inject(FirebaseService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly injector = inject(Injector);

  /** Firestore/Storage when the app has a real Firebase config; otherwise local demo mode. */
  private readonly db = this.fb.isConfigured ? this.fb.firestore : null;
  private readonly storage = this.fb.isConfigured ? this.fb.storage : null;
  readonly usesFirebase = !!this.db;

  private readonly _adSizes = signal<AdSize[]>(
    this.db ? [] : loadJson(STORAGE_SIZES_KEY, SEED_AD_SIZES)
  );
  private readonly _adBooks = signal<AdBook[]>(
    this.db ? [] : loadJson(STORAGE_BOOKS_KEY, SEED_AD_BOOKS)
  );
  private readonly _ads = signal<AdItem[]>(this.db ? [] : loadJson(STORAGE_ADS_KEY, []));
  private readonly _audits = signal<AuditEntry[]>(this.db ? [] : loadJson(STORAGE_AUDITS_KEY, []));
  /** Storage download URLs by imagePath (runtime only, never persisted). */
  private readonly _imageUrls = signal<Record<string, string>>({});
  private readonly pendingUrls = new Set<string>();

  private readonly _adsLoaded = signal(!this.db);
  private adsLoadedWaiters: (() => void)[] = [];
  private readonly _loadError = signal<string | null>(null);
  private readonly _uploadProgress = signal<number | null>(null);
  private unsubscribers: Unsubscribe[] = [];
  private listenGeneration = 0;
  private seedingSizes = false;

  /** First Firestore snapshot of the user's ads has arrived (always true in demo mode). */
  readonly adsLoaded = this._adsLoaded.asReadonly();
  readonly loadError = this._loadError.asReadonly();
  /** 0-100 while an ad image uploads to Storage; null otherwise. */
  readonly uploadProgress = this._uploadProgress.asReadonly();

  readonly adSizes = computed(() =>
    [...this._adSizes()].sort((a, b) => a.sortOrder - b.sortOrder)
  );
  readonly activeSizes = computed(() => this.adSizes().filter((s) => s.active));
  readonly adBooks = this._adBooks.asReadonly();
  readonly ads = computed(() => {
    const urls = this._imageUrls();
    return this._ads().map((a) =>
      a.imagePath && urls[a.imagePath] ? { ...a, imageUrl: urls[a.imagePath] } : a
    );
  });
  /** Audited Ad Book actions, newest first (admin activity page). */
  readonly audits = computed(() => [...this._audits()].sort((a, b) => b.at.localeCompare(a.at)));

  readonly myAds = computed(() => {
    const uid = this.auth.user()?.uid;
    if (!uid) return [];
    return this.ads().filter((a) => a.createdBy === uid);
  });

  readonly submittedQueue = computed(() => this.ads().filter((a) => a.status === 'submitted'));

  readonly approvedAds = computed(() => this.ads().filter((a) => a.status === 'approved'));

  readonly canApprove = computed(() => this.auth.hasAnyRole(AD_REVIEWER_ROLES));

  /** Books the current user may see: members see open books only; approvers/admins see all. */
  readonly visibleBooks = computed(() =>
    this.canApprove() ? this._adBooks() : this._adBooks().filter((b) => b.status === 'open')
  );

  /** Department, national, or site admin (AD_BOOK.md: self-approval, undo review). */
  readonly isDeptOrHigherAdmin = computed(() => this.auth.hasAnyRole(ADMIN_ROLES));

  /** Approved or rejected ads an admin may undo (AC 13). */
  readonly reviewedAds = computed(() =>
    this.ads().filter((a) => a.status === 'approved' || a.status === 'rejected')
  );

  /** Locked ads an admin may reset (AC 11). */
  readonly lockedAds = computed(() => this.ads().filter((a) => a.locked));

  constructor() {
    if (this.db) {
      // Re-subscribe when the signed-in user or their access changes: rules decide what is visible.
      const accessKey = computed(() => {
        const u = this.auth.user();
        return `${u?.uid ?? ''}|${u?.status ?? ''}|${this.canApprove()}|${this.isDeptOrHigherAdmin()}`;
      });
      effect(() => {
        accessKey();
        untracked(() => void this.listen());
      });
    }
  }

  // ---------- Firestore listeners ----------

  private stopListening(): void {
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
  }

  private setAdsLoaded(): void {
    this._adsLoaded.set(true);
    const waiters = this.adsLoadedWaiters;
    this.adsLoadedWaiters = [];
    waiters.forEach((w) => w());
  }

  /** Resolves once the current user's ads are loaded (immediately in demo mode). */
  whenAdsLoaded(): Promise<void> {
    if (this._adsLoaded()) return Promise.resolve();
    return new Promise((resolve) => this.adsLoadedWaiters.push(resolve));
  }

  private onListenError(what: string): (err: unknown) => void {
    return (err) => {
      console.error(`Unable to load ${what}`, err);
      this._loadError.set(`Unable to load ${what}. Check your connection and try again.`);
    };
  }

  private async listen(): Promise<void> {
    const db = this.db;
    if (!db) return;
    const generation = ++this.listenGeneration;
    this.stopListening();
    this._adsLoaded.set(false);
    await this.auth.whenReady();
    if (generation !== this.listenGeneration) return;

    const user = this.auth.user();
    const active = user?.status === 'active';
    const reviewer = this.canApprove();
    const admin = this.isDeptOrHigherAdmin();

    // Sizes: anyone may read active sizes; active users read all (firestore.rules adSizes).
    const sizesQuery = active
      ? collection(db, 'adSizes')
      : query(collection(db, 'adSizes'), where('active', '==', true));
    this.unsubscribers.push(
      onSnapshot(
        sizesQuery,
        (snap) => {
          if (snap.empty && reviewer) void this.seedSizes();
          this._adSizes.set(snap.docs.map((d) => sizeFromDoc(d.id, d.data())));
        },
        this.onListenError('ad sizes')
      )
    );

    if (!user || !active) {
      this._adBooks.set([]);
      this._ads.set([]);
      this._audits.set([]);
      this.setAdsLoaded();
      return;
    }

    const booksQuery = reviewer
      ? collection(db, 'adBooks')
      : query(collection(db, 'adBooks'), where('status', '==', 'open'));
    this.unsubscribers.push(
      onSnapshot(
        booksQuery,
        (snap) =>
          this._adBooks.set(
            snap.docs.map((d) => bookFromDoc(d.id, d.data({ serverTimestamps: 'estimate' })))
          ),
        this.onListenError('event books')
      )
    );

    // Members read their own ads; approvers and admins read every ad (firestore.rules ads read).
    const adsQuery = reviewer
      ? collection(db, 'ads')
      : query(collection(db, 'ads'), where('createdBy', '==', user.uid));
    this.unsubscribers.push(
      onSnapshot(
        adsQuery,
        (snap) => {
          const ads = snap.docs.map((d) => adFromDoc(d.id, d.data({ serverTimestamps: 'estimate' })));
          ads.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          this._ads.set(ads);
          this.resolveImageUrls(ads);
          this.setAdsLoaded();
        },
        (err) => {
          this.onListenError('ads')(err);
          this.setAdsLoaded();
        }
      )
    );

    if (admin) {
      this.unsubscribers.push(
        onSnapshot(
          query(collection(db, 'audits'), where('entityType', '==', 'ad')),
          (snap) =>
            this._audits.set(
              snap.docs.map((d) => auditFromDoc(d.id, d.data({ serverTimestamps: 'estimate' })))
            ),
          this.onListenError('the audit log')
        )
      );
    } else {
      this._audits.set([]);
    }
  }

  /** Fresh project: the first approver/admin to load sizes writes the documented seed. */
  private async seedSizes(): Promise<void> {
    if (!this.db || this.seedingSizes) return;
    this.seedingSizes = true;
    try {
      await seedAdSizesBatch(this.db, SEED_AD_SIZES).commit();
    } catch (err) {
      console.error('Unable to seed ad sizes', err);
    } finally {
      this.seedingSizes = false;
    }
  }

  private resolveImageUrls(ads: AdItem[]): void {
    const storage = this.storage;
    if (!storage) return;
    const known = this._imageUrls();
    for (const ad of ads) {
      const path = ad.imagePath;
      if (!path || known[path] || this.pendingUrls.has(path)) continue;
      this.pendingUrls.add(path);
      adImageUrl(storage, path)
        .then((url) => this._imageUrls.update((m) => ({ ...m, [path]: url })))
        .catch((err) => console.warn('Unable to load ad image', path, err))
        .finally(() => this.pendingUrls.delete(path));
    }
  }

  // ---------- helpers ----------

  submissionsUsed(ad: AdItem): number {
    return ad.submissionCount ?? 0;
  }

  maxSubmissions(ad: AdItem): number {
    return ad.maxSubmissions ?? MAX_AD_SUBMISSIONS;
  }

  /** Owner may submit: draft/rejected, not locked, and under the limit (AC 9). */
  canSubmit(ad: AdItem): boolean {
    return (
      (ad.status === 'draft' || ad.status === 'rejected') &&
      !ad.locked &&
      this.submissionsUsed(ad) < this.maxSubmissions(ad)
    );
  }

  isOwnAd(ad: AdItem): boolean {
    return !!this.auth.user() && ad.createdBy === this.auth.user()?.uid;
  }

  /** Approve/reject someone else's submitted ad (AC 2: never your own). */
  canReviewAd(ad: AdItem): boolean {
    return ad.status === 'submitted' && this.canApprove() && !this.isOwnAd(ad);
  }

  /** Admin approving their own submitted ad, with a required reason (AC 12). */
  canSelfApprove(ad: AdItem): boolean {
    return ad.status === 'submitted' && this.isDeptOrHigherAdmin() && this.isOwnAd(ad);
  }

  canUndoReview(ad: AdItem): boolean {
    return (ad.status === 'approved' || ad.status === 'rejected') && this.isDeptOrHigherAdmin();
  }

  /** Locked/printed book that still contains the ad (undo must wait until it is removed). */
  lockedBookContaining(adId: string): AdBook | undefined {
    return this._adBooks().find(
      (b) => (b.status === 'locked' || b.status === 'printed') && b.adIds.includes(adId)
    );
  }

  /** The book an ad is placed in, if any. */
  bookContaining(adId: string): AdBook | undefined {
    return this._adBooks().find((b) => b.adIds.includes(adId));
  }

  private saveLocal(): void {
    if (this.db) return;
    localStorage.setItem(STORAGE_SIZES_KEY, JSON.stringify(this._adSizes()));
    localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(this._adBooks()));
    localStorage.setItem(STORAGE_ADS_KEY, JSON.stringify(this._ads()));
    localStorage.setItem(STORAGE_AUDITS_KEY, JSON.stringify(this._audits()));
  }

  private actor(): Actor {
    const u = this.auth.user();
    return { uid: u?.uid ?? '', name: u?.displayName || u?.email || 'Admin' };
  }

  private requireActiveUser(): UserProfile {
    const user = this.auth.user();
    if (!user || user.status !== 'active') {
      throw new Error('Active member authentication is required to create an ad.');
    }
    return user;
  }

  private writeLocalAudit(
    action: AuditAction,
    ad: AdItem,
    reason: string,
    toStatus: AdItem['status'],
    at: string
  ): AuditEntry {
    const entry: AuditEntry = {
      id: newId('audit'),
      entityType: 'ad',
      entityId: ad.id,
      action,
      actorUid: this.actor().uid,
      actorName: this.actor().name,
      at,
      ...(reason ? { reason } : {}),
      fromStatus: ad.status,
      toStatus,
    };
    this._audits.update((list) => [entry, ...list]);
    return entry;
  }

  /** Demo mode: every other active department/national/site admin. */
  private otherAdminUidsLocal(): string[] {
    const me = this.auth.user()?.uid;
    const users = this.injector.get(AdminService).users();
    return users
      .filter(
        (u) => u.uid !== me && u.status === 'active' && u.roles.some((r) => ADMIN_ROLES.includes(r))
      )
      .map((u) => u.uid);
  }

  /** Firebase: every other active admin, read fresh (admins may read users/*). */
  private async otherAdminUidsRemote(): Promise<string[]> {
    if (!this.db) return [];
    const me = this.auth.user()?.uid;
    const snap = await getDocs(
      query(collection(this.db, 'users'), where('roles', 'array-contains-any', [...ADMIN_ROLES]))
    );
    return snap.docs
      .filter((d) => d.id !== me && d.data()['status'] === 'active')
      .map((d) => d.id);
  }

  private replaceLocal(updated: AdItem): void {
    this._ads.update((list) => list.map((a) => (a.id === updated.id ? updated : a)));
    this.saveLocal();
  }

  private async commit(batch: WriteBatch): Promise<void> {
    await batch.commit();
  }

  getSizeById(id: string | undefined): AdSize | undefined {
    if (!id) return undefined;
    return this._adSizes().find((s) => s.id === id);
  }

  getAdById(id: string | undefined): AdItem | undefined {
    if (!id) return undefined;
    return this.ads().find((a) => a.id === id);
  }

  getBookById(id: string | undefined): AdBook | undefined {
    if (!id) return undefined;
    return this._adBooks().find((b) => b.id === id);
  }

  /** Like getBookById, but only if the current user may read the book (see visibleBooks). */
  getVisibleBookById(id: string | undefined): AdBook | undefined {
    if (!id) return undefined;
    return this.visibleBooks().find((b) => b.id === id);
  }

  // --- Ad CRUD & Workflow ---
  // Validation errors are thrown synchronously; the returned promise settles when the change is
  // saved (Firestore/Storage), or immediately in local demo mode.

  private async uploadImage(uid: string, adId: string, image: PendingAdImage): Promise<string> {
    if (!this.storage) throw new Error('Image storage is not available.');
    const problem = checkAdImage(image.blob);
    if (problem) throw new Error(problem);
    const path = adImagePath(uid, adId, image.name, image.blob.type);
    this._uploadProgress.set(0);
    try {
      await uploadAdImage(this.storage, path, image.blob, (p) => this._uploadProgress.set(p));
    } finally {
      this._uploadProgress.set(null);
    }
    return path;
  }

  private removeImageQuietly(path: string | undefined): void {
    if (!path || !this.storage) return;
    deleteAdImage(this.storage, path).catch((err) =>
      console.warn('Unable to delete replaced ad image', path, err)
    );
  }

  createAd(input: AdEditorInput): Promise<AdItem> {
    const user = this.requireActiveUser();
    if (input.image) {
      const problem = checkAdImage(input.image.blob);
      if (problem) throw new Error(problem);
    }

    const now = new Date().toISOString();
    const base: AdItem = {
      id: '',
      departmentId: 'dof',
      sizeId: input.sizeId,
      title: input.title.trim(),
      companyName: input.companyName?.trim() || undefined,
      status: 'draft',
      createdBy: user.uid,
      createdByName: user.displayName || user.email,
      createdByType: 'member',
      imageName: input.image?.name ?? input.imageName,
      fit: input.fit,
      position: { ...input.position },
      submissionCount: 0,
      maxSubmissions: MAX_AD_SUBMISSIONS,
      locked: false,
      createdAt: now,
      updatedAt: now,
    };

    const db = this.db;
    if (!db) {
      const ad: AdItem = {
        ...base,
        id: newId('ad'),
        imageUrl: input.image?.previewUrl ?? input.imageUrl,
      };
      this._ads.update((list) => [ad, ...list]);
      this.saveLocal();
      return Promise.resolve(ad);
    }

    return (async () => {
      const id = newAdId(db);
      const imagePath = input.image ? await this.uploadImage(user.uid, id, input.image) : undefined;
      const content: AdContent = { ...base, imagePath };
      await this.commit(createAdBatch(db, id, this.actor(), content));
      return { ...base, id, imagePath };
    })();
  }

  updateAd(id: string, patch: Partial<AdEditorInput>): Promise<AdItem> {
    const existing = this.getAdById(id);
    if (!existing) throw new Error('Ad not found.');

    if (existing.status === 'approved' || existing.status === 'submitted') {
      throw new Error('Withdraw the ad to draft before editing.');
    }
    if (existing.locked) {
      throw new Error(
        'Submission limit reached. An administrator must reset this ad before it can be edited.'
      );
    }
    if (patch.image) {
      const problem = checkAdImage(patch.image.blob);
      if (problem) throw new Error(problem);
    }

    const { image, ...fields } = patch;
    const updated: AdItem = {
      ...existing,
      ...fields,
      ...(image ? { imageName: image.name } : {}),
      title: (fields.title ?? existing.title).trim(),
      status: 'draft',
      updatedAt: new Date().toISOString(),
    };

    const db = this.db;
    if (!db) {
      if (image) updated.imageUrl = image.previewUrl;
      this.replaceLocal(updated);
      return Promise.resolve(updated);
    }

    return (async () => {
      const oldPath = existing.imagePath;
      const imagePath = image ? await this.uploadImage(existing.createdBy, id, image) : oldPath;
      const content: AdContent = {
        title: updated.title,
        sizeId: updated.sizeId,
        companyName: updated.companyName,
        imagePath,
        imageName: updated.imageName,
        fit: updated.fit,
        position: updated.position,
      };
      await this.commit(
        updateAdContentBatch(db, id, content, existing.status === 'rejected' ? 'rejected' : 'draft')
      );
      if (image && oldPath && oldPath !== imagePath) this.removeImageQuietly(oldPath);
      return { ...updated, imagePath };
    })();
  }

  submitAd(id: string): Promise<AdItem> {
    const ad = this.getAdById(id);
    if (!ad) throw new Error('Ad not found.');
    if (!ad.title.trim()) throw new Error('Ad title is required before submitting.');
    if (!ad.imagePath && !ad.imageUrl) {
      throw new Error('Please upload an ad image before submitting.');
    }

    if (ad.status !== 'draft' && ad.status !== 'rejected') {
      throw new Error('Only draft or rejected ads can be submitted.');
    }
    if (ad.locked || this.submissionsUsed(ad) >= this.maxSubmissions(ad)) {
      throw new Error(
        `Submission limit reached (${this.maxSubmissions(ad)} of ${this.maxSubmissions(ad)}). An administrator must reset this ad.`
      );
    }

    const size = this.getSizeById(ad.sizeId);
    if (!size || !size.active) {
      throw new Error('Please select an active ad size.');
    }

    const now = new Date().toISOString();
    const updated: AdItem = {
      ...ad,
      status: 'submitted',
      submissionCount: this.submissionsUsed(ad) + 1,
      rejectionNotes: undefined,
      submittedAt: now,
      updatedAt: now,
    };

    if (!this.db) {
      this.replaceLocal(updated);
      return Promise.resolve(updated);
    }
    return this.commit(submitAdBatch(this.db, id, updated.submissionCount!)).then(() => updated);
  }

  /**
   * Owner withdraws a submitted ad back to draft (AD_BOOK.md FR-A-3, AC 10). Only `submitted`
   * ads can be withdrawn, only by their owner; the submission attempt is not refunded.
   */
  recallToDraft(id: string): Promise<AdItem> {
    const ad = this.getAdById(id);
    if (!ad) throw new Error('Ad not found.');
    if (!this.isOwnAd(ad)) throw new Error('Only the ad owner can withdraw it.');
    if (ad.status !== 'submitted') {
      throw new Error('Only submitted ads can be withdrawn to draft.');
    }

    const updated: AdItem = { ...ad, status: 'draft', updatedAt: new Date().toISOString() };
    if (!this.db) {
      this.replaceLocal(updated);
      return Promise.resolve(updated);
    }
    return this.commit(withdrawAdBatch(this.db, id)).then(() => updated);
  }

  /**
   * Approve a submitted ad. Approvers and admins approve other members' ads. An approver can
   * never approve their own ad; a department, national, or site admin may self-approve only with a
   * reason, which is audited and notifies every other admin (AD_BOOK.md AC 2, 12).
   */
  approveAd(id: string, opts: { selfApprovalReason?: string } = {}): Promise<AdItem> {
    if (!this.canApprove()) {
      throw new Error('Only Ad Book Approvers or Admins can approve ads.');
    }
    const ad = this.getAdById(id);
    if (!ad) throw new Error('Ad not found.');
    if (ad.status !== 'submitted') throw new Error('Only submitted ads can be approved.');

    const own = this.isOwnAd(ad);
    const reason = opts.selfApprovalReason?.trim() ?? '';
    if (own && !this.isDeptOrHigherAdmin()) {
      throw new Error("You can't approve your own ad. A different approver must review it.");
    }
    if (own && !reason) {
      throw new Error('A reason is required to approve your own ad.');
    }

    const now = new Date().toISOString();
    const actor = this.actor();
    const updated: AdItem = {
      ...ad,
      status: 'approved',
      rejectionNotes: undefined,
      reviewedBy: actor.uid,
      reviewedByName: actor.name,
      reviewedAt: now,
      selfApproved: own ? true : undefined,
      selfApprovalReason: own ? reason : undefined,
      updatedAt: now,
    };

    const db = this.db;
    if (db) {
      if (!own) return this.commit(approveAdBatch(db, id, actor)).then(() => updated);
      return (async () => {
        const recipients = await this.otherAdminUidsRemote();
        const { batch, auditId } = selfApproveAdBatch(db, ad, actor, reason, recipients);
        await this.commit(batch);
        return { ...updated, lastAuditId: auditId };
      })();
    }

    if (own) {
      const audit = this.writeLocalAudit('selfApprove', ad, reason, 'approved', now);
      updated.lastAuditId = audit.id;
      const notes: AppNotification[] = this.otherAdminUidsLocal().map((recipientUid) => ({
        id: newId('notif'),
        recipientUid,
        type: 'adSelfApproved',
        adId: ad.id,
        adTitle: ad.title,
        actorUid: actor.uid,
        actorName: actor.name,
        reason,
        createdAt: now,
        read: false,
      }));
      this.notifications.add(notes);
    }
    this.replaceLocal(updated);
    return Promise.resolve(updated);
  }

  rejectAd(id: string, notes: string): Promise<AdItem> {
    if (!this.canApprove()) {
      throw new Error('Only Ad Book Approvers or Admins can reject ads.');
    }
    const ad = this.getAdById(id);
    if (!ad) throw new Error('Ad not found.');
    if (ad.status !== 'submitted') throw new Error('Only submitted ads can be rejected.');
    if (this.isOwnAd(ad)) {
      throw new Error("You can't reject your own ad. Withdraw it instead.");
    }
    const cleanNotes = notes.trim();
    if (cleanNotes.length < 5) {
      throw new Error('Rejection notes must be at least 5 characters.');
    }

    const now = new Date().toISOString();
    const actor = this.actor();
    const updated: AdItem = {
      ...ad,
      status: 'rejected',
      rejectionNotes: cleanNotes,
      // The rejection of the last allowed submission locks the ad (AC 9).
      locked: this.submissionsUsed(ad) >= this.maxSubmissions(ad),
      reviewedBy: actor.uid,
      reviewedByName: actor.name,
      reviewedAt: now,
      updatedAt: now,
    };

    if (!this.db) {
      this.replaceLocal(updated);
      return Promise.resolve(updated);
    }
    return this.commit(rejectAdBatch(this.db, id, actor, cleanNotes, !!updated.locked)).then(
      () => updated
    );
  }

  /**
   * Admin undo of an approval or rejection (AD_BOOK.md FR-A-3, AC 13): required reason, ad
   * returns to submitted, submissionCount unchanged, audited. An approved ad in a locked or
   * printed book must be removed from that book first; it is removed from an open book.
   */
  undoReview(id: string, reason: string): Promise<AdItem> {
    if (!this.isDeptOrHigherAdmin()) {
      throw new Error('Only a department, national, or site admin can undo a review.');
    }
    const ad = this.getAdById(id);
    if (!ad) throw new Error('Ad not found.');
    if (ad.status !== 'approved' && ad.status !== 'rejected') {
      throw new Error('Only approved or rejected ads can be undone.');
    }
    const cleanReason = reason.trim();
    if (!cleanReason) throw new Error('A reason is required to undo a review.');
    const locked = this.lockedBookContaining(id);
    if (locked) {
      throw new Error(`Remove this ad from the locked book "${locked.title}" before undoing.`);
    }
    const placed = this.bookContaining(id);
    if (placed && this.isOwnAd(ad)) {
      // #45: nobody takes their own ad out of a book, and undo would.
      throw new Error(
        `This is your own ad and it is in "${placed.title}". A different approver must remove it from the book before you undo.`
      );
    }

    const now = new Date().toISOString();
    const updated: AdItem = {
      ...ad,
      status: 'submitted',
      bookId: undefined,
      reviewedBy: undefined,
      reviewedByName: undefined,
      reviewedAt: undefined,
      rejectionNotes: undefined,
      selfApproved: undefined,
      selfApprovalReason: undefined,
      locked: false,
      updatedAt: now,
    };

    const db = this.db;
    if (db) {
      const placedIn = this.bookContaining(id);
      const { batch, auditId } = undoReviewBatch(db, ad, this.actor(), cleanReason, placedIn);
      return this.commit(batch).then(() => ({ ...updated, lastAuditId: auditId }));
    }

    const audit = this.writeLocalAudit('undoReview', ad, cleanReason, 'submitted', now);
    updated.lastAuditId = audit.id;
    this._adBooks.update((books) =>
      books.map((b) =>
        b.adIds.includes(id) ? { ...b, adIds: b.adIds.filter((x) => x !== id), updatedAt: now } : b
      )
    );
    this.replaceLocal(updated);
    return Promise.resolve(updated);
  }

  /**
   * Admin lock reset (AD_BOOK.md FR-A-3, AC 11): clears `locked`, sets `submissionCount` to 0,
   * returns the ad to draft, and audits who, when, and the (optional) reason.
   */
  resetLock(id: string, reason = ''): Promise<AdItem> {
    if (!this.isDeptOrHigherAdmin()) {
      throw new Error('Only a department, national, or site admin can reset a locked ad.');
    }
    const ad = this.getAdById(id);
    if (!ad) throw new Error('Ad not found.');
    if (!ad.locked) throw new Error('This ad is not locked.');

    const now = new Date().toISOString();
    const cleanReason = reason.trim();
    const db = this.db;
    if (db) {
      const { batch, auditId, entry } = resetLockBatch(db, ad, this.actor(), cleanReason, now);
      const updated: AdItem = {
        ...ad,
        status: 'draft',
        submissionCount: 0,
        locked: false,
        lockResets: [...(ad.lockResets ?? []), entry],
        lastAuditId: auditId,
        updatedAt: now,
      };
      return this.commit(batch).then(() => updated);
    }

    const audit = this.writeLocalAudit('lockReset', ad, cleanReason, 'draft', now);
    const entry = { by: this.actor().uid, at: now, ...(cleanReason ? { reason: cleanReason } : {}) };
    const updated: AdItem = {
      ...ad,
      status: 'draft',
      submissionCount: 0,
      locked: false,
      lockResets: [...(ad.lockResets ?? []), entry],
      lastAuditId: audit.id,
      updatedAt: now,
    };
    this.replaceLocal(updated);
    return Promise.resolve(updated);
  }

  deleteAd(id: string): Promise<void> {
    const ad = this.getAdById(id);
    if (!ad) return Promise.resolve();
    // Owner-only, draft-only (AD_BOOK.md FR-A-3, AC 10); approver/admin roles don't widen this.
    if (!this.isOwnAd(ad)) {
      throw new Error('Only the ad owner can delete it.');
    }
    if (ad.status !== 'draft') {
      throw new Error('Only draft ads can be deleted.');
    }
    if (this.db) {
      // Delete the image first: storage.rules let the owner remove it only while the ad is a draft.
      const path = ad.imagePath;
      const db = this.db;
      return (async () => {
        if (path && this.storage) {
          await deleteAdImage(this.storage, path).catch((err) =>
            console.warn('Unable to delete ad image', path, err)
          );
        }
        await this.commit(deleteAdBatch(db, id));
      })();
    }
    this._ads.update((list) => list.filter((a) => a.id !== id));
    this.saveLocal();
    return Promise.resolve();
  }

  // --- Event Books ---

  private requireBookEditor(action: string): void {
    if (!this.canApprove()) {
      throw new Error(`Only Ad Book Approvers or Admins can ${action}.`);
    }
  }

  createBook(input: { title: string; eventName: string; eventDate?: string }): Promise<AdBook> {
    this.requireBookEditor('create event books');
    const now = new Date().toISOString();
    const actor = this.actor();
    const book: AdBook = {
      id: '',
      departmentId: 'dof',
      title: input.title.trim(),
      eventName: input.eventName.trim(),
      eventDate: input.eventDate || undefined,
      status: 'open',
      pageSize: 'letter',
      adIds: [],
      createdBy: actor.uid || 'approver',
      createdAt: now,
      updatedAt: now,
    };
    if (this.db) {
      const id = newBookId(this.db);
      return this.commit(createBookBatch(this.db, id, actor, input)).then(() => ({ ...book, id }));
    }
    const local = { ...book, id: newId('book') };
    this._adBooks.update((list) => [local, ...list]);
    this.saveLocal();
    return Promise.resolve(local);
  }

  updateBookStatus(bookId: string, status: AdBookStatus): Promise<void> {
    this.requireBookEditor('change a book status');
    if (this.db) return this.commit(setBookStatusBatch(this.db, bookId, status));
    this._adBooks.update((books) =>
      books.map((b) => (b.id === bookId ? { ...b, status, updatedAt: new Date().toISOString() } : b))
    );
    this.saveLocal();
    return Promise.resolve();
  }

  /** Places an approved ad at the end of an open book (AC 4). An ad sits in one book at a time. */
  addAdToBook(bookId: string, adId: string): Promise<void> {
    this.requireBookEditor('place ads in a book');
    const book = this.getBookById(bookId);
    const ad = this.getAdById(adId);
    if (!book || !ad) throw new Error('Book or Ad not found.');
    if (book.status === 'locked' || book.status === 'printed') {
      throw new Error('This book is locked and cannot accept new placements.');
    }
    if (book.status !== 'open') {
      throw new Error('Open the book before placing ads in it.');
    }
    if (ad.status !== 'approved') {
      throw new Error('Only approved ads can be placed into a book.');
    }
    if (this.isOwnAd(ad)) {
      throw new Error("You can't place your own ad in a book. A different approver must place it.");
    }
    if (book.adIds.includes(adId)) return Promise.resolve();
    const other = this.bookContaining(adId);
    if (other) {
      throw new Error(`This ad is already in "${other.title}". Remove it from that book first.`);
    }

    if (this.db) return this.commit(placeAdBatch(this.db, book, adId, ad.createdBy));
    const now = new Date().toISOString();
    this._adBooks.update((books) =>
      books.map((b) => (b.id === bookId ? { ...b, adIds: [...b.adIds, adId], updatedAt: now } : b))
    );
    this._ads.update((list) => list.map((a) => (a.id === adId ? { ...a, bookId } : a)));
    this.saveLocal();
    return Promise.resolve();
  }

  /** Approved ads the current user may place (issue #43: never their own). */
  canPlaceAd(ad: AdItem): boolean {
    return ad.status === 'approved' && this.canApprove() && !this.isOwnAd(ad);
  }

  removeAdFromBook(bookId: string, adId: string): Promise<void> {
    this.requireBookEditor('remove ads from a book');
    const book = this.getBookById(bookId);
    if (!book || !book.adIds.includes(adId)) return Promise.resolve();
    const ad = this.getAdById(adId);
    if (!ad) throw new Error('Ad not found.');
    if (this.isOwnAd(ad)) {
      throw new Error("You can't remove your own ad from a book. A different approver must do it.");
    }
    if (book.status === 'locked' || book.status === 'printed') {
      throw new Error('Reopen this book before removing ads from it.');
    }
    if (this.db) return this.commit(unplaceAdBatch(this.db, book, adId, ad.createdBy));
    const now = new Date().toISOString();
    this._adBooks.update((books) =>
      books.map((b) =>
        b.id === bookId ? { ...b, adIds: b.adIds.filter((id) => id !== adId), updatedAt: now } : b
      )
    );
    this._ads.update((list) =>
      list.map((a) => (a.id === adId && a.bookId === bookId ? { ...a, bookId: undefined } : a))
    );
    this.saveLocal();
    return Promise.resolve();
  }

  /**
   * #46: page order follows adIds, so nobody who owns an ad in a book may reorder that book
   * (firestore.rules checks book.ownerCounts).
   */
  ownsAdInBook(book: Pick<AdBook, 'adIds' | 'ownerCounts'>): boolean {
    const uid = this.auth.user()?.uid;
    if (!uid) return false;
    if ((book.ownerCounts?.[uid] ?? 0) > 0) return true;
    return book.adIds.some((id) => {
      const ad = this.getAdById(id);
      return !!ad && this.isOwnAd(ad);
    });
  }

  moveAdInBook(bookId: string, adId: string, direction: -1 | 1): Promise<void> {
    this.requireBookEditor('reorder a book');
    const book = this.getBookById(bookId);
    if (!book || book.status === 'locked' || book.status === 'printed') return Promise.resolve();
    if (this.ownsAdInBook(book)) {
      throw new Error(
        'You have your own ad in this book, so a different approver must set the page order.'
      );
    }
    const idx = book.adIds.indexOf(adId);
    const nextIdx = idx + direction;
    if (idx < 0 || nextIdx < 0 || nextIdx >= book.adIds.length) return Promise.resolve();

    const copy = [...book.adIds];
    [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];

    if (this.db) return this.commit(reorderBookBatch(this.db, bookId, copy));
    this._adBooks.update((books) =>
      books.map((b) =>
        b.id === bookId ? { ...b, adIds: copy, updatedAt: new Date().toISOString() } : b
      )
    );
    this.saveLocal();
    return Promise.resolve();
  }

  // --- Configurable Ad Sizes ---

  addAdSize(input: {
    label: string;
    widthIn: number;
    heightIn: number;
    slotsPerPage: number;
    layoutHint: AdSize['layoutHint'];
  }): Promise<void> {
    this.requireBookEditor('manage ad sizes');
    const id = input.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    const nextOrder = Math.max(0, ...this._adSizes().map((s) => s.sortOrder)) + 1;
    const size: AdSize = {
      id: id || `custom_${Date.now()}`,
      label: input.label.trim(),
      widthIn: input.widthIn,
      heightIn: input.heightIn,
      slotsPerPage: input.slotsPerPage,
      layoutHint: input.layoutHint,
      active: true,
      sortOrder: nextOrder,
    };
    if (this.db) return this.commit(setAdSizeBatch(this.db, size));
    this._adSizes.update((list) => [...list.filter((s) => s.id !== size.id), size]);
    this.saveLocal();
    return Promise.resolve();
  }

  toggleAdSizeActive(id: string): Promise<void> {
    this.requireBookEditor('manage ad sizes');
    const size = this.getSizeById(id);
    if (!size) return Promise.resolve();
    const updated = { ...size, active: !size.active };
    if (this.db) return this.commit(setAdSizeBatch(this.db, updated));
    this._adSizes.update((list) => list.map((s) => (s.id === id ? updated : s)));
    this.saveLocal();
    return Promise.resolve();
  }
}

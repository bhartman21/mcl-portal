import { computed, inject, Injectable, Injector, signal } from '@angular/core';
import {
  AdBook,
  AdBookStatus,
  AdItem,
  AdSize,
  AppNotification,
  AuditAction,
  AuditEntry,
  SEED_AD_BOOKS,
  SEED_AD_SIZES,
} from '../models/ad-book.model';
import { AD_REVIEWER_ROLES } from '../models/user.model';
import { AdminService } from './admin.service';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

const STORAGE_SIZES_KEY = 'mcl_portal_ad_sizes_v1';
const STORAGE_BOOKS_KEY = 'mcl_portal_ad_books_v1';
const STORAGE_ADS_KEY = 'mcl_portal_ads_v1';
const STORAGE_AUDITS_KEY = 'mcl_portal_audits_v1';

const ADMIN_ROLES = ['departmentAdmin', 'nationalAdmin'] as const;

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

@Injectable({ providedIn: 'root' })
export class AdBookService {
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly injector = inject(Injector);

  private readonly _adSizes = signal<AdSize[]>(this.loadJson(STORAGE_SIZES_KEY, SEED_AD_SIZES));
  private readonly _adBooks = signal<AdBook[]>(this.loadJson(STORAGE_BOOKS_KEY, SEED_AD_BOOKS));
  private readonly _ads = signal<AdItem[]>(this.loadJson(STORAGE_ADS_KEY, []));
  private readonly _audits = signal<AuditEntry[]>(this.loadJson(STORAGE_AUDITS_KEY, []));

  readonly adSizes = computed(() =>
    [...this._adSizes()].sort((a, b) => a.sortOrder - b.sortOrder)
  );
  readonly activeSizes = computed(() => this.adSizes().filter((s) => s.active));
  readonly adBooks = this._adBooks.asReadonly();
  readonly ads = this._ads.asReadonly();
  /** Audited Ad Book actions, newest first (admin activity page). */
  readonly audits = computed(() => [...this._audits()].sort((a, b) => b.at.localeCompare(a.at)));

  readonly myAds = computed(() => {
    const uid = this.auth.user()?.uid;
    if (!uid) return [];
    return this._ads().filter((a) => a.createdBy === uid);
  });

  readonly submittedQueue = computed(() =>
    this._ads().filter((a) => a.status === 'submitted')
  );

  readonly approvedAds = computed(() =>
    this._ads().filter((a) => a.status === 'approved')
  );

  readonly canApprove = computed(() =>
    this.auth.hasAnyRole(AD_REVIEWER_ROLES)
  );

  /** Books the current user may see: members see open books only; approvers/admins see all. */
  readonly visibleBooks = computed(() =>
    this.canApprove() ? this._adBooks() : this._adBooks().filter((b) => b.status === 'open')
  );

  /** Department or national admin (AD_BOOK.md: self-approval, undo review). */
  readonly isDeptOrHigherAdmin = computed(() => this.auth.hasAnyRole([...ADMIN_ROLES]));

  /** Approved or rejected ads an admin may undo (AC 13). */
  readonly reviewedAds = computed(() =>
    this._ads().filter((a) => a.status === 'approved' || a.status === 'rejected')
  );

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

  private loadJson<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      // Ignore corrupt local storage
    }
    return fallback;
  }

  private saveSizes(): void {
    localStorage.setItem(STORAGE_SIZES_KEY, JSON.stringify(this._adSizes()));
  }

  private saveBooks(): void {
    localStorage.setItem(STORAGE_BOOKS_KEY, JSON.stringify(this._adBooks()));
  }

  private saveAds(): void {
    localStorage.setItem(STORAGE_ADS_KEY, JSON.stringify(this._ads()));
  }

  private saveAudits(): void {
    localStorage.setItem(STORAGE_AUDITS_KEY, JSON.stringify(this._audits()));
  }

  private actorName(): string {
    const u = this.auth.user();
    return u?.displayName || u?.email || 'Admin';
  }

  private writeAudit(
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
      actorUid: this.auth.user()?.uid ?? '',
      actorName: this.actorName(),
      at,
      reason,
      fromStatus: ad.status,
      toStatus,
    };
    this._audits.update((list) => [entry, ...list]);
    this.saveAudits();
    return entry;
  }

  /** Every other active department/national admin (self-approval notification recipients). */
  private otherAdminUids(): string[] {
    const me = this.auth.user()?.uid;
    const users = this.injector.get(AdminService).users();
    return users
      .filter(
        (u) =>
          u.uid !== me &&
          u.status === 'active' &&
          u.roles.some((r) => (ADMIN_ROLES as readonly string[]).includes(r))
      )
      .map((u) => u.uid);
  }

  private replaceAd(updated: AdItem): void {
    this._ads.update((list) => list.map((a) => (a.id === updated.id ? updated : a)));
    this.saveAds();
  }

  getSizeById(id: string | undefined): AdSize | undefined {
    if (!id) return undefined;
    return this._adSizes().find((s) => s.id === id);
  }

  getAdById(id: string | undefined): AdItem | undefined {
    if (!id) return undefined;
    return this._ads().find((a) => a.id === id);
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

  createAd(input: {
    title: string;
    sizeId: string;
    bookId?: string;
    companyName?: string;
    imageUrl?: string;
    imageName?: string;
    fit: 'cover' | 'contain';
    position: { x: number; y: number };
  }): AdItem {
    const user = this.auth.user();
    if (!user || user.status !== 'active') {
      throw new Error('Active member authentication is required to create an ad.');
    }

    const now = new Date().toISOString();
    const id = `ad-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const ad: AdItem = {
      id,
      departmentId: 'dof',
      bookId: input.bookId || undefined,
      sizeId: input.sizeId,
      title: input.title.trim(),
      companyName: input.companyName?.trim() || undefined,
      status: 'draft',
      createdBy: user.uid,
      createdByName: user.displayName || user.email,
      createdByType: 'member',
      imageUrl: input.imageUrl,
      imageName: input.imageName,
      fit: input.fit,
      position: { ...input.position },
      createdAt: now,
      updatedAt: now,
    };

    this._ads.update((list) => [ad, ...list]);
    this.saveAds();
    return ad;
  }

  updateAd(
    id: string,
    patch: Partial<
      Pick<
        AdItem,
        'title' | 'sizeId' | 'bookId' | 'companyName' | 'imageUrl' | 'imageName' | 'fit' | 'position'
      >
    >
  ): AdItem {
    const existing = this.getAdById(id);
    if (!existing) throw new Error('Ad not found.');

    if (existing.status === 'approved' || existing.status === 'submitted') {
      throw new Error('Recall the ad to draft before editing.');
    }

    const updated: AdItem = {
      ...existing,
      ...patch,
      status: existing.status === 'rejected' ? 'draft' : existing.status,
      updatedAt: new Date().toISOString(),
    };

    this._ads.update((list) => list.map((a) => (a.id === id ? updated : a)));
    this.saveAds();
    return updated;
  }

  submitAd(id: string): AdItem {
    const ad = this.getAdById(id);
    if (!ad) throw new Error('Ad not found.');
    if (!ad.title.trim()) throw new Error('Ad title is required before submitting.');
    if (!ad.imageUrl) throw new Error('Please upload an ad image before submitting.');

    const size = this.getSizeById(ad.sizeId);
    if (!size || !size.active) {
      throw new Error('Please select an active ad size.');
    }

    const now = new Date().toISOString();
    const updated: AdItem = {
      ...ad,
      status: 'submitted',
      rejectionNotes: undefined,
      submittedAt: now,
      updatedAt: now,
    };

    this._ads.update((list) => list.map((a) => (a.id === id ? updated : a)));
    this.saveAds();
    return updated;
  }

  /**
   * Owner withdraws a submitted ad back to draft (AD_BOOK.md FR-A-3, AC 10). Only `submitted`
   * ads can be withdrawn, only by their owner; the submission attempt is not refunded.
   */
  recallToDraft(id: string): AdItem {
    const ad = this.getAdById(id);
    if (!ad) throw new Error('Ad not found.');
    if (!this.isOwnAd(ad)) throw new Error('Only the ad owner can withdraw it.');
    if (ad.status !== 'submitted') {
      throw new Error('Only submitted ads can be withdrawn to draft.');
    }

    const updated: AdItem = {
      ...ad,
      status: 'draft',
      updatedAt: new Date().toISOString(),
    };
    this.replaceAd(updated);
    return updated;
  }

  /**
   * Approve a submitted ad. Approvers and admins approve other members' ads. An approver can
   * never approve their own ad; a department or national admin may self-approve only with a
   * reason, which is audited and notifies every other admin (AD_BOOK.md AC 2, 12).
   */
  approveAd(id: string, opts: { selfApprovalReason?: string } = {}): AdItem {
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
    const user = this.auth.user();
    const updated: AdItem = {
      ...ad,
      status: 'approved',
      rejectionNotes: undefined,
      reviewedBy: user?.uid,
      reviewedByName: this.actorName(),
      reviewedAt: now,
      selfApproved: own ? true : undefined,
      selfApprovalReason: own ? reason : undefined,
      updatedAt: now,
    };

    if (own) {
      const audit = this.writeAudit('selfApprove', ad, reason, 'approved', now);
      updated.lastAuditId = audit.id;
      const notes: AppNotification[] = this.otherAdminUids().map((recipientUid) => ({
        id: newId('notif'),
        recipientUid,
        type: 'adSelfApproved',
        adId: ad.id,
        adTitle: ad.title,
        actorUid: user?.uid ?? '',
        actorName: this.actorName(),
        reason,
        createdAt: now,
        read: false,
      }));
      this.notifications.add(notes);
    }

    this.replaceAd(updated);
    return updated;
  }

  rejectAd(id: string, notes: string): AdItem {
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
    const updated: AdItem = {
      ...ad,
      status: 'rejected',
      rejectionNotes: cleanNotes,
      reviewedBy: this.auth.user()?.uid,
      reviewedByName: this.actorName(),
      reviewedAt: now,
      updatedAt: now,
    };

    this.replaceAd(updated);
    return updated;
  }

  /**
   * Admin undo of an approval or rejection (AD_BOOK.md FR-A-3, AC 13): required reason, ad
   * returns to submitted, submissionCount unchanged, audited. An approved ad in a locked or
   * printed book must be removed from that book first; it is removed from open books.
   */
  undoReview(id: string, reason: string): AdItem {
    if (!this.isDeptOrHigherAdmin()) {
      throw new Error('Only a department or national admin can undo a review.');
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

    const now = new Date().toISOString();
    const audit = this.writeAudit('undoReview', ad, cleanReason, 'submitted', now);
    const updated: AdItem = {
      ...ad,
      status: 'submitted',
      reviewedBy: undefined,
      reviewedByName: undefined,
      reviewedAt: undefined,
      rejectionNotes: undefined,
      selfApproved: undefined,
      selfApprovalReason: undefined,
      lastAuditId: audit.id,
      updatedAt: now,
    };

    this._adBooks.update((books) =>
      books.map((b) =>
        b.adIds.includes(id) ? { ...b, adIds: b.adIds.filter((x) => x !== id), updatedAt: now } : b
      )
    );
    this.saveBooks();
    this.replaceAd(updated);
    return updated;
  }

  deleteAd(id: string): void {
    const ad = this.getAdById(id);
    if (!ad) return;
    if (ad.status !== 'draft' && !this.canApprove()) {
      throw new Error('Only draft ads can be deleted.');
    }
    this._ads.update((list) => list.filter((a) => a.id !== id));
    this.saveAds();
  }

  // --- Event Books ---

  createBook(input: { title: string; eventName: string; eventDate?: string }): AdBook {
    if (!this.canApprove()) {
      throw new Error('Only Ad Book Approvers or Admins can create event books.');
    }
    const now = new Date().toISOString();
    const book: AdBook = {
      id: `book-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      departmentId: 'dof',
      title: input.title.trim(),
      eventName: input.eventName.trim(),
      eventDate: input.eventDate || undefined,
      status: 'open',
      pageSize: 'letter',
      adIds: [],
      createdBy: this.auth.user()?.uid || 'approver',
      createdAt: now,
      updatedAt: now,
    };
    this._adBooks.update((list) => [book, ...list]);
    this.saveBooks();
    return book;
  }

  updateBookStatus(bookId: string, status: AdBookStatus): void {
    if (!this.canApprove()) return;
    this._adBooks.update((books) =>
      books.map((b) =>
        b.id === bookId ? { ...b, status, updatedAt: new Date().toISOString() } : b
      )
    );
    this.saveBooks();
  }

  addAdToBook(bookId: string, adId: string): void {
    if (!this.canApprove()) {
      throw new Error('Only Ad Book Approvers or Admins can place ads in a book.');
    }
    const book = this.getBookById(bookId);
    const ad = this.getAdById(adId);
    if (!book || !ad) throw new Error('Book or Ad not found.');
    if (book.status === 'locked' || book.status === 'printed') {
      throw new Error('This book is locked and cannot accept new placements.');
    }
    if (ad.status !== 'approved') {
      throw new Error('Only approved ads can be placed into a book.');
    }
    if (book.adIds.includes(adId)) return;

    this._adBooks.update((books) =>
      books.map((b) =>
        b.id === bookId
          ? { ...b, adIds: [...b.adIds, adId], updatedAt: new Date().toISOString() }
          : b
      )
    );
    this.saveBooks();
  }

  removeAdFromBook(bookId: string, adId: string): void {
    if (!this.canApprove()) return;
    const book = this.getBookById(bookId);
    if (!book || book.status === 'locked' || book.status === 'printed') return;
    this._adBooks.update((books) =>
      books.map((b) =>
        b.id === bookId
          ? {
              ...b,
              adIds: b.adIds.filter((id) => id !== adId),
              updatedAt: new Date().toISOString(),
            }
          : b
      )
    );
    this.saveBooks();
  }

  moveAdInBook(bookId: string, adId: string, direction: -1 | 1): void {
    if (!this.canApprove()) return;
    const book = this.getBookById(bookId);
    if (!book || book.status === 'locked' || book.status === 'printed') return;
    const idx = book.adIds.indexOf(adId);
    const nextIdx = idx + direction;
    if (idx < 0 || nextIdx < 0 || nextIdx >= book.adIds.length) return;

    const copy = [...book.adIds];
    [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];

    this._adBooks.update((books) =>
      books.map((b) =>
        b.id === bookId ? { ...b, adIds: copy, updatedAt: new Date().toISOString() } : b
      )
    );
    this.saveBooks();
  }

  // --- Configurable Ad Sizes ---

  addAdSize(input: {
    label: string;
    widthIn: number;
    heightIn: number;
    slotsPerPage: number;
    layoutHint: AdSize['layoutHint'];
  }): void {
    if (!this.canApprove()) return;
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
    this._adSizes.update((list) => [...list.filter((s) => s.id !== size.id), size]);
    this.saveSizes();
  }

  toggleAdSizeActive(id: string): void {
    if (!this.canApprove()) return;
    this._adSizes.update((list) =>
      list.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    );
    this.saveSizes();
  }
}


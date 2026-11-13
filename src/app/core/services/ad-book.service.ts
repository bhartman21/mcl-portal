import { computed, inject, Injectable, signal } from '@angular/core';
import {
  AdBook,
  AdBookStatus,
  AdItem,
  AdSize,
  SEED_AD_BOOKS,
  SEED_AD_SIZES,
} from '../models/ad-book.model';
import { AuthService } from './auth.service';

const STORAGE_SIZES_KEY = 'mcl_portal_ad_sizes_v1';
const STORAGE_BOOKS_KEY = 'mcl_portal_ad_books_v1';
const STORAGE_ADS_KEY = 'mcl_portal_ads_v1';

@Injectable({ providedIn: 'root' })
export class AdBookService {
  private readonly auth = inject(AuthService);

  private readonly _adSizes = signal<AdSize[]>(this.loadJson(STORAGE_SIZES_KEY, SEED_AD_SIZES));
  private readonly _adBooks = signal<AdBook[]>(this.loadJson(STORAGE_BOOKS_KEY, SEED_AD_BOOKS));
  private readonly _ads = signal<AdItem[]>(this.loadJson(STORAGE_ADS_KEY, []));

  readonly adSizes = computed(() =>
    [...this._adSizes()].sort((a, b) => a.sortOrder - b.sortOrder)
  );
  readonly activeSizes = computed(() => this.adSizes().filter((s) => s.active));
  readonly adBooks = this._adBooks.asReadonly();
  readonly ads = this._ads.asReadonly();

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
    this.auth.hasAnyRole(['adBookApprover', 'departmentAdmin', 'nationalAdmin'])
  );

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

  recallToDraft(id: string): AdItem {
    const ad = this.getAdById(id);
    if (!ad) throw new Error('Ad not found.');

    const updated: AdItem = {
      ...ad,
      status: 'draft',
      reviewedBy: undefined,
      reviewedAt: undefined,
      updatedAt: new Date().toISOString(),
    };

    // Remove from any open books since approval was cleared
    this._adBooks.update((books) =>
      books.map((b) =>
        b.status === 'locked' || b.status === 'printed'
          ? b
          : { ...b, adIds: b.adIds.filter((x) => x !== id) }
      )
    );
    this.saveBooks();

    this._ads.update((list) => list.map((a) => (a.id === id ? updated : a)));
    this.saveAds();
    return updated;
  }

  approveAd(id: string): AdItem {
    if (!this.canApprove()) {
      throw new Error('Only Ad Book Approvers or Admins can approve ads.');
    }
    const ad = this.getAdById(id);
    if (!ad) throw new Error('Ad not found.');

    const now = new Date().toISOString();
    const updated: AdItem = {
      ...ad,
      status: 'approved',
      rejectionNotes: undefined,
      reviewedBy: this.auth.user()?.displayName || this.auth.user()?.email || 'Approver',
      reviewedAt: now,
      updatedAt: now,
    };

    this._ads.update((list) => list.map((a) => (a.id === id ? updated : a)));
    this.saveAds();
    return updated;
  }

  rejectAd(id: string, notes: string): AdItem {
    if (!this.canApprove()) {
      throw new Error('Only Ad Book Approvers or Admins can reject ads.');
    }
    const cleanNotes = notes.trim();
    if (cleanNotes.length < 5) {
      throw new Error('Rejection notes must be at least 5 characters.');
    }

    const ad = this.getAdById(id);
    if (!ad) throw new Error('Ad not found.');

    const now = new Date().toISOString();
    const updated: AdItem = {
      ...ad,
      status: 'rejected',
      rejectionNotes: cleanNotes,
      reviewedBy: this.auth.user()?.displayName || this.auth.user()?.email || 'Approver',
      reviewedAt: now,
      updatedAt: now,
    };

    this._ads.update((list) => list.map((a) => (a.id === id ? updated : a)));
    this.saveAds();
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
      id: `book-${Date.now()}`,
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


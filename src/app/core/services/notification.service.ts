import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { collection, onSnapshot, query, Unsubscribe, where } from 'firebase/firestore';
import { markNotificationReadBatch, notificationFromDoc } from '../ad-book/ad-book-firestore';
import { AppNotification } from '../models/ad-book.model';
import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';

const STORAGE_NOTIFICATIONS_KEY = 'mcl_portal_notifications_v1';

/**
 * In-app notifications (`notifications/{id}`; AD_BOOK.md AC 2, 12): header badge + admin list.
 * No email. With Firebase they live in Firestore (written by AdBookService in the self-approval
 * batch; only the recipient reads them or marks them read). Local demo mode keeps them in
 * localStorage.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FirebaseService);
  private readonly db = this.fb.isConfigured ? this.fb.firestore : null;
  private readonly _all = signal<AppNotification[]>(this.db ? [] : this.load());
  private unsubscribe: Unsubscribe | null = null;

  readonly myNotifications = computed(() => {
    const uid = this.auth.user()?.uid;
    if (!uid) return [];
    return this._all()
      .filter((n) => n.recipientUid === uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  readonly unreadCount = computed(() => this.myNotifications().filter((n) => !n.read).length);

  constructor() {
    const db = this.db;
    if (!db) return;
    const key = computed(() => {
      const u = this.auth.user();
      return u?.status === 'active' ? u.uid : '';
    });
    effect(() => {
      const uid = key();
      untracked(() => {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this._all.set([]);
        if (!uid) return;
        this.unsubscribe = onSnapshot(
          query(collection(db, 'notifications'), where('recipientUid', '==', uid)),
          (snap) =>
            this._all.set(
              snap.docs.map((d) =>
                notificationFromDoc(d.id, d.data({ serverTimestamps: 'estimate' }))
              )
            ),
          (err) => console.error('Unable to load notifications', err)
        );
      });
    });
  }

  private load(): AppNotification[] {
    try {
      const raw = localStorage.getItem(STORAGE_NOTIFICATIONS_KEY);
      if (raw) return JSON.parse(raw) as AppNotification[];
    } catch {
      // Ignore corrupt local storage
    }
    return [];
  }

  private save(): void {
    if (this.db) return;
    localStorage.setItem(STORAGE_NOTIFICATIONS_KEY, JSON.stringify(this._all()));
  }

  /**
   * Local demo mode: adds notifications (one per recipient) on admin self-approval. With Firebase,
   * AdBookService writes them in the same batch as the approval, so this is a no-op.
   */
  add(notifications: AppNotification[]): void {
    if (this.db || notifications.length === 0) return;
    this._all.update((list) => [...notifications, ...list]);
    this.save();
  }

  /** Only the recipient can mark their own notification read. */
  markRead(id: string): void {
    const uid = this.auth.user()?.uid;
    const target = this._all().find((n) => n.id === id);
    if (!target || target.recipientUid !== uid || target.read) return;
    if (this.db) {
      markNotificationReadBatch(this.db, id)
        .commit()
        .catch((err) => console.error('Unable to mark notification read', err));
      return;
    }
    const now = new Date().toISOString();
    this._all.update((list) => list.map((n) => (n.id === id ? { ...n, read: true, readAt: now } : n)));
    this.save();
  }

  markAllRead(): void {
    for (const n of this.myNotifications()) {
      if (!n.read) this.markRead(n.id);
    }
  }
}

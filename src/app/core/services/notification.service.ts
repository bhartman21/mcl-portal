import { computed, inject, Injectable, signal } from '@angular/core';
import { AppNotification } from '../models/ad-book.model';
import { AuthService } from './auth.service';

const STORAGE_NOTIFICATIONS_KEY = 'mcl_portal_notifications_v1';

/**
 * In-app notifications (`notifications/{id}`; AD_BOOK.md AC 2, 12): header badge + admin list.
 * No email. Stored in localStorage alongside Ad Book data until Phase 1 moves Ad Book to
 * Firestore (issue #4); firestore.rules already restricts the Firestore collection.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly auth = inject(AuthService);
  private readonly _all = signal<AppNotification[]>(this.load());

  readonly myNotifications = computed(() => {
    const uid = this.auth.user()?.uid;
    if (!uid) return [];
    return this._all()
      .filter((n) => n.recipientUid === uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  readonly unreadCount = computed(() => this.myNotifications().filter((n) => !n.read).length);

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
    localStorage.setItem(STORAGE_NOTIFICATIONS_KEY, JSON.stringify(this._all()));
  }

  /** Adds notifications (one per recipient); called by AdBookService on admin self-approval. */
  add(notifications: AppNotification[]): void {
    if (notifications.length === 0) return;
    this._all.update((list) => [...notifications, ...list]);
    this.save();
  }

  /** Only the recipient can mark their own notification read. */
  markRead(id: string): void {
    const uid = this.auth.user()?.uid;
    const now = new Date().toISOString();
    this._all.update((list) =>
      list.map((n) => (n.id === id && n.recipientUid === uid && !n.read ? { ...n, read: true, readAt: now } : n))
    );
    this.save();
  }

  markAllRead(): void {
    for (const n of this.myNotifications()) {
      if (!n.read) this.markRead(n.id);
    }
  }
}

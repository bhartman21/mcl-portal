import { TestBed } from '@angular/core/testing';
import { FakeAuth } from '../../../testing/fake-auth';
import { AppNotification } from '../models/ad-book.model';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let auth: FakeAuth;
  let service: NotificationService;
  const n = (id: string, recipientUid: string): AppNotification => ({
    id,
    recipientUid,
    type: 'adSelfApproved',
    adId: 'ad1',
    actorUid: 'admin',
    reason: 'deadline',
    createdAt: `2026-11-14T0${id.length}:00:00Z`,
    read: false,
  });

  beforeEach(() => {
    localStorage.clear();
    auth = new FakeAuth();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: auth }] });
    service = TestBed.inject(NotificationService);
    service.add([n('a', 'admin2'), n('bb', 'admin2'), n('c', 'natAdmin')]);
  });

  it('shows each user only their own notifications and unread count', () => {
    auth.signInAs('admin2');
    expect(service.myNotifications().map((x) => x.id)).toEqual(['bb', 'a']);
    expect(service.unreadCount()).toBe(2);
    auth.signInAs('alice');
    expect(service.unreadCount()).toBe(0);
  });

  it('only the recipient can mark a notification read', () => {
    auth.signInAs('natAdmin');
    service.markRead('a');
    auth.signInAs('admin2');
    expect(service.unreadCount()).toBe(2);
    service.markRead('a');
    expect(service.unreadCount()).toBe(1);
    service.markAllRead();
    expect(service.unreadCount()).toBe(0);
  });
});

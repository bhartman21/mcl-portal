import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FakeAuth, profile } from '../../../testing/fake-auth';
import { UserProfile } from '../models/user.model';
import { AdBookService } from './ad-book.service';
import { AdminService } from './admin.service';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

describe('AdBookService review rules (#3)', () => {
  let auth: FakeAuth;
  let service: AdBookService;
  let notifications: NotificationService;
  const users = signal<UserProfile[]>([]);

  function createAd(owner: string): string {
    auth.signInAs(owner, auth.user()?.roles ?? ['member']);
    const ad = service.createAd({
      title: 'Semper Fi Plumbing',
      sizeId: 'full',
      imageUrl: 'data:image/png;base64,AAAA',
      fit: 'cover',
      position: { x: 50, y: 50 },
    });
    service.submitAd(ad.id);
    return ad.id;
  }

  beforeEach(() => {
    localStorage.clear();
    auth = new FakeAuth();
    users.set([
      profile('admin', ['member', 'departmentAdmin']),
      profile('admin2', ['member', 'departmentAdmin']),
      profile('natAdmin', ['member', 'nationalAdmin']),
      profile('approver', ['member', 'adBookApprover']),
      profile('alice'),
    ]);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: AdminService, useValue: { users } },
      ],
    });
    service = TestBed.inject(AdBookService);
    notifications = TestBed.inject(NotificationService);
  });

  it('an approver approves and rejects other members\u2019 ads, recording their uid', () => {
    auth.signInAs('alice');
    const id = createAd('alice');
    auth.signInAs('approver', ['member', 'adBookApprover']);
    const approved = service.approveAd(id);
    expect(approved.status).toBe('approved');
    expect(approved.reviewedBy).toBe('approver');
    expect(approved.selfApproved).toBeUndefined();
  });

  it('an approver cannot approve or reject their own ad', () => {
    auth.signInAs('approver', ['member', 'adBookApprover']);
    const id = createAd('approver');
    const ad = service.getAdById(id)!;
    expect(service.canReviewAd(ad)).toBe(false);
    expect(service.canSelfApprove(ad)).toBe(false);
    expect(() => service.approveAd(id)).toThrow(/different approver/);
    expect(() => service.approveAd(id, { selfApprovalReason: 'please' })).toThrow(/different approver/);
    expect(() => service.rejectAd(id, 'Logo too low-res')).toThrow(/Withdraw/);
    expect(service.getAdById(id)!.status).toBe('submitted');
  });

  it('an admin self-approves only with a reason; it is audited and notifies every other admin', () => {
    auth.signInAs('admin', ['member', 'departmentAdmin']);
    const id = createAd('admin');
    expect(service.canSelfApprove(service.getAdById(id)!)).toBe(true);
    expect(() => service.approveAd(id)).toThrow(/reason is required/);
    expect(() => service.approveAd(id, { selfApprovalReason: '   ' })).toThrow(/reason is required/);

    const ad = service.approveAd(id, { selfApprovalReason: 'No other admin before deadline' });
    expect(ad.selfApproved).toBe(true);
    expect(ad.selfApprovalReason).toBe('No other admin before deadline');

    const audit = service.audits()[0];
    expect(audit).toMatchObject({ action: 'selfApprove', entityId: id, actorUid: 'admin' });
    expect(ad.lastAuditId).toBe(audit.id);

    for (const uid of ['admin2', 'natAdmin']) {
      auth.signInAs(uid, ['member', 'departmentAdmin']);
      expect(notifications.unreadCount()).toBe(1);
      expect(notifications.myNotifications()[0]).toMatchObject({ adId: id, actorUid: 'admin', read: false });
    }
    for (const uid of ['admin', 'approver', 'alice']) {
      auth.signInAs(uid);
      expect(notifications.myNotifications().length).toBe(0);
    }
  });

  it('nobody self-rejects, admins included', () => {
    auth.signInAs('admin', ['member', 'departmentAdmin']);
    const id = createAd('admin');
    expect(() => service.rejectAd(id, 'Logo too low-res')).toThrow(/Withdraw/);
  });

  it('a normal approval by another admin is not a self-approval and notifies nobody', () => {
    auth.signInAs('alice');
    const id = createAd('alice');
    auth.signInAs('admin', ['member', 'departmentAdmin']);
    service.approveAd(id);
    expect(service.audits().length).toBe(0);
    auth.signInAs('admin2', ['member', 'departmentAdmin']);
    expect(notifications.unreadCount()).toBe(0);
  });

  describe('undo review (AC 13)', () => {
    let id: string;
    beforeEach(() => {
      auth.signInAs('alice');
      id = createAd('alice');
      auth.signInAs('approver', ['member', 'adBookApprover']);
      service.approveAd(id);
    });

    it('requires a department or national admin and a reason', () => {
      expect(() => service.undoReview(id, 'oops')).toThrow(/department or national admin/);
      auth.signInAs('admin', ['member', 'departmentAdmin']);
      expect(() => service.undoReview(id, '  ')).toThrow(/reason is required/);
    });

    it('returns the ad to submitted, clears review fields, and is audited', () => {
      auth.signInAs('admin', ['member', 'departmentAdmin']);
      const ad = service.undoReview(id, 'Approved the wrong version');
      expect(ad.status).toBe('submitted');
      expect(ad.reviewedBy).toBeUndefined();
      expect(service.audits()[0]).toMatchObject({
        action: 'undoReview',
        reason: 'Approved the wrong version',
        fromStatus: 'approved',
        toStatus: 'submitted',
      });
    });

    it('also undoes a rejection', () => {
      auth.signInAs('alice');
      const id2 = createAd('alice');
      auth.signInAs('approver', ['member', 'adBookApprover']);
      service.rejectAd(id2, 'Logo too low-res');
      auth.signInAs('natAdmin', ['member', 'nationalAdmin']);
      const ad = service.undoReview(id2, 'Notes were for another ad');
      expect(ad.status).toBe('submitted');
      expect(ad.rejectionNotes).toBeUndefined();
    });

    it('is blocked while the ad is in a locked book, and removes it from open books', () => {
      auth.signInAs('admin', ['member', 'departmentAdmin']);
      const book = service.adBooks()[0];
      service.addAdToBook(book.id, id);
      service.updateBookStatus(book.id, 'locked');
      expect(() => service.undoReview(id, 'reason')).toThrow(/locked book/);

      service.updateBookStatus(book.id, 'open');
      service.undoReview(id, 'reason');
      expect(service.getBookById(book.id)!.adIds).not.toContain(id);
    });
  });
});

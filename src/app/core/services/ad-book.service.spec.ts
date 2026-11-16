import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FakeAuth, profile } from '../../../testing/fake-auth';
import { UserProfile } from '../models/user.model';
import { AdBookService } from './ad-book.service';
import { AdminService } from './admin.service';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

describe('AdBookService review rules (#3)', async () => {
  let auth: FakeAuth;
  let service: AdBookService;
  let notifications: NotificationService;
  const users = signal<UserProfile[]>([]);

  async function createAd(owner: string): Promise<string> {
    auth.signInAs(owner, auth.user()?.roles ?? ['member']);
    const ad = await service.createAd({
      title: 'Semper Fi Plumbing',
      sizeId: 'full',
      imageUrl: 'data:image/png;base64,AAAA',
      fit: 'cover',
      position: { x: 50, y: 50 },
    });
    await service.submitAd(ad.id);
    return ad.id;
  }

  beforeEach(() => {
    localStorage.clear();
    auth = new FakeAuth();
    users.set([
      profile('admin', ['member', 'departmentAdmin']),
      profile('admin2', ['member', 'departmentAdmin']),
      profile('natAdmin', ['member', 'nationalAdmin']),
      profile('site', ['member', 'siteAdmin']),
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

  it('an approver approves and rejects other members\u2019 ads, recording their uid', async () => {
    auth.signInAs('alice');
    const id = await createAd('alice');
    auth.signInAs('approver', ['member', 'adBookApprover']);
    const approved = await service.approveAd(id);
    expect(approved.status).toBe('approved');
    expect(approved.reviewedBy).toBe('approver');
    expect(approved.selfApproved).toBeUndefined();
  });

  it('an approver cannot approve or reject their own ad', async () => {
    auth.signInAs('approver', ['member', 'adBookApprover']);
    const id = await createAd('approver');
    const ad = service.getAdById(id)!;
    expect(service.canReviewAd(ad)).toBe(false);
    expect(service.canSelfApprove(ad)).toBe(false);
    expect(() => service.approveAd(id)).toThrow(/different approver/);
    expect(() => service.approveAd(id, { selfApprovalReason: 'please' })).toThrow(/different approver/);
    expect(() => service.rejectAd(id, 'Logo too low-res')).toThrow(/Withdraw/);
    expect(service.getAdById(id)!.status).toBe('submitted');
  });

  it('an admin self-approves only with a reason; it is audited and notifies every other admin', async () => {
    auth.signInAs('admin', ['member', 'departmentAdmin']);
    const id = await createAd('admin');
    expect(service.canSelfApprove(service.getAdById(id)!)).toBe(true);
    expect(() => service.approveAd(id)).toThrow(/reason is required/);
    expect(() => service.approveAd(id, { selfApprovalReason: '   ' })).toThrow(/reason is required/);

    const ad = await service.approveAd(id, { selfApprovalReason: 'No other admin before deadline' });
    expect(ad.selfApproved).toBe(true);
    expect(ad.selfApprovalReason).toBe('No other admin before deadline');

    const audit = await service.audits()[0];
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

  it('nobody self-rejects, admins included', async () => {
    auth.signInAs('admin', ['member', 'departmentAdmin']);
    const id = await createAd('admin');
    expect(() => service.rejectAd(id, 'Logo too low-res')).toThrow(/Withdraw/);
  });

  it('a normal approval by another admin is not a self-approval and notifies nobody', async () => {
    auth.signInAs('alice');
    const id = await createAd('alice');
    auth.signInAs('admin', ['member', 'departmentAdmin']);
    service.approveAd(id);
    expect(service.audits().length).toBe(0);
    auth.signInAs('admin2', ['member', 'departmentAdmin']);
    expect(notifications.unreadCount()).toBe(0);
  });

  describe('undo review (AC 13)', async () => {
    let id: string;
    beforeEach(async () => {
      auth.signInAs('alice');
      id = await createAd('alice');
      auth.signInAs('approver', ['member', 'adBookApprover']);
      service.approveAd(id);
    });

    it('requires a department, national, or site admin and a reason', async () => {
      expect(() => service.undoReview(id, 'oops')).toThrow(/department, national, or site admin/);
      auth.signInAs('admin', ['member', 'departmentAdmin']);
      expect(() => service.undoReview(id, '  ')).toThrow(/reason is required/);
    });

    it('returns the ad to submitted, clears review fields, and is audited', async () => {
      auth.signInAs('admin', ['member', 'departmentAdmin']);
      const ad = await service.undoReview(id, 'Approved the wrong version');
      expect(ad.status).toBe('submitted');
      expect(ad.reviewedBy).toBeUndefined();
      expect(service.audits()[0]).toMatchObject({
        action: 'undoReview',
        reason: 'Approved the wrong version',
        fromStatus: 'approved',
        toStatus: 'submitted',
      });
    });

    it('also undoes a rejection', async () => {
      auth.signInAs('alice');
      const id2 = await createAd('alice');
      auth.signInAs('approver', ['member', 'adBookApprover']);
      service.rejectAd(id2, 'Logo too low-res');
      auth.signInAs('natAdmin', ['member', 'nationalAdmin']);
      const ad = await service.undoReview(id2, 'Notes were for another ad');
      expect(ad.status).toBe('submitted');
      expect(ad.rejectionNotes).toBeUndefined();
    });

    it('is blocked while the ad is in a locked book, and removes it from open books', async () => {
      auth.signInAs('admin', ['member', 'departmentAdmin']);
      const book = service.adBooks()[0];
      await service.addAdToBook(book.id, id);
      expect(service.getAdById(id)!.bookId).toBe(book.id);
      await service.updateBookStatus(book.id, 'locked');
      expect(() => service.undoReview(id, 'reason')).toThrow(/locked book/);

      await service.updateBookStatus(book.id, 'open');
      await service.undoReview(id, 'reason');
      expect(service.getBookById(book.id)!.adIds).not.toContain(id);
      expect(service.getAdById(id)!.bookId).toBeUndefined();
    });
  });

  describe('withdraw (#6)', async () => {
    it('the owner withdraws a submitted ad to draft without refunding anything', async () => {
      auth.signInAs('alice');
      const id = await createAd('alice');
      const before = service.getAdById(id)!;
      const ad = await service.recallToDraft(id);
      expect(ad.status).toBe('draft');
      expect(ad.submittedAt).toBe(before.submittedAt);
    });

    it('only submitted ads, and only by the owner', async () => {
      auth.signInAs('alice');
      const id = await createAd('alice');
      auth.signInAs('approver', ['member', 'adBookApprover']);
      expect(() => service.recallToDraft(id)).toThrow(/owner/);
      service.approveAd(id);
      auth.signInAs('alice');
      expect(() => service.recallToDraft(id)).toThrow(/Only submitted/);
    });
  });

  describe('submission limit and lock reset (#5)', async () => {
    function cycle(id: string, times: number): void {
      for (let i = 0; i < times; i++) {
        auth.signInAs('approver', ['member', 'adBookApprover']);
        service.rejectAd(id, 'Please fix the logo');
        auth.signInAs('alice');
        if (i < times - 1) service.submitAd(id);
      }
    }

    it('new ads start at 0 of 3 and each submit adds one', async () => {
      auth.signInAs('alice');
      const id = await createAd('alice');
      const ad = service.getAdById(id)!;
      expect(ad.submissionCount).toBe(1);
      expect(ad.maxSubmissions).toBe(3);
      expect(ad.locked).toBe(false);
    });

    it('locks after the 3rd rejection and blocks a 4th submission and edits', async () => {
      auth.signInAs('alice');
      const id = await createAd('alice');
      cycle(id, 2);
      expect(service.getAdById(id)!.locked).toBe(false);
      service.submitAd(id);
      expect(service.getAdById(id)!.submissionCount).toBe(3);
      auth.signInAs('approver', ['member', 'adBookApprover']);
      service.rejectAd(id, 'Still blurry');
      auth.signInAs('alice');
      const ad = service.getAdById(id)!;
      expect(ad.locked).toBe(true);
      expect(service.canSubmit(ad)).toBe(false);
      expect(() => service.submitAd(id)).toThrow(/Submission limit reached/);
      expect(() => service.updateAd(id, { title: 'x' })).toThrow(/Submission limit reached/);
    });

    it('a withdraw does not refund a submission', async () => {
      auth.signInAs('alice');
      const id = await createAd('alice');
      service.recallToDraft(id);
      service.submitAd(id);
      expect(service.getAdById(id)!.submissionCount).toBe(2);
    });

    it('only an admin resets a lock: draft, count 0, unlocked, audited', async () => {
      auth.signInAs('alice');
      const id = await createAd('alice');
      cycle(id, 1);
      service.submitAd(id);
      cycle(id, 1);
      service.submitAd(id);
      auth.signInAs('approver', ['member', 'adBookApprover']);
      service.rejectAd(id, 'Still blurry');
      expect(() => service.resetLock(id, 'x')).toThrow(/department, national, or site admin/);

      auth.signInAs('admin', ['member', 'departmentAdmin']);
      const ad = await service.resetLock(id, 'New artwork coming');
      expect(ad).toMatchObject({ status: 'draft', submissionCount: 0, locked: false });
      expect(ad.lockResets?.length).toBe(1);
      expect(service.audits()[0]).toMatchObject({ action: 'lockReset', reason: 'New artwork coming', entityId: id });
      expect(() => service.resetLock(id)).toThrow(/not locked/);

      auth.signInAs('alice');
      expect(service.canSubmit(service.getAdById(id)!)).toBe(true);
    });

    it('undoing the locking rejection unlocks but keeps the count', async () => {
      auth.signInAs('alice');
      const id = await createAd('alice');
      cycle(id, 1);
      service.submitAd(id);
      cycle(id, 1);
      service.submitAd(id);
      auth.signInAs('approver', ['member', 'adBookApprover']);
      service.rejectAd(id, 'Still blurry');
      auth.signInAs('admin', ['member', 'departmentAdmin']);
      const ad = await service.undoReview(id, 'Rejected by mistake');
      expect(ad).toMatchObject({ status: 'submitted', submissionCount: 3, locked: false });
    });
  });

  describe('delete (#10)', async () => {
    it('the owner deletes only drafts', async () => {
      auth.signInAs('alice');
      const id = await createAd('alice');
      expect(() => service.deleteAd(id)).toThrow(/Only draft/);
      service.recallToDraft(id);
      service.deleteAd(id);
      expect(service.getAdById(id)).toBeUndefined();
    });

    it('approvers and admins cannot delete members\u2019 ads, even drafts (issue #10 repro)', async () => {
      auth.signInAs('alice');
      const id = await createAd('alice');
      for (const [uid, role] of [
        ['approver', 'adBookApprover'],
        ['admin', 'departmentAdmin'],
      ] as const) {
        auth.signInAs(uid, ['member', role]);
        expect(() => service.deleteAd(id)).toThrow(/owner/);
      }
      auth.signInAs('alice');
      service.recallToDraft(id);
      auth.signInAs('approver', ['member', 'adBookApprover']);
      expect(() => service.deleteAd(id)).toThrow(/owner/);
      expect(service.getAdById(id)).toBeDefined();
    });
  });

  // ROLES_AND_PERMISSIONS.md (main ca46777): siteAdmin counts wherever the docs say department or
  // national admin. Pairs with PR #18.
  describe('siteAdmin', async () => {
    const asSite = () => auth.signInAs('site', ['member', 'siteAdmin']);

    it('self-approves with a reason, audited, and notifies every other admin', async () => {
      asSite();
      const id = await createAd('site');
      expect(service.isDeptOrHigherAdmin()).toBe(true);
      expect(service.canSelfApprove(service.getAdById(id)!)).toBe(true);
      expect(() => service.approveAd(id)).toThrow(/reason is required/);
      const ad = await service.approveAd(id, { selfApprovalReason: 'Deadline' });
      expect(ad.selfApproved).toBe(true);
      expect(service.audits()[0]).toMatchObject({ action: 'selfApprove', actorUid: 'site' });
      for (const uid of ['admin', 'admin2', 'natAdmin']) {
        auth.signInAs(uid, ['member', 'departmentAdmin']);
        expect(notifications.myNotifications()[0]).toMatchObject({ adId: id, actorUid: 'site' });
      }
    });

    it('is notified when another admin self-approves', async () => {
      auth.signInAs('admin', ['member', 'departmentAdmin']);
      const id = await createAd('admin');
      service.approveAd(id, { selfApprovalReason: 'Deadline' });
      asSite();
      expect(notifications.unreadCount()).toBe(1);
      expect(notifications.myNotifications()[0]).toMatchObject({ adId: id, actorUid: 'admin' });
    });

    it('cannot self-reject', async () => {
      asSite();
      const id = await createAd('site');
      expect(() => service.rejectAd(id, 'Logo too low-res')).toThrow(/Withdraw/);
    });

    it('undoes a review and resets a lock', async () => {
      auth.signInAs('alice');
      const id = await createAd('alice');
      auth.signInAs('approver', ['member', 'adBookApprover']);
      service.approveAd(id);
      asSite();
      expect(service.canUndoReview(service.getAdById(id)!)).toBe(true);
      expect((await service.undoReview(id, 'Wrong version')).status).toBe('submitted');

      for (let i = 0; i < 3; i++) {
        auth.signInAs('approver', ['member', 'adBookApprover']);
        service.rejectAd(id, 'Please fix the logo');
        auth.signInAs('alice');
        if (i < 2) service.submitAd(id);
      }
      expect(service.getAdById(id)!.locked).toBe(true);
      asSite();
      expect(await service.resetLock(id)).toMatchObject({ status: 'draft', submissionCount: 0, locked: false });
    });
  });

  describe('Firestore + Storage data path (#4)', () => {
    const pending = (type = 'image/png') => ({
      blob: new Blob(['x'], { type }),
      name: 'flyer.pdf',
      previewUrl: 'data:image/png;base64,AAAA',
    });

    it('runs in local demo mode only without a Firebase config', () => {
      expect(service.usesFirebase).toBe(false);
    });

    it('takes a chosen image (converted PDF) and requires one before submit', async () => {
      auth.signInAs('alice');
      const ad = await service.createAd({
        title: 'Flyer',
        sizeId: 'full',
        fit: 'contain',
        position: { x: 50, y: 50 },
        image: pending(),
      });
      expect(ad.imageName).toBe('flyer.pdf');
      expect(service.getAdById(ad.id)!.imageUrl).toBe('data:image/png;base64,AAAA');

      const bare = await service.createAd({ title: 'No art', sizeId: 'full', fit: 'cover', position: { x: 0, y: 0 } });
      expect(() => service.submitAd(bare.id)).toThrow(/upload an ad image/);
    });

    it('refuses non-image uploads before anything is saved', () => {
      auth.signInAs('alice');
      expect(() =>
        service.createAd({ title: 'x', sizeId: 'full', fit: 'cover', position: { x: 0, y: 0 }, image: pending('application/pdf') })
      ).toThrow(/JPEG, PNG, or WebP/);
    });

    it('places an approved ad in one open book at a time', async () => {
      auth.signInAs('alice');
      const id = await createAd('alice');
      auth.signInAs('approver', ['member', 'adBookApprover']);
      const open = service.adBooks()[0];
      expect(() => service.addAdToBook(open.id, id)).toThrow(/Only approved/);
      await service.approveAd(id);
      const draft = await service.createBook({ title: 'Later', eventName: 'Fall' });
      await service.updateBookStatus(draft.id, 'draft');
      expect(() => service.addAdToBook(draft.id, id)).toThrow(/Open the book/);
      await service.addAdToBook(open.id, id);
      await service.updateBookStatus(draft.id, 'open');
      expect(() => service.addAdToBook(draft.id, id)).toThrow(/already in/);
      await service.updateBookStatus(open.id, 'locked');
      expect(() => service.removeAdFromBook(open.id, id)).toThrow(/Reopen/);
      await service.updateBookStatus(open.id, 'open');
      await service.removeAdFromBook(open.id, id);
      expect(service.getAdById(id)!.bookId).toBeUndefined();
    });

    it('#43: approvers and admins cannot place or remove their own approved ad', async () => {
      for (const [uid, role] of [
        ['approver', 'adBookApprover'],
        ['admin', 'departmentAdmin'],
      ] as const) {
        auth.signInAs(uid, ['member', role]);
        const id = await createAd(uid);
        auth.signInAs('approver2', ['member', 'adBookApprover']);
        await service.approveAd(id);
        const book = service.adBooks()[0];
        auth.signInAs(uid, ['member', role]);
        const ad = service.getAdById(id)!;
        expect(service.canPlaceAd(ad)).toBe(false);
        expect(() => service.addAdToBook(book.id, id)).toThrow(/your own ad/);
        auth.signInAs('approver2', ['member', 'adBookApprover']);
        expect(service.canPlaceAd(service.getAdById(id)!)).toBe(true);
        await service.addAdToBook(book.id, id);
        auth.signInAs(uid, ['member', role]);
        expect(() => service.removeAdFromBook(book.id, id)).toThrow(/your own ad/);
        auth.signInAs('approver2', ['member', 'adBookApprover']);
        await service.removeAdFromBook(book.id, id);
      }
    });

    it('members cannot create books or change sizes', () => {
      auth.signInAs('alice');
      expect(() => service.createBook({ title: 't', eventName: 'e' })).toThrow(/Approvers or Admins/);
      expect(() => service.toggleAdSizeActive('full')).toThrow(/Approvers or Admins/);
    });
  });
});

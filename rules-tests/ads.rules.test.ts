/**
 * Ad Book `ads` transitions, `audits`, and `notifications` (issue #3; features/AD_BOOK.md
 * FR-A-3, AC 2, 3, 12, 13).
 */
import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  deleteField,
  doc,
  Firestore,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { asUser, getTestEnv, resetEnv, seed, seedUsers, USERS } from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await getTestEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await resetEnv(env);
  await seedUsers(env, {
    alice: USERS.member,
    bob: USERS.member,
    approver: USERS.adApprover,
    approver2: USERS.adApprover,
    admin: USERS.deptAdmin,
    admin2: USERS.deptAdmin,
    natAdmin: USERS.nationalAdmin,
    siteAdmin: USERS.siteAdmin,
  });
});

function ad(createdBy: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    id: 'ad1',
    departmentId: 'dof',
    sizeId: 'full',
    title: 'Semper Fi Plumbing',
    status,
    createdBy,
    createdByType: 'member',
    fit: 'cover',
    position: { x: 50, y: 50 },
    createdAt: '2026-11-14T00:00:00Z',
    updatedAt: '2026-11-14T00:00:00Z',
    ...extra,
  };
}

const seedAd = (createdBy: string, status: string, extra: Record<string, unknown> = {}) =>
  seed(env, { 'ads/ad1': ad(createdBy, status, extra) });

let auditSeq = 0;
const nextAuditId = (prefix: string) => `${prefix}-${++auditSeq}`;

const db = (uid: string) => asUser(env, uid).firestore();
const adRef = (fs: Firestore) => doc(fs, 'ads/ad1');

const approve = (uid: string, extra: Record<string, unknown> = {}) =>
  updateDoc(adRef(db(uid)), {
    status: 'approved',
    reviewedBy: uid,
    reviewedAt: '2026-11-14T01:00:00Z',
    updatedAt: '2026-11-14T01:00:00Z',
    ...extra,
  });

const reject = (uid: string, notes = 'Logo too low-res', extra: Record<string, unknown> = {}) =>
  updateDoc(adRef(db(uid)), {
    status: 'rejected',
    rejectionNotes: notes,
    reviewedBy: uid,
    reviewedAt: '2026-11-14T01:00:00Z',
    updatedAt: '2026-11-14T01:00:00Z',
    ...extra,
  });

/** Admin self-approval batch: ad update + audit (+ optional notifications). */
function selfApproveBatch(
  uid: string,
  opts: {
    reason?: string;
    audit?: boolean;
    auditAction?: string;
    auditId?: string;
    notify?: string[];
  } = {}
) {
  const fs = db(uid);
  const batch = writeBatch(fs);
  const reason = opts.reason ?? 'Convention deadline; no other admin available';
  const auditId = opts.auditId ?? nextAuditId('audit-self');
  batch.update(adRef(fs), {
    status: 'approved',
    reviewedBy: uid,
    reviewedAt: '2026-11-14T01:00:00Z',
    updatedAt: '2026-11-14T01:00:00Z',
    selfApproved: true,
    selfApprovalReason: reason,
    lastAuditId: auditId,
  });
  if (opts.audit !== false) {
    batch.set(doc(fs, 'audits', auditId), {
      entityType: 'ad',
      entityId: 'ad1',
      action: opts.auditAction ?? 'selfApprove',
      actorUid: uid,
      at: serverTimestamp(),
      reason,
      fromStatus: 'submitted',
      toStatus: 'approved',
    });
  }
  for (const recipient of opts.notify ?? []) {
    batch.set(doc(fs, 'notifications', `n-${recipient}`), notification(uid, recipient, reason));
  }
  return batch.commit();
}

function notification(actorUid: string, recipientUid: string, reason = 'reason') {
  return {
    recipientUid,
    type: 'adSelfApproved',
    adId: 'ad1',
    adTitle: 'Semper Fi Plumbing',
    actorUid,
    actorName: actorUid,
    reason,
    createdAt: serverTimestamp(),
    read: false,
  };
}

function undoBatch(uid: string, opts: { reason?: string; audit?: boolean; extra?: Record<string, unknown> } = {}) {
  const fs = db(uid);
  const batch = writeBatch(fs);
  const auditId = nextAuditId('audit-undo');
  const reason = opts.reason ?? 'Approved the wrong version';
  batch.update(adRef(fs), {
    status: 'submitted',
    reviewedBy: deleteField(),
    reviewedByName: deleteField(),
    reviewedAt: deleteField(),
    rejectionNotes: deleteField(),
    selfApproved: deleteField(),
    selfApprovalReason: deleteField(),
    lastAuditId: auditId,
    updatedAt: '2026-11-14T02:00:00Z',
    ...opts.extra,
  });
  if (opts.audit !== false) {
    batch.set(doc(fs, 'audits', auditId), {
      entityType: 'ad',
      entityId: 'ad1',
      action: 'undoReview',
      actorUid: uid,
      at: serverTimestamp(),
      reason,
    });
  }
  return batch.commit();
}

describe('#3 ads: create', () => {
  it('a member creates only their own draft with no review fields', async () => {
    await assertSucceeds(setDoc(adRef(db('alice')), ad('alice', 'draft')));
    await assertFails(setDoc(doc(db('alice'), 'ads/ad2'), ad('bob', 'draft')));
    await assertFails(setDoc(doc(db('alice'), 'ads/ad3'), ad('alice', 'approved')));
    await assertFails(setDoc(doc(db('alice'), 'ads/ad4'), ad('alice', 'submitted')));
    await assertFails(
      setDoc(doc(db('alice'), 'ads/ad5'), ad('alice', 'draft', { reviewedBy: 'alice' }))
    );
    await assertFails(
      setDoc(doc(db('alice'), 'ads/ad6'), ad('alice', 'draft', { selfApproved: true }))
    );
  });
});

describe('#3 ads: owner edits and submit', () => {
  it('owner edits content of a draft, and of a rejected ad (which returns to draft)', async () => {
    await seedAd('alice', 'draft');
    await assertSucceeds(updateDoc(adRef(db('alice')), { title: 'New title', fit: 'contain' }));
    await seedAd('alice', 'rejected', { rejectionNotes: 'Logo too low-res' });
    await assertSucceeds(updateDoc(adRef(db('alice')), { title: 'Fixed', status: 'draft' }));
  });

  it('owner cannot approve their own ad or rewrite privileged fields (issue #3 repro)', async () => {
    await seedAd('alice', 'draft');
    const ref = adRef(db('alice'));
    await assertFails(updateDoc(ref, { status: 'approved' }));
    await assertFails(updateDoc(ref, { status: 'rejected' }));
    await assertFails(updateDoc(ref, { reviewedBy: 'alice' }));
    await assertFails(updateDoc(ref, { createdBy: 'bob' }));
    await assertFails(updateDoc(ref, { selfApproved: true }));
    await assertFails(updateDoc(ref, { createdByType: 'company' }));
  });

  it('owner submits a draft; nobody else can submit it', async () => {
    await seedAd('alice', 'draft');
    await assertFails(updateDoc(adRef(db('bob')), { status: 'submitted' }));
    await assertFails(updateDoc(adRef(db('approver')), { status: 'submitted' }));
    await assertSucceeds(
      updateDoc(adRef(db('alice')), {
        status: 'submitted',
        submittedAt: '2026-11-14T00:30:00Z',
        submissionCount: 1,
      })
    );
  });

  it('owner cannot edit a submitted or approved ad', async () => {
    await seedAd('alice', 'submitted');
    await assertFails(updateDoc(adRef(db('alice')), { title: 'Sneaky edit' }));
    await seedAd('alice', 'approved', { reviewedBy: 'approver' });
    await assertFails(updateDoc(adRef(db('alice')), { title: 'Sneaky edit' }));
    await assertFails(updateDoc(adRef(db('alice')), { imageUrl: 'x' }));
  });
});

describe('#3 ads: approve / reject', () => {
  it('a different approver or admin approves a submitted ad', async () => {
    await seedAd('alice', 'submitted');
    await assertSucceeds(approve('approver', { reviewedByName: 'Cpl. Holloway' }));
    await seedAd('alice', 'submitted');
    await assertSucceeds(approve('admin'));
  });

  it('members cannot approve or reject', async () => {
    await seedAd('alice', 'submitted');
    await assertFails(approve('bob'));
    await assertFails(reject('bob'));
  });

  it('approvers cannot rewrite non-review fields (issue #3 repro step 4)', async () => {
    await seedAd('alice', 'submitted');
    await assertFails(approve('approver', { title: 'Changed' }));
    await assertFails(approve('approver', { createdBy: 'approver' }));
    await assertFails(approve('approver', { imageUrl: 'other.png' }));
    await assertFails(updateDoc(adRef(db('approver')), { title: 'Changed' }));
    await assertFails(updateDoc(adRef(db('approver')), { createdBy: 'approver' }));
  });

  it('reviewedBy must be the reviewer; approval cannot claim selfApproved', async () => {
    await seedAd('alice', 'submitted');
    await assertFails(approve('approver', { reviewedBy: 'approver2' }));
    await assertFails(approve('approver', { selfApproved: true, selfApprovalReason: 'x' }));
  });

  it('only submitted ads can be approved or rejected', async () => {
    await seedAd('alice', 'draft');
    await assertFails(approve('approver'));
    await assertFails(reject('approver'));
  });

  it('an approver cannot approve or reject their own ad (AC 2, 12)', async () => {
    await seedAd('approver', 'submitted');
    await assertFails(approve('approver'));
    await assertFails(reject('approver'));
    // Even with a reason and an audit, the self-approval path is admin-only.
    await assertFails(selfApproveBatch('approver'));
    // A different approver can.
    await assertSucceeds(approve('approver2'));
  });

  it('rejection needs notes of at least 5 characters', async () => {
    await seedAd('alice', 'submitted');
    await assertFails(reject('approver', 'bad'));
    await assertFails(reject('approver', '     '));
    await assertSucceeds(reject('approver', 'Logo too low-res'));
  });

  it('nobody self-rejects, admins included (AC 2)', async () => {
    await seedAd('admin', 'submitted');
    await assertFails(reject('admin'));
    await seedAd('natAdmin', 'submitted');
    await assertFails(reject('natAdmin'));
    await assertSucceeds(reject('admin'));
  });
});

describe('#3 ads: admin self-approval (AC 2, 12)', () => {
  it('a department or national admin self-approves with a reason and an audit', async () => {
    await seedAd('admin', 'submitted');
    await assertSucceeds(selfApproveBatch('admin'));
    await seedAd('natAdmin', 'submitted');
    await assertSucceeds(selfApproveBatch('natAdmin'));
  });

  it('a plain self-approval (no reason flag) is denied for admins', async () => {
    await seedAd('admin', 'submitted');
    await assertFails(approve('admin'));
  });

  it('self-approval requires a non-blank reason', async () => {
    await seedAd('admin', 'submitted');
    await assertFails(selfApproveBatch('admin', { reason: '' }));
    await assertFails(selfApproveBatch('admin', { reason: '   ' }));
  });

  it('self-approval requires a matching audit doc in the same batch', async () => {
    await seedAd('admin', 'submitted');
    await assertFails(selfApproveBatch('admin', { audit: false }));
    await assertFails(selfApproveBatch('admin', { auditAction: 'undoReview' }));
  });

  it('self-approval can notify every other admin in the same batch', async () => {
    await seedAd('admin', 'submitted');
    await assertSucceeds(selfApproveBatch('admin', { notify: ['admin2', 'natAdmin'] }));
  });
});

describe('#3 audits', () => {
  it('members and approvers cannot write audits; orphan audits are denied', async () => {
    await seedAd('alice', 'submitted');
    const audit = (uid: string) => ({
      entityType: 'ad',
      entityId: 'ad1',
      action: 'undoReview',
      actorUid: uid,
      at: serverTimestamp(),
      reason: 'forged',
    });
    await assertFails(setDoc(doc(db('alice'), 'audits/a1'), audit('alice')));
    await assertFails(setDoc(doc(db('approver'), 'audits/a1'), audit('approver')));
    // Admin, but not paired with an ad change pointing at this audit.
    await assertFails(setDoc(doc(db('admin'), 'audits/a1'), audit('admin')));
  });

  it('audits are admin-readable and immutable', async () => {
    await seedAd('admin', 'submitted');
    await selfApproveBatch('admin', { auditId: 'audit-self-1' });
    await assertSucceeds(getDoc(doc(db('admin2'), 'audits/audit-self-1')));
    await assertFails(getDoc(doc(db('alice'), 'audits/audit-self-1')));
    await assertFails(getDoc(doc(db('approver'), 'audits/audit-self-1')));
    await assertFails(updateDoc(doc(db('admin'), 'audits/audit-self-1'), { reason: 'edited' }));
  });
});

describe('#3 notifications', () => {
  it('cannot notify yourself, a non-admin, or without a self-approved ad', async () => {
    await seedAd('admin', 'submitted');
    await assertFails(selfApproveBatch('admin', { notify: ['admin'] }));
    await seedAd('admin', 'submitted');
    await assertFails(selfApproveBatch('admin', { notify: ['alice'] }));
    // Ad approved normally by someone else: no self-approval to report.
    await seedAd('alice', 'approved', { reviewedBy: 'admin' });
    await assertFails(setDoc(doc(db('admin'), 'notifications/n1'), notification('admin', 'admin2')));
  });

  it('members and approvers cannot create notifications', async () => {
    await seedAd('alice', 'approved', { selfApproved: true, reviewedBy: 'alice' });
    await assertFails(setDoc(doc(db('alice'), 'notifications/n1'), notification('alice', 'admin')));
    await seedAd('approver', 'approved', { selfApproved: true, reviewedBy: 'approver' });
    await assertFails(
      setDoc(doc(db('approver'), 'notifications/n1'), notification('approver', 'admin'))
    );
  });

  it('only the recipient reads it and marks it read', async () => {
    await seedAd('admin', 'submitted');
    await selfApproveBatch('admin', { notify: ['admin2'] });
    const n = 'notifications/n-admin2';
    await assertSucceeds(getDoc(doc(db('admin2'), n)));
    await assertFails(getDoc(doc(db('admin'), n)));
    await assertFails(getDoc(doc(db('natAdmin'), n)));
    await assertFails(getDoc(doc(db('alice'), n)));
    await assertFails(updateDoc(doc(db('natAdmin'), n), { read: true }));
    await assertFails(updateDoc(doc(db('admin2'), n), { reason: 'edited' }));
    await assertSucceeds(updateDoc(doc(db('admin2'), n), { read: true, readAt: '2026-11-14T03:00:00Z' }));
  });
});

describe('#3 ads: admin undo review (AC 13)', () => {
  it('an admin returns an approved or rejected ad to submitted with a reason and audit', async () => {
    await seedAd('alice', 'approved', { reviewedBy: 'approver', reviewedAt: 'x' });
    await assertSucceeds(undoBatch('admin'));
    await seedAd('alice', 'rejected', { reviewedBy: 'approver', rejectionNotes: 'Logo too low-res' });
    await assertSucceeds(undoBatch('natAdmin'));
  });

  it('undo clears self-approval fields', async () => {
    await seedAd('admin', 'approved', {
      reviewedBy: 'admin',
      selfApproved: true,
      selfApprovalReason: 'deadline',
    });
    await assertSucceeds(undoBatch('admin2'));
  });

  it('approvers and members cannot undo', async () => {
    await seedAd('alice', 'approved', { reviewedBy: 'approver' });
    await assertFails(undoBatch('approver'));
    await assertFails(undoBatch('alice'));
  });

  it('undo requires a reason and an audit', async () => {
    await seedAd('alice', 'approved', { reviewedBy: 'approver' });
    await assertFails(undoBatch('admin', { audit: false }));
    await assertFails(undoBatch('admin', { reason: ' ' }));
  });

  it('undo cannot change submissionCount or content', async () => {
    await seedAd('alice', 'rejected', { reviewedBy: 'approver', submissionCount: 2 });
    await assertFails(undoBatch('admin', { extra: { submissionCount: 1 } }));
    await assertFails(undoBatch('admin', { extra: { title: 'Changed' } }));
    await assertSucceeds(undoBatch('admin'));
  });

  it('an approved ad placed in a locked book must be removed from the book first', async () => {
    await seed(env, {
      'adBooks/b1': { title: 'Convention', status: 'locked', adIds: ['ad1'] },
    });
    await seedAd('alice', 'approved', { reviewedBy: 'approver', bookId: 'b1' });
    const clearBook = { extra: { bookId: deleteField() } };
    await assertFails(undoBatch('admin', clearBook));
    await seed(env, { 'adBooks/b1': { title: 'Convention', status: 'printed', adIds: ['ad1'] } });
    await assertFails(undoBatch('admin', clearBook));
    // Removed from the book: allowed.
    await seed(env, { 'adBooks/b1': { title: 'Convention', status: 'locked', adIds: [] } });
    await assertSucceeds(undoBatch('admin', clearBook));
  });

  it('an ad in an open book can be undone; it comes out of the book in the same batch (#4)', async () => {
    await seed(env, { 'adBooks/b1': { title: 'Convention', status: 'open', adIds: ['ad1'] } });
    await seedAd('alice', 'approved', { reviewedBy: 'approver', bookId: 'b1' });
    // Leaving it listed in the book (or keeping bookId) is refused.
    await assertFails(undoBatch('admin'));
    await assertFails(undoBatch('admin', { extra: { bookId: deleteField() } }));
    const fs = db('admin');
    const batch = writeBatch(fs);
    batch.update(adRef(fs), {
      status: 'submitted',
      reviewedBy: deleteField(),
      bookId: deleteField(),
      lastAuditId: 'audit-open-book',
      updatedAt: '2026-11-14T02:00:00Z',
    });
    batch.update(doc(fs, 'adBooks/b1'), { adIds: [] });
    batch.set(doc(fs, 'audits', 'audit-open-book'), {
      entityType: 'ad',
      entityId: 'ad1',
      action: 'undoReview',
      actorUid: 'admin',
      at: serverTimestamp(),
      reason: 'Approved the wrong version',
    });
    await assertSucceeds(batch.commit());
  });
});

describe('#6 ads: owner withdraws a submitted ad to draft', () => {
  it('the owner withdraws submitted -> draft (issue #6 repro)', async () => {
    await seedAd('alice', 'submitted', { submittedAt: 'x' });
    await assertSucceeds(
      updateDoc(adRef(db('alice')), { status: 'draft', updatedAt: '2026-11-14T05:00:00Z' })
    );
  });

  it('the withdrawal does not refund a submission or change anything else', async () => {
    await seedAd('alice', 'submitted', { submissionCount: 2 });
    const ref = adRef(db('alice'));
    await assertFails(updateDoc(ref, { status: 'draft', submissionCount: 1 }));
    await assertFails(updateDoc(ref, { status: 'draft', title: 'Edited while withdrawing' }));
    await assertFails(updateDoc(ref, { status: 'draft', reviewedBy: 'alice' }));
  });

  it('other members and approvers cannot withdraw someone else\u2019s ad', async () => {
    await seedAd('alice', 'submitted');
    await assertFails(updateDoc(adRef(db('bob')), { status: 'draft' }));
    await assertFails(updateDoc(adRef(db('approver')), { status: 'draft' }));
  });

  it('approved ads cannot be withdrawn by the owner (admin undo is the path)', async () => {
    await seedAd('alice', 'approved', { reviewedBy: 'approver' });
    await assertFails(updateDoc(adRef(db('alice')), { status: 'draft' }));
  });
});

describe('#5 ads: 3-submission limit, lock, and admin lock reset', () => {
  const submit = (uid: string, count: number, extra: Record<string, unknown> = {}) =>
    updateDoc(adRef(db(uid)), { status: 'submitted', submissionCount: count, ...extra });

  function resetBatch(uid: string, opts: { audit?: boolean; reason?: string; extra?: Record<string, unknown> } = {}) {
    const fs = db(uid);
    const batch = writeBatch(fs);
    const auditId = nextAuditId('audit-reset');
    batch.update(adRef(fs), {
      status: 'draft',
      submissionCount: 0,
      locked: false,
      lastAuditId: auditId,
      updatedAt: '2026-11-14T06:00:00Z',
      ...opts.extra,
    });
    if (opts.audit !== false) {
      const audit: Record<string, unknown> = {
        entityType: 'ad',
        entityId: 'ad1',
        action: 'lockReset',
        actorUid: uid,
        at: serverTimestamp(),
        fromStatus: 'rejected',
        toStatus: 'draft',
      };
      if (opts.reason !== undefined) audit['reason'] = opts.reason;
      batch.set(doc(fs, 'audits', auditId), audit);
    }
    return batch.commit();
  }

  it('new ads start at 0 of 3 submissions, unlocked', async () => {
    await assertSucceeds(
      setDoc(adRef(db('alice')), ad('alice', 'draft', { submissionCount: 0, maxSubmissions: 3, locked: false }))
    );
    await assertFails(setDoc(doc(db('alice'), 'ads/ad2'), ad('alice', 'draft', { submissionCount: -5 })));
    await assertFails(setDoc(doc(db('alice'), 'ads/ad3'), ad('alice', 'draft', { maxSubmissions: 99 })));
    await assertFails(setDoc(doc(db('alice'), 'ads/ad4'), ad('alice', 'draft', { locked: true })));
  });

  it('each submit adds exactly one to submissionCount', async () => {
    await seedAd('alice', 'draft', { submissionCount: 0, maxSubmissions: 3 });
    await assertFails(submit('alice', 0));
    await assertFails(submit('alice', 2));
    await assertFails(updateDoc(adRef(db('alice')), { status: 'submitted' }));
    await assertSucceeds(submit('alice', 1));
  });

  it('the 4th submission is denied (issue #5 repro)', async () => {
    await seedAd('alice', 'rejected', { submissionCount: 2, maxSubmissions: 3 });
    await assertSucceeds(submit('alice', 3));
    // Even if an ad were somehow unlocked at 3, a 4th submit is denied.
    await seedAd('alice', 'rejected', { submissionCount: 3, maxSubmissions: 3, locked: false });
    await assertFails(submit('alice', 4));
  });

  it('the owner cannot lower submissionCount, raise maxSubmissions, or clear locked', async () => {
    await seedAd('alice', 'rejected', { submissionCount: 3, maxSubmissions: 3, locked: true });
    const ref = adRef(db('alice'));
    await assertFails(updateDoc(ref, { submissionCount: 0 }));
    await assertFails(updateDoc(ref, { locked: false }));
    await assertFails(updateDoc(ref, { maxSubmissions: 10 }));
    await assertFails(updateDoc(ref, { status: 'draft', locked: false, submissionCount: 0 }));
    await seedAd('alice', 'draft', { submissionCount: 2, maxSubmissions: 3 });
    await assertFails(updateDoc(adRef(db('alice')), { submissionCount: 1 }));
    await assertFails(submit('alice', 1));
  });

  it('a locked ad cannot be edited or submitted', async () => {
    await seedAd('alice', 'rejected', { submissionCount: 3, maxSubmissions: 3, locked: true });
    await assertFails(updateDoc(adRef(db('alice')), { title: 'Try again' }));
    await assertFails(submit('alice', 4));
  });

  it('the rejection of the 3rd submission must lock the ad; earlier ones must not', async () => {
    await seedAd('alice', 'submitted', { submissionCount: 2, maxSubmissions: 3 });
    await assertFails(reject('approver', 'Logo too low-res', { locked: true }));
    await assertSucceeds(reject('approver', 'Logo too low-res'));
    await seedAd('alice', 'submitted', { submissionCount: 3, maxSubmissions: 3 });
    await assertFails(reject('approver'));
    await assertSucceeds(reject('approver', 'Logo too low-res', { locked: true }));
  });

  it('approvers cannot change the counter or lock', async () => {
    await seedAd('alice', 'submitted', { submissionCount: 3, maxSubmissions: 3 });
    await assertFails(approve('approver', { submissionCount: 0 }));
    await seedAd('alice', 'rejected', { submissionCount: 3, maxSubmissions: 3, locked: true });
    await assertFails(resetBatch('approver'));
  });

  it('only a department or national admin resets a locked ad, with an audit (AC 11)', async () => {
    await seedAd('alice', 'rejected', { submissionCount: 3, maxSubmissions: 3, locked: true });
    await assertFails(resetBatch('alice'));
    await assertFails(resetBatch('admin', { audit: false }));
    await assertSucceeds(resetBatch('admin', { reason: 'Member called; new artwork coming' }));
    await seedAd('alice', 'rejected', { submissionCount: 3, maxSubmissions: 3, locked: true });
    // Reason is optional for a reset (OPEN_QUESTIONS.md item 9).
    await assertSucceeds(resetBatch('natAdmin'));
  });

  it('a siteAdmin resets a locked ad, with an audit (siteAdmin counts as an admin)', async () => {
    await seedAd('alice', 'rejected', { submissionCount: 3, maxSubmissions: 3, locked: true });
    await assertFails(resetBatch('siteAdmin', { audit: false }));
    await assertSucceeds(resetBatch('siteAdmin', { reason: 'Site admin reset' }));
  });

  it('a reset must clear the lock, zero the count, return to draft, and change nothing else', async () => {
    await seedAd('alice', 'rejected', { submissionCount: 3, maxSubmissions: 3, locked: true });
    await assertFails(resetBatch('admin', { extra: { submissionCount: 1 } }));
    await assertFails(resetBatch('admin', { extra: { status: 'submitted' } }));
    await assertFails(resetBatch('admin', { extra: { title: 'Admin edit' } }));
    await assertFails(resetBatch('admin', { extra: { maxSubmissions: 5 } }));
    await assertSucceeds(
      resetBatch('admin', { extra: { lockResets: [{ by: 'admin', at: 'now', reason: 'ok' }] } })
    );
  });

  it('an unlocked ad cannot be "reset"', async () => {
    await seedAd('alice', 'rejected', { submissionCount: 2, maxSubmissions: 3 });
    await assertFails(resetBatch('admin'));
  });

  it('undoing the locking rejection unlocks the ad but keeps the count', async () => {
    await seedAd('alice', 'rejected', {
      submissionCount: 3,
      maxSubmissions: 3,
      locked: true,
      reviewedBy: 'approver',
      rejectionNotes: 'Logo too low-res',
    });
    await assertFails(undoBatch('admin'));
    await assertFails(undoBatch('admin', { extra: { locked: false, submissionCount: 2 } }));
    await assertSucceeds(undoBatch('admin', { extra: { locked: false } }));
  });
});

describe('#10 ads: only the owner deletes, only drafts', () => {
  const del = (uid: string) => deleteDoc(adRef(db(uid)));

  it('the owner deletes their own draft', async () => {
    await seedAd('alice', 'draft');
    await assertSucceeds(del('alice'));
  });

  it('the owner cannot delete a submitted, approved, or rejected ad', async () => {
    for (const status of ['submitted', 'approved', 'rejected']) {
      await seedAd('alice', status);
      await assertFails(del('alice'));
    }
  });

  it('approvers and admins cannot delete members\u2019 ads in any status (issue #10)', async () => {
    for (const status of ['draft', 'submitted', 'approved', 'rejected']) {
      await seedAd('alice', status);
      for (const uid of ['approver', 'admin', 'natAdmin', 'bob']) {
        await assertFails(del(uid));
      }
    }
  });

  it('a locked ad cannot be deleted', async () => {
    await seedAd('alice', 'rejected', { submissionCount: 3, maxSubmissions: 3, locked: true });
    await assertFails(del('alice'));
  });
});

// ROLES_AND_PERMISSIONS.md (main ca46777): siteAdmin counts anywhere the docs say "department or
// national admin" (lock reset is covered in the #5 suite above). Pairs with PR #18.
describe('siteAdmin on ads', () => {
  it('reads any ad and approves or rejects someone else\u2019s submitted ad', async () => {
    await seedAd('alice', 'draft');
    await assertSucceeds(getDoc(adRef(db('siteAdmin'))));
    await seedAd('alice', 'submitted');
    await assertSucceeds(approve('siteAdmin'));
    await seedAd('alice', 'submitted');
    await assertSucceeds(reject('siteAdmin'));
  });

  it('self-approves only with a reason and an audit, and notifies the other admins', async () => {
    await seedAd('siteAdmin', 'submitted');
    await assertFails(approve('siteAdmin'));
    await assertFails(selfApproveBatch('siteAdmin', { reason: ' ' }));
    await assertFails(selfApproveBatch('siteAdmin', { audit: false }));
    await assertSucceeds(selfApproveBatch('siteAdmin', { notify: ['admin', 'natAdmin'] }));
  });

  it('cannot self-reject', async () => {
    await seedAd('siteAdmin', 'submitted');
    await assertFails(reject('siteAdmin'));
  });

  it('receives self-approval notifications from other admins and reads them', async () => {
    await seedAd('admin', 'submitted');
    await assertSucceeds(selfApproveBatch('admin', { notify: ['siteAdmin'] }));
    await assertSucceeds(getDoc(doc(db('siteAdmin'), 'notifications/n-siteAdmin')));
  });

  it('undoes an approval or rejection with a reason and an audit', async () => {
    await seedAd('alice', 'approved', { reviewedBy: 'approver', reviewedAt: 'x' });
    await assertFails(undoBatch('siteAdmin', { audit: false }));
    await assertSucceeds(undoBatch('siteAdmin'));
    await seedAd('alice', 'rejected', { reviewedBy: 'approver', rejectionNotes: 'Logo too low-res' });
    await assertSucceeds(undoBatch('siteAdmin'));
  });

  it('reads the audit log', async () => {
    await seedAd('admin', 'submitted');
    await selfApproveBatch('admin', { auditId: 'audit-site-1' });
    await assertSucceeds(getDoc(doc(db('siteAdmin'), 'audits/audit-site-1')));
  });

  it('still cannot delete members\u2019 ads (#10 applies to every admin level)', async () => {
    for (const status of ['draft', 'submitted', 'approved']) {
      await seedAd('alice', status);
      await assertFails(deleteDoc(adRef(db('siteAdmin'))));
    }
  });
});

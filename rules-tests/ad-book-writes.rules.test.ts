/**
 * Issue #4: the exact Firestore batches and Storage uploads the app performs
 * (src/app/core/ad-book/*) must pass firestore.rules and storage.rules, and every documented
 * Ad Book rule must still hold when Firestore + Storage are the source of truth.
 */
import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, Firestore, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getBytes, ref } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  Actor,
  AdContent,
  approveAdBatch,
  createAdBatch,
  createBookBatch,
  deleteAdBatch,
  placeAdBatch,
  rejectAdBatch,
  reorderBookBatch,
  resetLockBatch,
  selfApproveAdBatch,
  setBookStatusBatch,
  submitAdBatch,
  undoReviewBatch,
  unplaceAdBatch,
  updateAdContentBatch,
  withdrawAdBatch,
  markNotificationReadBatch,
} from '../src/app/core/ad-book/ad-book-firestore';
import { adImagePath, uploadAdImage } from '../src/app/core/ad-book/ad-image-storage';
import { AdItem } from '../src/app/core/models/ad-book.model';
import { asUser, getTestEnv, resetEnv, seedUsers, USERS } from './helpers';

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

const db = (uid: string): Firestore => asUser(env, uid).firestore();
const actor = (uid: string): Actor => ({ uid, name: uid });
const AD = 'ad1';

const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });

function content(owner: string, extra: Partial<AdContent> = {}): AdContent {
  return {
    title: 'Semper Fi Plumbing',
    sizeId: 'full',
    imagePath: `ad-images/${owner}/${AD}/1-art.png`,
    imageName: 'art.png',
    fit: 'cover',
    position: { x: 50, y: 50 },
    ...extra,
  };
}

async function adDoc(): Promise<Record<string, unknown>> {
  let data: Record<string, unknown> = {};
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), 'ads', AD))).data() ?? {};
  });
  return data;
}

async function bookDoc(id: string): Promise<Record<string, unknown>> {
  let data: Record<string, unknown> = {};
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), 'adBooks', id))).data() ?? {};
  });
  return data;
}

/** The ad as the app sees it (the batches only read a few fields). */
async function ad(): Promise<AdItem> {
  return { id: AD, ...(await adDoc()) } as unknown as AdItem;
}

const create = (owner = 'alice', extra: Partial<AdContent> = {}) =>
  createAdBatch(db(owner), AD, actor(owner), content(owner, extra)).commit();
const submit = (owner: string, count: number) => submitAdBatch(db(owner), AD, count).commit();
const reject = (uid: string, locked = false) =>
  rejectAdBatch(db(uid), AD, actor(uid), 'Logo too low-res', locked).commit();

describe('#4 ads in Firestore with images in Storage', () => {
  it('a member uploads the image to Storage, then creates the draft (AC 1)', async () => {
    const path = adImagePath('alice', AD, 'My Flyer!.png', 'image/png', 1);
    expect(path).toBe('ad-images/alice/ad1/1-My-Flyer.png');
    const st = asUser(env, 'alice').storage();
    await assertSucceeds(uploadAdImage(st, path, png));
    await assertSucceeds(create('alice', { imagePath: path }));
    const saved = await adDoc();
    expect(saved).toMatchObject({ status: 'draft', createdBy: 'alice', imagePath: path, submissionCount: 0 });
    expect(saved['imageUrl']).toBeUndefined();
    // An approver on another computer reads the ad and its image (issue #4 repro step 5).
    await assertSucceeds(getDoc(doc(db('approver'), 'ads', AD)));
    await assertSucceeds(getBytes(ref(asUser(env, 'approver').storage(), path)));
    await assertFails(getBytes(ref(asUser(env, 'bob').storage(), path)));
  });

  it('Firestore refuses image URLs / data URLs and image paths outside the owner\u2019s folder', async () => {
    await assertFails(
      setDoc(doc(db('alice'), 'ads', AD), {
        title: 't', sizeId: 'full', status: 'draft', createdBy: 'alice', createdByType: 'member',
        fit: 'cover', position: { x: 50, y: 50 }, imageUrl: 'data:image/png;base64,AAAA',
      })
    );
    await assertFails(create('alice', { imagePath: 'ad-images/bob/ad1/x.png' }));
    await assertFails(create('alice', { imagePath: 'ad-images/alice/other-ad/x.png' }));
    await assertSucceeds(create('alice'));
    await assertFails(updateDoc(doc(db('alice'), 'ads', AD), { imagePath: 'ad-images/bob/ad1/x.png' }));
    await assertFails(updateDoc(doc(db('alice'), 'ads', AD), { imageUrl: 'https://example.com/x.png' }));
  });

  it('owners cannot place their own ad in a book', async () => {
    await assertSucceeds(create('alice'));
    await assertFails(updateDoc(doc(db('alice'), 'ads', AD), { bookId: 'b1' }));
  });

  it('owner saves, submits, withdraws; draft-only delete (AC 2, 10)', async () => {
    await assertSucceeds(create('alice'));
    await assertSucceeds(
      updateAdContentBatch(db('alice'), AD, content('alice', { title: 'New', companyName: '' }), 'draft').commit()
    );
    await assertSucceeds(submit('alice', 1));
    await assertFails(deleteAdBatch(db('alice'), AD).commit());
    await assertFails(
      updateAdContentBatch(db('alice'), AD, content('alice', { title: 'Sneaky' }), 'draft').commit()
    );
    await assertSucceeds(withdrawAdBatch(db('alice'), AD).commit());
    expect(await adDoc()).toMatchObject({ status: 'draft', submissionCount: 1 });
    await assertFails(deleteAdBatch(db('approver'), AD).commit());
    await assertSucceeds(deleteAdBatch(db('alice'), AD).commit());
  });

  it('max 3 submissions: the 3rd rejection locks, a 4th submit is refused, admin reset (AC 9, 11)', async () => {
    await assertSucceeds(create('alice'));
    for (let n = 1; n <= 3; n++) {
      await assertSucceeds(submit('alice', n));
      await assertFails(reject('approver', n < 3)); // lock flag must match the count
      await assertSucceeds(reject('approver', n === 3));
      if (n < 3) {
        await assertSucceeds(
          updateAdContentBatch(db('alice'), AD, content('alice', { title: `Try ${n + 1}` }), 'rejected').commit()
        );
      }
    }
    expect(await adDoc()).toMatchObject({ status: 'rejected', locked: true, submissionCount: 3 });
    await assertFails(submit('alice', 4));
    await assertFails(
      updateAdContentBatch(db('alice'), AD, content('alice'), 'rejected').commit()
    );
    await assertFails(resetLockBatch(db('approver'), await ad(), actor('approver'), '', 'now').batch.commit());
    await assertFails(resetLockBatch(db('alice'), await ad(), actor('alice'), '', 'now').batch.commit());
    const { batch, auditId } = resetLockBatch(db('admin'), await ad(), actor('admin'), 'New artwork', '2026-11-16T13:00:00Z');
    await assertSucceeds(batch.commit());
    expect(await adDoc()).toMatchObject({ status: 'draft', locked: false, submissionCount: 0, lastAuditId: auditId });
    // The reset reason stays optional (AD_BOOK.md FR-A-3).
    await assertSucceeds(getDoc(doc(db('admin'), 'audits', auditId)));
    await assertSucceeds(submit('alice', 1));
  });

  it('no self-review by approvers; approve and reject by someone else (AC 2, 3, 12)', async () => {
    await assertSucceeds(create('approver'));
    await assertSucceeds(submit('approver', 1));
    await assertFails(approveAdBatch(db('approver'), AD, actor('approver')).commit());
    await assertFails(reject('approver'));
    await assertFails(
      selfApproveAdBatch(db('approver'), { id: AD, title: 't' }, actor('approver'), 'reason', []).batch.commit()
    );
    await assertSucceeds(approveAdBatch(db('admin'), AD, actor('admin')).commit());
  });

  it('admin self-approval needs a reason, is audited, and notifies each other admin', async () => {
    await assertSucceeds(create('admin'));
    await assertSucceeds(submit('admin', 1));
    await assertFails(approveAdBatch(db('admin'), AD, actor('admin')).commit());
    await assertFails(
      selfApproveAdBatch(db('admin'), { id: AD, title: 't' }, actor('admin'), ' ', ['admin2']).batch.commit()
    );
    // Notifying a non-admin is refused.
    await assertFails(
      selfApproveAdBatch(db('admin'), { id: AD, title: 't' }, actor('admin'), 'Deadline', ['bob']).batch.commit()
    );
    const { batch, auditId } = selfApproveAdBatch(
      db('admin'),
      { id: AD, title: 'Semper Fi Plumbing' },
      actor('admin'),
      'Deadline; no other admin',
      ['admin2', 'natAdmin', 'siteAdmin']
    );
    await assertSucceeds(batch.commit());
    expect(await adDoc()).toMatchObject({ status: 'approved', selfApproved: true, lastAuditId: auditId });
    const auditSnap = await getDoc(doc(db('admin2'), 'audits', auditId));
    expect(auditSnap.data()).toMatchObject({ action: 'selfApprove', actorUid: 'admin', reason: 'Deadline; no other admin' });
  });

  it('no self-reject, admins included', async () => {
    await assertSucceeds(create('admin'));
    await assertSucceeds(submit('admin', 1));
    await assertFails(reject('admin'));
  });

  it('recipients read and mark their own notifications read', async () => {
    await assertSucceeds(create('admin'));
    await assertSucceeds(submit('admin', 1));
    await assertSucceeds(
      selfApproveAdBatch(db('admin'), { id: AD, title: 't' }, actor('admin'), 'Deadline', ['admin2']).batch.commit()
    );
    const { getDocs, query, collection, where } = await import('firebase/firestore');
    const mine = await getDocs(query(collection(db('admin2'), 'notifications'), where('recipientUid', '==', 'admin2')));
    expect(mine.size).toBe(1);
    const id = mine.docs[0].id;
    await assertFails(markNotificationReadBatch(db('natAdmin'), id).commit());
    await assertSucceeds(markNotificationReadBatch(db('admin2'), id).commit());
  });
});

describe('#4 books: placement, locking, and undo', () => {
  async function approvedAd(): Promise<void> {
    await assertSucceeds(create('alice'));
    await assertSucceeds(submit('alice', 1));
    await assertSucceeds(approveAdBatch(db('approver'), AD, actor('approver')).commit());
  }

  async function newBook(id: string): Promise<void> {
    await assertSucceeds(createBookBatch(db('approver'), id, actor('approver'), { title: 'Convention', eventName: 'DoF' }).commit());
  }

  it('members cannot create books; new books start empty', async () => {
    await assertFails(createBookBatch(db('alice'), 'b1', actor('alice'), { title: 't', eventName: 'e' }).commit());
    await assertFails(setDoc(doc(db('approver'), 'adBooks', 'b1'), { title: 't', status: 'open', adIds: ['x'] }));
    await newBook('b1');
  });

  it('an approver places an approved ad in an open book; a locked book refuses placements (AC 4)', async () => {
    await approvedAd();
    await newBook('b1');
    await assertFails(placeAdBatch(db('alice'), { id: 'b1', adIds: [] }, AD).commit());
    await assertSucceeds(setBookStatusBatch(db('approver'), 'b1', 'locked').commit());
    await assertFails(placeAdBatch(db('approver'), { id: 'b1', adIds: [] }, AD).commit());
    await assertSucceeds(setBookStatusBatch(db('approver'), 'b1', 'open').commit());
    await assertSucceeds(placeAdBatch(db('approver'), { id: 'b1', adIds: [] }, AD).commit());
    expect(await bookDoc('b1')).toMatchObject({ adIds: [AD] });
    expect(await adDoc()).toMatchObject({ bookId: 'b1' });
  });

  it('only approved ads are placed, one book at a time, and the book list must match', async () => {
    await assertSucceeds(create('alice'));
    await assertSucceeds(submit('alice', 1));
    await newBook('b1');
    await newBook('b2');
    await assertFails(placeAdBatch(db('approver'), { id: 'b1', adIds: [] }, AD).commit());
    await assertSucceeds(approveAdBatch(db('approver'), AD, actor('approver')).commit());
    // Book list alone, without the ad's bookId, is refused.
    await assertFails(updateDoc(doc(db('approver'), 'adBooks', 'b1'), { adIds: [AD] }));
    await assertSucceeds(placeAdBatch(db('approver'), { id: 'b1', adIds: [] }, AD).commit());
    await assertFails(placeAdBatch(db('approver'), { id: 'b2', adIds: [] }, AD).commit());
  });

  it('#43: an approver-owner cannot place (or remove) their own approved ad; another approver can', async () => {
    await newBook('b1');
    // Approver-owned ad, approved by a different approver.
    await assertSucceeds(create('approver'));
    await assertSucceeds(submit('approver', 1));
    await assertSucceeds(approveAdBatch(db('approver2'), AD, actor('approver2')).commit());
    await assertFails(placeAdBatch(db('approver'), { id: 'b1', adIds: [] }, AD).commit());
    expect(await bookDoc('b1')).toMatchObject({ adIds: [] });
    // Another approver can place it; the owner cannot take it back out.
    await assertSucceeds(placeAdBatch(db('approver2'), { id: 'b1', adIds: [] }, AD).commit());
    await assertFails(unplaceAdBatch(db('approver'), { id: 'b1', adIds: [AD] }, AD).commit());
    await assertSucceeds(unplaceAdBatch(db('approver2'), { id: 'b1', adIds: [AD] }, AD).commit());
  });

  it('#43: an admin who self-approved their own ad cannot place it; another approver can', async () => {
    await newBook('b1');
    await assertSucceeds(create('admin'));
    await assertSucceeds(submit('admin', 1));
    await assertSucceeds(
      selfApproveAdBatch(db('admin'), { id: AD, title: 't' }, actor('admin'), 'Deadline', ['admin2']).batch.commit()
    );
    await assertFails(placeAdBatch(db('admin'), { id: 'b1', adIds: [] }, AD).commit());
    await assertSucceeds(placeAdBatch(db('approver'), { id: 'b1', adIds: [] }, AD).commit());
    expect(await bookDoc('b1')).toMatchObject({ adIds: [AD] });
  });

  it('reorder and removal work on open books, never on locked or printed books', async () => {
    await approvedAd();
    await newBook('b1');
    await assertSucceeds(placeAdBatch(db('approver'), { id: 'b1', adIds: [] }, AD).commit());
    await assertSucceeds(reorderBookBatch(db('approver'), 'b1', [AD]).commit());
    await assertSucceeds(setBookStatusBatch(db('approver'), 'b1', 'printed').commit());
    await assertFails(unplaceAdBatch(db('approver'), { id: 'b1', adIds: [AD] }, AD).commit());
    await assertSucceeds(setBookStatusBatch(db('approver'), 'b1', 'open').commit());
    await assertSucceeds(unplaceAdBatch(db('approver'), { id: 'b1', adIds: [AD] }, AD).commit());
    expect(await bookDoc('b1')).toMatchObject({ adIds: [] });
    expect((await adDoc())['bookId']).toBeUndefined();
  });

  it('admin undo: reason, audited, back to submitted, count unchanged; locked book first (AC 13)', async () => {
    await approvedAd();
    await newBook('b1');
    await assertSucceeds(placeAdBatch(db('approver'), { id: 'b1', adIds: [] }, AD).commit());
    await assertSucceeds(setBookStatusBatch(db('approver'), 'b1', 'locked').commit());
    const book = { id: 'b1', adIds: [AD] };
    await assertFails(undoReviewBatch(db('admin'), await ad(), actor('admin'), 'Wrong version', book).batch.commit());
    await assertFails(undoReviewBatch(db('approver'), await ad(), actor('approver'), 'Wrong version', book).batch.commit());

    await assertSucceeds(setBookStatusBatch(db('approver'), 'b1', 'open').commit());
    await assertFails(undoReviewBatch(db('admin'), await ad(), actor('admin'), ' ', book).batch.commit());
    // Undo without taking it out of the book is refused.
    await assertFails(undoReviewBatch(db('admin'), await ad(), actor('admin'), 'Wrong version').batch.commit());
    const { batch, auditId } = undoReviewBatch(db('admin'), await ad(), actor('admin'), 'Wrong version', book);
    await assertSucceeds(batch.commit());
    const after = await adDoc();
    expect(after).toMatchObject({ status: 'submitted', submissionCount: 1, lastAuditId: auditId });
    expect(after['reviewedBy']).toBeUndefined();
    expect(after['bookId']).toBeUndefined();
    expect(await bookDoc('b1')).toMatchObject({ adIds: [] });
  });

  it('undo of a rejection keeps the submission count', async () => {
    await assertSucceeds(create('alice'));
    await assertSucceeds(submit('alice', 1));
    await assertSucceeds(reject('approver'));
    await assertSucceeds(undoReviewBatch(db('natAdmin'), await ad(), actor('natAdmin'), 'Rejected by mistake').batch.commit());
    expect(await adDoc()).toMatchObject({ status: 'submitted', submissionCount: 1 });
  });
});

describe('#4 nobody changes their own roles or status', () => {
  it('a member cannot raise their own roles or status; an admin cannot change their own', async () => {
    await assertFails(updateDoc(doc(db('alice'), 'users', 'alice'), { roles: ['member', 'adBookApprover'] }));
    await assertFails(updateDoc(doc(db('alice'), 'users', 'alice'), { status: 'suspended' }));
    await assertFails(updateDoc(doc(db('admin'), 'users', 'admin'), { roles: ['member'] }));
    await assertFails(updateDoc(doc(db('admin'), 'users', 'admin'), { status: 'suspended' }));
    await assertFails(deleteDoc(doc(db('admin'), 'users', 'admin')));
  });
});


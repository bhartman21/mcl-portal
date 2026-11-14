/** adBooks reads (issue #9; ARCHITECTURE.md security outline: members "read open books"). */
import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { asGuest, asUser, getTestEnv, resetEnv, seed, seedUsers, USERS } from './helpers';

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
    pat: USERS.pendingMember,
    approver: USERS.adApprover,
    admin: USERS.deptAdmin,
    natAdmin: USERS.nationalAdmin,
  });
  const book = (status: string) => ({ title: `${status} book`, eventName: 'Convention', status, adIds: [] });
  await seed(env, {
    'adBooks/draft': book('draft'),
    'adBooks/open': book('open'),
    'adBooks/locked': book('locked'),
    'adBooks/printed': book('printed'),
  });
});

const read = (uid: string, id: string) => getDoc(doc(asUser(env, uid).firestore(), 'adBooks', id));

describe('#9 adBooks reads', () => {
  it('members read open books only (issue #9 repro)', async () => {
    await assertSucceeds(read('alice', 'open'));
    await assertFails(read('alice', 'draft'));
    await assertFails(read('alice', 'locked'));
    await assertFails(read('alice', 'printed'));
  });

  it('member list queries must filter to open books', async () => {
    const db = asUser(env, 'alice').firestore();
    await assertSucceeds(getDocs(query(collection(db, 'adBooks'), where('status', '==', 'open'))));
    await assertFails(getDocs(collection(db, 'adBooks')));
  });

  it('approvers and admins read every book', async () => {
    for (const uid of ['approver', 'admin', 'natAdmin']) {
      for (const id of ['draft', 'open', 'locked', 'printed']) {
        await assertSucceeds(read(uid, id));
      }
    }
  });

  it('guests and pending users read nothing', async () => {
    await assertFails(getDoc(doc(asGuest(env).firestore(), 'adBooks/open')));
    await assertFails(read('pat', 'open'));
  });
});

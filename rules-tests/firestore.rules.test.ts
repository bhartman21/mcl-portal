import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  asGuest,
  asUser,
  emailFor,
  getTestEnv,
  resetEnv,
  seed,
  seedUsers,
  setRegistrationMode,
  USERS,
} from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await getTestEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await resetEnv(env);
});

/** The profile the Angular client writes on first sign-in (see core/auth/registration.ts). */
function newProfile(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    uid,
    email: emailFor(uid),
    status: 'active',
    roles: ['member'],
    detachmentScopes: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

const vavsEntry = (ownerUid: string, detachmentId = 'dof-054') => ({
  ownerUid,
  detachmentId,
  departmentId: 'dof',
  periodId: 'dof_2026_h2',
  worksheet: 'activity',
  member: 'Test',
  vaHours: 2,
});

describe('AC1: unauthenticated users', () => {
  beforeEach(async () => {
    await seed(env, {
      'detachments/dof-054': { name: 'Morris F. Dixon Jr.', number: '54', active: true },
      'vavsEntries/e1': vavsEntry('alice'),
      'ads/a1': { createdBy: 'alice', status: 'draft' },
    });
  });

  it('cannot write VAVS collections', async () => {
    const db = asGuest(env).firestore();
    await assertFails(setDoc(doc(db, 'vavsEntries/new'), vavsEntry('guest')));
    await assertFails(updateDoc(doc(db, 'vavsEntries/e1'), { vaHours: 99 }));
    await assertFails(deleteDoc(doc(db, 'vavsEntries/e1')));
    await assertFails(setDoc(doc(db, 'vavsPeriods/p1'), { year: 2026 }));
    await assertFails(addDoc(collection(db, 'vavsAuditLogs'), { entryId: 'e1' }));
  });

  it('cannot write Ad Book collections', async () => {
    const db = asGuest(env).firestore();
    await assertFails(setDoc(doc(db, 'ads/new'), { createdBy: 'guest', status: 'draft' }));
    await assertFails(updateDoc(doc(db, 'ads/a1'), { title: 'x' }));
    await assertFails(setDoc(doc(db, 'adBooks/b1'), { title: 'Convention' }));
    await assertFails(setDoc(doc(db, 'adSizes/full'), { label: 'Full', active: true }));
  });

  it('cannot write users, settings, or detachments', async () => {
    const db = asGuest(env).firestore();
    await assertFails(setDoc(doc(db, 'users/guest'), newProfile('guest')));
    await assertFails(setDoc(doc(db, 'settings/registration'), { mode: 'open' }));
    await assertFails(setDoc(doc(db, 'detachments/x'), { name: 'X', active: true }));
  });

  it('can read active detachments (public directory) but not VAVS data', async () => {
    const db = asGuest(env).firestore();
    await assertSucceeds(getDoc(doc(db, 'detachments/dof-054')));
    await assertSucceeds(getDocs(query(collection(db, 'detachments'), where('active', '==', true))));
    await assertFails(getDoc(doc(db, 'vavsEntries/e1')));
  });
});

describe('AC2 / #2: first sign-in profile creation and registration mode', () => {
  it('open mode (or no settings doc): self-create as active member succeeds', async () => {
    const db = asUser(env, 'newbie').firestore();
    await assertSucceeds(setDoc(doc(db, 'users/newbie'), newProfile('newbie')));

    await setRegistrationMode(env, 'open');
    const db2 = asUser(env, 'newbie2').firestore();
    await assertSucceeds(setDoc(doc(db2, 'users/newbie2'), newProfile('newbie2')));
  });

  it('open mode: self-create as pending is rejected (status must match mode)', async () => {
    await setRegistrationMode(env, 'open');
    const db = asUser(env, 'newbie').firestore();
    await assertFails(setDoc(doc(db, 'users/newbie'), newProfile('newbie', { status: 'pending' })));
  });

  it('approval mode: self-create must be pending; active is rejected', async () => {
    await setRegistrationMode(env, 'approval');
    const db = asUser(env, 'newbie').firestore();
    await assertFails(setDoc(doc(db, 'users/newbie'), newProfile('newbie')));
    await assertSucceeds(setDoc(doc(db, 'users/newbie'), newProfile('newbie', { status: 'pending' })));
  });

  it('cannot self-assign admin or other roles (issue #2)', async () => {
    const db = asUser(env, 'attacker').firestore();
    for (const roles of [
      ['member', 'departmentAdmin', 'nationalAdmin'],
      ['departmentAdmin'],
      ['member', 'detachmentVavsRep'],
      [],
    ]) {
      await assertFails(setDoc(doc(db, 'users/attacker'), newProfile('attacker', { roles })));
    }
  });

  it('cannot self-assign detachment scopes, suspended status, another uid, or extra fields', async () => {
    const db = asUser(env, 'attacker').firestore();
    await assertFails(
      setDoc(doc(db, 'users/attacker'), newProfile('attacker', { detachmentScopes: ['dof-054'] }))
    );
    await assertFails(setDoc(doc(db, 'users/attacker'), newProfile('attacker', { status: 'suspended' })));
    await assertFails(setDoc(doc(db, 'users/someoneElse'), newProfile('someoneElse')));
    await assertFails(setDoc(doc(db, 'users/attacker'), newProfile('attacker', { uid: 'x' })));
    await assertFails(
      setDoc(doc(db, 'users/attacker'), newProfile('attacker', { email: 'admin@example.com' }))
    );
    await assertFails(setDoc(doc(db, 'users/attacker'), newProfile('attacker', { isAdmin: true })));
  });

  it('pending and suspended users cannot write VAVS, ads, or their own profile', async () => {
    await seedUsers(env, { pat: USERS.pendingMember, sam: USERS.suspendedMember });
    for (const uid of ['pat', 'sam']) {
      const db = asUser(env, uid).firestore();
      await assertFails(setDoc(doc(db, `vavsEntries/${uid}-e`), vavsEntry(uid)));
      await assertFails(setDoc(doc(db, `ads/${uid}-a`), { createdBy: uid, status: 'draft' }));
      await assertFails(updateDoc(doc(db, `users/${uid}`), { displayName: 'Me' }));
      await assertFails(updateDoc(doc(db, `users/${uid}`), { status: 'active' }));
      // They can still read their own profile (to see the pending/suspended screen).
      await assertSucceeds(getDoc(doc(db, `users/${uid}`)));
    }
  });

  it('active members can write their own VAVS entry and ad draft', async () => {
    await seedUsers(env, { alice: USERS.member });
    const db = asUser(env, 'alice').firestore();
    await assertSucceeds(setDoc(doc(db, 'vavsEntries/a-e'), vavsEntry('alice')));
    await assertSucceeds(setDoc(doc(db, 'ads/a-a'), { createdBy: 'alice', status: 'draft' }));
  });
});

describe('users: self-service limits and admin role management', () => {
  beforeEach(async () => {
    await seedUsers(env, {
      alice: USERS.member,
      bob: USERS.member,
      admin: USERS.deptAdmin,
      approver: USERS.adApprover,
    });
  });

  it('a user may edit own profile fields but not roles, status, scopes, or email', async () => {
    const db = asUser(env, 'alice').firestore();
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { displayName: 'Alice', memberNumber: 'FL-1' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { roles: ['member', 'departmentAdmin'] }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { status: 'suspended' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { detachmentScopes: ['dof-054'] }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { email: 'x@example.com' }));
  });

  it('users cannot read or edit other users; admins can read all', async () => {
    const alice = asUser(env, 'alice').firestore();
    await assertFails(getDoc(doc(alice, 'users/bob')));
    await assertFails(updateDoc(doc(alice, 'users/bob'), { displayName: 'x' }));
    await assertSucceeds(getDocs(collection(asUser(env, 'admin').firestore(), 'users')));
  });

  it('AC3: department admin can assign detachmentVavsRep scoped to a detachment', async () => {
    const db = asUser(env, 'admin').firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'users/bob'), {
        roles: ['member', 'detachmentVavsRep'],
        detachmentScopes: ['dof-054'],
        updatedAt: serverTimestamp(),
      })
    );
    // The new scope is honored: bob can now read and edit entries in dof-054 only.
    await seed(env, {
      'vavsEntries/in': vavsEntry('alice', 'dof-054'),
      'vavsEntries/out': vavsEntry('alice', 'dof-055'),
    });
    const bob = asUser(env, 'bob').firestore();
    await assertSucceeds(getDoc(doc(bob, 'vavsEntries/in')));
    await assertSucceeds(updateDoc(doc(bob, 'vavsEntries/in'), { vaHours: 3 }));
    await assertFails(getDoc(doc(bob, 'vavsEntries/out')));
    await assertFails(updateDoc(doc(bob, 'vavsEntries/out'), { vaHours: 3 }));
  });

  it('admins can approve and suspend users; non-admins (incl. approvers) cannot assign roles', async () => {
    await seedUsers(env, { pat: USERS.pendingMember });
    const admin = asUser(env, 'admin').firestore();
    await assertSucceeds(updateDoc(doc(admin, 'users/pat'), { status: 'active' }));
    await assertSucceeds(updateDoc(doc(admin, 'users/bob'), { status: 'suspended' }));
    await assertFails(updateDoc(doc(admin, 'users/bob'), { status: 'superuser' }));

    const approver = asUser(env, 'approver').firestore();
    await assertFails(updateDoc(doc(approver, 'users/alice'), { roles: ['member', 'departmentAdmin'] }));
    const alice = asUser(env, 'alice').firestore();
    await assertFails(updateDoc(doc(alice, 'users/bob'), { roles: ['member', 'detachmentVavsRep'] }));
  });

  it('a suspended admin loses admin powers', async () => {
    await seedUsers(env, { exAdmin: { status: 'suspended', roles: ['member', 'departmentAdmin'] } });
    const db = asUser(env, 'exAdmin').firestore();
    await assertFails(updateDoc(doc(db, 'users/bob'), { roles: ['member', 'departmentAdmin'] }));
    await assertFails(setDoc(doc(db, 'settings/registration'), { mode: 'approval' }));
  });
});

describe('settings/registration and detachments: admin-only writes', () => {
  beforeEach(async () => {
    await seedUsers(env, {
      alice: USERS.member,
      admin: USERS.deptAdmin,
      natl: USERS.nationalAdmin,
      approver: USERS.adApprover,
    });
  });

  it('only department/national admins can set the registration mode', async () => {
    await assertFails(setDoc(doc(asUser(env, 'alice').firestore(), 'settings/registration'), { mode: 'open' }));
    await assertFails(
      setDoc(doc(asUser(env, 'approver').firestore(), 'settings/registration'), { mode: 'open' })
    );
    await assertSucceeds(
      setDoc(doc(asUser(env, 'admin').firestore(), 'settings/registration'), {
        mode: 'approval',
        updatedAt: serverTimestamp(),
        updatedBy: 'admin',
      })
    );
    await assertSucceeds(
      setDoc(doc(asUser(env, 'natl').firestore(), 'settings/registration'), { mode: 'open' })
    );
  });

  it('rejects invalid registration modes and extra fields, even from admins', async () => {
    const db = asUser(env, 'admin').firestore();
    await assertFails(setDoc(doc(db, 'settings/registration'), { mode: 'closed' }));
    await assertFails(setDoc(doc(db, 'settings/registration'), { mode: 'open', extra: true }));
  });

  it('signed-in users can read the registration mode', async () => {
    await setRegistrationMode(env, 'approval');
    await assertSucceeds(getDoc(doc(asUser(env, 'alice').firestore(), 'settings/registration')));
  });

  it('only admins can create, edit, or deactivate detachments', async () => {
    await seed(env, { 'detachments/dof-054': { name: 'Morris F. Dixon Jr.', number: '54', active: true } });
    const alice = asUser(env, 'alice').firestore();
    await assertFails(setDoc(doc(alice, 'detachments/dof-999'), { name: 'X', active: true }));
    await assertFails(updateDoc(doc(alice, 'detachments/dof-054'), { active: false }));
    const admin = asUser(env, 'admin').firestore();
    await assertSucceeds(
      setDoc(doc(admin, 'detachments/dof-archambault-unverified'), {
        name: 'S/Sgt Ted Archambault',
        number: '',
        active: true,
        needsVerification: true,
      })
    );
    await assertSucceeds(updateDoc(doc(admin, 'detachments/dof-054'), { active: false }));
  });
});

describe('#8: vavsAuditLogs cannot be forged', () => {
  beforeEach(async () => {
    await seedUsers(env, {
      alice: USERS.member,
      rep54: USERS.detRep54,
      deptRep: USERS.deptVavsRep,
      admin: USERS.deptAdmin,
    });
  });

  const log = (actorUid: string, actorRole: string, detachmentId = 'dof-054', extra = {}) => ({
    entryId: 'e1',
    action: 'update',
    actorUid,
    actorRole,
    detachmentId,
    at: serverTimestamp(),
    before: { vaHours: 1 },
    after: { vaHours: 2 },
    ...extra,
  });

  it('members cannot create audit logs (even claiming a rep role)', async () => {
    const db = asUser(env, 'alice').firestore();
    await assertFails(addDoc(collection(db, 'vavsAuditLogs'), log('alice', 'member')));
    await assertFails(addDoc(collection(db, 'vavsAuditLogs'), log('alice', 'departmentVavsRep')));
    await assertFails(addDoc(collection(db, 'vavsAuditLogs'), log('deptRep', 'departmentVavsRep')));
  });

  it('a detachment rep can log only as themselves, for their own detachment', async () => {
    const db = asUser(env, 'rep54').firestore();
    await assertSucceeds(addDoc(collection(db, 'vavsAuditLogs'), log('rep54', 'detachmentVavsRep')));
    await assertFails(
      addDoc(collection(db, 'vavsAuditLogs'), log('rep54', 'detachmentVavsRep', 'dof-055'))
    );
    await assertFails(addDoc(collection(db, 'vavsAuditLogs'), log('deptRep', 'detachmentVavsRep')));
    await assertFails(addDoc(collection(db, 'vavsAuditLogs'), log('rep54', 'departmentVavsRep')));
  });

  it('department reps and admins can log within the department', async () => {
    await assertSucceeds(
      addDoc(
        collection(asUser(env, 'deptRep').firestore(), 'vavsAuditLogs'),
        log('deptRep', 'departmentVavsRep', 'dof-055')
      )
    );
    await assertSucceeds(
      addDoc(collection(asUser(env, 'admin').firestore(), 'vavsAuditLogs'), log('admin', 'departmentAdmin'))
    );
  });

  it('rejects extra fields, unknown actions, missing fields, and client-chosen timestamps', async () => {
    const db = asUser(env, 'rep54').firestore();
    const col = collection(db, 'vavsAuditLogs');
    await assertFails(addDoc(col, log('rep54', 'detachmentVavsRep', 'dof-054', { forged: true })));
    await assertFails(addDoc(col, log('rep54', 'detachmentVavsRep', 'dof-054', { action: 'approve' })));
    await assertFails(
      addDoc(col, log('rep54', 'detachmentVavsRep', 'dof-054', { at: Timestamp.fromDate(new Date(2020, 0, 1)) }))
    );
    const { entryId: _omit, ...missing } = log('rep54', 'detachmentVavsRep');
    void _omit;
    await assertFails(addDoc(col, missing));
  });

  it('audit logs are immutable', async () => {
    await seed(env, { 'vavsAuditLogs/l1': { ...log('rep54', 'detachmentVavsRep'), at: Timestamp.now() } });
    for (const uid of ['rep54', 'admin']) {
      const db = asUser(env, uid).firestore();
      await assertFails(updateDoc(doc(db, 'vavsAuditLogs/l1'), { after: {} }));
      await assertFails(deleteDoc(doc(db, 'vavsAuditLogs/l1')));
    }
  });

  it('members cannot read audit logs; reps read only their scope', async () => {
    await seed(env, {
      'vavsAuditLogs/l54': { ...log('admin', 'departmentAdmin'), at: Timestamp.now() },
      'vavsAuditLogs/l55': { ...log('admin', 'departmentAdmin', 'dof-055'), at: Timestamp.now() },
    });
    await assertFails(getDoc(doc(asUser(env, 'alice').firestore(), 'vavsAuditLogs/l54')));
    const rep = asUser(env, 'rep54').firestore();
    await assertSucceeds(getDoc(doc(rep, 'vavsAuditLogs/l54')));
    await assertFails(getDoc(doc(rep, 'vavsAuditLogs/l55')));
  });
});

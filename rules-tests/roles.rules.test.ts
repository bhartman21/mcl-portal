/**
 * siteAdmin role and admin grant hierarchy (ROLES_AND_PERMISSIONS.md "Admin role grants",
 * decided Nov 14, 2026). Revoke rules follow the grant table (inferred, OPEN_QUESTIONS #17).
 */
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
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  asGuest,
  asUser,
  auditedRoleChange,
  emailFor,
  getTestEnv,
  resetEnv,
  seed,
  seedUsers,
  UserFixture,
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

const NON_ADMIN = ['member', 'companyAdvertiser', 'detachmentVavsRep', 'departmentVavsRep', 'adBookApprover'];
const ALL_ROLES = [...NON_ADMIN, 'departmentAdmin', 'nationalAdmin', 'siteAdmin'];

/** Expected grant/revoke set per actor (the decided table). */
const ACTORS: { name: string; fixture: UserFixture; grantable: string[] }[] = [
  { name: 'siteAdmin', fixture: USERS.siteAdmin, grantable: ALL_ROLES },
  {
    name: 'nationalAdmin',
    fixture: USERS.nationalAdmin,
    grantable: [...NON_ADMIN, 'departmentAdmin', 'nationalAdmin'],
  },
  { name: 'departmentAdmin', fixture: USERS.deptAdmin, grantable: [...NON_ADMIN, 'departmentAdmin'] },
  { name: 'adBookApprover', fixture: USERS.adApprover, grantable: [] },
  { name: 'departmentVavsRep', fixture: USERS.deptVavsRep, grantable: [] },
  { name: 'detachmentVavsRep', fixture: USERS.detRep54, grantable: [] },
  { name: 'member', fixture: USERS.member, grantable: [] },
  { name: 'pending siteAdmin', fixture: { status: 'pending', roles: ['member', 'siteAdmin'] }, grantable: [] },
  {
    name: 'suspended siteAdmin',
    fixture: { status: 'suspended', roles: ['member', 'siteAdmin'] },
    grantable: [],
  },
];

/** A non-admin role the target keeps throughout, different from the role under test. */
const fillerFor = (role: string) => (role === 'member' ? 'companyAdvertiser' : 'member');

describe('grant and revoke matrix: every actor x every role', () => {
  for (const actor of ACTORS) {
    for (const role of ALL_ROLES) {
      const allowed = actor.grantable.includes(role);
      const verb = allowed ? 'may' : 'may NOT';
      const filler = fillerFor(role);

      it(`${actor.name} ${verb} grant ${role}`, async () => {
        await seedUsers(env, { actor: actor.fixture, target: { status: 'active', roles: [filler] } });
        const write = auditedRoleChange(asUser(env, 'actor').firestore(), {
          actorUid: 'actor',
          actorRoles: actor.fixture.roles,
          targetUid: 'target',
          beforeRoles: [filler],
          afterRoles: [filler, role],
        });
        await (allowed ? assertSucceeds(write) : assertFails(write));
      });

      it(`${actor.name} ${verb} revoke ${role}`, async () => {
        await seedUsers(env, {
          actor: actor.fixture,
          target: { status: 'active', roles: [filler, role] },
        });
        const write = auditedRoleChange(asUser(env, 'actor').firestore(), {
          actorUid: 'actor',
          actorRoles: actor.fixture.roles,
          targetUid: 'target',
          beforeRoles: [filler, role],
          afterRoles: [filler],
        });
        await (allowed ? assertSucceeds(write) : assertFails(write));
      });
    }
  }
});

describe('self-escalation is impossible', () => {
  it('self-created profiles may only hold ["member"] (no siteAdmin bootstrap from the client)', async () => {
    for (const roles of [['member', 'siteAdmin'], ['siteAdmin'], ['member', 'nationalAdmin']]) {
      await assertFails(
        setDoc(doc(asUser(env, 'newbie').firestore(), 'users/newbie'), {
          uid: 'newbie',
          email: emailFor('newbie'),
          status: 'active',
          roles,
          detachmentScopes: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }
  });

  it('a member cannot add any role to themselves, audited or not', async () => {
    await seedUsers(env, { alice: USERS.member });
    const db = asUser(env, 'alice').firestore();
    for (const role of ['adBookApprover', 'departmentAdmin', 'nationalAdmin', 'siteAdmin']) {
      await assertFails(updateDoc(doc(db, 'users/alice'), { roles: ['member', role] }));
      await assertFails(
        auditedRoleChange(db, {
          actorUid: 'alice',
          actorRoles: ['member'],
          targetUid: 'alice',
          beforeRoles: ['member'],
          afterRoles: ['member', role],
        })
      );
    }
  });

  it('no admin can change their own roles, even to a role they may grant others', async () => {
    const cases: [UserFixture, string][] = [
      [USERS.deptAdmin, 'nationalAdmin'],
      [USERS.deptAdmin, 'siteAdmin'],
      [USERS.deptAdmin, 'adBookApprover'],
      [USERS.nationalAdmin, 'siteAdmin'],
      [USERS.nationalAdmin, 'departmentAdmin'],
      [USERS.siteAdmin, 'nationalAdmin'],
    ];
    for (const [fixture, role] of cases) {
      await resetEnv(env);
      await seedUsers(env, { me: fixture });
      const db = asUser(env, 'me').firestore();
      await assertFails(
        auditedRoleChange(db, {
          actorUid: 'me',
          actorRoles: fixture.roles,
          targetUid: 'me',
          beforeRoles: fixture.roles,
          afterRoles: [...fixture.roles, role],
        })
      );
    }
  });

  it('admins cannot drop their own admin role or suspend themselves', async () => {
    await seedUsers(env, { me: USERS.siteAdmin });
    const db = asUser(env, 'me').firestore();
    await assertFails(
      auditedRoleChange(db, {
        actorUid: 'me',
        actorRoles: USERS.siteAdmin.roles,
        targetUid: 'me',
        beforeRoles: USERS.siteAdmin.roles,
        afterRoles: ['member'],
      })
    );
    await assertFails(updateDoc(doc(db, 'users/me'), { status: 'suspended' }));
    await assertFails(deleteDoc(doc(db, 'users/me')));
  });

  it('pending and suspended users cannot write their roles or anyone else\'s', async () => {
    await seedUsers(env, {
      pend: { status: 'pending', roles: ['member', 'siteAdmin'] },
      susp: { status: 'suspended', roles: ['member', 'nationalAdmin'] },
      bob: USERS.member,
    });
    for (const uid of ['pend', 'susp']) {
      const db = asUser(env, uid).firestore();
      await assertFails(updateDoc(doc(db, `users/${uid}`), { status: 'active' }));
      await assertFails(updateDoc(doc(db, 'users/bob'), { status: 'suspended' }));
    }
  });

  it('cannot assign an unknown role id or an empty role list, even as siteAdmin', async () => {
    await seedUsers(env, { site: USERS.siteAdmin, bob: USERS.member });
    const db = asUser(env, 'site').firestore();
    for (const afterRoles of [['member', 'superuser'], ['guest'], []]) {
      await assertFails(
        auditedRoleChange(db, {
          actorUid: 'site',
          actorRoles: USERS.siteAdmin.roles,
          targetUid: 'bob',
          beforeRoles: ['member'],
          afterRoles,
        })
      );
    }
  });
});

describe('managing users above you (inferred revoke rule)', () => {
  beforeEach(async () => {
    await seedUsers(env, {
      site: USERS.siteAdmin,
      site2: USERS.siteAdmin,
      natl: USERS.nationalAdmin,
      natl2: USERS.nationalAdmin,
      dept: USERS.deptAdmin,
      dept2: USERS.deptAdmin,
      bob: USERS.member,
    });
  });

  it('department admin cannot suspend, delete, or edit national/site admins; can manage peers and members', async () => {
    const db = asUser(env, 'dept').firestore();
    for (const uid of ['natl', 'site']) {
      await assertFails(updateDoc(doc(db, `users/${uid}`), { status: 'suspended' }));
      await assertFails(updateDoc(doc(db, `users/${uid}`), { displayName: 'x' }));
      await assertFails(deleteDoc(doc(db, `users/${uid}`)));
    }
    // Revoking departmentAdmin from someone who is also a national admin is out of reach too.
    await seedUsers(env, { both: { status: 'active', roles: ['member', 'departmentAdmin', 'nationalAdmin'] } });
    await assertFails(
      auditedRoleChange(db, {
        actorUid: 'dept',
        actorRoles: USERS.deptAdmin.roles,
        targetUid: 'both',
        beforeRoles: ['member', 'departmentAdmin', 'nationalAdmin'],
        afterRoles: ['member', 'nationalAdmin'],
      })
    );
    await assertSucceeds(updateDoc(doc(db, 'users/dept2'), { status: 'suspended' }));
    await assertSucceeds(updateDoc(doc(db, 'users/bob'), { status: 'suspended' }));
  });

  it('national admin can manage national/department admins but not site admins', async () => {
    const db = asUser(env, 'natl').firestore();
    await assertFails(updateDoc(doc(db, 'users/site'), { status: 'suspended' }));
    await assertFails(deleteDoc(doc(db, 'users/site')));
    await assertSucceeds(updateDoc(doc(db, 'users/natl2'), { status: 'suspended' }));
    await assertSucceeds(updateDoc(doc(db, 'users/dept'), { status: 'suspended' }));
  });

  it('site admin can manage anyone else, including another site admin', async () => {
    const db = asUser(env, 'site').firestore();
    await assertSucceeds(updateDoc(doc(db, 'users/natl'), { status: 'suspended' }));
    await assertSucceeds(
      auditedRoleChange(db, {
        actorUid: 'site',
        actorRoles: USERS.siteAdmin.roles,
        targetUid: 'site2',
        beforeRoles: USERS.siteAdmin.roles,
        afterRoles: ['member'],
      })
    );
    await assertSucceeds(deleteDoc(doc(db, 'users/bob')));
  });

  it('admins cannot change a user\'s uid or email', async () => {
    const db = asUser(env, 'site').firestore();
    await assertFails(updateDoc(doc(db, 'users/bob'), { email: 'evil@example.com' }));
    await assertFails(updateDoc(doc(db, 'users/bob'), { uid: 'someone-else' }));
  });
});

describe('every grant/revoke is audited, and audits cannot be forged', () => {
  beforeEach(async () => {
    await seedUsers(env, {
      site: USERS.siteAdmin,
      dept: USERS.deptAdmin,
      bob: USERS.member,
      alice: USERS.member,
    });
  });

  const change = (overrides: Partial<Parameters<typeof auditedRoleChange>[1]> = {}) => ({
    actorUid: 'dept',
    actorRoles: USERS.deptAdmin.roles,
    targetUid: 'bob',
    beforeRoles: ['member'],
    afterRoles: ['member', 'adBookApprover'],
    ...overrides,
  });

  it('a role or scope change without its audit entry is rejected (even for siteAdmin)', async () => {
    const db = asUser(env, 'site').firestore();
    await assertFails(updateDoc(doc(db, 'users/bob'), { roles: ['member', 'adBookApprover'] }));
    await assertFails(updateDoc(doc(db, 'users/bob'), { detachmentScopes: ['dof-054'] }));
    // A roleAuditId pointing at no audit doc is not enough.
    await assertFails(
      updateDoc(doc(db, 'users/bob'), { roles: ['member', 'adBookApprover'], roleAuditId: 'ghost' })
    );
  });

  it('the audited batch succeeds and records who, when, target, before/after roles', async () => {
    const db = asUser(env, 'dept').firestore();
    await assertSucceeds(auditedRoleChange(db, { ...change(), auditId: 'a1' }));
    const snap = await assertSucceeds(getDoc(doc(db, 'audits/a1')));
    const a = snap.data()!;
    if (
      a['actorUid'] !== 'dept' ||
      a['targetUid'] !== 'bob' ||
      !(a['at'] instanceof Timestamp) ||
      JSON.stringify(a['beforeRoles']) !== '["member"]' ||
      JSON.stringify(a['afterRoles']) !== '["member","adBookApprover"]'
    ) {
      throw new Error(`unexpected audit ${JSON.stringify(a)}`);
    }
  });

  it('status-only changes (approve/suspend) need no audit', async () => {
    await assertSucceeds(updateDoc(doc(asUser(env, 'dept').firestore(), 'users/bob'), { status: 'suspended' }));
  });

  it('a standalone audit entry (no matching user change) is rejected', async () => {
    const db = asUser(env, 'dept').firestore();
    await assertFails(
      setDoc(doc(db, 'audits/fake'), {
        action: 'roleChange',
        actorUid: 'dept',
        actorRoles: USERS.deptAdmin.roles,
        targetUid: 'bob',
        at: serverTimestamp(),
        beforeRoles: ['member'],
        afterRoles: ['member', 'adBookApprover'],
        beforeScopes: [],
        afterScopes: [],
      })
    );
  });

  it('rejects audits that misstate the change, actor, roles, time, action, or fields', async () => {
    const db = asUser(env, 'dept').firestore();
    const forgeries: Record<string, unknown>[] = [
      { beforeRoles: ['member', 'departmentAdmin'] },
      { afterRoles: ['member'] },
      { afterScopes: ['dof-054'] },
      { actorUid: 'site' },
      { actorRoles: USERS.siteAdmin.roles },
      { at: Timestamp.fromDate(new Date(2020, 0, 1)) },
      { action: 'lockReset' },
      { note: 'extra field' },
      { targetUid: 'alice' },
    ];
    for (const audit of forgeries) {
      await assertFails(auditedRoleChange(db, change({ audit })));
    }
  });

  it('members and non-admins cannot write audits, even alongside a change', async () => {
    const db = asUser(env, 'alice').firestore();
    await assertFails(
      auditedRoleChange(db, change({ actorUid: 'alice', actorRoles: ['member'] }))
    );
    await assertFails(addDoc(collection(db, 'audits'), { action: 'roleChange', actorUid: 'alice' }));
  });

  it('an audit id cannot be reused for a second change', async () => {
    const db = asUser(env, 'dept').firestore();
    await assertSucceeds(auditedRoleChange(db, { ...change(), auditId: 'once' }));
    await assertFails(
      auditedRoleChange(db, {
        ...change({ beforeRoles: ['member', 'adBookApprover'], afterRoles: ['member'] }),
        auditId: 'once',
      })
    );
  });

  it('audits are immutable and readable only by admins', async () => {
    await seed(env, {
      'audits/old': {
        action: 'roleChange',
        actorUid: 'dept',
        actorRoles: USERS.deptAdmin.roles,
        targetUid: 'bob',
        at: Timestamp.now(),
        beforeRoles: ['member'],
        afterRoles: ['member', 'adBookApprover'],
        beforeScopes: [],
        afterScopes: [],
      },
    });
    for (const uid of ['dept', 'site']) {
      const db = asUser(env, uid).firestore();
      await assertSucceeds(getDoc(doc(db, 'audits/old')));
      await assertFails(updateDoc(doc(db, 'audits/old'), { afterRoles: [] }));
      await assertFails(deleteDoc(doc(db, 'audits/old')));
    }
    await assertFails(getDoc(doc(asUser(env, 'alice').firestore(), 'audits/old')));
    await assertFails(getDoc(doc(asUser(env, 'bob').firestore(), 'audits/old')));
    await assertFails(getDoc(doc(asGuest(env).firestore(), 'audits/old')));
  });
});

describe('siteAdmin has every nationalAdmin permission', () => {
  beforeEach(async () => {
    await seedUsers(env, { site: USERS.siteAdmin, alice: USERS.member });
    await seed(env, {
      'detachments/dof-054': { name: 'Morris F. Dixon Jr.', number: '54', active: true },
      'ads/a1': { createdBy: 'alice', status: 'draft' },
      'vavsEntries/e1': { ownerUid: 'alice', detachmentId: 'dof-054', vaHours: 1 },
    });
  });

  it('users, settings, detachments, ad sizes, ad books, ads, VAVS, and VAVS audit logs', async () => {
    const db = asUser(env, 'site').firestore();
    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertSucceeds(
      setDoc(doc(db, 'settings/registration'), {
        mode: 'approval',
        updatedAt: serverTimestamp(),
        updatedBy: 'site',
      })
    );
    await assertSucceeds(setDoc(doc(db, 'settings/branding'), { name: 'MCL DoF' }));
    await assertSucceeds(setDoc(doc(db, 'detachments/dof-999'), { name: 'New', number: '999', active: true }));
    await assertSucceeds(setDoc(doc(db, 'adSizes/full'), { label: 'Full page', active: true }));
    await assertSucceeds(setDoc(doc(db, 'adBooks/b1'), { title: 'Convention 2027' }));
    await assertSucceeds(getDoc(doc(db, 'ads/a1')));
    await assertSucceeds(getDoc(doc(db, 'vavsEntries/e1')));
    await assertSucceeds(updateDoc(doc(db, 'vavsEntries/e1'), { vaHours: 2 }));
    await assertSucceeds(setDoc(doc(db, 'vavsPeriods/p1'), { year: 2026 }));
    await assertSucceeds(
      addDoc(collection(db, 'vavsAuditLogs'), {
        entryId: 'e1',
        action: 'update',
        actorUid: 'site',
        actorRole: 'siteAdmin',
        detachmentId: 'dof-054',
        at: serverTimestamp(),
      })
    );
  });

  it('Storage: reads any ad image and deletes others\' images', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), 'ad-images/alice/a1/ad.png'), new Uint8Array([1, 2, 3]), {
        contentType: 'image/png',
      });
    });
    const storage = asUser(env, 'site').storage();
    await assertSucceeds(getBytes(ref(storage, 'ad-images/alice/a1/ad.png')));
    await assertSucceeds(deleteObject(ref(storage, 'ad-images/alice/a1/ad.png')));
  });
});

describe('detachment directory is public (active entries only)', () => {
  beforeEach(async () => {
    await seed(env, {
      'detachments/dof-054': { name: 'Morris F. Dixon Jr.', number: '54', active: true },
      'detachments/dof-old': { name: 'Closed Detachment', number: '99', active: false },
    });
  });

  it('signed-out visitors can read and list active detachments', async () => {
    const db = asGuest(env).firestore();
    await assertSucceeds(getDoc(doc(db, 'detachments/dof-054')));
    await assertSucceeds(getDocs(query(collection(db, 'detachments'), where('active', '==', true))));
  });

  it('signed-out visitors cannot read inactive detachments or list without the active filter', async () => {
    const db = asGuest(env).firestore();
    await assertFails(getDoc(doc(db, 'detachments/dof-old')));
    await assertFails(getDocs(collection(db, 'detachments')));
  });

  it('active members can read inactive detachments too', async () => {
    await seedUsers(env, { alice: USERS.member });
    await assertSucceeds(getDoc(doc(asUser(env, 'alice').firestore(), 'detachments/dof-old')));
  });
});

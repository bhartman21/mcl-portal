/**
 * Shared harness for Firestore/Storage security-rules tests.
 *
 * Add a new suite as rules-tests/<area>.rules.test.ts:
 *   const env = await getTestEnv();
 *   await seedUsers(env, { alice: USERS.member });
 *   await assertFails(asUser(env, 'alice').firestore() ... );
 * Each test starts from a clean emulator via resetEnv().
 */
import {
  initializeTestEnvironment,
  RulesTestContext,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  collection,
  doc,
  Firestore,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';

export const PROJECT_ID = 'demo-mcl-portal';

let env: RulesTestEnvironment | undefined;

export async function getTestEnv(): Promise<RulesTestEnvironment> {
  if (env) return env;
  const root = process.cwd();
  // `firebase emulators:exec` exports the emulator addresses; fall back to firebase.json defaults.
  const [fsHost, fsPort] = hostPort(process.env['FIRESTORE_EMULATOR_HOST'], 8080);
  const [stHost, stPort] = hostPort(process.env['FIREBASE_STORAGE_EMULATOR_HOST'], 9199);
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(root, 'firestore.rules'), 'utf8'),
      host: fsHost,
      port: fsPort,
    },
    storage: {
      rules: readFileSync(resolve(root, 'storage.rules'), 'utf8'),
      host: stHost,
      port: stPort,
    },
  });
  return env;
}

function hostPort(value: string | undefined, defaultPort: number): [string, number] {
  if (!value) return ['127.0.0.1', defaultPort];
  const i = value.lastIndexOf(':');
  return [value.slice(0, i) || '127.0.0.1', Number(value.slice(i + 1)) || defaultPort];
}

export async function resetEnv(e: RulesTestEnvironment): Promise<void> {
  await e.clearFirestore();
  await e.clearStorage();
}

export interface UserFixture {
  status: 'active' | 'pending' | 'suspended';
  roles: string[];
  detachmentScopes?: string[];
}

/** Canonical personas; extend as new roles/scopes need coverage. */
export const USERS = {
  member: { status: 'active', roles: ['member'] },
  pendingMember: { status: 'pending', roles: ['member'] },
  suspendedMember: { status: 'suspended', roles: ['member'] },
  detRep54: { status: 'active', roles: ['member', 'detachmentVavsRep'], detachmentScopes: ['dof-054'] },
  deptVavsRep: { status: 'active', roles: ['member', 'departmentVavsRep'] },
  adApprover: { status: 'active', roles: ['member', 'adBookApprover'] },
  deptAdmin: { status: 'active', roles: ['member', 'departmentAdmin'] },
  nationalAdmin: { status: 'active', roles: ['member', 'nationalAdmin'] },
  siteAdmin: { status: 'active', roles: ['member', 'siteAdmin'] },
} satisfies Record<string, UserFixture>;

export function emailFor(uid: string): string {
  return `${uid}@example.com`;
}

/** Authenticated context with an email claim (email-link sign-in always provides one). */
export function asUser(e: RulesTestEnvironment, uid: string): RulesTestContext {
  return e.authenticatedContext(uid, { email: emailFor(uid), email_verified: true });
}

export function asGuest(e: RulesTestEnvironment): RulesTestContext {
  return e.unauthenticatedContext();
}

/** Write docs bypassing rules (test setup only). */
export async function seed(
  e: RulesTestEnvironment,
  docs: Record<string, Record<string, unknown>>
): Promise<void> {
  await e.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [path, data] of Object.entries(docs)) {
      await setDoc(doc(db, path), data);
    }
  });
}

export async function seedUsers(
  e: RulesTestEnvironment,
  users: Record<string, UserFixture>
): Promise<void> {
  const docs: Record<string, Record<string, unknown>> = {};
  for (const [uid, u] of Object.entries(users)) {
    docs[`users/${uid}`] = {
      uid,
      email: emailFor(uid),
      status: u.status,
      roles: u.roles,
      detachmentScopes: u.detachmentScopes ?? [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
  }
  await seed(e, docs);
}

export async function setRegistrationMode(
  e: RulesTestEnvironment,
  mode: 'open' | 'approval'
): Promise<void> {
  await seed(e, { 'settings/registration': { mode } });
}

export interface RoleChange {
  actorUid: string;
  actorRoles: string[];
  targetUid: string;
  beforeRoles: string[];
  afterRoles: string[];
  beforeScopes?: string[];
  afterScopes?: string[];
  /** Override fields of the audit doc (forgery tests). */
  audit?: Record<string, unknown>;
  /** Override fields of the users update (forgery tests). */
  user?: Record<string, unknown>;
  /** Fixed audit id (reuse tests); random by default. */
  auditId?: string;
}

/**
 * The batched write AdminService.updateUserRoles performs: users/{target} gets the new roles plus
 * a fresh roleAuditId, and audits/{roleAuditId} records who/when/target/before/after.
 */
export function auditedRoleChange(db: Firestore, c: RoleChange): Promise<void> {
  const auditRef = c.auditId ? doc(db, 'audits', c.auditId) : doc(collection(db, 'audits'));
  const afterScopes = c.afterScopes ?? [];
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', c.targetUid), {
    roles: c.afterRoles,
    detachmentScopes: afterScopes,
    roleAuditId: auditRef.id,
    updatedAt: serverTimestamp(),
    ...c.user,
  });
  batch.set(auditRef, {
    action: 'roleChange',
    actorUid: c.actorUid,
    actorRoles: c.actorRoles,
    targetUid: c.targetUid,
    at: serverTimestamp(),
    beforeRoles: c.beforeRoles,
    afterRoles: c.afterRoles,
    beforeScopes: c.beforeScopes ?? [],
    afterScopes,
    ...c.audit,
  });
  return batch.commit();
}

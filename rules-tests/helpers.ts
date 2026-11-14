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
import { doc, setDoc, Timestamp } from 'firebase/firestore';

export const PROJECT_ID = 'demo-mcl-portal';

let env: RulesTestEnvironment | undefined;

export async function getTestEnv(): Promise<RulesTestEnvironment> {
  if (env) return env;
  const root = process.cwd();
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(root, 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
    storage: {
      rules: readFileSync(resolve(root, 'storage.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
  return env;
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

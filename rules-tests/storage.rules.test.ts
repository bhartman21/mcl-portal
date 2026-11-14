import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
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
    bob: USERS.member,
    pat: USERS.pendingMember,
    approver: USERS.adApprover,
  });
});

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const meta = { contentType: 'image/png' };

async function seedImage(path: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), path), png, meta);
  });
}

describe('storage: ad-images', () => {
  it('guests and pending users cannot upload', async () => {
    await assertFails(uploadBytes(ref(asGuest(env).storage(), 'ad-images/alice/ad1/a.png'), png, meta));
    await assertFails(uploadBytes(ref(asUser(env, 'pat').storage(), 'ad-images/pat/ad1/a.png'), png, meta));
  });

  it('active users upload images only under their own uid', async () => {
    const st = asUser(env, 'alice').storage();
    await assertSucceeds(uploadBytes(ref(st, 'ad-images/alice/ad1/a.png'), png, meta));
    await assertFails(uploadBytes(ref(st, 'ad-images/bob/ad1/a.png'), png, meta));
  });

  it('only jpeg/png/webp images are accepted', async () => {
    const st = asUser(env, 'alice').storage();
    await assertFails(
      uploadBytes(ref(st, 'ad-images/alice/ad1/a.pdf'), png, { contentType: 'application/pdf' })
    );
  });

  it('owner and approvers can read; other members only once the ad is approved', async () => {
    await seedImage('ad-images/alice/ad1/a.png');
    await seed(env, { 'ads/ad1': { createdBy: 'alice', status: 'submitted' } });
    const path = 'ad-images/alice/ad1/a.png';
    await assertSucceeds(getBytes(ref(asUser(env, 'alice').storage(), path)));
    await assertSucceeds(getBytes(ref(asUser(env, 'approver').storage(), path)));
    await assertFails(getBytes(ref(asUser(env, 'bob').storage(), path)));
    await assertFails(getBytes(ref(asGuest(env).storage(), path)));

    await seed(env, { 'ads/ad1': { createdBy: 'alice', status: 'approved' } });
    await assertSucceeds(getBytes(ref(asUser(env, 'bob').storage(), path)));
  });
});

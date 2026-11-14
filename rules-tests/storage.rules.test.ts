import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';
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

// Issue #24: once an ad is submitted, the reviewed image is frozen. The owner may only add, replace,
// or delete it while the ad is editable (AD_BOOK.md workflow: draft, or rejected and not locked),
// or before the ad doc exists (first upload of a new ad).
describe('storage: ad-images are frozen after submit (#24)', () => {
  const path = 'ad-images/alice/ad1/a.png';
  const ad = (fields: Record<string, unknown>) => ({ 'ads/ad1': { createdBy: 'alice', ...fields } });

  beforeEach(async () => {
    await seedUsers(env, { deptAdmin: USERS.deptAdmin });
  });

  it('owner can upload, replace, and delete while the ad is a draft', async () => {
    await seed(env, ad({ status: 'draft' }));
    const st = asUser(env, 'alice').storage();
    await assertSucceeds(uploadBytes(ref(st, path), png, meta));
    await assertSucceeds(uploadBytes(ref(st, path), png, meta));
    await assertSucceeds(deleteObject(ref(st, path)));
  });

  it('owner can upload the first image before the ad doc exists', async () => {
    await assertSucceeds(uploadBytes(ref(asUser(env, 'alice').storage(), path), png, meta));
  });

  it('owner can replace the image on a rejected ad that is not locked (editing returns it to draft)', async () => {
    await seedImage(path);
    await seed(env, ad({ status: 'rejected', locked: false }));
    const st = asUser(env, 'alice').storage();
    await assertSucceeds(uploadBytes(ref(st, path), png, meta));
    await assertSucceeds(deleteObject(ref(st, path)));
  });

  for (const status of ['submitted', 'approved']) {
    it(`owner cannot replace or delete the image once the ad is ${status}`, async () => {
      await seedImage(path);
      await seed(env, ad({ status }));
      const st = asUser(env, 'alice').storage();
      await assertFails(uploadBytes(ref(st, path), png, meta));
      await assertFails(uploadBytes(ref(st, 'ad-images/alice/ad1/b.png'), png, meta));
      await assertFails(deleteObject(ref(st, path)));
    });
  }

  it('owner cannot replace or delete the image on a locked rejected ad', async () => {
    await seedImage(path);
    await seed(env, ad({ status: 'rejected', locked: true }));
    const st = asUser(env, 'alice').storage();
    await assertFails(uploadBytes(ref(st, path), png, meta));
    await assertFails(deleteObject(ref(st, path)));
  });

  it("a member cannot write under their own uid for someone else's ad id", async () => {
    await seed(env, { 'ads/ad1': { createdBy: 'bob', status: 'draft' } });
    await assertFails(uploadBytes(ref(asUser(env, 'alice').storage(), path), png, meta));
  });

  it('admins can still delete an image on a submitted ad (moderation cleanup)', async () => {
    await seedImage(path);
    await seed(env, ad({ status: 'submitted' }));
    await assertSucceeds(deleteObject(ref(asUser(env, 'deptAdmin').storage(), path)));
  });
});

// siteAdmin counts as an admin for ad images (pairs with PR #18).
describe('storage: siteAdmin on ad-images', () => {
  it('reads and deletes an image on a submitted ad', async () => {
    await seedUsers(env, { siteAdmin: USERS.siteAdmin });
    const path = 'ad-images/alice/ad1/a.png';
    await seedImage(path);
    await seed(env, { 'ads/ad1': { createdBy: 'alice', status: 'submitted' } });
    const st = asUser(env, 'siteAdmin').storage();
    await assertSucceeds(getBytes(ref(st, path)));
    await assertSucceeds(deleteObject(ref(st, path)));
  });
});

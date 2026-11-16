import { afterEach, describe, expect, it, vi } from 'vitest';

// Wiring check: the deployed trigger uses the configured topic, us-east1, and the dedicated service account.
describe('budgetGuard function definition', () => {
  afterEach(() => vi.resetModules());

  it('is a 2nd-gen Pub/Sub function in us-east1 running as budget-guard@', async () => {
    const mod = await import('../src/index');
    const endpoint = (mod.budgetGuard as unknown as { __endpoint: Record<string, unknown> }).__endpoint;
    expect(endpoint['platform']).toBe('gcfv2');
    expect(endpoint['region']).toEqual(['us-east1']);
    expect(endpoint['serviceAccountEmail']).toBe('budget-guard@');
    const trigger = endpoint['eventTrigger'] as { eventType: string; eventFilters: Record<string, unknown>; retry: boolean };
    expect(trigger.eventType).toBe('google.cloud.pubsub.topic.v1.messagePublished');
    expect(String(trigger.eventFilters['topic'])).toContain('BUDGET_GUARD_TOPIC');
    expect(trigger.retry).toBe(false);
  });

  it('declared defaults (applied by the Firebase CLI at deploy): topic "budget-guard", dry run off', async () => {
    const mod = await import('../src/index');
    expect(mod.budgetTopic.options.default).toBe('budget-guard');
    expect(mod.dryRun.options.default).toBe(false);
  });

  it('dry run is turned on by BUDGET_GUARD_DRY_RUN=true', async () => {
    vi.stubEnv('BUDGET_GUARD_DRY_RUN', 'true');
    vi.stubEnv('BUDGET_GUARD_TOPIC', 'my-topic');
    const mod = await import('../src/index');
    expect(mod.dryRun.value()).toBe(true);
    expect(mod.budgetTopic.value()).toBe('my-topic');
    vi.unstubAllEnvs();
  });
});

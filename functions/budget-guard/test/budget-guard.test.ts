import { describe, expect, it, vi } from 'vitest';
import { BillingClient, handleBudgetNotification, Logger, parseBudgetNotification } from '../src/budget-guard';

/** A Cloud Billing budget notification as the budget publishes it, base64-encoded like Pub/Sub data. */
function budgetMessage(costAmount: unknown, budgetAmount: unknown = 10, extra: Record<string, unknown> = {}): string {
  const body = {
    budgetDisplayName: 'mcl-portal $10/month',
    alertThresholdExceeded: 1.0,
    costAmount,
    costIntervalStart: '2026-11-01T07:00:00Z',
    budgetAmount,
    budgetAmountType: 'SPECIFIED_AMOUNT',
    currencyCode: 'USD',
    ...extra,
  };
  return Buffer.from(JSON.stringify(body)).toString('base64');
}

function fakeBilling(enabled: boolean | Error = true) {
  const billing = {
    isBillingEnabled: vi.fn(async () => {
      if (enabled instanceof Error) throw enabled;
      return enabled;
    }),
    disableBilling: vi.fn(async () => undefined),
  } satisfies BillingClient;
  return billing;
}

function fakeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } satisfies Logger;
}

const base = { projectId: 'mcl-portal', dryRun: false };

describe('handleBudgetNotification', () => {
  it('under budget: no billing calls, no action', async () => {
    const billing = fakeBilling();
    const logger = fakeLogger();
    const outcome = await handleBudgetNotification({ ...base, messageData: budgetMessage(8.01), billing, logger });
    expect(outcome).toBe('under-budget');
    expect(billing.isBillingEnabled).not.toHaveBeenCalled();
    expect(billing.disableBilling).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
  });

  it('at budget (cost == budget): detaches billing from this project', async () => {
    const billing = fakeBilling();
    const outcome = await handleBudgetNotification({ ...base, messageData: budgetMessage(10), billing, logger: fakeLogger() });
    expect(outcome).toBe('billing-disabled');
    expect(billing.isBillingEnabled).toHaveBeenCalledWith('projects/mcl-portal');
    expect(billing.disableBilling).toHaveBeenCalledWith('projects/mcl-portal');
  });

  it('over budget: detaches billing and logs it', async () => {
    const billing = fakeBilling();
    const logger = fakeLogger();
    const outcome = await handleBudgetNotification({ ...base, messageData: budgetMessage(12.34), billing, logger });
    expect(outcome).toBe('billing-disabled');
    expect(billing.disableBilling).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls.some(([m]) => String(m).includes('billing DETACHED from projects/mcl-portal'))).toBe(true);
  });

  it('uses whatever project ID the runtime provides (not hardcoded)', async () => {
    const billing = fakeBilling();
    await handleBudgetNotification({ ...base, projectId: 'other-proj-123', messageData: budgetMessage(11), billing, logger: fakeLogger() });
    expect(billing.disableBilling).toHaveBeenCalledWith('projects/other-proj-123');
  });

  it('billing already disabled: skips the detach', async () => {
    const billing = fakeBilling(false);
    const outcome = await handleBudgetNotification({ ...base, messageData: budgetMessage(15), billing, logger: fakeLogger() });
    expect(outcome).toBe('already-disabled');
    expect(billing.disableBilling).not.toHaveBeenCalled();
  });

  it('dry run: logs what it would do and never detaches', async () => {
    const billing = fakeBilling();
    const logger = fakeLogger();
    const outcome = await handleBudgetNotification({ ...base, dryRun: true, messageData: budgetMessage(10.5), billing, logger });
    expect(outcome).toBe('dry-run');
    expect(billing.disableBilling).not.toHaveBeenCalled();
    expect(logger.warn.mock.calls.some(([m]) => String(m).includes('DRY RUN'))).toBe(true);
  });

  it('dry run under budget is still a no-op', async () => {
    const billing = fakeBilling();
    const outcome = await handleBudgetNotification({ ...base, dryRun: true, messageData: budgetMessage(2), billing, logger: fakeLogger() });
    expect(outcome).toBe('under-budget');
    expect(billing.disableBilling).not.toHaveBeenCalled();
  });

  it.each([
    ['not base64 JSON', Buffer.from('hello').toString('base64')],
    ['empty data', ''],
    ['missing data', undefined],
    ['JSON array', Buffer.from('[1,2]').toString('base64')],
    ['missing costAmount', Buffer.from(JSON.stringify({ budgetAmount: 10 })).toString('base64')],
    ['non-numeric costAmount', budgetMessage('lots')],
    ['zero budgetAmount', budgetMessage(5, 0)],
  ])('malformed message (%s): logs an error and does nothing', async (_label, data) => {
    const billing = fakeBilling();
    const logger = fakeLogger();
    const outcome = await handleBudgetNotification({ ...base, messageData: data, billing, logger });
    expect(outcome).toBe('malformed');
    expect(logger.error).toHaveBeenCalled();
    expect(billing.isBillingEnabled).not.toHaveBeenCalled();
    expect(billing.disableBilling).not.toHaveBeenCalled();
  });

  it('accepts numeric strings for amounts', async () => {
    const billing = fakeBilling();
    const outcome = await handleBudgetNotification({ ...base, messageData: budgetMessage('10.00', '10'), billing, logger: fakeLogger() });
    expect(outcome).toBe('billing-disabled');
  });

  it('cannot read billing status: assumes enabled and detaches (as in Google\'s sample)', async () => {
    const billing = fakeBilling(new Error('PERMISSION_DENIED'));
    const logger = fakeLogger();
    const outcome = await handleBudgetNotification({ ...base, messageData: budgetMessage(10), billing, logger });
    expect(outcome).toBe('billing-disabled');
    expect(logger.warn).toHaveBeenCalled();
    expect(billing.disableBilling).toHaveBeenCalled();
  });

  it('detach fails: logs the failure and rethrows', async () => {
    const billing = fakeBilling();
    billing.disableBilling.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));
    const logger = fakeLogger();
    await expect(
      handleBudgetNotification({ ...base, messageData: budgetMessage(11), billing, logger })
    ).rejects.toThrow('PERMISSION_DENIED');
    expect(logger.error.mock.calls.some(([m]) => String(m).includes('FAILED to detach'))).toBe(true);
  });

  it('missing project ID: does not call the billing API', async () => {
    const billing = fakeBilling();
    const outcome = await handleBudgetNotification({ ...base, projectId: '', messageData: budgetMessage(11), billing, logger: fakeLogger() });
    expect(outcome).toBe('no-project');
    expect(billing.isBillingEnabled).not.toHaveBeenCalled();
  });
});

describe('parseBudgetNotification', () => {
  it('reads the fields from a real-shaped notification', () => {
    expect(parseBudgetNotification(budgetMessage(3.5))).toMatchObject({
      costAmount: 3.5,
      budgetAmount: 10,
      currencyCode: 'USD',
      budgetDisplayName: 'mcl-portal $10/month',
    });
  });
});

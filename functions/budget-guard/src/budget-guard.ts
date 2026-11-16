/**
 * budget-guard core logic (ARCHITECTURE.md "Pricing plan and cost cap").
 *
 * Follows Google's "Disable billing usage with notifications" sample:
 * https://cloud.google.com/billing/docs/how-to/disable-billing-with-notifications
 *
 * Kept free of Firebase and Google client imports so it can be unit-tested with fakes.
 */

/** The fields budget-guard reads from a Cloud Billing budget notification. */
export interface BudgetNotification {
  costAmount: number;
  budgetAmount: number;
  budgetDisplayName?: string;
  currencyCode?: string;
  costIntervalStart?: string;
  alertThresholdExceeded?: number;
}

/** The two Cloud Billing API calls budget-guard needs (projects.getBillingInfo and projects.updateBillingInfo). */
export interface BillingClient {
  isBillingEnabled(projectName: string): Promise<boolean>;
  /** Detaches the billing account (updateBillingInfo with billingAccountName ''). */
  disableBilling(projectName: string): Promise<void>;
}

export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export type Outcome =
  | 'malformed'
  | 'under-budget'
  | 'no-project'
  | 'already-disabled'
  | 'dry-run'
  | 'billing-disabled';

export interface HandleOptions {
  /** Base64 Pub/Sub message data, exactly as delivered in the CloudEvent. */
  messageData: string | undefined | null;
  projectId: string | undefined | null;
  dryRun: boolean;
  billing: BillingClient;
  logger: Logger;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/** Decodes and validates a budget notification. Returns null for anything that is not one. */
export function parseBudgetNotification(messageData: string | undefined | null): BudgetNotification | null {
  if (!messageData) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(messageData, 'base64').toString('utf8'));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const raw = parsed as Record<string, unknown>;
  const costAmount = finiteNumber(raw['costAmount']);
  const budgetAmount = finiteNumber(raw['budgetAmount']);
  if (costAmount === null || budgetAmount === null || budgetAmount <= 0) return null;
  return {
    costAmount,
    budgetAmount,
    budgetDisplayName: typeof raw['budgetDisplayName'] === 'string' ? raw['budgetDisplayName'] : undefined,
    currencyCode: typeof raw['currencyCode'] === 'string' ? raw['currencyCode'] : undefined,
    costIntervalStart: typeof raw['costIntervalStart'] === 'string' ? raw['costIntervalStart'] : undefined,
    alertThresholdExceeded: finiteNumber(raw['alertThresholdExceeded']) ?? undefined,
  };
}

/**
 * Handles one budget notification. Detaches billing when actual cost reaches the budget
 * (costAmount >= budgetAmount), unless billing is already off or dry run is on.
 */
export async function handleBudgetNotification(opts: HandleOptions): Promise<Outcome> {
  const { logger, billing, dryRun } = opts;
  const note = parseBudgetNotification(opts.messageData);
  if (!note) {
    logger.error('budget-guard: ignoring a message that is not a budget notification (needs numeric costAmount and budgetAmount).');
    return 'malformed';
  }

  const summary = {
    budget: note.budgetDisplayName,
    costAmount: note.costAmount,
    budgetAmount: note.budgetAmount,
    currency: note.currencyCode,
    costIntervalStart: note.costIntervalStart,
    alertThresholdExceeded: note.alertThresholdExceeded,
    dryRun,
  };

  if (note.costAmount < note.budgetAmount) {
    logger.info(`budget-guard: under budget (${note.costAmount} of ${note.budgetAmount}); no action.`, summary);
    return 'under-budget';
  }

  const projectId = opts.projectId?.trim();
  if (!projectId) {
    logger.error('budget-guard: budget reached but the project ID is unknown, so billing was NOT detached.', summary);
    return 'no-project';
  }
  const projectName = `projects/${projectId}`;

  let enabled: boolean;
  try {
    enabled = await billing.isBillingEnabled(projectName);
  } catch (err) {
    // Same as Google's sample: if the check fails, assume billing is on and try to detach.
    logger.warn('budget-guard: could not read billing status; assuming billing is enabled.', {
      ...summary,
      error: err instanceof Error ? err.message : String(err),
    });
    enabled = true;
  }

  if (!enabled) {
    logger.info(`budget-guard: budget reached, but billing is already disabled on ${projectName}; nothing to do.`, summary);
    return 'already-disabled';
  }

  if (dryRun) {
    logger.warn(
      `budget-guard: DRY RUN. Budget reached (${note.costAmount} >= ${note.budgetAmount}); would detach billing from ${projectName}. Nothing changed.`,
      summary
    );
    return 'dry-run';
  }

  logger.warn(`budget-guard: budget reached (${note.costAmount} >= ${note.budgetAmount}); detaching billing from ${projectName}.`, summary);
  try {
    await billing.disableBilling(projectName);
  } catch (err) {
    logger.error(`budget-guard: FAILED to detach billing from ${projectName}. Check the service account's role.`, {
      ...summary,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  logger.error(`budget-guard: billing DETACHED from ${projectName}. Billed services stop until the owner re-links billing.`, summary);
  return 'billing-disabled';
}

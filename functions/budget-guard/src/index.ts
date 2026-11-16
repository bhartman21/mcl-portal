/**
 * budget-guard Cloud Function (2nd gen), the only Cloud Function in mcl-portal.
 * Spec: ARCHITECTURE.md "Pricing plan and cost cap" and PROJECTPLAN.md Phase 0 "Cost cap".
 * Setup and roles: functions/budget-guard/README.md.
 */
import * as logger from 'firebase-functions/logger';
import { defineBoolean, defineString, projectID } from 'firebase-functions/params';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { createBillingClient } from './billing-client';
import { handleBudgetNotification } from './budget-guard';

/** Pub/Sub topic the Cloud Billing budget publishes to. */
export const budgetTopic = defineString('BUDGET_GUARD_TOPIC', {
  default: 'budget-guard',
  description: 'Pub/Sub topic (in this project) that the $20/month Cloud Billing budget publishes to.',
});

/** When true, only logs what it would do and never detaches billing. */
export const dryRun = defineBoolean('BUDGET_GUARD_DRY_RUN', {
  default: false,
  description: 'true = log only, never detach billing (use for the safe test).',
});

export const budgetGuard = onMessagePublished(
  {
    topic: budgetTopic,
    region: 'us-east1',
    // Dedicated least-privilege service account. A trailing "@" makes the Firebase CLI
    // expand it to budget-guard@<projectId>.iam.gserviceaccount.com, so no project ID is hardcoded.
    serviceAccount: 'budget-guard@',
    memory: '256MiB',
    timeoutSeconds: 60,
    maxInstances: 1,
    retry: false,
  },
  async (event) => {
    // Project ID comes from the runtime environment (the project the function is deployed to).
    const projectId = projectID.value() || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
    await handleBudgetNotification({
      messageData: event.data?.message?.data,
      projectId,
      dryRun: dryRun.value(),
      billing: createBillingClient(),
      logger,
    });
  }
);

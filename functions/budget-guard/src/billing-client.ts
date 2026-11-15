import { auth, cloudbilling } from '@googleapis/cloudbilling';
import type { BillingClient } from './budget-guard';

/**
 * Cloud Billing API v1 client using Application Default Credentials, so it runs as the
 * function's runtime service account. No keys or secrets.
 */
export function createBillingClient(): BillingClient {
  const api = cloudbilling({
    version: 'v1',
    timeout: 20_000,
    auth: new auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-billing'] }),
  });
  return {
    async isBillingEnabled(projectName: string): Promise<boolean> {
      const res = await api.projects.getBillingInfo({ name: projectName });
      return !!res.data.billingEnabled;
    },
    async disableBilling(projectName: string): Promise<void> {
      await api.projects.updateBillingInfo({
        name: projectName,
        requestBody: { billingAccountName: '' },
      });
    },
  };
}

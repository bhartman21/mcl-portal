import { Environment, PLACEHOLDER_FIREBASE_CONFIG } from './environment.model';

export type { Environment, FirebaseConfig } from './environment.model';

/**
 * Committed default environment: placeholders only (the repo is public).
 *
 * With placeholder config the app runs in clearly labeled local demo mode.
 * To use a real Firebase project or the emulators, generate the gitignored
 * `environment.local.ts` with `npm run config:env` / `npm run config:emulators`
 * and build or serve with the `firebase` configuration (see README).
 */
export const environment: Environment = {
  production: true,
  appName: 'MCL Department of Florida Portal',
  departmentId: 'dof',
  departmentName: 'Department of Florida',
  ribbonRackBuilderUrl: 'https://bhartman21.github.io/RibbonRackBuilder/',
  firebase: PLACEHOLDER_FIREBASE_CONFIG,
  useEmulators: false,
  enableGoogleSignIn: false,
};

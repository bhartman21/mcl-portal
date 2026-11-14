import { Environment, PLACEHOLDER_FIREBASE_CONFIG } from './environment.model';

/** Development default: placeholders only, so `ng serve` starts in local demo mode. */
export const environment: Environment = {
  production: false,
  appName: 'MCL Department of Florida Portal',
  departmentId: 'dof',
  departmentName: 'Department of Florida',
  ribbonRackBuilderUrl: 'https://bhartman21.github.io/RibbonRackBuilder/',
  firebase: PLACEHOLDER_FIREBASE_CONFIG,
  useEmulators: false,
  enableGoogleSignIn: false,
};

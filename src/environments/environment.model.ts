export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface Environment {
  production: boolean;
  appName: string;
  departmentId: string;
  departmentName: string;
  ribbonRackBuilderUrl: string;
  /** Firebase web config. Placeholder values (REPLACE_WITH_...) keep the app in local demo mode. */
  firebase: FirebaseConfig;
  /** Connect to the local Firebase emulators (Auth 9099, Firestore 8080, Storage 9199). */
  useEmulators?: boolean;
  /** Google sign-in is "may be added later" (PROJECTPLAN Phase 0). Keep false until approved. */
  enableGoogleSignIn?: boolean;
}

/** Placeholder Firebase config committed to the public repo. Never put real values here. */
export const PLACEHOLDER_FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: 'REPLACE_WITH_FIREBASE_API_KEY',
  authDomain: 'mcl-portal.firebaseapp.com',
  projectId: 'mcl-portal',
  storageBucket: 'mcl-portal.firebasestorage.app',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000',
};

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
  firebase: FirebaseConfig;
}

export const environment: Environment = {
  production: true,
  appName: 'MCL Department of Florida Portal',
  departmentId: 'dof',
  departmentName: 'Department of Florida',
  ribbonRackBuilderUrl: 'https://bhartman21.github.io/RibbonRackBuilder/',
  // Inject real Firebase config via CI secrets or local replacement before production deploy.
  // Do NOT commit production secrets to the public repository.
  firebase: {
    apiKey: 'REPLACE_WITH_FIREBASE_API_KEY',
    authDomain: 'mcl-portal.firebaseapp.com',
    projectId: 'mcl-portal',
    storageBucket: 'mcl-portal.firebasestorage.app',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000',
  },
};


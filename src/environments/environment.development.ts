import { Environment } from './environment';

export const environment: Environment = {
  production: false,
  appName: 'MCL Department of Florida Portal',
  departmentId: 'dof',
  departmentName: 'Department of Florida',
  ribbonRackBuilderUrl: 'https://bhartman21.github.io/RibbonRackBuilder/',
  firebase: {
    apiKey: 'REPLACE_WITH_FIREBASE_API_KEY',
    authDomain: 'mcl-portal.firebaseapp.com',
    projectId: 'mcl-portal',
    storageBucket: 'mcl-portal.firebasestorage.app',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000',
  },
};


import { Injectable } from '@angular/core';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  readonly isConfigured: boolean;
  readonly app: FirebaseApp | null = null;
  readonly auth: Auth | null = null;
  readonly firestore: Firestore | null = null;

  constructor() {
    const cfg = environment.firebase;
    this.isConfigured = Boolean(
      cfg?.apiKey &&
        !cfg.apiKey.startsWith('REPLACE_WITH_') &&
        cfg.projectId &&
        cfg.appId
    );

    if (this.isConfigured) {
      this.app = getApps().length > 0 ? getApps()[0] : initializeApp(cfg);
      this.auth = getAuth(this.app);
      this.firestore = getFirestore(this.app);
    }
  }
}


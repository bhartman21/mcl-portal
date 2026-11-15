import { Injectable } from '@angular/core';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  Firestore,
  getFirestore,
  initializeFirestore,
} from 'firebase/firestore';
import { connectStorageEmulator, FirebaseStorage, getStorage } from 'firebase/storage';
import { environment } from '../../../environments/environment';
import { FirebaseConfig } from '../../../environments/environment.model';

/** True when the Firebase web config is real (not the committed REPLACE_WITH_ placeholders). */
export function isFirebaseConfigured(cfg: FirebaseConfig | undefined | null): boolean {
  return Boolean(
    cfg?.apiKey && !cfg.apiKey.startsWith('REPLACE_WITH_') && cfg.projectId && cfg.appId
  );
}

/**
 * Initializes the modular Firebase JS SDK (Auth, Firestore, Storage).
 *
 * The plan lists `@angular/fire`; @angular/fire 21 pins `firebase@^12` while this app
 * already uses `firebase@13`, so we keep the modular SDK behind this small service
 * (deviation noted in README).
 *
 * When the config is a placeholder, nothing is initialized and the app runs in local demo mode.
 */
@Injectable({ providedIn: 'root' })
export class FirebaseService {
  readonly isConfigured: boolean;
  readonly usingEmulators: boolean;
  readonly app: FirebaseApp | null = null;
  readonly auth: Auth | null = null;
  readonly firestore: Firestore | null = null;
  readonly storage: FirebaseStorage | null = null;

  constructor() {
    const cfg = environment.firebase;
    this.isConfigured = isFirebaseConfigured(cfg);
    this.usingEmulators = this.isConfigured && Boolean(environment.useEmulators);

    if (this.isConfigured) {
      const existing = getApps();
      this.app = existing.length > 0 ? existing[0] : initializeApp(cfg);
      this.auth = getAuth(this.app);
      this.firestore =
        existing.length > 0
          ? getFirestore(this.app)
          : initializeFirestore(this.app, { ignoreUndefinedProperties: true });
      this.storage = getStorage(this.app);

      if (this.usingEmulators) {
        connectAuthEmulator(this.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
        connectFirestoreEmulator(this.firestore, '127.0.0.1', 8080);
        connectStorageEmulator(this.storage, '127.0.0.1', 9199);
      }
    }
  }
}

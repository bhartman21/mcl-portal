import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { buildNewUserProfile, normalizeRegistrationMode } from '../auth/registration';
import {
  RegistrationMode,
  ROLE_LABELS,
  RoleId,
  UserProfile,
} from '../models/user.model';
import { FirebaseService } from './firebase.service';

const STORAGE_DEMO_USER_KEY = 'mcl_portal_demo_user';
const STORAGE_EMAIL_LINK_KEY = 'mcl_portal_email_for_signin';
const STORAGE_REG_MODE_KEY = 'mcl_portal_registration_mode';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly fb = inject(FirebaseService);
  private readonly router = inject(Router);

  private readonly _user = signal<UserProfile | null>(null);
  private readonly _loading = signal<boolean>(true);
  private readonly _registrationMode = signal<RegistrationMode>('open');
  private readonly _authError = signal<string | null>(null);
  private resolveReady!: () => void;
  private readonly ready = new Promise<void>((resolve) => (this.resolveReady = resolve));
  private settledUid: string | null = null;
  private settleWaiters: (() => void)[] = [];

  readonly user = this._user.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly registrationMode = this._registrationMode.asReadonly();
  /** Set when a Firebase sign-in succeeded but the profile could not be loaded or created. */
  readonly authError = this._authError.asReadonly();

  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly isActive = computed(() => this._user()?.status === 'active');
  readonly isPending = computed(() => this._user()?.status === 'pending');
  readonly isSuspended = computed(() => this._user()?.status === 'suspended');

  readonly isAdmin = computed(() =>
    this.hasAnyRole(['departmentAdmin', 'nationalAdmin'])
  );

  readonly primaryRoleLabel = computed(() => {
    const roles = this._user()?.roles ?? [];
    if (roles.length === 0) return ROLE_LABELS.guest;
    const priority: RoleId[] = [
      'nationalAdmin',
      'departmentAdmin',
      'adBookApprover',
      'departmentVavsRep',
      'detachmentVavsRep',
      'member',
      'companyAdvertiser',
    ];
    for (const r of priority) {
      if (roles.includes(r)) return ROLE_LABELS[r];
    }
    return ROLE_LABELS[roles[0]];
  });

  readonly isDemoMode = computed(() => !this.fb.isConfigured);

  /** Google sign-in is "may be added later"; hidden unless explicitly enabled in the environment. */
  readonly googleSignInEnabled = Boolean(environment.enableGoogleSignIn) && this.fb.isConfigured;

  constructor() {
    this.initAuth();
  }

  /** Resolves once the initial auth state (Firebase or demo) is known. Guards await this. */
  whenReady(): Promise<void> {
    return this.ready;
  }

  private finishLoading(uid: string | null = null): void {
    this.settledUid = uid;
    this._loading.set(false);
    this.resolveReady();
    const waiters = this.settleWaiters;
    this.settleWaiters = [];
    waiters.forEach((w) => w());
  }

  /** Resolves after the auth listener has finished loading/creating the profile for `uid`. */
  private waitForSettledUser(uid: string): Promise<void> {
    if (this.settledUid === uid && !this._loading()) return Promise.resolve();
    return new Promise((resolve) => {
      const check = () =>
        this.settledUid === uid ? resolve() : this.settleWaiters.push(check);
      this.settleWaiters.push(check);
    });
  }

  private initAuth(): void {
    if (this.fb.isConfigured && this.fb.auth) {
      onAuthStateChanged(this.fb.auth, async (fbUser) => {
        if (!fbUser) {
          this._user.set(null);
          this.finishLoading();
          return;
        }
        this._loading.set(true);
        try {
          this._authError.set(null);
          await this.syncFirestoreUser(fbUser);
        } catch (err) {
          console.error('Unable to load or create the user profile', err);
          this._user.set(null);
          this._authError.set(
            'Signed in, but your portal profile could not be loaded. Please try again or contact a Department Administrator.'
          );
          await firebaseSignOut(this.fb.auth!).catch(() => undefined);
        } finally {
          this.finishLoading(fbUser.uid);
        }
      });
    } else {
      const savedMode = localStorage.getItem(STORAGE_REG_MODE_KEY) as RegistrationMode | null;
      if (savedMode === 'open' || savedMode === 'approval') {
        this._registrationMode.set(savedMode);
      }
      const raw = localStorage.getItem(STORAGE_DEMO_USER_KEY);
      if (raw) {
        try {
          this._user.set(JSON.parse(raw) as UserProfile);
        } catch {
          localStorage.removeItem(STORAGE_DEMO_USER_KEY);
        }
      }
      this.finishLoading();
    }
  }

  private async loadRegistrationModeFromFirestore(): Promise<void> {
    if (!this.fb.firestore) return;
    try {
      const snap = await getDoc(doc(this.fb.firestore, 'settings', 'registration'));
      this._registrationMode.set(
        normalizeRegistrationMode(snap.exists() ? snap.data()['mode'] : undefined)
      );
    } catch {
      // Signed-out users cannot read settings; keep the default 'open'.
    }
  }

  /**
   * First admin sign-in on a fresh project: write the default settings/registration doc
   * (mode 'open') if it does not exist yet. Only admins may write settings (firestore.rules).
   */
  private async ensureRegistrationSettings(): Promise<void> {
    if (!this.fb.firestore || !this.isAdmin()) return;
    const ref = doc(this.fb.firestore, 'settings', 'registration');
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          mode: 'open',
          updatedAt: serverTimestamp(),
          updatedBy: this._user()?.uid ?? '',
        });
        this._registrationMode.set('open');
      }
    } catch (err) {
      console.warn('Could not seed settings/registration', err);
    }
  }

  private async syncFirestoreUser(fbUser: FirebaseUser): Promise<void> {
    if (!this.fb.firestore) return;
    const userRef = doc(this.fb.firestore, 'users', fbUser.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data() as Partial<UserProfile>;
      this._user.set({
        uid: fbUser.uid,
        email: fbUser.email ?? data.email ?? '',
        displayName: fbUser.displayName ?? data.displayName,
        memberNumber: data.memberNumber,
        defaultDetachmentId: data.defaultDetachmentId,
        status: data.status ?? 'active',
        roles: data.roles ?? ['member'],
        detachmentScopes: data.detachmentScopes ?? [],
        createdAt: String(data.createdAt ?? new Date().toISOString()),
        updatedAt: new Date().toISOString(),
      });
      await this.loadRegistrationModeFromFirestore();
      // Fire-and-forget: never hold up auth readiness on the one-time settings seed.
      void this.ensureRegistrationSettings();
      return;
    }

    await this.loadRegistrationModeFromFirestore();
    const newProfile = buildNewUserProfile(
      { uid: fbUser.uid, email: fbUser.email ?? '', displayName: fbUser.displayName },
      this._registrationMode()
    );

    await setDoc(userRef, {
      ...newProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    this._user.set(newProfile);
  }

  hasAnyRole(allowed: RoleId[]): boolean {
    const u = this._user();
    if (!u || u.status !== 'active') return false;
    return allowed.some((role) => u.roles.includes(role));
  }

  hasDetachmentScope(detachmentId: string): boolean {
    const u = this._user();
    if (!u || u.status !== 'active') return false;
    if (this.hasAnyRole(['departmentAdmin', 'nationalAdmin', 'departmentVavsRep'])) {
      return true;
    }
    if (u.roles.includes('detachmentVavsRep')) {
      return (u.detachmentScopes ?? []).includes(detachmentId);
    }
    return false;
  }

  async sendEmailSignInLink(email: string): Promise<void> {
    if (!this.fb.isConfigured || !this.fb.auth) {
      throw new Error('Firebase is not configured. Use Local Demo Sign-In below.');
    }
    const actionCodeSettings = {
      url: `${window.location.origin}/sign-in`,
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(this.fb.auth, email, actionCodeSettings);
    localStorage.setItem(STORAGE_EMAIL_LINK_KEY, email);
  }

  /** True when the URL is a Firebase email sign-in link. */
  isEmailSignInLink(url: string): boolean {
    return Boolean(this.fb.isConfigured && this.fb.auth && isSignInWithEmailLink(this.fb.auth, url));
  }

  /** Email saved when the link was requested on this device (absent when opened on another device). */
  storedSignInEmail(): string | null {
    return localStorage.getItem(STORAGE_EMAIL_LINK_KEY);
  }

  /**
   * Completes email-link sign-in. If the link was opened on a different device there is no
   * stored email, so the caller must ask the user to re-enter it and pass it as emailOverride.
   */
  async completeEmailLinkSignIn(url: string, emailOverride?: string): Promise<boolean> {
    if (!this.fb.isConfigured || !this.fb.auth) return false;
    if (!isSignInWithEmailLink(this.fb.auth, url)) return false;

    const email = emailOverride?.trim() || this.storedSignInEmail();
    if (!email) {
      throw new Error('Please enter your email address to complete sign-in.');
    }
    const cred = await signInWithEmailLink(this.fb.auth, email, url);
    localStorage.removeItem(STORAGE_EMAIL_LINK_KEY);
    await this.waitForSettledUser(cred.user.uid);
    if (this._authError()) {
      throw new Error(this._authError()!);
    }
    return true;
  }

  /** Feature-flagged off by default (environment.enableGoogleSignIn). */
  async signInWithGoogle(): Promise<void> {
    if (!this.googleSignInEnabled || !this.fb.auth) {
      throw new Error('Google sign-in is not enabled. Use the email sign-in link.');
    }
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(this.fb.auth, provider);
    await this.waitForSettledUser(cred.user.uid);
  }

  /**
   * Local preview sign-in when Firebase config is placeholder.
   * Respects the registration mode switch for new member sign-ins.
   */
  signInDemo(preset: {
    displayName: string;
    email: string;
    roles: RoleId[];
    detachmentScopes?: string[];
    defaultDetachmentId?: string;
    respectRegistrationMode?: boolean;
  }): void {
    const mode = this._registrationMode();
    const status =
      preset.respectRegistrationMode && mode === 'approval' ? 'pending' : 'active';
    const now = new Date().toISOString();
    const profile: UserProfile = {
      uid: `demo-${preset.email.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
      email: preset.email,
      displayName: preset.displayName,
      defaultDetachmentId: preset.defaultDetachmentId ?? 'dof-054',
      status,
      roles: preset.roles,
      detachmentScopes: preset.detachmentScopes ?? [],
      createdAt: now,
      updatedAt: now,
    };
    localStorage.setItem(STORAGE_DEMO_USER_KEY, JSON.stringify(profile));
    this._user.set(profile);
  }

  setLocalRegistrationMode(mode: RegistrationMode): void {
    this._registrationMode.set(mode);
    localStorage.setItem(STORAGE_REG_MODE_KEY, mode);
  }

  updateCurrentUserLocal(patch: Partial<UserProfile>): void {
    const current = this._user();
    if (!current) return;
    const updated: UserProfile = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this._user.set(updated);
    if (!this.fb.isConfigured) {
      localStorage.setItem(STORAGE_DEMO_USER_KEY, JSON.stringify(updated));
    }
  }

  async signOut(): Promise<void> {
    if (this.fb.isConfigured && this.fb.auth) {
      await firebaseSignOut(this.fb.auth);
    }
    localStorage.removeItem(STORAGE_DEMO_USER_KEY);
    this._user.set(null);
    await this.router.navigate(['/']);
  }
}


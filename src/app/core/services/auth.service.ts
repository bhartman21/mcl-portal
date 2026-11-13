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

  readonly user = this._user.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly registrationMode = this._registrationMode.asReadonly();

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

  constructor() {
    this.initAuth();
  }

  private initAuth(): void {
    if (this.fb.isConfigured && this.fb.auth) {
      this.loadRegistrationModeFromFirestore();
      onAuthStateChanged(this.fb.auth, async (fbUser) => {
        if (!fbUser) {
          this._user.set(null);
          this._loading.set(false);
          return;
        }
        await this.syncFirestoreUser(fbUser);
        this._loading.set(false);
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
      this._loading.set(false);
    }
  }

  private async loadRegistrationModeFromFirestore(): Promise<void> {
    if (!this.fb.firestore) return;
    try {
      const snap = await getDoc(doc(this.fb.firestore, 'settings', 'registration'));
      if (snap.exists()) {
        const mode = snap.data()['mode'];
        if (mode === 'open' || mode === 'approval') {
          this._registrationMode.set(mode);
        }
      }
    } catch {
      // Fallback to default 'open' if rules block unauthenticated read
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
      return;
    }

    await this.loadRegistrationModeFromFirestore();
    const mode = this._registrationMode();
    const nowIso = new Date().toISOString();
    const newProfile: UserProfile = {
      uid: fbUser.uid,
      email: fbUser.email ?? '',
      displayName: fbUser.displayName ?? undefined,
      status: mode === 'open' ? 'active' : 'pending',
      roles: ['member'],
      detachmentScopes: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

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
      throw new Error('Firebase is not configured. Use Demo Sign-In below for local preview.');
    }
    const actionCodeSettings = {
      url: `${window.location.origin}/sign-in`,
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(this.fb.auth, email, actionCodeSettings);
    localStorage.setItem(STORAGE_EMAIL_LINK_KEY, email);
  }

  async completeEmailLinkSignIn(url: string, emailOverride?: string): Promise<boolean> {
    if (!this.fb.isConfigured || !this.fb.auth) return false;
    if (!isSignInWithEmailLink(this.fb.auth, url)) return false;

    const email = emailOverride ?? localStorage.getItem(STORAGE_EMAIL_LINK_KEY);
    if (!email) {
      throw new Error('Please enter your email address to complete sign-in.');
    }
    await signInWithEmailLink(this.fb.auth, email, url);
    localStorage.removeItem(STORAGE_EMAIL_LINK_KEY);
    return true;
  }

  async signInWithGoogle(): Promise<void> {
    if (!this.fb.isConfigured || !this.fb.auth) {
      throw new Error('Firebase is not configured. Use Demo Sign-In below for local preview.');
    }
    const provider = new GoogleAuthProvider();
    await signInWithPopup(this.fb.auth, provider);
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


import { computed, inject, Injectable, signal } from '@angular/core';
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  RegistrationMode,
  RoleId,
  UserProfile,
  UserStatus,
} from '../models/user.model';
import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';

const STORAGE_DEMO_USERS_KEY = 'mcl_portal_demo_users_v1';

const SEED_DEMO_USERS: UserProfile[] = [
  {
    uid: 'demo-admin-dof',
    email: 'adjutant@dof-mcl.org',
    displayName: 'Dept. Adjutant (Admin)',
    memberNumber: 'FL-10421',
    defaultDetachmentId: 'dof-054',
    status: 'active',
    roles: ['member', 'departmentAdmin'],
    detachmentScopes: [],
    createdAt: '2026-10-01T12:00:00Z',
    updatedAt: '2026-11-09T12:00:00Z',
  },
  {
    uid: 'demo-vavs-rep-54',
    email: 'vavs54@dof-mcl.org',
    displayName: 'Sgt. Maj. R. Vance',
    memberNumber: 'FL-20892',
    defaultDetachmentId: 'dof-054',
    status: 'active',
    roles: ['member', 'detachmentVavsRep'],
    detachmentScopes: ['dof-054'],
    createdAt: '2026-10-12T12:00:00Z',
    updatedAt: '2026-11-01T12:00:00Z',
  },
  {
    uid: 'demo-ad-approver',
    email: 'adbook@dof-mcl.org',
    displayName: 'Cpl. M. Holloway',
    memberNumber: 'FL-33104',
    defaultDetachmentId: 'dof-058',
    status: 'active',
    roles: ['member', 'adBookApprover'],
    detachmentScopes: [],
    createdAt: '2026-10-18T12:00:00Z',
    updatedAt: '2026-11-05T12:00:00Z',
  },
  {
    uid: 'demo-pending-member',
    email: 'newmarine@example.com',
    displayName: 'LCpl. J. Mercer',
    defaultDetachmentId: 'dof-052',
    status: 'pending',
    roles: ['member'],
    detachmentScopes: [],
    createdAt: '2026-11-12T14:00:00Z',
    updatedAt: '2026-11-12T14:00:00Z',
  },
];

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly fb = inject(FirebaseService);
  private readonly auth = inject(AuthService);

  private readonly _users = signal<UserProfile[]>([]);
  private readonly _loading = signal<boolean>(false);

  readonly users = this._users.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly pendingUsers = computed(() =>
    this._users().filter((u) => u.status === 'pending')
  );

  constructor() {
    this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    this._loading.set(true);
    try {
      if (this.fb.isConfigured && this.fb.firestore) {
        const snap = await getDocs(collection(this.fb.firestore, 'users'));
        this._users.set(
          snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }))
        );
      } else {
        const raw = localStorage.getItem(STORAGE_DEMO_USERS_KEY);
        if (raw) {
          this._users.set(JSON.parse(raw) as UserProfile[]);
        } else {
          this._users.set([...SEED_DEMO_USERS]);
          this.saveLocalUsers();
        }
      }
    } finally {
      this._loading.set(false);
    }
  }

  private saveLocalUsers(): void {
    localStorage.setItem(STORAGE_DEMO_USERS_KEY, JSON.stringify(this._users()));
  }

  async setRegistrationMode(mode: RegistrationMode): Promise<void> {
    if (this.fb.isConfigured && this.fb.firestore) {
      await setDoc(
        doc(this.fb.firestore, 'settings', 'registration'),
        {
          mode,
          updatedAt: serverTimestamp(),
          updatedBy: this.auth.user()?.uid ?? 'admin',
        },
        { merge: true }
      );
    }
    this.auth.setLocalRegistrationMode(mode);
  }

  async updateUserStatus(uid: string, status: UserStatus): Promise<void> {
    if (this.fb.isConfigured && this.fb.firestore) {
      await updateDoc(doc(this.fb.firestore, 'users', uid), {
        status,
        updatedAt: serverTimestamp(),
      });
    }
    this._users.update((list) =>
      list.map((u) =>
        u.uid === uid ? { ...u, status, updatedAt: new Date().toISOString() } : u
      )
    );
    if (!this.fb.isConfigured) {
      this.saveLocalUsers();
    }
    if (this.auth.user()?.uid === uid) {
      this.auth.updateCurrentUserLocal({ status });
    }
  }

  async updateUserRoles(
    uid: string,
    roles: RoleId[],
    detachmentScopes: string[] = []
  ): Promise<void> {
    const cleanRoles: RoleId[] = roles.length > 0 ? Array.from(new Set(roles)) : ['member'];
    const cleanScopes = cleanRoles.includes('detachmentVavsRep') ? detachmentScopes : [];

    if (this.fb.isConfigured && this.fb.firestore) {
      await updateDoc(doc(this.fb.firestore, 'users', uid), {
        roles: cleanRoles,
        detachmentScopes: cleanScopes,
        updatedAt: serverTimestamp(),
      });
    }

    this._users.update((list) =>
      list.map((u) =>
        u.uid === uid
          ? {
              ...u,
              roles: cleanRoles,
              detachmentScopes: cleanScopes,
              updatedAt: new Date().toISOString(),
            }
          : u
      )
    );
    if (!this.fb.isConfigured) {
      this.saveLocalUsers();
    }
    if (this.auth.user()?.uid === uid) {
      this.auth.updateCurrentUserLocal({
        roles: cleanRoles,
        detachmentScopes: cleanScopes,
      });
    }
  }
}


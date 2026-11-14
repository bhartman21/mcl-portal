import { computed, inject, Injectable, signal } from '@angular/core';
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { canManageUser, grantableRoles } from '../auth/role-grants';
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
    const target = this._users().find((u) => u.uid === uid);
    if (!target || !canManageUser(this.auth.user(), target)) {
      throw new Error('You are not allowed to change this user\'s status.');
    }
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

  /**
   * Grant/revoke roles (and detachment scopes) for another user. Only roles the signed-in admin may
   * grant are accepted (see role-grants.ts / firestore.rules). In Firebase mode the user update and
   * its audits/{id} entry (who, when, target, before/after roles and scopes) are one batched write;
   * the rules reject a role change without its matching audit and an audit without its change.
   */
  async updateUserRoles(
    uid: string,
    roles: RoleId[],
    detachmentScopes: string[] = []
  ): Promise<void> {
    const actor = this.auth.user();
    const target = this._users().find((u) => u.uid === uid);
    if (!actor || !target || !canManageUser(actor, target)) {
      throw new Error('You are not allowed to change this user\'s roles.');
    }
    const cleanRoles: RoleId[] = roles.length > 0 ? Array.from(new Set(roles)) : ['member'];
    const allowed = grantableRoles(actor.roles);
    if (!cleanRoles.every((r) => allowed.includes(r))) {
      throw new Error('You are not allowed to grant one or more of these roles.');
    }
    const cleanScopes = cleanRoles.includes('detachmentVavsRep') ? detachmentScopes : [];

    if (this.fb.isConfigured && this.fb.firestore) {
      const db = this.fb.firestore;
      const auditRef = doc(collection(db, 'audits'));
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', uid), {
        roles: cleanRoles,
        detachmentScopes: cleanScopes,
        roleAuditId: auditRef.id,
        updatedAt: serverTimestamp(),
      });
      batch.set(auditRef, {
        action: 'roleChange',
        actorUid: actor.uid,
        actorRoles: actor.roles,
        targetUid: uid,
        at: serverTimestamp(),
        beforeRoles: target.roles ?? [],
        afterRoles: cleanRoles,
        beforeScopes: target.detachmentScopes ?? [],
        afterScopes: cleanScopes,
      });
      await batch.commit();
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
  }
}


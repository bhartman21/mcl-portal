import { computed, signal } from '@angular/core';
import { ADMIN_ROLES, RoleId, UserProfile } from '../app/core/models/user.model';

/** Minimal AuthService double for service/component unit tests. */
export class FakeAuth {
  readonly user = signal<UserProfile | null>(null);
  readonly isAdmin = computed(() => this.hasAnyRole(ADMIN_ROLES));
  hasAnyRole(roles: RoleId[]): boolean {
    const u = this.user();
    return !!u && u.status === 'active' && roles.some((r) => u.roles.includes(r));
  }
  signInAs(uid: string, roles: RoleId[] = ['member']): void {
    this.user.set(profile(uid, roles));
  }
}

export function profile(uid: string, roles: RoleId[] = ['member']): UserProfile {
  return {
    uid,
    email: `${uid}@example.com`,
    displayName: uid,
    status: 'active',
    roles,
    detachmentScopes: [],
    createdAt: '',
    updatedAt: '',
  };
}

import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { canManageUser, roleOptionsFor } from '../../core/auth/role-grants';
import {
  ROLE_LABELS,
  RoleId,
  UserProfile,
} from '../../core/models/user.model';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { DetachmentService } from '../../core/services/detachment.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [FormsModule, RouterLink, StatusBadgeComponent],
  templateUrl: './admin-users.component.html',
})
export class AdminUsersComponent {
  private readonly adminService = inject(AdminService);
  private readonly detachmentService = inject(DetachmentService);
  private readonly auth = inject(AuthService);

  readonly users = this.adminService.users;
  readonly pendingUsers = this.adminService.pendingUsers;
  readonly detachments = this.detachmentService.detachments;
  /** Only the roles the signed-in admin may grant or revoke (grant hierarchy). */
  readonly assignableRoles = computed(() => roleOptionsFor(this.auth.user()));
  readonly errorMessage = signal<string | null>(null);

  readonly editingUser = signal<UserProfile | null>(null);
  readonly draftRoles = signal<RoleId[]>([]);
  draftDetachmentId = 'dof-054';

  roleLabel(role: RoleId): string {
    return ROLE_LABELS[role] ?? role;
  }

  detachmentLabel(id?: string): string {
    if (!id) return 'Not set';
    return this.detachmentService.getById(id)?.displayName ?? id;
  }

  scopeNames(ids: string[]): string {
    return ids
      .map((id) => {
        const d = this.detachmentService.getById(id);
        return d?.number ? `#${d.number}` : d?.name ?? id;
      })
      .join(', ');
  }

  /** False for yourself and for anyone holding a role above what you may grant. */
  canManage(user: UserProfile): boolean {
    return canManageUser(this.auth.user(), user);
  }

  isSelf(user: UserProfile): boolean {
    return this.auth.user()?.uid === user.uid;
  }

  startEdit(user: UserProfile): void {
    if (!this.canManage(user)) return;
    this.errorMessage.set(null);
    this.editingUser.set(user);
    this.draftRoles.set([...user.roles]);
    this.draftDetachmentId = user.detachmentScopes?.[0] || user.defaultDetachmentId || 'dof-054';
  }

  toggleRole(role: RoleId): void {
    this.draftRoles.update((roles) =>
      roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role]
    );
  }

  async saveRoles(): Promise<void> {
    const target = this.editingUser();
    if (!target) return;
    const scopes = this.draftRoles().includes('detachmentVavsRep')
      ? [this.draftDetachmentId]
      : [];
    try {
      await this.adminService.updateUserRoles(target.uid, this.draftRoles(), scopes);
      this.editingUser.set(null);
      this.errorMessage.set(null);
    } catch (err) {
      this.errorMessage.set(this.describe(err, 'Could not save the role assignment.'));
    }
  }

  async approveUser(user: UserProfile): Promise<void> {
    await this.setStatus(user, 'active');
  }

  async suspendUser(user: UserProfile): Promise<void> {
    await this.setStatus(user, 'suspended');
  }

  private async setStatus(user: UserProfile, status: 'active' | 'suspended'): Promise<void> {
    try {
      await this.adminService.updateUserStatus(user.uid, status);
      this.errorMessage.set(null);
    } catch (err) {
      this.errorMessage.set(this.describe(err, 'Could not change this user\'s status.'));
    }
  }

  private describe(err: unknown, fallback: string): string {
    return err instanceof Error && err.message ? err.message : fallback;
  }
}

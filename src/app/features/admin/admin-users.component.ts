import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  RoleId,
  UserProfile,
} from '../../core/models/user.model';
import { AdminService } from '../../core/services/admin.service';
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

  readonly users = this.adminService.users;
  readonly pendingUsers = this.adminService.pendingUsers;
  readonly detachments = this.detachmentService.detachments;
  readonly assignableRoles = ASSIGNABLE_ROLES;

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

  startEdit(user: UserProfile): void {
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
    await this.adminService.updateUserRoles(target.uid, this.draftRoles(), scopes);
    this.editingUser.set(null);
  }

  async approveUser(user: UserProfile): Promise<void> {
    await this.adminService.updateUserStatus(user.uid, 'active');
  }

  async suspendUser(user: UserProfile): Promise<void> {
    await this.adminService.updateUserStatus(user.uid, 'suspended');
  }
}

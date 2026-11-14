import { ASSIGNABLE_ROLES, RoleId } from '../models/user.model';

/**
 * Admin grant hierarchy (ROLES_AND_PERMISSIONS.md "Admin role grants", decided Nov 14, 2026).
 * Mirrors grantableRoles() in firestore.rules; the rules are the enforcement, this drives the UI.
 *
 * - siteAdmin: any role, including siteAdmin, nationalAdmin, departmentAdmin
 * - nationalAdmin: nationalAdmin, departmentAdmin, and every non-admin role
 * - departmentAdmin: departmentAdmin and every non-admin role
 *
 * Revoking follows the same table (inferred; OPEN_QUESTIONS #17).
 */
export const NON_ADMIN_ROLES: RoleId[] = [
  'member',
  'companyAdvertiser',
  'detachmentVavsRep',
  'departmentVavsRep',
  'adBookApprover',
];

export function grantableRoles(actorRoles: readonly RoleId[] | null | undefined): RoleId[] {
  const roles = actorRoles ?? [];
  if (roles.includes('siteAdmin')) {
    return [...NON_ADMIN_ROLES, 'departmentAdmin', 'nationalAdmin', 'siteAdmin'];
  }
  if (roles.includes('nationalAdmin')) {
    return [...NON_ADMIN_ROLES, 'departmentAdmin', 'nationalAdmin'];
  }
  if (roles.includes('departmentAdmin')) {
    return [...NON_ADMIN_ROLES, 'departmentAdmin'];
  }
  return [];
}

export interface RoleActor {
  uid: string;
  status: string;
  roles: readonly RoleId[];
}

export interface RoleTarget {
  uid: string;
  roles: readonly RoleId[];
}

/**
 * Whether `actor` may change `target`'s roles, scopes, or status at all: an active admin, not
 * editing themselves, whose grant set covers every role the target currently holds (so nobody
 * can demote or suspend someone above them).
 */
export function canManageUser(actor: RoleActor | null | undefined, target: RoleTarget): boolean {
  if (!actor || actor.status !== 'active' || actor.uid === target.uid) return false;
  const allowed = grantableRoles(actor.roles);
  if (allowed.length === 0) return false;
  return target.roles.every((r) => allowed.includes(r));
}

/** Role checkboxes the admin users page offers this actor, in catalog order. */
export function roleOptionsFor(actor: RoleActor | null | undefined) {
  if (!actor || actor.status !== 'active') return [];
  const allowed = grantableRoles(actor.roles);
  return ASSIGNABLE_ROLES.filter((r) => allowed.includes(r.id));
}

export type RoleId =
  | 'guest'
  | 'member'
  | 'companyAdvertiser'
  | 'detachmentVavsRep'
  | 'departmentVavsRep'
  | 'adBookApprover'
  | 'departmentAdmin'
  | 'nationalAdmin'
  | 'siteAdmin';

export type UserStatus = 'active' | 'pending' | 'suspended';

export type ScopeType = 'none' | 'detachment' | 'department' | 'national';

export interface RoleAssignment {
  id?: string;
  uid: string;
  role: RoleId;
  scopeType: ScopeType;
  scopeId?: string;
  createdBy: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  memberNumber?: string;
  defaultDetachmentId?: string;
  status: UserStatus;
  roles: RoleId[];
  detachmentScopes?: string[];
  createdAt: string;
  updatedAt: string;
}

export type RegistrationMode = 'open' | 'approval';

export interface RegistrationSettings {
  mode: RegistrationMode;
  updatedAt?: string;
  updatedBy?: string;
}

export const ROLE_LABELS: Record<RoleId, string> = {
  guest: 'Guest',
  member: 'MCL Member',
  companyAdvertiser: 'Company Advertiser',
  detachmentVavsRep: 'Detachment VAVS Rep',
  departmentVavsRep: 'Department VAVS Rep',
  adBookApprover: 'Ad Book Approver',
  departmentAdmin: 'Department Admin',
  nationalAdmin: 'National Admin',
  siteAdmin: 'Site Administrator',
};

/** Roles that open the admin area. siteAdmin has every power of nationalAdmin. */
export const ADMIN_ROLES: RoleId[] = ['departmentAdmin', 'nationalAdmin', 'siteAdmin'];

/** Ad Book reviewers: approvers plus every admin level. */
export const AD_REVIEWER_ROLES: RoleId[] = ['adBookApprover', ...ADMIN_ROLES];

export const ASSIGNABLE_ROLES: { id: RoleId; label: string; requiresDetachmentScope: boolean }[] = [
  { id: 'member', label: 'MCL Member', requiresDetachmentScope: false },
  { id: 'detachmentVavsRep', label: 'Detachment VAVS Rep', requiresDetachmentScope: true },
  { id: 'departmentVavsRep', label: 'Department VAVS Rep', requiresDetachmentScope: false },
  { id: 'adBookApprover', label: 'Ad Book Approver', requiresDetachmentScope: false },
  { id: 'departmentAdmin', label: 'Department Admin', requiresDetachmentScope: false },
  { id: 'nationalAdmin', label: 'National Admin', requiresDetachmentScope: false },
  { id: 'siteAdmin', label: 'Site Administrator', requiresDetachmentScope: false },
];


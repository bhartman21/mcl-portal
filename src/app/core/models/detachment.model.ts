export interface Department {
  id: string;
  name: string;
  organizationLabel: string;
}

export interface Detachment {
  id: string;
  departmentId: 'dof';
  number: string;
  name: string;
  displayName: string;
  city?: string;
  active: boolean;
  needsVerification?: boolean;
  notes?: string;
}

export const DOF_DEPARTMENT: Department = {
  id: 'dof',
  name: 'Department of Florida',
  organizationLabel: 'Marine Corps League — Department of Florida',
};

/**
 * Initial Florida detachment directory seed.
 * #54 is Morris F Dixon Jr. Detachment (confirmed Nov 9, 2026).
 * S/Sgt Ted Archambault Detachment is seeded separately with needsVerification: true and no number.
 */
export const SEED_DETACHMENTS: Detachment[] = [
  {
    id: 'dof-052',
    departmentId: 'dof',
    number: '52',
    name: 'PFC Bruce W. Carter',
    displayName: 'Detachment #52 — PFC Bruce W. Carter',
    city: 'Miami / South Florida',
    active: true,
  },
  {
    id: 'dof-054',
    departmentId: 'dof',
    number: '54',
    name: 'Morris F. Dixon Jr.',
    displayName: 'Detachment #54 — Morris F. Dixon Jr.',
    city: 'Florida',
    active: true,
  },
  {
    id: 'dof-055',
    departmentId: 'dof',
    number: '55',
    name: 'Col. Phillip C. DeLong',
    displayName: 'Detachment #55 — Col. Phillip C. DeLong',
    city: 'The Villages',
    active: true,
  },
  {
    id: 'dof-058',
    departmentId: 'dof',
    number: '58',
    name: 'Cpl. Larry E. Smedley',
    displayName: 'Detachment #58 — Cpl. Larry E. Smedley',
    city: 'Orlando',
    active: true,
  },
  {
    id: 'dof-567',
    departmentId: 'dof',
    number: '567',
    name: 'Greater Clearwater',
    displayName: 'Detachment #567 — Greater Clearwater',
    city: 'Clearwater',
    active: true,
  },
  {
    id: 'dof-755',
    departmentId: 'dof',
    number: '755',
    name: 'Gator Detachment',
    displayName: 'Detachment #755 — Gator Detachment',
    city: 'Gainesville',
    active: true,
  },
  {
    id: 'dof-1055',
    departmentId: 'dof',
    number: '1055',
    name: 'Sgt. Maj. Louis C. "Lou" Ehlers',
    displayName: 'Detachment #1055 — Sgt. Maj. Louis C. "Lou" Ehlers',
    city: 'Florida',
    active: true,
  },
  {
    id: 'dof-archambault-unverified',
    departmentId: 'dof',
    number: '',
    name: 'S/Sgt Ted Archambault',
    displayName: 'S/Sgt Ted Archambault Detachment (Number Pending Verification)',
    active: true,
    needsVerification: true,
    notes: 'Detachment number unconfirmed; keep separate from #54 Morris F. Dixon Jr. until verified.',
  },
];


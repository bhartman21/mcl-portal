export type AdSizeLayoutHint = 'full' | 'horizontal-split' | 'grid';

export interface AdSize {
  id: string;
  label: string;
  widthIn: number;
  heightIn: number;
  slotsPerPage: number;
  layoutHint: AdSizeLayoutHint;
  active: boolean;
  sortOrder: number;
  inferredDimensions?: boolean;
}

export type AdBookStatus = 'draft' | 'open' | 'locked' | 'printed';

export interface AdBook {
  id: string;
  departmentId: 'dof';
  title: string;
  eventName: string;
  eventDate?: string;
  status: AdBookStatus;
  pageSize: 'letter';
  adIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type AdStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface AdItem {
  id: string;
  bookId?: string;
  departmentId: 'dof';
  sizeId: string;
  title: string;
  status: AdStatus;
  rejectionNotes?: string;
  createdBy: string;
  createdByName?: string;
  createdByType: 'member' | 'company' | 'guest';
  companyName?: string;
  imageUrl?: string;
  imageName?: string;
  fit: 'cover' | 'contain';
  position: { x: number; y: number };
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const SEED_AD_SIZES: AdSize[] = [
  {
    id: 'full',
    label: 'Full Page',
    widthIn: 7.5,
    heightIn: 10,
    slotsPerPage: 1,
    layoutHint: 'full',
    active: true,
    sortOrder: 1,
  },
  {
    id: 'half',
    label: 'Half Page (Horizontal)',
    widthIn: 7.5,
    heightIn: 4.875,
    slotsPerPage: 2,
    layoutHint: 'horizontal-split',
    active: true,
    sortOrder: 2,
  },
  {
    id: 'quarter',
    label: 'Quarter Page',
    widthIn: 3.625,
    heightIn: 4.875,
    slotsPerPage: 4,
    layoutHint: 'grid',
    active: true,
    sortOrder: 3,
    inferredDimensions: true,
  },
  {
    id: 'business_card',
    label: 'Business Card',
    widthIn: 3.5,
    heightIn: 2,
    slotsPerPage: 8,
    layoutHint: 'grid',
    active: true,
    sortOrder: 4,
    inferredDimensions: true,
  },
];

export const SEED_AD_BOOKS: AdBook[] = [
  {
    id: 'dof-2026-convention',
    departmentId: 'dof',
    title: '2026 Department of Florida Convention Program',
    eventName: '2026 DoF Annual Convention',
    eventDate: '2026-06-18',
    status: 'open',
    pageSize: 'letter',
    adIds: [],
    createdBy: 'demo-admin-dof',
    createdAt: '2026-10-15T12:00:00Z',
    updatedAt: '2026-11-09T12:00:00Z',
  },
];


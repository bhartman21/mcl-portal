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
  /**
   * How many ads in `adIds` each user owns (uid -> count), kept in step with every placement and
   * removal and checked by firestore.rules. Owners of any ad in a book cannot reorder it (#46).
   */
  ownerCounts?: Record<string, number>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type AdStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

/** Max submissions per ad (decided Nov 14, 2026; AD_BOOK.md FR-A-3, AC 9). */
export const MAX_AD_SUBMISSIONS = 3;

export interface AdLockReset {
  by: string;
  at: string;
  reason?: string;
}

export interface AdItem {
  id: string;
  /** The book this approved ad is placed in (set by an approver with the placement). */
  bookId?: string;
  departmentId: 'dof';
  sizeId: string;
  title: string;
  status: AdStatus;
  rejectionNotes?: string;
  /** Times submitted; only submit increases it, never lowered by the owner. */
  submissionCount?: number;
  /** Default 3; fixed at create. */
  maxSubmissions?: number;
  /** True after the rejection of the last allowed submission; only an admin can reset it. */
  locked?: boolean;
  /** Admin lock resets (also written to audits). */
  lockResets?: AdLockReset[];
  createdBy: string;
  createdByName?: string;
  createdByType: 'member' | 'company' | 'guest';
  companyName?: string;
  /** Storage object path `ad-images/{uid}/{adId}/{file}` (issue #4). */
  imagePath?: string;
  /**
   * Display URL. With Firebase it is resolved at runtime from `imagePath` and never stored in
   * Firestore; in local demo mode (no Firebase config) it holds the browser-only data URL.
   */
  imageUrl?: string;
  imageName?: string;
  fit: 'cover' | 'contain';
  position: { x: number; y: number };
  submittedAt?: string;
  /** uid of the approver/admin who approved or rejected the ad. */
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  /** Admin approved their own ad (AD_BOOK.md AC 12); always paired with selfApprovalReason. */
  selfApproved?: boolean;
  selfApprovalReason?: string;
  /** Id of the audits/{id} doc written with the last audited change (self-approve, undo). */
  lastAuditId?: string;
  createdAt: string;
  updatedAt: string;
}

export type AuditAction = 'selfApprove' | 'undoReview' | 'lockReset';

/** `audits/{id}`: audited Ad Book actions (AD_BOOK.md FR-A-3, AC 12, 13). */
export interface AuditEntry {
  id: string;
  entityType: 'ad';
  entityId: string;
  action: AuditAction;
  actorUid: string;
  actorName?: string;
  at: string;
  /** Required for selfApprove and undoReview; optional for lockReset. */
  reason?: string;
  fromStatus?: AdStatus;
  toStatus?: AdStatus;
}

/** `notifications/{id}`: in-app notification for one recipient (no email). */
export interface AppNotification {
  id: string;
  recipientUid: string;
  type: 'adSelfApproved';
  adId: string;
  adTitle?: string;
  actorUid: string;
  actorName?: string;
  reason: string;
  createdAt: string;
  read: boolean;
  readAt?: string;
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


/**
 * Firestore reads and batched writes for Ad Book (issue #4; features/AD_BOOK.md, ARCHITECTURE.md
 * `ads`, `adBooks`, `adSizes`, `audits`, `notifications`).
 *
 * Every function here builds exactly the write firestore.rules expects for one documented
 * transition, so the app and the emulator rules tests (rules-tests/ad-book-writes.rules.test.ts)
 * share one source. No Angular imports: the rules tests run these in Node.
 */
import {
  collection,
  deleteField,
  doc,
  DocumentData,
  Firestore,
  serverTimestamp,
  WriteBatch,
  writeBatch,
} from 'firebase/firestore';
import {
  AdBook,
  AdBookStatus,
  AdItem,
  AdLockReset,
  AdSize,
  AppNotification,
  AuditEntry,
  MAX_AD_SUBMISSIONS,
} from '../models/ad-book.model';

export interface Actor {
  uid: string;
  name: string;
}

/** Owner-editable ad fields (firestore.rules `contentKeys`). The image lives in Storage. */
export interface AdContent {
  title: string;
  sizeId: string;
  companyName?: string;
  imagePath?: string;
  imageName?: string;
  fit: 'cover' | 'contain';
  position: { x: number; y: number };
}

/** A new ad id (Firestore auto-id), also used in the Storage path before the doc exists. */
export function newAdId(db: Firestore): string {
  return doc(collection(db, 'ads')).id;
}

export function newBookId(db: Firestore): string {
  return doc(collection(db, 'adBooks')).id;
}

function contentData(c: AdContent, clearBlank: boolean): DocumentData {
  const blank = clearBlank ? deleteField() : undefined;
  return {
    title: c.title.trim(),
    sizeId: c.sizeId,
    companyName: c.companyName?.trim() || blank,
    imagePath: c.imagePath || blank,
    imageName: c.imageName || blank,
    fit: c.fit,
    position: { x: c.position.x, y: c.position.y },
  };
}

function strip(data: DocumentData): DocumentData {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
}

/** Member creates their own draft (0 of 3 submissions, unlocked). */
export function createAdBatch(db: Firestore, adId: string, owner: Actor, c: AdContent): WriteBatch {
  const batch = writeBatch(db);
  batch.set(
    doc(db, 'ads', adId),
    strip({
      ...contentData(c, false),
      departmentId: 'dof',
      status: 'draft',
      createdBy: owner.uid,
      createdByName: owner.name,
      createdByType: 'member',
      submissionCount: 0,
      maxSubmissions: MAX_AD_SUBMISSIONS,
      locked: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return batch;
}

/** Owner saves a draft, or a rejected ad (which returns it to draft). */
export function updateAdContentBatch(
  db: Firestore,
  adId: string,
  c: AdContent,
  fromStatus: 'draft' | 'rejected'
): WriteBatch {
  const batch = writeBatch(db);
  batch.update(doc(db, 'ads', adId), {
    ...contentData(c, true),
    ...(fromStatus === 'rejected' ? { status: 'draft' } : {}),
    updatedAt: serverTimestamp(),
  });
  return batch;
}

/** Owner submits: adds exactly one to submissionCount and clears old rejection notes. */
export function submitAdBatch(db: Firestore, adId: string, submissionCount: number): WriteBatch {
  const batch = writeBatch(db);
  batch.update(doc(db, 'ads', adId), {
    status: 'submitted',
    submissionCount,
    submittedAt: serverTimestamp(),
    rejectionNotes: deleteField(),
    updatedAt: serverTimestamp(),
  });
  return batch;
}

/** Owner withdraws a submitted ad to draft (no submission refunded). */
export function withdrawAdBatch(db: Firestore, adId: string): WriteBatch {
  const batch = writeBatch(db);
  batch.update(doc(db, 'ads', adId), { status: 'draft', updatedAt: serverTimestamp() });
  return batch;
}

/** A different approver or admin approves. */
export function approveAdBatch(db: Firestore, adId: string, reviewer: Actor): WriteBatch {
  const batch = writeBatch(db);
  batch.update(doc(db, 'ads', adId), {
    status: 'approved',
    reviewedBy: reviewer.uid,
    reviewedByName: reviewer.name,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return batch;
}

/**
 * Admin self-approval (AC 2, 12): ad update + audits/{id} + one notifications/{id} per other admin,
 * in one batch.
 */
export function selfApproveAdBatch(
  db: Firestore,
  ad: Pick<AdItem, 'id' | 'title'>,
  actor: Actor,
  reason: string,
  recipientUids: string[]
): { batch: WriteBatch; auditId: string } {
  const batch = writeBatch(db);
  const auditRef = doc(collection(db, 'audits'));
  batch.update(doc(db, 'ads', ad.id), {
    status: 'approved',
    reviewedBy: actor.uid,
    reviewedByName: actor.name,
    reviewedAt: serverTimestamp(),
    selfApproved: true,
    selfApprovalReason: reason,
    lastAuditId: auditRef.id,
    updatedAt: serverTimestamp(),
  });
  batch.set(auditRef, {
    entityType: 'ad',
    entityId: ad.id,
    action: 'selfApprove',
    actorUid: actor.uid,
    actorName: actor.name,
    at: serverTimestamp(),
    reason,
    fromStatus: 'submitted',
    toStatus: 'approved',
  });
  for (const recipientUid of recipientUids) {
    if (recipientUid === actor.uid) continue;
    batch.set(doc(collection(db, 'notifications')), {
      recipientUid,
      type: 'adSelfApproved',
      adId: ad.id,
      adTitle: ad.title,
      actorUid: actor.uid,
      actorName: actor.name,
      reason,
      createdAt: serverTimestamp(),
      read: false,
    });
  }
  return { batch, auditId: auditRef.id };
}

/** A different approver or admin rejects with notes; the last allowed submission locks the ad. */
export function rejectAdBatch(
  db: Firestore,
  adId: string,
  reviewer: Actor,
  notes: string,
  locked: boolean
): WriteBatch {
  const batch = writeBatch(db);
  batch.update(doc(db, 'ads', adId), {
    status: 'rejected',
    rejectionNotes: notes,
    locked,
    reviewedBy: reviewer.uid,
    reviewedByName: reviewer.name,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return batch;
}

/**
 * Admin undo of an approval or rejection (AC 13): back to submitted, review fields cleared,
 * submissionCount untouched, audited. If the ad is placed in a (not locked) book it comes out of
 * that book in the same batch; the rules refuse the undo while it sits in a locked/printed book.
 */
export function undoReviewBatch(
  db: Firestore,
  ad: Pick<AdItem, 'id' | 'status' | 'bookId'>,
  actor: Actor,
  reason: string,
  placedIn?: Pick<AdBook, 'id' | 'adIds'>
): { batch: WriteBatch; auditId: string } {
  const batch = writeBatch(db);
  const auditRef = doc(collection(db, 'audits'));
  batch.update(doc(db, 'ads', ad.id), {
    status: 'submitted',
    reviewedBy: deleteField(),
    reviewedByName: deleteField(),
    reviewedAt: deleteField(),
    rejectionNotes: deleteField(),
    selfApproved: deleteField(),
    selfApprovalReason: deleteField(),
    bookId: deleteField(),
    locked: false,
    lastAuditId: auditRef.id,
    updatedAt: serverTimestamp(),
  });
  if (placedIn && placedIn.adIds.includes(ad.id)) {
    batch.update(doc(db, 'adBooks', placedIn.id), {
      adIds: placedIn.adIds.filter((x) => x !== ad.id),
      updatedAt: serverTimestamp(),
    });
  }
  batch.set(auditRef, {
    entityType: 'ad',
    entityId: ad.id,
    action: 'undoReview',
    actorUid: actor.uid,
    actorName: actor.name,
    at: serverTimestamp(),
    reason,
    fromStatus: ad.status,
    toStatus: 'submitted',
  });
  return { batch, auditId: auditRef.id };
}

/** Admin lock reset (AC 11): draft, count 0, unlocked, lockResets + audit (reason optional). */
export function resetLockBatch(
  db: Firestore,
  ad: Pick<AdItem, 'id' | 'status' | 'lockResets'>,
  actor: Actor,
  reason: string,
  nowIso: string
): { batch: WriteBatch; auditId: string; entry: AdLockReset } {
  const batch = writeBatch(db);
  const auditRef = doc(collection(db, 'audits'));
  // serverTimestamp() is not allowed inside arrays; the audit doc carries the server time.
  const entry: AdLockReset = { by: actor.uid, at: nowIso, ...(reason ? { reason } : {}) };
  batch.update(doc(db, 'ads', ad.id), {
    status: 'draft',
    submissionCount: 0,
    locked: false,
    lockResets: [...(ad.lockResets ?? []), entry],
    lastAuditId: auditRef.id,
    updatedAt: serverTimestamp(),
  });
  batch.set(
    auditRef,
    strip({
      entityType: 'ad',
      entityId: ad.id,
      action: 'lockReset',
      actorUid: actor.uid,
      actorName: actor.name,
      at: serverTimestamp(),
      reason: reason || undefined,
      fromStatus: ad.status,
      toStatus: 'draft',
    })
  );
  return { batch, auditId: auditRef.id, entry };
}

/** Owner deletes their own draft. */
export function deleteAdBatch(db: Firestore, adId: string): WriteBatch {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'ads', adId));
  return batch;
}

// ---------- books ----------

export function createBookBatch(
  db: Firestore,
  bookId: string,
  actor: Actor,
  input: { title: string; eventName: string; eventDate?: string }
): WriteBatch {
  const batch = writeBatch(db);
  batch.set(
    doc(db, 'adBooks', bookId),
    strip({
      departmentId: 'dof',
      title: input.title.trim(),
      eventName: input.eventName.trim(),
      eventDate: input.eventDate || undefined,
      status: 'open',
      pageSize: 'letter',
      adIds: [],
      createdBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return batch;
}

export function setBookStatusBatch(db: Firestore, bookId: string, status: AdBookStatus): WriteBatch {
  const batch = writeBatch(db);
  batch.update(doc(db, 'adBooks', bookId), { status, updatedAt: serverTimestamp() });
  return batch;
}

/** Place an approved ad at the end of an open book: book.adIds + ad.bookId in one batch. */
export function placeAdBatch(
  db: Firestore,
  book: Pick<AdBook, 'id' | 'adIds'>,
  adId: string
): WriteBatch {
  const batch = writeBatch(db);
  batch.update(doc(db, 'adBooks', book.id), {
    adIds: [...book.adIds, adId],
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'ads', adId), { bookId: book.id, updatedAt: serverTimestamp() });
  return batch;
}

/** Take an ad out of a book that is not locked/printed. */
export function unplaceAdBatch(
  db: Firestore,
  book: Pick<AdBook, 'id' | 'adIds'>,
  adId: string
): WriteBatch {
  const batch = writeBatch(db);
  batch.update(doc(db, 'adBooks', book.id), {
    adIds: book.adIds.filter((x) => x !== adId),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'ads', adId), { bookId: deleteField(), updatedAt: serverTimestamp() });
  return batch;
}

export function reorderBookBatch(db: Firestore, bookId: string, adIds: string[]): WriteBatch {
  const batch = writeBatch(db);
  batch.update(doc(db, 'adBooks', bookId), { adIds, updatedAt: serverTimestamp() });
  return batch;
}

// ---------- sizes ----------

export function setAdSizeBatch(db: Firestore, size: AdSize): WriteBatch {
  const batch = writeBatch(db);
  const { id, ...data } = size;
  batch.set(doc(db, 'adSizes', id), strip({ ...data }));
  return batch;
}

export function seedAdSizesBatch(db: Firestore, sizes: AdSize[]): WriteBatch {
  const batch = writeBatch(db);
  for (const { id, ...data } of sizes) batch.set(doc(db, 'adSizes', id), strip({ ...data }));
  return batch;
}

// ---------- notifications ----------

export function markNotificationReadBatch(db: Firestore, id: string): WriteBatch {
  const batch = writeBatch(db);
  batch.update(doc(db, 'notifications', id), { read: true, readAt: serverTimestamp() });
  return batch;
}

// ---------- reads ----------

/** Firestore Timestamp (or ISO string) to ISO string. */
export function toIso(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate === 'function') return maybe.toDate().toISOString();
  return undefined;
}

export function adFromDoc(id: string, d: DocumentData): AdItem {
  return {
    ...(d as Omit<AdItem, 'id'>),
    id,
    departmentId: 'dof',
    // Firestore never stores a display URL; it is resolved from imagePath at runtime.
    imageUrl: undefined,
    createdAt: toIso(d['createdAt']) ?? '',
    updatedAt: toIso(d['updatedAt']) ?? '',
    submittedAt: toIso(d['submittedAt']),
    reviewedAt: toIso(d['reviewedAt']),
  };
}

export function bookFromDoc(id: string, d: DocumentData): AdBook {
  return {
    ...(d as Omit<AdBook, 'id'>),
    id,
    adIds: Array.isArray(d['adIds']) ? (d['adIds'] as string[]) : [],
    createdAt: toIso(d['createdAt']) ?? '',
    updatedAt: toIso(d['updatedAt']) ?? '',
  };
}

export function sizeFromDoc(id: string, d: DocumentData): AdSize {
  return { ...(d as Omit<AdSize, 'id'>), id };
}

export function auditFromDoc(id: string, d: DocumentData): AuditEntry {
  return { ...(d as Omit<AuditEntry, 'id'>), id, at: toIso(d['at']) ?? '' };
}

export function notificationFromDoc(id: string, d: DocumentData): AppNotification {
  return {
    ...(d as Omit<AppNotification, 'id'>),
    id,
    createdAt: toIso(d['createdAt']) ?? '',
    readAt: toIso(d['readAt']),
  };
}

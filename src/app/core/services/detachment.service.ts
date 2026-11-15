import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { Detachment, SEED_DETACHMENTS } from '../models/detachment.model';
import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';

/** Display label used across the app; number-less detachments are flagged as pending verification. */
export function detachmentDisplayName(name: string, number: string): string {
  return number
    ? `Detachment #${number} — ${name}`
    : `${name} Detachment (Number Pending Verification)`;
}

function byName(a: Detachment, b: Detachment): number {
  return a.name.localeCompare(b.name);
}

const STORAGE_DETACHMENTS_KEY = 'mcl_portal_detachments_v1';

@Injectable({ providedIn: 'root' })
export class DetachmentService {
  private readonly fb = inject(FirebaseService);
  private readonly auth = inject(AuthService);

  private readonly _detachments = signal<Detachment[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly error = this._error.asReadonly();

  readonly detachments = this._detachments.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly activeDetachments = computed(() =>
    this._detachments().filter((d) => d.active)
  );

  readonly unverifiedCount = computed(
    () => this._detachments().filter((d) => d.needsVerification).length
  );

  constructor() {
    if (this.fb.isConfigured) {
      // Reload when the signed-in user (or their admin status) changes: rules decide what is visible.
      const accessKey = computed(
        () => `${this.auth.user()?.uid ?? ''}|${this.auth.isActive()}|${this.auth.isAdmin()}`
      );
      effect(() => {
        accessKey();
        untracked(() => void this.load());
      });
    } else {
      this.load();
    }
  }

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      if (this.fb.isConfigured && this.fb.firestore) {
        await this.auth.whenReady();
        const col = collection(this.fb.firestore, 'detachments');
        // Signed-out / inactive users may only list active detachments (firestore.rules).
        const q = this.auth.isActive() ? query(col) : query(col, where('active', '==', true));
        const snap = await getDocs(q);
        if (snap.empty && this.auth.isAdmin()) {
          // Fresh project: the first admin to load the directory writes the DoF seed (issue #11).
          await this.seedDefaults();
          return;
        }
        this._detachments.set(
          snap.docs
            .map((d) => ({ ...(d.data() as Omit<Detachment, 'id'>), id: d.id }))
            .sort(byName)
        );
      } else {
        const raw = localStorage.getItem(STORAGE_DETACHMENTS_KEY);
        if (raw) {
          this._detachments.set(JSON.parse(raw) as Detachment[]);
        } else {
          this._detachments.set([...SEED_DETACHMENTS]);
          this.saveLocal();
        }
      }
    } catch (err) {
      console.error('Unable to load detachments', err);
      this._error.set('Unable to load the detachment directory.');
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Writes SEED_DETACHMENTS (#54 = Morris F. Dixon Jr.; S/Sgt Ted Archambault with
   * needsVerification and no number) to Firestore. Only admins can write detachments.
   * Existing documents with the same ids are left untouched.
   */
  async seedDefaults(): Promise<void> {
    if (!this.fb.isConfigured || !this.fb.firestore) {
      this._detachments.set([...SEED_DETACHMENTS].sort(byName));
      this.saveLocal();
      return;
    }
    const db = this.fb.firestore;
    const existing = new Set((await getDocs(collection(db, 'detachments'))).docs.map((d) => d.id));
    const batch = writeBatch(db);
    for (const det of SEED_DETACHMENTS) {
      if (!existing.has(det.id)) batch.set(doc(db, 'detachments', det.id), det);
    }
    await batch.commit();
    const snap = await getDocs(collection(db, 'detachments'));
    this._detachments.set(
      snap.docs.map((d) => ({ ...(d.data() as Omit<Detachment, 'id'>), id: d.id })).sort(byName)
    );
  }

  private saveLocal(): void {
    localStorage.setItem(STORAGE_DETACHMENTS_KEY, JSON.stringify(this._detachments()));
  }

  async addDetachment(input: Omit<Detachment, 'id' | 'departmentId' | 'displayName'>): Promise<void> {
    const cleanNum = input.number.trim();
    const id = cleanNum
      ? `dof-${cleanNum.padStart(3, '0')}`
      : `dof-${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`;

    const displayName = detachmentDisplayName(input.name.trim(), cleanNum);

    const record: Detachment = {
      id,
      departmentId: 'dof',
      number: cleanNum,
      name: input.name.trim(),
      displayName,
      city: input.city?.trim() || undefined,
      active: input.active,
      needsVerification: input.needsVerification ?? !cleanNum,
      notes: input.notes?.trim() || undefined,
    };

    if (this.fb.isConfigured && this.fb.firestore) {
      await setDoc(doc(this.fb.firestore, 'detachments', id), record);
    }

    this._detachments.update((list) => [...list.filter((d) => d.id !== id), record].sort(byName));
    if (!this.fb.isConfigured) {
      this.saveLocal();
    }
  }

  async toggleActive(detachment: Detachment): Promise<void> {
    const updated = { ...detachment, active: !detachment.active };
    if (this.fb.isConfigured && this.fb.firestore) {
      await updateDoc(doc(this.fb.firestore, 'detachments', detachment.id), {
        active: updated.active,
      });
    }
    this._detachments.update((list) =>
      list.map((d) => (d.id === detachment.id ? updated : d))
    );
    if (!this.fb.isConfigured) {
      this.saveLocal();
    }
  }

  /**
   * Edit name, number, city, or notes. The document id stays stable. Recording a new number on a
   * detachment that needs verification clears `needsVerification`, the same outcome as Verify
   * (#15). Saving without a new number leaves the flag alone.
   */
  async updateDetachment(
    detachment: Detachment,
    patch: Pick<Detachment, 'name' | 'number'> & Partial<Pick<Detachment, 'city' | 'notes'>>
  ): Promise<void> {
    const name = patch.name.trim();
    if (!name) return;
    const number = patch.number.trim();
    const recordsNumber =
      !!detachment.needsVerification && number !== '' && number !== (detachment.number ?? '');
    const changes: Partial<Detachment> = {
      name,
      number,
      displayName: detachmentDisplayName(name, number),
      city: patch.city?.trim() ?? '',
      notes: patch.notes?.trim() ?? '',
      ...(recordsNumber ? { needsVerification: false } : {}),
    };
    if (this.fb.isConfigured && this.fb.firestore) {
      await updateDoc(doc(this.fb.firestore, 'detachments', detachment.id), changes);
    }
    const updated: Detachment = { ...detachment, ...changes };
    this._detachments.update((list) =>
      list.map((d) => (d.id === detachment.id ? updated : d)).sort(byName)
    );
    if (!this.fb.isConfigured) {
      this.saveLocal();
    }
  }

  async verifyDetachmentNumber(detachment: Detachment, number: string): Promise<void> {
    const cleanNum = number.trim();
    if (!cleanNum) return;
    const updated: Detachment = {
      ...detachment,
      number: cleanNum,
      displayName: detachmentDisplayName(detachment.name, cleanNum),
      needsVerification: false,
    };
    if (this.fb.isConfigured && this.fb.firestore) {
      await updateDoc(doc(this.fb.firestore, 'detachments', detachment.id), {
        number: updated.number,
        displayName: updated.displayName,
        needsVerification: false,
      });
    }
    this._detachments.update((list) =>
      list.map((d) => (d.id === detachment.id ? updated : d))
    );
    if (!this.fb.isConfigured) {
      this.saveLocal();
    }
  }

  getById(id: string | undefined): Detachment | undefined {
    if (!id) return undefined;
    return this._detachments().find((d) => d.id === id);
  }
}


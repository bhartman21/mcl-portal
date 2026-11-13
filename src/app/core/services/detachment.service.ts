import { computed, inject, Injectable, signal } from '@angular/core';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { Detachment, SEED_DETACHMENTS } from '../models/detachment.model';
import { FirebaseService } from './firebase.service';

const STORAGE_DETACHMENTS_KEY = 'mcl_portal_detachments_v1';

@Injectable({ providedIn: 'root' })
export class DetachmentService {
  private readonly fb = inject(FirebaseService);

  private readonly _detachments = signal<Detachment[]>([]);
  private readonly _loading = signal<boolean>(false);

  readonly detachments = this._detachments.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly activeDetachments = computed(() =>
    this._detachments().filter((d) => d.active)
  );

  readonly unverifiedCount = computed(
    () => this._detachments().filter((d) => d.needsVerification).length
  );

  constructor() {
    this.load();
  }

  async load(): Promise<void> {
    this._loading.set(true);
    try {
      if (this.fb.isConfigured && this.fb.firestore) {
        const q = query(
          collection(this.fb.firestore, 'detachments'),
          orderBy('name')
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          this._detachments.set([...SEED_DETACHMENTS]);
        } else {
          this._detachments.set(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Detachment, 'id'>) }))
          );
        }
      } else {
        const raw = localStorage.getItem(STORAGE_DETACHMENTS_KEY);
        if (raw) {
          this._detachments.set(JSON.parse(raw) as Detachment[]);
        } else {
          this._detachments.set([...SEED_DETACHMENTS]);
          this.saveLocal();
        }
      }
    } finally {
      this._loading.set(false);
    }
  }

  private saveLocal(): void {
    localStorage.setItem(STORAGE_DETACHMENTS_KEY, JSON.stringify(this._detachments()));
  }

  async addDetachment(input: Omit<Detachment, 'id' | 'departmentId' | 'displayName'>): Promise<void> {
    const cleanNum = input.number.trim();
    const id = cleanNum
      ? `dof-${cleanNum.padStart(3, '0')}`
      : `dof-${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`;

    const displayName = cleanNum
      ? `Detachment #${cleanNum} — ${input.name.trim()}`
      : `${input.name.trim()} Detachment (Number Pending Verification)`;

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

    this._detachments.update((list) => [...list.filter((d) => d.id !== id), record]);
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

  async verifyDetachmentNumber(detachment: Detachment, number: string): Promise<void> {
    const cleanNum = number.trim();
    if (!cleanNum) return;
    const updated: Detachment = {
      ...detachment,
      number: cleanNum,
      displayName: `Detachment #${cleanNum} — ${detachment.name}`,
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


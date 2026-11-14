import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Detachment } from '../../core/models/detachment.model';
import { DetachmentService } from '../../core/services/detachment.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-admin-detachments',
  standalone: true,
  imports: [FormsModule, RouterLink, StatusBadgeComponent],
  templateUrl: './admin-detachments.component.html',
})
export class AdminDetachmentsComponent {
  readonly detachmentService = inject(DetachmentService);

  readonly detachments = this.detachmentService.detachments;
  readonly unverifiedCount = computed(() => this.detachmentService.unverifiedCount());

  newNumber = '';
  newName = '';
  newCity = '';
  readonly verifyInputs = signal<Record<string, string>>({});
  readonly seeding = signal(false);

  /** Detachment currently being edited inline, with its draft values. */
  readonly editingId = signal<string | null>(null);
  editDraft = { number: '', name: '', city: '', notes: '' };

  startEdit(det: Detachment): void {
    this.editingId.set(det.id);
    this.editDraft = {
      number: det.number ?? '',
      name: det.name,
      city: det.city ?? '',
      notes: det.notes ?? '',
    };
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  async saveEdit(det: Detachment): Promise<void> {
    if (!this.editDraft.name.trim()) return;
    await this.detachmentService.updateDetachment(det, this.editDraft);
    this.editingId.set(null);
  }

  async seedDefaults(): Promise<void> {
    this.seeding.set(true);
    try {
      await this.detachmentService.seedDefaults();
    } finally {
      this.seeding.set(false);
    }
  }

  setVerifyInput(id: string, val: string): void {
    this.verifyInputs.update((map) => ({ ...map, [id]: val }));
  }

  async addDetachment(): Promise<void> {
    if (!this.newName.trim()) return;
    await this.detachmentService.addDetachment({
      number: this.newNumber,
      name: this.newName,
      city: this.newCity,
      active: true,
      needsVerification: !this.newNumber.trim(),
    });
    this.newNumber = '';
    this.newName = '';
    this.newCity = '';
  }

  async verifyNumber(det: Detachment): Promise<void> {
    const num = (this.verifyInputs()[det.id] || '').trim();
    if (!num) return;
    await this.detachmentService.verifyDetachmentNumber(det, num);
  }
}

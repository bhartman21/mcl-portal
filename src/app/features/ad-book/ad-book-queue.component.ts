import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdBookService } from '../../core/services/ad-book.service';

@Component({
  selector: 'app-ad-book-queue',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './ad-book-queue.component.html',
})
export class AdBookQueueComponent {
  readonly adBook = inject(AdBookService);

  readonly notice = signal<string | null>(null);
  readonly errorMsg = signal<string | null>(null);
  readonly notesMap = signal<Record<string, string>>({});

  sizeLabel(sizeId: string): string {
    const s = this.adBook.getSizeById(sizeId);
    return s ? `${s.label} (${s.widthIn}" × ${s.heightIn}")` : sizeId;
  }

  setNotes(adId: string, val: string): void {
    this.notesMap.update((m) => ({ ...m, [adId]: val }));
  }

  approve(adId: string): void {
    this.errorMsg.set(null);
    this.adBook.approveAd(adId);
    this.notice.set('Ad approved and ready for book placement.');
  }

  reject(adId: string): void {
    this.errorMsg.set(null);
    this.notice.set(null);
    try {
      this.adBook.rejectAd(adId, this.notesMap()[adId] || '');
      this.notice.set('Ad returned to member with revision notes.');
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Unable to reject ad.');
    }
  }
}


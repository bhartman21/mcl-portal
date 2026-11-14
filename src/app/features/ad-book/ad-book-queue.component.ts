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
  /** Self-approval reasons (admins, own ads) and undo reasons, keyed by ad id. */
  readonly reasonMap = signal<Record<string, string>>({});

  sizeLabel(sizeId: string): string {
    const s = this.adBook.getSizeById(sizeId);
    return s ? `${s.label} (${s.widthIn}" × ${s.heightIn}")` : sizeId;
  }

  setNotes(adId: string, val: string): void {
    this.notesMap.update((m) => ({ ...m, [adId]: val }));
  }

  setReason(adId: string, val: string): void {
    this.reasonMap.update((m) => ({ ...m, [adId]: val }));
  }

  reasonFor(adId: string): string {
    return this.reasonMap()[adId] || '';
  }

  private run(action: () => void, success: string, fallback: string): void {
    this.errorMsg.set(null);
    this.notice.set(null);
    try {
      action();
      this.notice.set(success);
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : fallback);
    }
  }

  approve(adId: string): void {
    this.run(
      () => this.adBook.approveAd(adId),
      'Ad approved and ready for book placement.',
      'Unable to approve ad.'
    );
  }

  selfApprove(adId: string): void {
    this.run(
      () => this.adBook.approveAd(adId, { selfApprovalReason: this.reasonFor(adId) }),
      'Your ad was self-approved. The reason was logged and the other admins were notified.',
      'Unable to approve ad.'
    );
  }

  reject(adId: string): void {
    this.run(
      () => this.adBook.rejectAd(adId, this.notesMap()[adId] || ''),
      'Ad returned to member with revision notes.',
      'Unable to reject ad.'
    );
  }

  undo(adId: string): void {
    this.run(
      () => {
        this.adBook.undoReview(adId, this.reasonFor(adId));
        this.setReason(adId, '');
      },
      'Review undone. The ad is back in the queue as submitted.',
      'Unable to undo review.'
    );
  }
}

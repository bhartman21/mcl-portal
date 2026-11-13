import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdStatus } from '../../core/models/ad-book.model';
import { AdBookService } from '../../core/services/ad-book.service';

@Component({
  selector: 'app-ad-book-hub',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './ad-book-hub.component.html',
  styleUrl: './ad-book-hub.component.scss',
})
export class AdBookHubComponent {
  readonly adBook = inject(AdBookService);

  readonly notice = signal<string | null>(null);
  readonly errorMsg = signal<string | null>(null);
  readonly showNewBookForm = signal(false);

  newBookTitle = '';
  newBookEvent = '';

  sizeLabel(sizeId: string): string {
    const s = this.adBook.getSizeById(sizeId);
    return s ? `${s.label} (${s.widthIn}" × ${s.heightIn}")` : sizeId;
  }

  statusBadgeClass(status: AdStatus): string {
    switch (status) {
      case 'approved':
        return 'text-bg-success';
      case 'submitted':
        return 'text-bg-primary';
      case 'rejected':
        return 'text-bg-danger';
      case 'draft':
      default:
        return 'text-bg-secondary';
    }
  }

  submitAd(id: string): void {
    this.errorMsg.set(null);
    this.notice.set(null);
    try {
      this.adBook.submitAd(id);
      this.notice.set('Ad submitted to the Approval Queue.');
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Unable to submit ad.');
    }
  }

  recallAd(id: string): void {
    this.errorMsg.set(null);
    this.adBook.recallToDraft(id);
    this.notice.set('Ad recalled to draft.');
  }

  deleteAd(id: string): void {
    this.errorMsg.set(null);
    this.adBook.deleteAd(id);
    this.notice.set('Draft deleted.');
  }

  createBook(): void {
    if (!this.newBookTitle.trim() || !this.newBookEvent.trim()) return;
    this.adBook.createBook({
      title: this.newBookTitle,
      eventName: this.newBookEvent,
    });
    this.newBookTitle = '';
    this.newBookEvent = '';
    this.showNewBookForm.set(false);
    this.notice.set('Event book created.');
  }
}


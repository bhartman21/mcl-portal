import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdBookStatus, AdItem, AdSize, AdSizeLayoutHint } from '../../core/models/ad-book.model';
import { AdBookService } from '../../core/services/ad-book.service';

interface PlacedSlot {
  ad: AdItem;
  size: AdSize;
}

interface BookletPage {
  layoutHint: AdSizeLayoutHint;
  slots: PlacedSlot[];
}

@Component({
  selector: 'app-ad-book-detail',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './ad-book-detail.component.html',
  styleUrl: './ad-book-detail.component.scss',
})
export class AdBookDetailComponent {
  readonly adBook = inject(AdBookService);
  private readonly route = inject(ActivatedRoute);

  readonly bookId = signal(this.route.snapshot.paramMap.get('bookId') || '');
  readonly book = computed(() => this.adBook.getBookById(this.bookId()));
  readonly errorMsg = signal<string | null>(null);

  selectedAdToAdd = '';

  readonly placedAds = computed<PlacedSlot[]>(() => {
    const b = this.book();
    if (!b) return [];
    const result: PlacedSlot[] = [];
    for (const id of b.adIds) {
      const ad = this.adBook.getAdById(id);
      if (!ad) continue;
      const size = this.adBook.getSizeById(ad.sizeId) ?? this.adBook.adSizes()[0];
      result.push({ ad, size });
    }
    return result;
  });

  readonly availableApprovedAds = computed(() => {
    const placedIds = new Set(this.book()?.adIds ?? []);
    return this.adBook.approvedAds().filter((a) => !placedIds.has(a.id));
  });

  readonly pages = computed<BookletPage[]>(() => {
    const slots = this.placedAds();
    const pages: BookletPage[] = [];

    let current: BookletPage | null = null;
    for (const slot of slots) {
      const maxSlots = Math.max(1, slot.size.slotsPerPage);
      if (
        !current ||
        current.layoutHint !== slot.size.layoutHint ||
        current.slots.length >= maxSlots
      ) {
        current = { layoutHint: slot.size.layoutHint, slots: [slot] };
        pages.push(current);
      } else {
        current.slots.push(slot);
      }
    }

    return pages;
  });

  sizeLabel(sizeId: string): string {
    return this.adBook.getSizeById(sizeId)?.label ?? sizeId;
  }

  setStatus(status: AdBookStatus): void {
    const b = this.book();
    if (!b) return;
    this.adBook.updateBookStatus(b.id, status);
  }

  addSelectedAd(): void {
    this.errorMsg.set(null);
    const b = this.book();
    const adId = this.selectedAdToAdd || this.availableApprovedAds()[0]?.id;
    if (!b || !adId) return;

    try {
      this.adBook.addAdToBook(b.id, adId);
      this.selectedAdToAdd = '';
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Unable to add ad to book.');
    }
  }

  printBook(): void {
    window.print();
  }
}


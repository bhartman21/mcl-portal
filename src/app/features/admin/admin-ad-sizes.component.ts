import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdBookService } from '../../core/services/ad-book.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-admin-ad-sizes',
  standalone: true,
  imports: [FormsModule, RouterLink, StatusBadgeComponent],
  templateUrl: './admin-ad-sizes.component.html',
})
export class AdminAdSizesComponent {
  readonly adBook = inject(AdBookService);

  label = '';
  widthIn = 7.5;
  heightIn = 6.5;
  slotsPerPage = 1;

  readonly errorMsg = signal<string | null>(null);

  async toggle(id: string): Promise<void> {
    this.errorMsg.set(null);
    try {
      await this.adBook.toggleAdSizeActive(id);
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Unable to update the size.');
    }
  }

  async addSize(): Promise<void> {
    if (!this.label.trim()) return;
    this.errorMsg.set(null);
    try {
      await this.adBook.addAdSize({
      label: this.label,
      widthIn: this.widthIn,
      heightIn: this.heightIn,
      slotsPerPage: this.slotsPerPage,
      layoutHint: this.slotsPerPage === 1 ? 'full' : this.slotsPerPage === 2 ? 'horizontal-split' : 'grid',
      });
      this.label = '';
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Unable to add the size.');
    }
  }
}


import { Component, inject } from '@angular/core';
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

  addSize(): void {
    if (!this.label.trim()) return;
    this.adBook.addAdSize({
      label: this.label,
      widthIn: this.widthIn,
      heightIn: this.heightIn,
      slotsPerPage: this.slotsPerPage,
      layoutHint: this.slotsPerPage === 1 ? 'full' : this.slotsPerPage === 2 ? 'horizontal-split' : 'grid',
    });
    this.label = '';
  }
}


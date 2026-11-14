import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdBookService } from '../../core/services/ad-book.service';
import { NotificationService } from '../../core/services/notification.service';

/** Admin page: in-app notifications (AD_BOOK.md AC 2, 12) and the Ad Book audit log. */
@Component({
  selector: 'app-admin-activity',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './admin-activity.component.html',
})
export class AdminActivityComponent {
  readonly notifications = inject(NotificationService);
  readonly adBook = inject(AdBookService);

  actionLabel(action: string): string {
    switch (action) {
      case 'selfApprove':
        return 'Self-approved own ad';
      case 'undoReview':
        return 'Undid review';
      default:
        return action;
    }
  }

  adTitle(adId: string): string {
    return this.adBook.getAdById(adId)?.title ?? adId;
  }
}

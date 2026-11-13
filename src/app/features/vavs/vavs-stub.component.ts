import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { DetachmentService } from '../../core/services/detachment.service';

@Component({
  selector: 'app-vavs-stub',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './vavs-stub.component.html',
})
export class VavsStubComponent {
  readonly auth = inject(AuthService);
  private readonly detachmentService = inject(DetachmentService);

  readonly activeDetachments = computed(() => this.detachmentService.activeDetachments());
  selectedDetachmentId = signal(this.auth.user()?.defaultDetachmentId || 'dof-054');
  selectedPeriod = signal('2026-h2');
}

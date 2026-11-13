import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { DetachmentService } from '../../core/services/detachment.service';
import { MclCrestComponent } from '../../shared/components/mcl-crest.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, MclCrestComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  readonly auth = inject(AuthService);
  private readonly detachmentService = inject(DetachmentService);

  readonly ribbonRackUrl = environment.ribbonRackBuilderUrl;
  readonly activeDetachments = computed(() => this.detachmentService.activeDetachments());
}

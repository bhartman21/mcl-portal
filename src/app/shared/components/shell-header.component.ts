import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { MclCrestComponent } from './mcl-crest.component';
import { StatusBadgeComponent } from './status-badge.component';

@Component({
  selector: 'app-shell-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MclCrestComponent, StatusBadgeComponent],
  templateUrl: './shell-header.component.html',
  styleUrl: './shell-header.component.scss',
})
export class ShellHeaderComponent {
  readonly auth = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly ribbonRackUrl = environment.ribbonRackBuilderUrl;

  readonly menuOpen = signal(false);
  readonly adminOpen = signal(false);

  closeMenus(): void {
    this.menuOpen.set(false);
    this.adminOpen.set(false);
  }

  async signOut(): Promise<void> {
    this.closeMenus();
    await this.auth.signOut();
  }
}

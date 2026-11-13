import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RegistrationMode } from '../../core/models/user.model';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-settings.component.html',
})
export class AdminSettingsComponent {
  readonly auth = inject(AuthService);
  private readonly adminService = inject(AdminService);

  readonly savedNotice = signal(false);

  async setMode(mode: RegistrationMode): Promise<void> {
    await this.adminService.setRegistrationMode(mode);
    this.savedNotice.set(true);
    setTimeout(() => this.savedNotice.set(false), 3000);
  }
}

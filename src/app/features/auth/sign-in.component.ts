import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MclCrestComponent } from '../../shared/components/mcl-crest.component';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [FormsModule, MclCrestComponent],
  templateUrl: './sign-in.component.html',
})
export class SignInComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  readonly busy = signal(false);
  readonly linkSent = signal(false);
  readonly errorMsg = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    if (!this.auth.isDemoMode()) {
      try {
        const completed = await this.auth.completeEmailLinkSignIn(window.location.href);
        if (completed) {
          await this.navigateAfterSignIn();
        }
      } catch (err) {
        this.errorMsg.set(err instanceof Error ? err.message : 'Unable to complete sign-in.');
      }
    }
  }

  async sendEmailLink(): Promise<void> {
    this.errorMsg.set(null);
    this.busy.set(true);
    try {
      await this.auth.sendEmailSignInLink(this.email.trim());
      this.linkSent.set(true);
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Failed to send sign-in link.');
    } finally {
      this.busy.set(false);
    }
  }

  async signInGoogle(): Promise<void> {
    this.errorMsg.set(null);
    this.busy.set(true);
    try {
      await this.auth.signInWithGoogle();
      await this.navigateAfterSignIn();
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      this.busy.set(false);
    }
  }

  async demoLogin(
    role: 'member' | 'detachmentVavsRep' | 'adBookApprover' | 'departmentAdmin'
  ): Promise<void> {
    switch (role) {
      case 'departmentAdmin':
        this.auth.signInDemo({
          displayName: 'Dept. Adjutant (Admin)',
          email: 'adjutant@dof-mcl.org',
          roles: ['member', 'departmentAdmin'],
        });
        break;
      case 'detachmentVavsRep':
        this.auth.signInDemo({
          displayName: 'Sgt. Maj. R. Vance',
          email: 'vavs54@dof-mcl.org',
          roles: ['member', 'detachmentVavsRep'],
          detachmentScopes: ['dof-054'],
          defaultDetachmentId: 'dof-054',
        });
        break;
      case 'adBookApprover':
        this.auth.signInDemo({
          displayName: 'Cpl. M. Holloway',
          email: 'adbook@dof-mcl.org',
          roles: ['member', 'adBookApprover'],
        });
        break;
      case 'member':
      default:
        this.auth.signInDemo({
          displayName: 'Cpl. D. Rivera',
          email: 'member@dof-mcl.org',
          roles: ['member'],
          respectRegistrationMode: true,
        });
        break;
    }

    if (this.auth.isActive()) {
      await this.navigateAfterSignIn();
    }
  }

  private async navigateAfterSignIn(): Promise<void> {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
    await this.router.navigateByUrl(returnUrl);
  }
}

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
  /**
   * The page was opened from an email sign-in link and the user must type their email: either
   * none is stored on this device ('missing'), or the stored one didn't work ('mismatch', #14).
   */
  readonly needsEmailConfirm = signal(false);
  readonly confirmReason = signal<'missing' | 'mismatch'>('missing');
  confirmEmail = '';

  async ngOnInit(): Promise<void> {
    if (this.auth.isDemoMode()) return;
    const url = window.location.href;
    if (!this.auth.isEmailSignInLink(url)) return;

    const stored = this.auth.storedSignInEmail();
    if (!stored) {
      // Link opened on a different device/browser: ask the user to re-enter their email.
      this.confirmReason.set('missing');
      this.needsEmailConfirm.set(true);
      return;
    }
    const ok = await this.finishEmailLink();
    // The stored email didn't complete the link (wrong address or typo): fall back to the
    // confirm form, prefilled so the user can correct it. Not when sign-in itself succeeded
    // but the profile failed to load (auth.authError), which re-typing can't fix.
    if (!ok && !this.auth.authError()) {
      this.auth.clearStoredSignInEmail();
      this.confirmEmail = stored;
      this.confirmReason.set('mismatch');
      this.needsEmailConfirm.set(true);
    }
  }

  async confirmEmailAndFinish(): Promise<void> {
    if (!this.confirmEmail.trim()) return;
    await this.finishEmailLink(this.confirmEmail.trim());
  }

  /** Returns false when completing the link threw. */
  private async finishEmailLink(email?: string): Promise<boolean> {
    this.errorMsg.set(null);
    this.busy.set(true);
    try {
      const completed = await this.auth.completeEmailLinkSignIn(window.location.href, email);
      if (completed) {
        this.needsEmailConfirm.set(false);
        if (this.auth.isActive()) {
          await this.navigateAfterSignIn();
        }
      }
      return true;
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Unable to complete sign-in.');
      return false;
    } finally {
      this.busy.set(false);
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

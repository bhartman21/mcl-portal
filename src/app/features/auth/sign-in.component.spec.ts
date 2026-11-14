import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SignInComponent } from './sign-in.component';

/** AuthService double for the email-link completion paths (#14). */
class FakeLinkAuth {
  stored: string | null = null;
  readonly authError = signal<string | null>(null);
  readonly isDemoMode = () => false;
  readonly isActive = () => true;
  readonly isPending = () => false;
  readonly isSuspended = () => false;
  readonly user = () => null;
  signOut = vi.fn();
  readonly googleSignInEnabled = false;
  readonly registrationMode = () => 'open';
  isEmailSignInLink = () => true;
  storedSignInEmail = () => this.stored;
  clearStoredSignInEmail = vi.fn(() => (this.stored = null));
  completeEmailLinkSignIn = vi.fn(async (_url: string, email?: string) => {
    const used = email ?? this.stored;
    if (used !== 'alice@example.com') throw new Error('The email provided does not match the sign-in email address.');
    return true;
  });
}

describe('SignInComponent email-link completion (#14)', () => {
  let auth: FakeLinkAuth;

  async function init(): Promise<SignInComponent> {
    const fixture = TestBed.createComponent(SignInComponent);
    fixture.detectChanges(); // runs ngOnInit
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    auth = new FakeLinkAuth();
    TestBed.configureTestingModule({
      imports: [SignInComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  it('prompts for the email when none is stored', async () => {
    const cmp = await init();
    expect(cmp.needsEmailConfirm()).toBe(true);
    expect(cmp.confirmReason()).toBe('missing');
    expect(auth.completeEmailLinkSignIn).not.toHaveBeenCalled();
  });

  it('completes automatically with a matching stored email', async () => {
    auth.stored = 'alice@example.com';
    const cmp = await init();
    expect(cmp.needsEmailConfirm()).toBe(false);
    expect(auth.completeEmailLinkSignIn).toHaveBeenCalledTimes(1);
  });

  it('falls back to the confirm form, prefilled, when the stored email is wrong', async () => {
    auth.stored = 'alice@exampel.com';
    const cmp = await init();
    expect(cmp.needsEmailConfirm()).toBe(true);
    expect(cmp.confirmReason()).toBe('mismatch');
    expect(cmp.confirmEmail).toBe('alice@exampel.com');
    expect(auth.clearStoredSignInEmail).toHaveBeenCalled();

    cmp.confirmEmail = 'alice@example.com';
    await cmp.confirmEmailAndFinish();
    expect(cmp.needsEmailConfirm()).toBe(false);
  });

  it('does not re-prompt when sign-in worked but the profile failed to load', async () => {
    auth.stored = 'alice@example.com';
    auth.completeEmailLinkSignIn.mockImplementationOnce(async () => {
      auth.authError.set('profile failed');
      throw new Error('profile failed');
    });
    const cmp = await init();
    expect(cmp.needsEmailConfirm()).toBe(false);
  });
});

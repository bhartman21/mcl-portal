import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FakeAuth } from '../../../testing/fake-auth';
import { UserProfile } from '../../core/models/user.model';
import { AdBookService } from '../../core/services/ad-book.service';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { AdBookHubComponent } from './ad-book-hub.component';

describe('AdBookHubComponent', () => {
  let auth: FakeAuth;
  let service: AdBookService;

  async function newAd(): Promise<string> {
    const ad = await service.createAd({
      title: 'My ad',
      sizeId: 'full',
      imageUrl: 'data:image/png;base64,AAAA',
      fit: 'cover',
      position: { x: 50, y: 50 },
    });
    return ad.id;
  }

  function buttonTexts(): string[] {
    const fixture = TestBed.createComponent(AdBookHubComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim() ?? '');
  }

  beforeEach(() => {
    localStorage.clear();
    auth = new FakeAuth();
    TestBed.configureTestingModule({
      imports: [AdBookHubComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: AdminService, useValue: { users: signal<UserProfile[]>([]) } },
      ],
    });
    service = TestBed.inject(AdBookService);
    auth.signInAs('alice');
  });

  it('offers Withdraw to Draft on submitted ads only (#6)', async () => {
    const id = await newAd();
    expect(buttonTexts()).not.toContain('Withdraw to Draft');
    await service.submitAd(id);
    expect(buttonTexts()).toContain('Withdraw to Draft');

    auth.signInAs('approver', ['member', 'adBookApprover']);
    await service.approveAd(id);
    auth.signInAs('alice');
    expect(buttonTexts()).not.toContain('Withdraw to Draft');
  });

  it('shows the submission count and hides Edit/Submit on a locked ad (#5)', async () => {
    const id = await newAd();
    for (let i = 0; i < 3; i++) {
      auth.signInAs('alice');
      await service.submitAd(id);
      auth.signInAs('approver', ['member', 'adBookApprover']);
      await service.rejectAd(id, 'Please fix the logo');
    }
    auth.signInAs('alice');
    const fixture = TestBed.createComponent(AdBookHubComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="submission-count"]')?.textContent).toContain('Submission 3 of 3');
    expect(el.textContent).toContain('Submission limit reached');
    expect(buttonTexts()).not.toContain('Submit');
  });
});

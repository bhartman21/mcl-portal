import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FakeAuth, profile } from '../../../testing/fake-auth';
import { RoleId, UserProfile } from '../../core/models/user.model';
import { AdBookService } from '../../core/services/ad-book.service';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { AdBookQueueComponent } from './ad-book-queue.component';

describe('AdBookQueueComponent review controls (#3)', () => {
  let auth: FakeAuth;
  let service: AdBookService;

  function submitAs(uid: string, roles: RoleId[]): string {
    auth.signInAs(uid, roles);
    const ad = service.createAd({
      title: `${uid} ad`,
      sizeId: 'full',
      imageUrl: 'data:image/png;base64,AAAA',
      fit: 'cover',
      position: { x: 50, y: 50 },
    });
    service.submitAd(ad.id);
    return ad.id;
  }

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(AdBookQueueComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const buttons = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim() ?? '');

  beforeEach(() => {
    localStorage.clear();
    auth = new FakeAuth();
    TestBed.configureTestingModule({
      imports: [AdBookQueueComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: AdminService, useValue: { users: signal<UserProfile[]>([profile('admin2')]) } },
      ],
    });
    service = TestBed.inject(AdBookService);
  });

  it('hides approve and reject on an approver\u2019s own ad', () => {
    submitAs('approver', ['member', 'adBookApprover']);
    const el = render();
    expect(buttons(el).some((b) => b.includes('Approve'))).toBe(false);
    expect(buttons(el).some((b) => b.includes('Reject'))).toBe(false);
    expect(el.textContent).toContain('A different approver must review it');
  });

  it('shows approve and reject on someone else\u2019s ad', () => {
    submitAs('alice', ['member']);
    auth.signInAs('approver', ['member', 'adBookApprover']);
    const el = render();
    expect(buttons(el)).toContain('Approve');
    expect(buttons(el).some((b) => b.includes('Reject'))).toBe(true);
  });

  it('offers an admin only reason-gated self-approval on their own ad (no reject)', () => {
    submitAs('admin', ['member', 'departmentAdmin']);
    const el = render();
    const self = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Approve My Own Ad')
    )!;
    expect(self).toBeTruthy();
    expect(self.disabled).toBe(true);
    expect(buttons(el).some((b) => b.includes('Reject'))).toBe(false);
  });

  it('shows Undo Review for admins on reviewed ads', () => {
    const id = submitAs('alice', ['member']);
    auth.signInAs('approver', ['member', 'adBookApprover']);
    service.approveAd(id);
    expect(buttons(render()).some((b) => b.includes('Undo Review'))).toBe(false);
    auth.signInAs('admin', ['member', 'departmentAdmin']);
    expect(buttons(render()).some((b) => b.includes('Undo Review'))).toBe(true);
  });
});

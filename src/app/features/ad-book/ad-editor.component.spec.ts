import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { FakeAuth } from '../../../testing/fake-auth';
import { UserProfile } from '../../core/models/user.model';
import { AdBookService } from '../../core/services/ad-book.service';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { DocumentConverterService } from '../../core/services/document-converter.service';
import { AdEditorComponent } from './ad-editor.component';

describe('AdEditorComponent: locked ads', () => {
  let auth: FakeAuth;
  let service: AdBookService;
  let adId: string | null;

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

  /** Uses all 3 submissions, each rejected, so the ad ends up `rejected` + `locked`. */
  async function lockAd(id: string): Promise<void> {
    for (let i = 0; i < 3; i++) {
      auth.signInAs('alice');
      await service.submitAd(id);
      auth.signInAs('approver', ['member', 'adBookApprover']);
      await service.rejectAd(id, 'Please fix the logo');
    }
    auth.signInAs('alice');
  }

  function render() {
    const fixture = TestBed.createComponent(AdEditorComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = () => Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim() ?? '');
    return { fixture, el, buttons };
  }

  beforeEach(() => {
    localStorage.clear();
    adId = null;
    auth = new FakeAuth();
    TestBed.configureTestingModule({
      imports: [AdEditorComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: AdminService, useValue: { users: signal<UserProfile[]>([]) } },
        { provide: DocumentConverterService, useValue: {} },
        {
          provide: ActivatedRoute,
          useFactory: () => ({ snapshot: { paramMap: convertToParamMap(adId ? { adId } : {}) } }),
        },
      ],
    });
    service = TestBed.inject(AdBookService);
    auth.signInAs('alice');
  });

  it('hides Save Draft and Submit for Approval on a locked ad and says an admin can reset it', async () => {
    const id = await newAd();
    await lockAd(id);
    adId = id;
    const { el, buttons } = render();
    expect(buttons()).not.toContain('Save Draft');
    expect(buttons()).not.toContain('Submit for Approval');
    const note = el.querySelector('[data-testid="locked-ad-note"]');
    expect(note?.textContent).toContain('Submission limit reached');
    expect(note?.textContent).toContain('administrator');
    expect(note?.textContent).toContain('reset');
  });

  it('disables the editing fields on a locked ad so changes cannot be made', async () => {
    const id = await newAd();
    await lockAd(id);
    adId = id;
    const { fixture, el } = render();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.isLockedForEdit()).toBe(true);
    const title = el.querySelector('#adTitle') as HTMLInputElement;
    expect(title.disabled).toBe(true);
  });

  it('still offers Save Draft and Submit for Approval on a rejected ad that is not locked', async () => {
    const id = await newAd();
    await service.submitAd(id);
    auth.signInAs('approver', ['member', 'adBookApprover']);
    await service.rejectAd(id, 'Please fix the logo');
    auth.signInAs('alice');
    adId = id;
    const { el, buttons } = render();
    expect(buttons()).toContain('Save Draft');
    expect(buttons()).toContain('Submit for Approval');
    expect(el.querySelector('[data-testid="locked-ad-note"]')).toBeNull();
  });

  it('offers Save Draft and Submit for Approval again after an admin resets the lock', async () => {
    const id = await newAd();
    await lockAd(id);
    auth.signInAs('dept', ['member', 'departmentAdmin']);
    await service.resetLock(id, 'Fresh start');
    auth.signInAs('alice');
    adId = id;
    const { el, buttons } = render();
    expect(buttons()).toContain('Save Draft');
    expect(buttons()).toContain('Submit for Approval');
    expect(el.querySelector('[data-testid="locked-ad-note"]')).toBeNull();
  });
});

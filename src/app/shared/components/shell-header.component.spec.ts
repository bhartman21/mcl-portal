import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UserProfile } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { initialsFor, ShellHeaderComponent } from './shell-header.component';

/** AuthService double: header only reads user, roles label, admin and demo flags. */
class FakeAuth {
  readonly user = signal<UserProfile | null>(null);
  readonly demo = signal(true);
  readonly admin = signal(false);
  readonly isDemoMode = computed(() => this.demo());
  readonly isAdmin = computed(() => this.admin());
  readonly primaryRoleLabel = computed(() => (this.admin() ? 'Department Admin' : 'Member'));
  signOut = vi.fn(async () => this.user.set(null));
}

class FakeNotifications {
  readonly unreadCount = signal(0);
}

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    uid: 'u1',
    email: 'adjutant@dof-mcl.org',
    displayName: 'Dept. Adjutant (Admin)',
    defaultDetachmentId: 'dof-054',
    status: 'active',
    roles: ['member', 'departmentAdmin'],
    detachmentScopes: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as UserProfile;
}

describe('initialsFor', () => {
  it('uses the first and last word, ignoring parentheses and punctuation', () => {
    expect(initialsFor('Dept. Adjutant (Admin)', 'a@b.org')).toBe('DA');
    expect(initialsFor('Cpl. D. Rivera', 'a@b.org')).toBe('CR');
  });
  it('falls back to a single word, then the email', () => {
    expect(initialsFor('Billy', 'x@y.org')).toBe('BI');
    expect(initialsFor('', 'member@dof-mcl.org')).toBe('ME');
    expect(initialsFor(null, null)).toBe('?');
  });
});

describe('ShellHeaderComponent (STYLE_GUIDE "App header layout")', () => {
  let auth: FakeAuth;
  let notes: FakeNotifications;
  let fixture: ComponentFixture<ShellHeaderComponent>;
  let el: HTMLElement;

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    auth = new FakeAuth();
    notes = new FakeNotifications();
    await TestBed.configureTestingModule({
      imports: [ShellHeaderComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: NotificationService, useValue: notes },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ShellHeaderComponent);
    el = fixture.nativeElement as HTMLElement;
  });

  it('brand links home and there is no separate Home link or Ribbon Rack link', async () => {
    await render();
    const brand = el.querySelector('a.navbar-brand') as HTMLAnchorElement;
    expect(brand.getAttribute('href')).toBe('/');
    const navText = el.querySelector('[data-testid="primary-nav"]')?.textContent ?? '';
    expect(navText).not.toMatch(/Home/);
    expect(el.textContent).not.toMatch(/Ribbon Rack/);
  });

  it('shows short primary labels VAVS and Ad Book and collapses below xl', async () => {
    await render();
    const labels = [...el.querySelectorAll('[data-testid="primary-nav"] > li > a')].map((a) =>
      a.textContent?.trim()
    );
    expect(labels).toEqual(['VAVS', 'Ad Book']);
    expect(el.querySelector('nav')?.classList).toContain('navbar-expand-xl');
  });

  it('signed out: theme icon button and Sign In, no avatar, no Admin', async () => {
    await render();
    expect(el.querySelector('[data-testid="theme-menu-button"]')).not.toBeNull();
    expect(el.textContent).toContain('Sign In');
    expect(el.querySelector('[data-testid="account-menu-button"]')).toBeNull();
    expect(el.querySelector('[data-testid="admin-menu-button"]')).toBeNull();
  });

  it('shows the demo strip only in demo mode', async () => {
    await render();
    expect(el.querySelector('[data-testid="demo-strip"]')?.textContent).toContain(
      'Local Demo Mode: data stays in this browser'
    );
    auth.demo.set(false);
    await render();
    expect(el.querySelector('[data-testid="demo-strip"]')).toBeNull();
  });

  it('signed in: initials avatar opens an account menu with name, email, role, theme and Sign Out', async () => {
    auth.user.set(profile());
    auth.admin.set(true);
    await render();
    const btn = el.querySelector('[data-testid="account-menu-button"]') as HTMLButtonElement;
    expect(btn.textContent?.trim()).toBe('DA');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    btn.click();
    await render();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    const menu = el.querySelector('[data-testid="account-menu"]') as HTMLElement;
    expect(menu.classList).toContain('show');
    expect(menu.textContent).toContain('Dept. Adjutant (Admin)');
    expect(menu.textContent).toContain('adjutant@dof-mcl.org');
    expect(menu.textContent).toContain('Department Admin');
    expect(menu.querySelectorAll('.mcl-theme-btn').length).toBe(3);
    expect(menu.textContent).toContain('Sign Out');
  });

  it('Esc closes the open menu and returns focus to its button', async () => {
    auth.user.set(profile());
    auth.admin.set(true);
    await render();
    const btn = el.querySelector('[data-testid="admin-menu-button"]') as HTMLButtonElement;
    btn.click();
    await render();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await render();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(btn);
  });

  it('Admin dropdown lists the four admin pages', async () => {
    auth.user.set(profile());
    auth.admin.set(true);
    await render();
    const items = [...el.querySelectorAll('#mcl-admin-menu a')].map((a) => a.textContent?.trim());
    expect(items).toEqual(['Users & Roles', 'Detachments', 'Activity', 'Registration Settings']);
  });

  it('bell shows only for admins, with the unread count in its aria-label and badge', async () => {
    auth.user.set(profile({ roles: ['member'] }));
    await render();
    expect(el.querySelector('[data-testid="notification-bell"]')).toBeNull();
    auth.admin.set(true);
    notes.unreadCount.set(3);
    await render();
    const bell = el.querySelector('[data-testid="notification-bell"]') as HTMLElement;
    expect(bell.getAttribute('aria-label')).toBe('Notifications, 3 unread');
    expect(bell.getAttribute('href')).toBe('/admin/activity');
    expect(el.querySelector('[data-testid="notification-badge"]')?.textContent?.trim()).toBe('3');
  });

  it('shows a pending status badge in the account menu', async () => {
    auth.user.set(profile({ status: 'pending', roles: ['member'] }));
    await render();
    expect(el.querySelector('[data-testid="account-menu"]')?.textContent).toContain('Pending');
  });

  it('Sign Out closes menus and signs out', async () => {
    auth.user.set(profile());
    await render();
    (el.querySelector('[data-testid="account-menu-button"]') as HTMLButtonElement).click();
    await render();
    (el.querySelector('[data-testid="account-menu"] [data-testid="sign-out"]') as HTMLButtonElement).click();
    await render();
    expect(auth.signOut).toHaveBeenCalled();
    expect(fixture.componentInstance.openMenu()).toBeNull();
  });
});

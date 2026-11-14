import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { RoleId, UserProfile } from '../models/user.model';
import { AuthService } from '../services/auth.service';
import { activeUserGuard } from './active-user.guard';
import { authGuard } from './auth.guard';
import { roleGuard } from './role.guard';

/** Minimal AuthService double whose initial auth state resolves only when we say so. */
class FakeAuth {
  readonly user = signal<UserProfile | null>(null);
  private resolve!: () => void;
  private readonly ready = new Promise<void>((r) => (this.resolve = r));
  whenReady = () => this.ready;
  finish(user: UserProfile | null) {
    this.user.set(user);
    this.resolve();
  }
  isAuthenticated = () => this.user() !== null;
  isActive = () => this.user()?.status === 'active';
  hasAnyRole = (roles: RoleId[]) => {
    const u = this.user();
    return !!u && u.status === 'active' && roles.some((r) => u.roles.includes(r));
  };
}

function profile(patch: Partial<UserProfile> = {}): UserProfile {
  return {
    uid: 'u1',
    email: 'u1@example.com',
    status: 'active',
    roles: ['member'],
    detachmentScopes: [],
    createdAt: '',
    updatedAt: '',
    ...patch,
  };
}

describe('route guards', () => {
  let auth: FakeAuth;
  let router: Router;
  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/vavs' } as RouterStateSnapshot;

  beforeEach(() => {
    auth = new FakeAuth();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    router = TestBed.inject(Router);
  });

  const run = (guard: typeof authGuard) =>
    TestBed.runInInjectionContext(() => guard(route, state)) as Promise<boolean | UrlTree>;

  it('authGuard waits for auth loading before deciding (no bounce on refresh)', async () => {
    let settled = false;
    const result = run(authGuard).then((r) => {
      settled = true;
      return r;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    auth.finish(profile());
    expect(await result).toBe(true);
  });

  it('authGuard redirects signed-out users to /sign-in with returnUrl', async () => {
    const result = run(authGuard);
    auth.finish(null);
    const tree = (await result) as UrlTree;
    expect(router.serializeUrl(tree)).toBe('/sign-in?returnUrl=%2Fvavs');
  });

  it('activeUserGuard allows active users and sends pending/suspended users to /sign-in', async () => {
    auth.finish(profile({ status: 'pending' }));
    expect(router.serializeUrl((await run(activeUserGuard)) as UrlTree)).toBe('/sign-in');
    auth.user.set(profile({ status: 'suspended' }));
    expect(router.serializeUrl((await run(activeUserGuard)) as UrlTree)).toBe('/sign-in');
    auth.user.set(profile());
    expect(await run(activeUserGuard)).toBe(true);
  });

  it('roleGuard waits for auth, then requires an active user with a listed role', async () => {
    const guard = roleGuard(['departmentAdmin', 'nationalAdmin']);
    let settled = false;
    const pending = run(guard).then((r) => {
      settled = true;
      return r;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    auth.finish(profile({ roles: ['member', 'departmentAdmin'] }));
    expect(await pending).toBe(true);

    auth.user.set(profile({ roles: ['member'] }));
    expect(router.serializeUrl((await run(guard)) as UrlTree)).toBe('/');

    auth.user.set(profile({ roles: ['departmentAdmin'], status: 'pending' }));
    expect(router.serializeUrl((await run(guard)) as UrlTree)).toBe('/');
  });
});

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Must be signed in. Waits for the initial auth state so a page refresh does not bounce to /sign-in. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.whenReady();
  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/sign-in'], {
    queryParams: { returnUrl: state.url },
  });
};

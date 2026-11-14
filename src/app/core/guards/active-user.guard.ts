import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Must have users/{uid}.status == 'active'. Pending/suspended users land on /sign-in, which explains why. */
export const activeUserGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.whenReady();
  if (auth.isActive()) {
    return true;
  }

  return router.createUrlTree(['/sign-in']);
};

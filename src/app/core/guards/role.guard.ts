import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RoleId } from '../models/user.model';
import { AuthService } from '../services/auth.service';

/** Active user holding any of the listed roles. */
export function roleGuard(allowedRoles: RoleId[]): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await auth.whenReady();
    if (auth.hasAnyRole(allowedRoles)) {
      return true;
    }

    return router.createUrlTree(['/']);
  };
}

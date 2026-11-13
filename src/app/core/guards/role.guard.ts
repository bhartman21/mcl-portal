import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RoleId } from '../models/user.model';
import { AuthService } from '../services/auth.service';

export function roleGuard(allowedRoles: RoleId[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.hasAnyRole(allowedRoles)) {
      return true;
    }

    return router.createUrlTree(['/']);
  };
}


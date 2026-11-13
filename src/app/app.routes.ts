import { Routes } from '@angular/router';
import { activeUserGuard } from './core/guards/active-user.guard';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'sign-in',
    loadComponent: () =>
      import('./features/auth/sign-in.component').then((m) => m.SignInComponent),
  },
  {
    path: 'vavs',
    canActivate: [authGuard, activeUserGuard],
    loadComponent: () =>
      import('./features/vavs/vavs-stub.component').then((m) => m.VavsStubComponent),
  },
  {
    path: 'ad-book',
    canActivate: [authGuard, activeUserGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/ad-book/ad-book-hub.component').then(
            (m) => m.AdBookHubComponent
          ),
      },
      {
        path: 'ads/new',
        loadComponent: () =>
          import('./features/ad-book/ad-editor.component').then(
            (m) => m.AdEditorComponent
          ),
      },
      {
        path: 'ads/:adId',
        loadComponent: () =>
          import('./features/ad-book/ad-editor.component').then(
            (m) => m.AdEditorComponent
          ),
      },
      {
        path: 'books/:bookId',
        loadComponent: () =>
          import('./features/ad-book/ad-book-detail.component').then(
            (m) => m.AdBookDetailComponent
          ),
      },
      {
        path: 'queue',
        canActivate: [roleGuard(['adBookApprover', 'departmentAdmin', 'nationalAdmin'])],
        loadComponent: () =>
          import('./features/ad-book/ad-book-queue.component').then(
            (m) => m.AdBookQueueComponent
          ),
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [authGuard, activeUserGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'users' },
      {
        path: 'users',
        canActivate: [roleGuard(['departmentAdmin', 'nationalAdmin'])],
        loadComponent: () =>
          import('./features/admin/admin-users.component').then(
            (m) => m.AdminUsersComponent
          ),
      },
      {
        path: 'detachments',
        canActivate: [roleGuard(['departmentAdmin', 'nationalAdmin'])],
        loadComponent: () =>
          import('./features/admin/admin-detachments.component').then(
            (m) => m.AdminDetachmentsComponent
          ),
      },
      {
        path: 'ad-sizes',
        canActivate: [roleGuard(['adBookApprover', 'departmentAdmin', 'nationalAdmin'])],
        loadComponent: () =>
          import('./features/admin/admin-ad-sizes.component').then(
            (m) => m.AdminAdSizesComponent
          ),
      },
      {
        path: 'settings',
        canActivate: [roleGuard(['departmentAdmin', 'nationalAdmin'])],
        loadComponent: () =>
          import('./features/admin/admin-settings.component').then(
            (m) => m.AdminSettingsComponent
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];

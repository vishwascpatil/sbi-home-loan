import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'members',
    loadComponent: () =>
      import('./features/members/members.component').then((m) => m.MembersComponent),
  },
  {
    path: 'members/history',
    loadComponent: () =>
      import('./features/members/member-history.component').then(
        (m) => m.MemberHistoryComponent
      ),
  },
  {
    path: 'member-history',
    redirectTo: 'members/history',
    pathMatch: 'full',
  },
  {
    path: 'insights',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./features/history/history.component').then((m) => m.HistoryComponent),
  },
  {
    path: 'statements',
    loadComponent: () =>
      import('./features/statements/statements.component').then((m) => m.StatementsComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: 'admin/audit',
    loadComponent: () =>
      import('./features/audit/audit-viewer.component').then((m) => m.AuditViewerComponent),
  },
  {
    path: 'styleguide',
    loadComponent: () =>
      import('./features/styleguide/styleguide.component').then((m) => m.StyleguideComponent),
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];

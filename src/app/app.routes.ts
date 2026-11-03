import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'styleguide',
    pathMatch: 'full',
  },
  {
    path: 'styleguide',
    loadComponent: () =>
      import('./features/styleguide/styleguide.component').then(
        (m) => m.StyleguideComponent
      ),
  },
];

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SideRailComponent, TabBarComponent, ToastComponent } from './shared/ui';
import { LedgerStore } from './core/state';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TabBarComponent, SideRailComponent, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly ledgerStore = inject(LedgerStore);
  readonly isAddSheetOpen = signal<boolean>(false);

  openAddTransaction(): void {
    this.isAddSheetOpen.set(true);
  }
}

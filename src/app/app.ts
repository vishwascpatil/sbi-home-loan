import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { SideRailComponent, TabBarComponent, ToastComponent } from './shared/ui';
import { LedgerStore } from './core/state';
import { AddEditTransactionSheetComponent } from './features/transaction-sheet/add-edit-transaction-sheet.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    TabBarComponent,
    SideRailComponent,
    ToastComponent,
    AddEditTransactionSheetComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly ledgerStore = inject(LedgerStore);
  private readonly swUpdate = inject(SwUpdate, { optional: true });

  readonly isAddSheetOpen = signal<boolean>(false);
  readonly updateAvailable = signal<boolean>(false);

  constructor() {
    if (this.swUpdate?.isEnabled) {
      this.swUpdate.versionUpdates.subscribe((event) => {
        if (event.type === 'VERSION_READY') {
          this.updateAvailable.set(true);
        }
      });
    }
  }

  openAddTransaction(): void {
    this.isAddSheetOpen.set(true);
  }

  reloadApp(): void {
    window.location.reload();
  }
}

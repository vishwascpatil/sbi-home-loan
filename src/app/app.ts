import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import {
  NotificationCenterComponent,
  SideRailComponent,
  TabBarComponent,
} from './shared/ui';
import { LedgerStore, UiStore, UserProfileStore } from './core/state';
import { AddEditTransactionSheetComponent } from './features/transaction-sheet/add-edit-transaction-sheet.component';
import { WelcomeBoardComponent } from './features/welcome/welcome-board.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    TabBarComponent,
    SideRailComponent,
    NotificationCenterComponent,
    AddEditTransactionSheetComponent,
    WelcomeBoardComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly ledgerStore = inject(LedgerStore);
  readonly userProfile = inject(UserProfileStore);
  readonly uiStore = inject(UiStore);
  private readonly swUpdate = inject(SwUpdate, { optional: true });

  readonly isAddSheetOpen = signal<boolean>(false);
  readonly updateAvailable = signal<boolean>(false);

  readonly isTabBarVisible = computed<boolean>(() => {
    return !this.isAddSheetOpen() && !this.uiStore.isAddPaymentOpen();
  });

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

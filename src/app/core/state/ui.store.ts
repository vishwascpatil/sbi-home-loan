import { computed, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UiStore {
  private readonly activeAddPaymentSheets = signal<Set<string>>(new Set<string>());

  /** True when any Add/Edit Payment sheet is active in the application */
  readonly isAddPaymentOpen = computed<boolean>(() => this.activeAddPaymentSheets().size > 0);

  registerAddPaymentOpen(id: string): void {
    this.activeAddPaymentSheets.update((set) => {
      const next = new Set(set);
      next.add(id);
      return next;
    });
  }

  registerAddPaymentClosed(id: string): void {
    this.activeAddPaymentSheets.update((set) => {
      if (!set.has(id)) return set;
      const next = new Set(set);
      next.delete(id);
      return next;
    });
  }
}


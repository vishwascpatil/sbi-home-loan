import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { FirestoreLedgerRepository } from '../data';

export type AppTheme = 'light';
export type AppDateFormat = 'DD/MM/YYYY' | 'YYYY-MM-DD';

@Injectable({
  providedIn: 'root',
})
export class SettingsStore {
  private readonly repo = inject(FirestoreLedgerRepository);

  readonly theme = signal<AppTheme>('light');
  readonly dateFormat = signal<AppDateFormat>('DD/MM/YYYY');
  readonly maskAccountNumber = signal<boolean>(true);

  // Always false as dark mode has been removed in favor of permanent light fintech theme
  readonly isDark = computed(() => false);

  constructor() {
    // Synchronize DOM attributes and theme-color meta tag
    effect(() => {
      if (typeof document !== 'undefined') {
        const root = document.documentElement;
        root.dataset['theme'] = 'light';

        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
          metaThemeColor.setAttribute('content', '#fbfbfd');
        }
      }
    });
  }

  setTheme(_newTheme?: unknown): void {
    this.theme.set('light');
    this.persistSettings();
  }

  toggleTheme(): void {
    // No-op: dark mode removed
  }

  toggleMaskAccountNumber(): void {
    this.maskAccountNumber.update((prev) => !prev);
    this.persistSettings();
  }

  setDateFormat(format: AppDateFormat): void {
    this.dateFormat.set(format);
    this.persistSettings();
  }

  initFromState(settings: {
    theme?: string;
    dateFormat: AppDateFormat;
    maskAccountNumber: boolean;
  }): void {
    this.theme.set('light');
    this.dateFormat.set(settings.dateFormat || 'DD/MM/YYYY');
    this.maskAccountNumber.set(settings.maskAccountNumber ?? true);
  }

  private persistSettings(): void {
    void this.repo.load().then((state) => {
      state.settings = {
        theme: 'light',
        dateFormat: this.dateFormat(),
        maskAccountNumber: this.maskAccountNumber(),
        defaultPaymentMode: state.settings.defaultPaymentMode || 'UPI',
      };
      void this.repo.save(state);
    });
  }
}


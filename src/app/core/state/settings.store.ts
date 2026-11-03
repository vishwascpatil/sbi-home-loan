import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { LocalStorageLedgerRepository } from '../data';

export type AppTheme = 'auto' | 'light' | 'dark';
export type AppDateFormat = 'DD/MM/YYYY' | 'YYYY-MM-DD';

@Injectable({
  providedIn: 'root',
})
export class SettingsStore {
  private readonly repo = inject(LocalStorageLedgerRepository);

  readonly theme = signal<AppTheme>('auto');
  readonly dateFormat = signal<AppDateFormat>('DD/MM/YYYY');
  readonly maskAccountNumber = signal<boolean>(true);

  // Computes whether dark theme is actually active (considering system preferences)
  readonly isDark = computed(() => {
    const current = this.theme();
    if (current === 'dark') return true;
    if (current === 'light') return false;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  constructor() {
    // Synchronize DOM attributes and theme-color meta tag
    effect(() => {
      const currentTheme = this.theme();
      const dark = this.isDark();

      if (typeof document !== 'undefined') {
        const root = document.documentElement;
        if (currentTheme === 'light' || currentTheme === 'dark') {
          root.dataset['theme'] = currentTheme;
        } else {
          delete root.dataset['theme'];
        }

        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
          metaThemeColor.setAttribute('content', dark ? '#0a0c15' : '#f4f1ec');
        }
      }
    });
  }

  setTheme(newTheme: AppTheme): void {
    this.theme.set(newTheme);
    this.persistSettings();
  }

  toggleTheme(): void {
    const current = this.theme();
    if (current === 'auto') {
      this.setTheme(this.isDark() ? 'light' : 'dark');
    } else {
      this.setTheme(current === 'dark' ? 'light' : 'dark');
    }
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
    theme: AppTheme;
    dateFormat: AppDateFormat;
    maskAccountNumber: boolean;
  }): void {
    this.theme.set(settings.theme || 'auto');
    this.dateFormat.set(settings.dateFormat || 'DD/MM/YYYY');
    this.maskAccountNumber.set(settings.maskAccountNumber ?? true);
  }

  private persistSettings(): void {
    void this.repo.load().then((state) => {
      state.settings = {
        theme: this.theme(),
        dateFormat: this.dateFormat(),
        maskAccountNumber: this.maskAccountNumber(),
        defaultPaymentMode: state.settings.defaultPaymentMode || 'UPI',
      };
      void this.repo.save(state);
    });
  }
}


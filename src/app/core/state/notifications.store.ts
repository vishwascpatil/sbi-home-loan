import { computed, inject, Injectable, signal } from '@angular/core';
import {
  AppNotification,
  DEFAULT_NOTIFICATION_PREFS,
  generateLedgerNotifications,
  NotificationPreferences,
} from '../engine';
import { LedgerStore } from './ledger.store';

const PREFS_STORAGE_KEY = 'loan_tracker_notification_prefs_v1';
const DISMISSED_STORAGE_KEY = 'loan_tracker_dismissed_notifications_v1';

@Injectable({
  providedIn: 'root',
})
export class NotificationsStore {
  private readonly ledgerStore = inject(LedgerStore);

  readonly preferences = signal<NotificationPreferences>(this.loadPreferences());
  readonly dismissedIds = signal<string[]>(this.loadDismissedIds());
  readonly isTrayOpen = signal<boolean>(false);

  readonly allNotifications = computed<AppNotification[]>(() => {
    return generateLedgerNotifications(
      this.ledgerStore.ledgerState(),
      this.preferences()
    );
  });

  readonly activeNotifications = computed<AppNotification[]>(() => {
    const dismissed = new Set(this.dismissedIds());
    return this.allNotifications().filter((n) => !dismissed.has(n.id));
  });

  readonly unreadCount = computed<number>(() => this.activeNotifications().length);

  toggleTray(): void {
    this.isTrayOpen.update((v) => !v);
  }

  closeTray(): void {
    this.isTrayOpen.set(false);
  }

  dismiss(id: string): void {
    this.dismissedIds.update((prev) => {
      const next = [...prev, id];
      this.saveDismissedIds(next);
      return next;
    });
  }

  dismissAll(): void {
    const currentActiveIds = this.activeNotifications().map((n) => n.id);
    this.dismissedIds.update((prev) => {
      const next = Array.from(new Set([...prev, ...currentActiveIds]));
      this.saveDismissedIds(next);
      return next;
    });
  }

  updatePreferences(patch: Partial<NotificationPreferences>): void {
    this.preferences.update((prev) => {
      const updated = { ...prev, ...patch };
      this.savePreferences(updated);
      return updated;
    });
  }

  async requestPushPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }

    try {
      const result = await Notification.requestPermission();
      return result;
    } catch {
      return 'denied';
    }
  }

  private loadPreferences(): NotificationPreferences {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(PREFS_STORAGE_KEY);
        if (raw) return { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(raw) };
      }
    } catch {
      // Fallback to defaults
    }
    return DEFAULT_NOTIFICATION_PREFS;
  }

  private savePreferences(prefs: NotificationPreferences): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
      }
    } catch {
      // Ignore quota errors
    }
  }

  private loadDismissedIds(): string[] {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch {
      // Fallback
    }
    return [];
  }

  private saveDismissedIds(ids: string[]): void {
    try {
      if (typeof localStorage !== 'undefined') {
        // Keep last 100 dismissed IDs to avoid unbounded storage
        localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(ids.slice(-100)));
      }
    } catch {
      // Ignore
    }
  }
}

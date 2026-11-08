import { Injectable, signal, inject, OnDestroy } from '@angular/core';
import { FirestoreLedgerRepository } from '../data/firestore-ledger.repository';
import { WOW_STATEMENTS, WowStatement } from './wow-statements';

export const VAPID_PUBLIC_KEY =
  'BOszAne7k25hJNMQtwmE-kXuDhNgmyKpePhwCsk_3xZvJa1kgFIiP2lVtlIK127Q837t164rWc8eQ-C06lvHY3Y';

export interface PushResult {
  success: boolean;
  message: string;
  error?: string;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

@Injectable({
  providedIn: 'root',
})
export class PushNotificationService implements OnDestroy {
  private readonly repo = inject(FirestoreLedgerRepository);

  readonly isSupported = typeof window !== 'undefined' && 'Notification' in window;
  readonly permission = signal<NotificationPermission | 'unsupported'>(
    this.detectInitialPermission()
  );
  readonly isSubscribed = signal<boolean>(false);
  readonly isBusy = signal<boolean>(false);
  readonly lastMessage = signal<string | null>(null);

  // 5-Minute WOW Statements Queue & Loop
  readonly currentWowIndex = signal<number>(0);
  readonly isFiveMinTimerActive = signal<boolean>(false);
  readonly nextTriggerSeconds = signal<number>(0);
  readonly activeIntervalMinutes = signal<number>(5);

  private countdownIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.checkExistingSubscription();
  }

  private detectInitialPermission(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  async checkExistingSubscription(): Promise<void> {
    if (!this.isSupported || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.pushManager) {
        const sub = await reg.pushManager.getSubscription();
        this.isSubscribed.set(!!sub);
      }
    } catch {
      // Ignore background check errors
    }
  }

  /**
   * Triggers the native iOS / browser permission dialog.
   * MUST be invoked directly from a user tap/click event.
   */
  async requestPermissionAndSubscribe(
    memberId = 'mem-vishwas',
    phone = '8105242578'
  ): Promise<PushResult> {
    if (!this.isSupported) {
      const msg = 'Push notifications are not supported on this browser or view.';
      this.lastMessage.set(msg);
      return { success: false, message: msg };
    }

    this.isBusy.set(true);

    try {
      const perm = await Notification.requestPermission();
      this.permission.set(perm);

      if (perm !== 'granted') {
        const msg =
          perm === 'denied'
            ? 'Notifications were blocked. Please enable them in iPhone Settings → Safari/PWA → Notifications.'
            : 'Permission was not granted.';
        this.lastMessage.set(msg);
        this.isBusy.set(false);
        return { success: false, message: msg };
      }

      // If granted, attempt to create and register push subscription
      if ('serviceWorker' in navigator) {
        try {
          const reg =
            (await navigator.serviceWorker.getRegistration()) ||
            (await navigator.serviceWorker.ready);

          if (reg && reg.pushManager) {
            let sub = await reg.pushManager.getSubscription();
            if (!sub) {
              const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
              sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedKey as unknown as BufferSource,
              });
            }

            if (sub) {
              this.isSubscribed.set(true);
              const subJson = sub.toJSON();

              // Save to Firestore
              await this.repo.savePushSubscription({
                id: `sub_${phone}_${Date.now()}`,
                phone,
                memberId,
                endpoint: subJson.endpoint,
                keys: subJson.keys,
                userAgent: navigator.userAgent,
                platform: /iPhone|iPad/i.test(navigator.userAgent) ? 'iOS' : 'Web',
                updatedAt: new Date().toISOString(),
              });
            }
          }
        } catch (swErr) {
          console.warn('[PushNotificationService] PushManager subscription warning:', swErr);
        }
      }

      const successMsg = '✓ Push notifications enabled successfully on this iPhone!';
      this.lastMessage.set(successMsg);
      this.isBusy.set(false);
      return { success: true, message: successMsg };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.lastMessage.set(`Error: ${errMsg}`);
      this.isBusy.set(false);
      return { success: false, message: errMsg, error: errMsg };
    }
  }

  /**
   * Fires an immediate native banner notification on the iPhone/device.
   */
  async sendLocalTestNotification(
    title = '🏦 SBI Home Loan Daily Update',
    body = "Today's Interest Accrued: +₹2,609.21 | Outstanding: ₹1,20,57,798.21. Test notification works on your iPhone!"
  ): Promise<PushResult> {
    if (!this.isSupported) {
      return {
        success: false,
        message: 'Push notifications are not supported on this browser.',
      };
    }

    if (Notification.permission !== 'granted') {
      const req = await this.requestPermissionAndSubscribe();
      if (!req.success) return req;
    }

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const options: NotificationOptions = {
            body,
            icon: 'icons/icon-192x192.png',
            badge: 'icons/icon-72x72.png',
            tag: 'sbi-loan-daily-test',
            data: { url: '/sbi-home-loan/' },
          };
          await reg.showNotification(title, options);

          const msg = '✓ Lock-screen notification dispatched! Check your notification banner/lock screen.';
          this.lastMessage.set(msg);
          return { success: true, message: msg };
        }
      }

      // Direct fallback
      new Notification(title, {
        body,
        icon: 'icons/icon-192x192.png',
      });

      const msg = '✓ Test notification banner dispatched!';
      this.lastMessage.set(msg);
      return { success: true, message: msg };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.lastMessage.set(`Failed to trigger notification: ${errMsg}`);
      return { success: false, message: errMsg, error: errMsg };
    }
  }

  // =========================================================================
  // 5-Minute WOW Statements Management & Timer Loop
  // =========================================================================

  getCurrentWowStatement(): WowStatement {
    return WOW_STATEMENTS[this.currentWowIndex() % WOW_STATEMENTS.length];
  }

  setWowStatementIndex(idx: number): void {
    const safeIdx = ((idx % WOW_STATEMENTS.length) + WOW_STATEMENTS.length) % WOW_STATEMENTS.length;
    this.currentWowIndex.set(safeIdx);
  }

  nextWowStatement(): WowStatement {
    const nextIdx = (this.currentWowIndex() + 1) % WOW_STATEMENTS.length;
    this.currentWowIndex.set(nextIdx);
    return WOW_STATEMENTS[nextIdx];
  }

  prevWowStatement(): WowStatement {
    const prevIdx = (this.currentWowIndex() - 1 + WOW_STATEMENTS.length) % WOW_STATEMENTS.length;
    this.currentWowIndex.set(prevIdx);
    return WOW_STATEMENTS[prevIdx];
  }

  async sendWowNotification(customStatement?: WowStatement): Promise<PushResult> {
    const stmt = customStatement || this.getCurrentWowStatement();
    return this.sendLocalTestNotification(stmt.title, stmt.body);
  }

  /**
   * Starts periodic lock-screen notification delivery.
   * Default: 5 minutes (300 seconds), can also be 1 minute or 10-second demo.
   */
  startFiveMinuteTimer(intervalMinutes = 5): void {
    this.stopFiveMinuteTimer();
    this.activeIntervalMinutes.set(intervalMinutes);
    this.isFiveMinTimerActive.set(true);

    const totalSeconds = intervalMinutes < 1 ? 10 : Math.round(intervalMinutes * 60);
    this.nextTriggerSeconds.set(totalSeconds);

    // Immediately dispatch current WOW statement
    void this.sendWowNotification();

    // 1-second interval tracker
    this.countdownIntervalId = setInterval(() => {
      const remaining = this.nextTriggerSeconds();
      if (remaining <= 1) {
        this.nextTriggerSeconds.set(totalSeconds);
        this.nextWowStatement();
        void this.sendWowNotification();
      } else {
        this.nextTriggerSeconds.set(remaining - 1);
      }
    }, 1000);

    this.lastMessage.set(
      `✓ Auto-broadcast started: firing a funny WOW notification every ${
        intervalMinutes < 1 ? '10 seconds (Demo)' : intervalMinutes + ' mins'
      }!`
    );
  }

  stopFiveMinuteTimer(): void {
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
    this.isFiveMinTimerActive.set(false);
    this.nextTriggerSeconds.set(0);
    this.lastMessage.set('Auto-broadcast timer stopped.');
  }

  ngOnDestroy(): void {
    this.stopFiveMinuteTimer();
  }
}

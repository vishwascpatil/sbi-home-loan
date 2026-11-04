import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationsStore } from '../../../core/state';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <!-- Top-Right Floating Bell Button -->
    <button
      type="button"
      class="bell-trigger-btn"
      (click)="store.toggleTray()"
      aria-label="Toggle notifications center"
      [attr.aria-expanded]="store.isTrayOpen()"
    >
      <span class="bell-icon">🔔</span>
      @if (store.unreadCount() > 0) {
        <span class="unread-pill">{{ store.unreadCount() }}</span>
      }
    </button>

    <!-- Slide-Out / Dropdown Tray Backdrop -->
    @if (store.isTrayOpen()) {
      <div
        class="tray-backdrop"
        (click)="store.closeTray()"
        (keydown.escape)="store.closeTray()"
        tabindex="-1"
      >
        <aside
          class="tray-drawer"
          role="dialog"
          aria-label="Notification Center"
          (click)="$event.stopPropagation()"
          (keydown)="$event.stopPropagation()"
          tabindex="0"
        >
          <!-- Tray Header -->
          <header class="tray-header">
            <div>
              <h3 class="tray-title">Notifications & Alerts</h3>
              <small class="tray-sub">
                {{ store.unreadCount() }} unread {{ store.unreadCount() === 1 ? 'alert' : 'alerts' }}
              </small>
            </div>

            <div class="header-actions">
              @if (store.unreadCount() > 0) {
                <button
                  type="button"
                  class="dismiss-all-btn"
                  (click)="store.dismissAll()"
                >
                  Clear All
                </button>
              }
              <button
                type="button"
                class="close-btn"
                (click)="store.closeTray()"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </header>

          <!-- Notification List Body -->
          <div class="tray-body">
            @for (item of store.activeNotifications(); track item.id) {
              <div
                class="notification-card"
                [class.alert]="item.severity === 'alert'"
                [class.warning]="item.severity === 'warning'"
                [class.info]="item.severity === 'info'"
              >
                <div class="card-top">
                  <span class="type-tag" [class]="item.severity">
                    {{ item.severity === 'alert' ? 'ACTION REQUIRED' : item.severity === 'warning' ? 'WARNING' : 'NOTICE' }}
                  </span>
                  <button
                    type="button"
                    class="card-dismiss-btn"
                    (click)="store.dismiss(item.id)"
                    aria-label="Dismiss alert"
                  >
                    ✕
                  </button>
                </div>

                <h4 class="card-title">{{ item.title }}</h4>
                <p class="card-message">{{ item.message }}</p>

                <div class="card-footer">
                  <small class="timestamp">{{ item.timestamp | date:'short' }}</small>
                  @if (item.actionRoute) {
                    <button
                      type="button"
                      class="action-link-btn"
                      (click)="navigateToAction(item.actionRoute)"
                    >
                      View Details →
                    </button>
                  }
                </div>
              </div>
            } @empty {
              <div class="empty-tray">
                <span class="empty-icon">🎉</span>
                <p class="empty-text">All caught up!</p>
                <small class="empty-sub">No pending reminders, anomalies, or rate notices.</small>
              </div>
            }
          </div>

          <!-- Tray Footer -->
          <footer class="tray-footer">
            <button
              type="button"
              class="settings-shortcut-btn"
              (click)="navigateToAction('/settings')"
            >
              ⚙️ Manage Alert Preferences
            </button>
          </footer>
        </aside>
      </div>
    }
  `,
  styles: [`
    .bell-trigger-btn {
      position: fixed;
      top: 14px;
      right: 18px;
      z-index: 1000;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: var(--color-card, #ffffff);
      color: var(--color-ink, #15172b);
      display: grid;
      place-items: center;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
      backdrop-filter: blur(12px);
      transition: all 0.2s ease;

      &:hover {
        transform: scale(1.05);
        border-color: #6c4cff;
      }
    }

    .bell-icon {
      font-size: 1.15rem;
    }

    .unread-pill {
      position: absolute;
      top: -2px;
      right: -2px;
      background: linear-gradient(135deg, #ee4d6b, #ff5f9e);
      color: #ffffff;
      font-size: 0.68rem;
      font-weight: 800;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      border-radius: 99px;
      display: grid;
      place-items: center;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 6px rgba(238, 77, 107, 0.4);
    }

    /* Backdrop & Drawer */
    .tray-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(10, 12, 21, 0.4);
      backdrop-filter: blur(4px);
      z-index: 1060;
      display: flex;
      justify-content: flex-end;
    }

    .tray-drawer {
      width: 100%;
      max-width: 380px;
      height: 100vh;
      background: var(--color-card, #ffffff);
      color: var(--color-ink, #15172b);
      box-shadow: -8px 0 32px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      animation: slideInRight 0.22s ease-out;
    }

    @keyframes slideInRight {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }

    .tray-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 20px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    .tray-title {
      font-size: 1.1rem;
      font-weight: 800;
      margin: 0;
    }

    .tray-sub {
      font-size: 0.75rem;
      color: var(--color-muted, #767a90);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .dismiss-all-btn {
      background: none;
      border: none;
      font-size: 0.75rem;
      font-weight: 700;
      color: #6c4cff;
      cursor: pointer;
      padding: 4px;
    }

    .close-btn {
      background: rgba(0, 0, 0, 0.05);
      border: none;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      cursor: pointer;
      color: var(--color-muted, #767a90);
      &:hover { background: rgba(0, 0, 0, 0.1); }
    }

    .tray-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .notification-card {
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #e5e7eb;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      position: relative;
      border-left-width: 4px;

      &.alert { border-left-color: #ee4d6b; background: #fffbfb; }
      &.warning { border-left-color: #f59f00; background: #fffdf8; }
      &.info { border-left-color: #6c4cff; background: #fbfbfe; }
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .type-tag {
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      padding: 2px 6px;
      border-radius: 4px;

      &.alert { background: rgba(238, 77, 107, 0.12); color: #ee4d6b; }
      &.warning { background: rgba(245, 159, 0, 0.15); color: #b26e00; }
      &.info { background: rgba(108, 76, 255, 0.12); color: #6c4cff; }
    }

    .card-dismiss-btn {
      background: none;
      border: none;
      font-size: 0.8rem;
      color: #9fa3b4;
      cursor: pointer;
      padding: 2px;
      &:hover { color: #15172b; }
    }

    .card-title {
      font-size: 0.92rem;
      font-weight: 700;
      margin: 2px 0 0;
      color: #15172b;
    }

    .card-message {
      font-size: 0.82rem;
      color: #4a4e63;
      margin: 0;
      line-height: 1.4;
    }

    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px dashed rgba(0, 0, 0, 0.06);
    }

    .timestamp {
      font-size: 0.7rem;
      color: #8f94a6;
    }

    .action-link-btn {
      background: none;
      border: none;
      font-size: 0.75rem;
      font-weight: 700;
      color: #6c4cff;
      cursor: pointer;
      padding: 0;
    }

    .empty-tray {
      text-align: center;
      padding: 48px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .empty-icon {
      font-size: 2.5rem;
      margin-bottom: 4px;
    }

    .empty-text {
      font-size: 1.1rem;
      font-weight: 800;
      margin: 0;
    }

    .empty-sub {
      font-size: 0.8rem;
      color: var(--color-muted, #767a90);
    }

    .tray-footer {
      padding: 14px 20px;
      border-top: 1px solid rgba(0, 0, 0, 0.08);
      background: var(--color-card, #ffffff);
    }

    .settings-shortcut-btn {
      width: 100%;
      padding: 8px;
      background: rgba(0, 0, 0, 0.05);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 10px;
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--color-ink, #15172b);
      cursor: pointer;
      transition: all 0.2s ease;
      &:hover { background: rgba(0, 0, 0, 0.08); }
    }
  `],
})
export class NotificationCenterComponent {
  readonly store = inject(NotificationsStore);
  private readonly router = inject(Router);

  navigateToAction(route: string): void {
    this.store.closeTray();
    void this.router.navigateByUrl(route);
  }
}

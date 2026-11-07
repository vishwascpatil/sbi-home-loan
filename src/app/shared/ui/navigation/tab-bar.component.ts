import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { triggerHaptic } from '../../../core/engine';

@Component({
  selector: 'app-tab-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <!-- Floating Glass Capsule Dock (Screenshot Matched) -->
    <nav class="floating-glass-dock" aria-label="Main Navigation">
      <!-- 1. Home Tab -->
      <a
        routerLink="/home"
        routerLinkActive="active"
        [routerLinkActiveOptions]="{ exact: true }"
        class="dock-item"
        aria-label="Home"
        (click)="triggerFeedback()"
      >
        <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 10.5 12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span class="dock-label">Home</span>
      </a>

      <!-- 2. Center Action Button (Matte Black Pill) -->
      <button
        type="button"
        class="dock-action-btn"
        (click)="onActionClick()"
        aria-label="Add transaction"
        title="Add transaction"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      <!-- 3. Members Tab -->
      <a
        routerLink="/members"
        routerLinkActive="active"
        class="dock-item"
        aria-label="Members"
        (click)="triggerFeedback()"
      >
        <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span class="dock-label">Team</span>
      </a>
    </nav>
  `,
  styles: `
    .floating-glass-dock {
      position: fixed;
      bottom: max(20px, env(safe-area-inset-bottom, 20px));
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      border-radius: var(--radius-pill, 9999px);
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: var(--blur-dock);
      -webkit-backdrop-filter: var(--blur-dock);
      border: 1.5px solid rgba(255, 255, 255, 0.95);
      box-shadow: 
        0 20px 48px -6px rgba(0, 0, 0, 0.16),
        0 4px 16px rgba(0, 0, 0, 0.06),
        inset 0 1px 1px rgba(255, 255, 255, 0.95);
      user-select: none;
      -webkit-user-select: none;
      max-width: calc(100vw - 20px);
      width: auto;
      box-sizing: border-box;
      touch-action: manipulation;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @media (min-width: 900px) {
      .floating-glass-dock {
        display: none;
      }
    }

    .dock-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      color: #9ca3af;
      padding: 8px clamp(18px, 4.5vw, 24px);
      border-radius: var(--radius-pill, 9999px);
      min-height: 52px;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      -webkit-tap-highlight-color: transparent;

      &:hover {
        color: #4b4c52;
      }

      &:active {
        transform: scale(0.92);
      }

      /* Active State Pill from Screenshot */
      &.active {
        background: #ffffff;
        color: #111216;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);

        .dock-icon {
          animation: appStoreTabBounce 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
          stroke-width: 2.4;
        }

        .dock-label {
          font-weight: 800;
          color: #111216;
        }
      }
    }

    .dock-icon {
      width: 24px;
      height: 24px;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .dock-label {
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin-top: 3px;
      color: inherit;
      transition: color 0.2s ease, font-weight 0.2s ease;
    }

    /* Center Action Button (Matte Obsidian Black Orb) */
    .dock-action-btn {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: linear-gradient(135deg, #181b24 0%, #0d0f17 100%);
      border: 1.5px solid rgba(255, 255, 255, 0.22);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35), 0 0 0 3px rgba(108, 76, 255, 0.16);
      display: grid;
      place-items: center;
      cursor: pointer;
      margin: 0 6px;
      flex-shrink: 0;
      transition: transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.22s ease;
      -webkit-tap-highlight-color: transparent;

      &:hover {
        transform: scale(1.08);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.42), 0 0 0 4px rgba(108, 76, 255, 0.25);
      }

      &:active {
        transform: scale(0.92);
      }
    }
  `,
})
export class TabBarComponent {
  readonly openAdd = output<void>();

  private lastHaptic = 0;

  triggerFeedback(): void {
    const now = Date.now();
    if (now - this.lastHaptic > 60) {
      this.lastHaptic = now;
      triggerHaptic('light');
    }
  }

  onActionClick(): void {
    this.triggerFeedback();
    this.openAdd.emit();
  }
}

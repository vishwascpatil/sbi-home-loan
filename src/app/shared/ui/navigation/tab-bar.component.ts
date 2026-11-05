import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

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
      >
        <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 10.5 12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span class="dock-label">Home</span>
      </a>

      <!-- 2. Members Tab -->
      <a
        routerLink="/members"
        routerLinkActive="active"
        class="dock-item"
        aria-label="Members"
      >
        <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span class="dock-label">Members</span>
      </a>

      <!-- 3. Center Action Button (Matte Black Pill) -->
      <button
        type="button"
        class="dock-action-btn"
        (click)="openAdd.emit()"
        aria-label="Add transaction"
        title="Add transaction"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      <!-- 4. Insights Tab -->
      <a
        routerLink="/insights"
        routerLinkActive="active"
        class="dock-item"
        aria-label="Insights"
      >
        <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
        <span class="dock-label">Insights</span>
      </a>

      <!-- 5. Settings Tab -->
      <a
        routerLink="/settings"
        routerLinkActive="active"
        class="dock-item"
        aria-label="Settings"
      >
        <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        <span class="dock-label">Settings</span>
      </a>
    </nav>
  `,
  styles: `
    .floating-glass-dock {
      position: fixed;
      bottom: max(16px, env(safe-area-inset-bottom, 16px));
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 5px 6px;
      border-radius: var(--radius-pill, 9999px);
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: var(--blur-dock);
      -webkit-backdrop-filter: var(--blur-dock);
      border: 1px solid rgba(255, 255, 255, 0.95);
      box-shadow: 
        0 16px 40px -6px rgba(0, 0, 0, 0.12),
        0 2px 10px rgba(0, 0, 0, 0.04),
        inset 0 1px 1px rgba(255, 255, 255, 0.9);
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
      padding: 6px clamp(8px, 2.5vw, 14px);
      border-radius: var(--radius-pill, 9999px);
      min-height: 42px;
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
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);

        .dock-icon {
          animation: appStoreTabBounce 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
          stroke-width: 2.3;
        }

        .dock-label {
          font-weight: 700;
          color: #111216;
        }
      }
    }

    .dock-icon {
      width: 20px;
      height: 20px;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .dock-label {
      font-size: 10px;
      font-weight: 500;
      letter-spacing: -0.01em;
      margin-top: 2px;
      color: inherit;
      transition: color 0.2s ease, font-weight 0.2s ease;
    }

    /* Center Action Button (Matte Obsidian Black Orb) */
    .dock-action-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #111216;
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
      display: grid;
      place-items: center;
      cursor: pointer;
      margin: 0 4px;
      flex-shrink: 0;
      transition: transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.22s ease;
      -webkit-tap-highlight-color: transparent;

      &:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.32);
      }

      &:active {
        transform: scale(0.92);
      }
    }
  `,
})
export class TabBarComponent {
  readonly openAdd = output<void>();
}

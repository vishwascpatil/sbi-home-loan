import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-tab-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="bottom-tab-bar" aria-label="Main Navigation">
      <a
        routerLink="/home"
        routerLinkActive="active"
        [routerLinkActiveOptions]="{ exact: true }"
        class="tab-item"
        aria-label="Home"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />
        </svg>
        <span class="tab-label">Home</span>
      </a>

      <a
        routerLink="/members"
        routerLinkActive="active"
        class="tab-item"
        aria-label="Members"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <span class="tab-label">Members</span>
      </a>

      <!-- Raised Center Action Button -->
      <button
        type="button"
        class="raised-add-button"
        (click)="openAdd.emit()"
        aria-label="Add transaction"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      <a
        routerLink="/insights"
        routerLinkActive="active"
        class="tab-item"
        aria-label="Insights"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
        <span class="tab-label">Insights</span>
      </a>

      <a
        routerLink="/settings"
        routerLinkActive="active"
        class="tab-item"
        aria-label="Settings"
      >
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        <span class="tab-label">Settings</span>
      </a>
    </nav>
  `,
  styles: `
    .bottom-tab-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 900;
      display: flex;
      justify-content: space-around;
      align-items: center;
      background: var(--card-glass);
      backdrop-filter: var(--blur-glass);
      -webkit-backdrop-filter: var(--blur-glass);
      border-top: 1px solid var(--line);
      height: 64px;
      padding-bottom: env(safe-area-inset-bottom, 0px);
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.06);
    }

    @media (min-width: 900px) {
      .bottom-tab-bar {
        display: none;
      }
    }

    .tab-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      color: var(--muted);
      flex: 1;
      height: 100%;
      min-width: 44px;
      transition: color 0.2s ease;
      -webkit-tap-highlight-color: transparent;
    }

    .tab-item:hover, .tab-item.active {
      color: var(--brand-a);
    }

    .tab-icon {
      width: 22px;
      height: 22px;
    }

    .tab-label {
      font-size: 10px;
      font-weight: 700;
      margin-top: 3px;
    }

    .raised-add-button {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--brand-gradient);
      border: 3px solid var(--card);
      box-shadow: 0 8px 24px rgba(108, 76, 255, 0.4);
      display: grid;
      place-items: center;
      cursor: pointer;
      margin-top: -22px;
      flex-shrink: 0;
      transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .raised-add-button:hover {
      transform: scale(1.08) translateY(-2px);
    }

    .raised-add-button:active {
      transform: scale(0.96);
    }
  `,
})
export class TabBarComponent {
  readonly openAdd = output<void>();
}


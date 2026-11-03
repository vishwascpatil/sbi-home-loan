import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SettingsStore } from '../../../core/state';

@Component({
  selector: 'app-side-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="desktop-side-rail" aria-label="Desktop Rail Navigation">
      <div class="brand-section">
        <div class="brand-avatar">₹</div>
        <div class="brand-details">
          <h2 class="brand-title">Loan Tracker</h2>
          <span class="brand-badge">Group OD</span>
        </div>
      </div>

      <nav class="rail-links">
        <a routerLink="/home" routerLinkActive="active" class="rail-link">
          <svg class="rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />
          </svg>
          <span>Dashboard</span>
        </a>

        <a routerLink="/members" routerLinkActive="active" class="rail-link">
          <svg class="rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
          </svg>
          <span>Members</span>
        </a>

        <a routerLink="/insights" routerLinkActive="active" class="rail-link">
          <svg class="rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          <span>Insights & Sim</span>
        </a>

        <a routerLink="/history" routerLinkActive="active" class="rail-link">
          <svg class="rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>History & CSV</span>
        </a>

        <a routerLink="/settings" routerLinkActive="active" class="rail-link">
          <svg class="rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>Settings</span>
        </a>
      </nav>

      <div class="rail-bottom-actions">
        <button
          type="button"
          class="add-action-btn"
          (click)="openAdd.emit()"
        >
          ＋ New Entry
        </button>

        <button
          type="button"
          class="theme-toggle-btn"
          (click)="settings.toggleTheme()"
          aria-label="Toggle theme"
        >
          {{ settings.isDark() ? '☀️ Light Mode' : '🌙 Dark Mode' }}
        </button>
      </div>
    </aside>
  `,
  styles: `
    .desktop-side-rail {
      display: none;
    }

    @media (min-width: 900px) {
      .desktop-side-rail {
        display: flex;
        flex-direction: column;
        width: 250px;
        height: 100vh;
        height: 100dvh;
        position: fixed;
        left: 0;
        top: 0;
        background: var(--card);
        border-right: 1px solid var(--line);
        padding: 24px 18px;
        z-index: 800;
      }
    }

    .brand-section {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 32px;
      padding-left: 6px;
    }

    .brand-avatar {
      width: 42px;
      height: 42px;
      border-radius: 14px;
      background: var(--brand-gradient);
      color: #ffffff;
      display: grid;
      place-items: center;
      font-size: 20px;
      font-weight: 800;
      box-shadow: 0 4px 14px rgba(108, 76, 255, 0.3);
    }

    .brand-title {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0;
    }

    .brand-badge {
      font-size: 11px;
      font-weight: 700;
      color: var(--muted);
    }

    .rail-links {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
    }

    .rail-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: var(--radius-tile, 16px);
      text-decoration: none;
      color: var(--muted);
      font-size: 14px;
      font-weight: 700;
      transition: all 0.2s ease;
      min-height: 44px;
    }

    .rail-link:hover {
      background: var(--bg);
      color: var(--ink);
    }

    .rail-link.active {
      background: var(--brand-gradient);
      color: #ffffff;
      box-shadow: 0 4px 16px rgba(108, 76, 255, 0.25);
    }

    .rail-icon {
      width: 20px;
      height: 20px;
    }

    .rail-bottom-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: auto;
    }

    .add-action-btn {
      width: 100%;
      height: 46px;
      border-radius: var(--radius-pill, 99px);
      background: var(--brand-gradient);
      color: #ffffff;
      border: none;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(108, 76, 255, 0.3);
      transition: transform 0.2s ease;
    }

    .add-action-btn:hover {
      transform: translateY(-1px);
    }

    .theme-toggle-btn {
      width: 100%;
      height: 40px;
      border-radius: var(--radius-pill, 99px);
      border: 1px solid var(--line);
      background: var(--bg);
      color: var(--ink);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
  `,
})
export class SideRailComponent {
  readonly settings = inject(SettingsStore);
  readonly openAdd = output<void>();
}

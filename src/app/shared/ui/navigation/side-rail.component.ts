import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { triggerHaptic } from '../../../core/engine';

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
          <span class="brand-badge">Home Loan</span>
        </div>
      </div>

      <nav class="rail-links">
        <a routerLink="/home" routerLinkActive="active" class="rail-link" (pointerdown)="triggerFeedback()" (click)="triggerFeedback()">
          <svg class="rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />
          </svg>
          <span>Home</span>
        </a>

        <a routerLink="/members" routerLinkActive="active" class="rail-link" (pointerdown)="triggerFeedback()" (click)="triggerFeedback()">
          <svg class="rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
          </svg>
          <span>Members</span>
        </a>

        <a routerLink="/members/history" routerLinkActive="active" class="rail-link" (pointerdown)="triggerFeedback()" (click)="triggerFeedback()">
          <svg class="rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>Payment History</span>
        </a>

        <a routerLink="/settings" routerLinkActive="active" class="rail-link" (pointerdown)="triggerFeedback()" (click)="triggerFeedback()">
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
          (click)="onActionClick()"
          (pointerdown)="triggerFeedback()"
        >
          ＋ New Entry
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
        background: var(--card-glass-dock);
        backdrop-filter: var(--blur-dock);
        -webkit-backdrop-filter: var(--blur-dock);
        border-right: 0.5px solid var(--line);
        padding: 24px 18px;
        z-index: 800;
        box-shadow: 2px 0 16px rgba(0, 0, 0, 0.02);
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
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: linear-gradient(135deg, #0071e3 0%, #4338ca 100%);
      color: #ffffff;
      display: grid;
      place-items: center;
      font-size: 19px;
      font-weight: 800;
      box-shadow: 0 4px 14px rgba(0, 113, 227, 0.28);
    }

    .brand-title {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: -0.025em;
      margin: 0;
      color: var(--ink);
    }

    .brand-badge {
      font-size: 11px;
      font-weight: 700;
      color: var(--muted);
      letter-spacing: 0.03em;
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
      font-weight: 600;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      min-height: 44px;
      user-select: none;
    }

    .rail-link:hover {
      background: rgba(0, 0, 0, 0.04);
      color: var(--ink);
    }

    .rail-link:active {
      transform: scale(0.97);
    }

    .rail-link.active {
      background: rgba(0, 113, 227, 0.09);
      color: var(--brand-a);
      font-weight: 700;
    }

    .rail-icon {
      width: 20px;
      height: 20px;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .rail-link.active .rail-icon {
      animation: appStoreTabBounce 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
      stroke-width: 2.5;
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
      border-radius: var(--radius-pill, 9999px);
      background: linear-gradient(135deg, #0071e3 0%, #0056b3 100%);
      color: #ffffff;
      border: none;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 8px 24px -2px rgba(0, 113, 227, 0.38), inset 0 1px 1px rgba(255, 255, 255, 0.5);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .add-action-btn:hover {
      transform: translateY(-1.5px) scale(1.01);
      box-shadow: 0 12px 28px -2px rgba(0, 113, 227, 0.46);
    }

    .add-action-btn:active {
      transform: scale(0.96);
    }
  `,
})
export class SideRailComponent {
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


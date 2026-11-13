import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { triggerHaptic } from '../../../core/engine';

@Component({
  selector: 'app-tab-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <!-- Floating Glass Capsule Dock (Screenshot Matched) -->
    <nav class="floating-glass-dock" aria-label="Main Navigation">
      <!-- 1. Home Tab -->
      <a
        routerLink="/home"
        class="dock-item"
        [class.active]="isTabActive('/home')"
        aria-label="Home"
        (pointerenter)="onPrefetch('/home')"
        (touchstart)="onPrefetch('/home')"
        (pointerdown)="onPointerDown('/home', $event)"
        (click)="onNavigate('/home', $event)"
      >
        <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 10.5 12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span class="dock-label">Home</span>
      </a>

      <!-- 2. Statement Tab (After Home) -->
      <a
        routerLink="/statements"
        class="dock-item"
        [class.active]="isTabActive('/statements')"
        aria-label="Statement"
        (pointerenter)="onPrefetch('/statements')"
        (touchstart)="onPrefetch('/statements')"
        (pointerdown)="onPointerDown('/statements', $event)"
        (click)="onNavigate('/statements', $event)"
      >
        <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        <span class="dock-label">Statement</span>
      </a>

      <!-- 3. Center Action Button (Matte Black Pill) -->
      <button
        type="button"
        class="dock-action-btn"
        (pointerdown)="triggerFeedback()"
        (click)="onActionClick()"
        aria-label="Add transaction"
        title="Add transaction"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      <!-- 4. Members / Family Tab -->
      <a
        routerLink="/members"
        class="dock-item"
        [class.active]="isTabActive('/members')"
        aria-label="Members"
        (pointerenter)="onPrefetch('/members')"
        (touchstart)="onPrefetch('/members')"
        (pointerdown)="onPointerDown('/members', $event)"
        (click)="onNavigate('/members', $event)"
      >
        <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span class="dock-label">Family</span>
      </a>

      <!-- 5. Settings Tab (Next to Family Right Side) -->
      <a
        routerLink="/settings"
        class="dock-item"
        [class.active]="isTabActive('/settings')"
        aria-label="Settings"
        (pointerenter)="onPrefetch('/settings')"
        (touchstart)="onPrefetch('/settings')"
        (pointerdown)="onPointerDown('/settings', $event)"
        (click)="onNavigate('/settings', $event)"
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
      bottom: max(20px, env(safe-area-inset-bottom, 20px));
      left: 50%;
      transform: translateX(-50%);
      z-index: 800;
      display: flex;
      align-items: center;
      gap: clamp(4px, 1.2vw, 8px);
      padding: 6px clamp(8px, 2vw, 12px);
      border-radius: var(--radius-pill, 9999px);
      background: rgba(255, 255, 255, 0.92);
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
      animation: dockFadeSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      view-transition-name: none !important;
      contain: layout style;
    }

    @keyframes dockFadeSlideUp {
      from {
        opacity: 0;
        transform: translate(-50%, 14px);
      }
      to {
        opacity: 1;
        transform: translate(-50%, 0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .floating-glass-dock {
        animation: none !important;
      }
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
      padding: 6px clamp(10px, 2.8vw, 18px);
      border-radius: var(--radius-pill, 9999px);
      min-height: 48px;
      min-width: 48px;
      box-sizing: border-box;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      cursor: pointer;
      transition: color 0.12s ease, background-color 0.12s ease;
      -webkit-tap-highlight-color: transparent;

      &:hover {
        color: #4b4c52;
      }

      &:active {
        .dock-icon {
          transform: scale(0.90);
        }
        .dock-label {
          opacity: 0.7;
        }
      }

      /* Active State Pill from Screenshot */
      &.active {
        background: #ffffff;
        color: #111216;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);

        .dock-icon {
          animation: appStoreTabBounce 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
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
      transition: transform 0.12s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .dock-label {
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin-top: 3px;
      color: inherit;
      transition: color 0.12s ease, font-weight 0.12s ease, opacity 0.12s ease;
    }

    /* Center Action Button (Matte Obsidian Black Orb) */
    .dock-action-btn {
      width: 48px;
      height: 48px;
      min-width: 48px;
      min-height: 48px;
      border-radius: 50%;
      background: #000000;
      color: #ffffff;
      border: none;
      display: grid;
      place-items: center;
      cursor: pointer;
      box-shadow: 
        0 6px 18px rgba(0, 0, 0, 0.32),
        inset 0 1px 1px rgba(255, 255, 255, 0.25);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
      padding: 0;

      svg {
        display: block;
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      &:hover {
        transform: scale(1.06);
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.4);
      }

      &:active {
        transform: scale(0.92);
      }
    }
  `,
})
export class TabBarComponent {
  private readonly router = inject(Router);
  readonly openAdd = output<void>();

  // Optimistic active tab override for instant 0ms visual feedback on tap
  readonly activeTabOverride = signal<string | null>(null);

  private lastHaptic = 0;

  isTabActive(path: string): boolean {
    const override = this.activeTabOverride();
    if (override !== null) {
      return override === path;
    }
    const currentUrl = this.router.url;
    if (path === '/home') {
      return currentUrl === '/home' || currentUrl === '/';
    }
    return currentUrl.startsWith(path);
  }

  onPrefetch(path: string): void {
    if (path === '/statements') void import('../../../features/statements/statements.component');
    else if (path === '/members') void import('../../../features/members/members.component');
    else if (path === '/settings') void import('../../../features/settings/settings.component');
    else if (path === '/home') void import('../../../features/home/home.component');
  }

  onPointerDown(path: string, event: Event): void {
    this.triggerFeedback();
    this.onPrefetch(path);
    if (this.router.url !== path && !(path === '/home' && this.router.url === '/')) {
      this.activeTabOverride.set(path);
    }
  }

  triggerFeedback(): void {
    const now = Date.now();
    if (now - this.lastHaptic > 50) {
      this.lastHaptic = now;
      triggerHaptic('selection');
    }
  }

  onNavigate(path: string, event: MouseEvent): void {
    this.triggerFeedback();
    event.preventDefault();
    if (this.router.url === path || (path === '/home' && this.router.url === '/')) {
      this.activeTabOverride.set(null);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }
    this.activeTabOverride.set(path);
    void this.router.navigateByUrl(path).finally(() => {
      this.activeTabOverride.set(null);
    });
  }

  onActionClick(): void {
    this.triggerFeedback();
    this.openAdd.emit();
  }
}

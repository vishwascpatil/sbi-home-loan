import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-tab-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="bottom-tab-bar" aria-label="Main Navigation">
      <!-- 1. Home / Today Tab -->
      <a
        routerLink="/home"
        routerLinkActive="active"
        [routerLinkActiveOptions]="{ exact: true }"
        class="tab-item"
        aria-label="Home"
      >
        <div class="icon-stage">
          <!-- Unselected SF Symbol Outline -->
          <svg class="tab-icon icon-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 10.5 12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <!-- Selected SF Symbol Filled -->
          <svg class="tab-icon icon-filled" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.1 2.3 9.6a1 1 0 0 0-.3.77V20a2 2 0 0 0 2 2h5.5a1 1 0 0 0 1-1v-5.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5V21a1 1 0 0 0 1 1H20a2 2 0 0 0 2-2v-9.63a1 1 0 0 0-.3-.77L12 2.1z"/>
          </svg>
        </div>
        <span class="tab-label">Home</span>
      </a>

      <!-- 2. Members Tab -->
      <a
        routerLink="/members"
        routerLinkActive="active"
        class="tab-item"
        aria-label="Members"
      >
        <div class="icon-stage">
          <!-- Unselected SF Symbol Outline -->
          <svg class="tab-icon icon-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <!-- Selected SF Symbol Filled -->
          <svg class="tab-icon icon-filled" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm6.5 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM9 14c-4 0-7.5 2-7.5 4.5V21a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-2.5c0-2.5-3.5-4.5-7.5-4.5zm7.5 1.2c-.3 0-.6.03-.9.08 1.6.8 2.6 2 2.6 3.72V21a1 1 0 0 0 1 1h3.3a1 1 0 0 0 1-1v-1.8c0-2.2-2.8-4-7-4z"/>
          </svg>
        </div>
        <span class="tab-label">Members</span>
      </a>

      <!-- 3. Raised Center Action Button (Apple Glass Orb) -->
      <button
        type="button"
        class="raised-add-button"
        (click)="openAdd.emit()"
        aria-label="Add transaction"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      <!-- 4. Insights Tab -->
      <a
        routerLink="/insights"
        routerLinkActive="active"
        class="tab-item"
        aria-label="Insights"
      >
        <div class="icon-stage">
          <!-- Unselected SF Symbol Outline -->
          <svg class="tab-icon icon-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
            <line x1="2" y1="20" x2="22" y2="20"/>
          </svg>
          <!-- Selected SF Symbol Filled -->
          <svg class="tab-icon icon-filled" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3.5" y="11" width="4" height="9.5" rx="2"/>
            <rect x="10" y="3.5" width="4" height="17" rx="2"/>
            <rect x="16.5" y="7.5" width="4" height="13" rx="2"/>
          </svg>
        </div>
        <span class="tab-label">Insights</span>
      </a>

      <!-- 5. Settings Tab -->
      <a
        routerLink="/settings"
        routerLinkActive="active"
        class="tab-item"
        aria-label="Settings"
      >
        <div class="icon-stage">
          <!-- Unselected SF Symbol Outline -->
          <svg class="tab-icon icon-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <!-- Selected SF Symbol Filled -->
          <svg class="tab-icon icon-filled" viewBox="0 0 24 24" fill="currentColor">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-2 4a2 2 0 1 1 4 0 2 2 0 0 1-4 0z"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </div>
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
      z-index: 1000;
      display: flex;
      justify-content: space-around;
      align-items: flex-start;
      height: calc(52px + env(safe-area-inset-bottom, 20px));
      padding-top: 5px;
      padding-bottom: env(safe-area-inset-bottom, 20px);

      /* Authentic Apple Translucent Liquid Frosted Glass */
      background: rgba(255, 255, 255, 0.72);
      backdrop-filter: blur(28px) saturate(210%) brightness(102%);
      -webkit-backdrop-filter: blur(28px) saturate(210%) brightness(102%);

      /* Apple 0.5px Hairline Top Border & Specular Light Reflection */
      border-top: 0.5px solid rgba(60, 60, 67, 0.18);
      box-shadow: 
        inset 0 0.5px 0 0 rgba(255, 255, 255, 0.9),
        0 -1px 16px rgba(0, 0, 0, 0.03);

      transition: background 0.3s ease;
      user-select: none;
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
      color: #8e8e93;
      flex: 1;
      height: 44px;
      min-width: 44px;
      position: relative;
      cursor: pointer;
      transition: color 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.12s cubic-bezier(0.16, 1, 0.3, 1);
      -webkit-tap-highlight-color: transparent;
    }

    /* iOS Instant Tactile Tap Scale Feedback */
    .tab-item:active {
      transform: scale(0.88);
    }

    .icon-stage {
      position: relative;
      width: 24px;
      height: 24px;
      display: grid;
      place-items: center;
    }

    .tab-icon {
      position: absolute;
      top: 0;
      left: 0;
      width: 24px;
      height: 24px;
      transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    /* Unselected Outline Icon */
    .icon-outline {
      opacity: 1;
      transform: scale(1);
    }

    /* Selected Solid Filled Icon */
    .icon-filled {
      opacity: 0;
      transform: scale(0.72);
      pointer-events: none;
    }

    /* Active State: Hide Outline, Reveal Filled Icon with Apple SF Symbols Elastic Spring Bounce */
    .tab-item.active {
      color: #007aff;
    }

    .tab-item.active .icon-outline {
      opacity: 0;
      transform: scale(0.72);
      pointer-events: none;
    }

    .tab-item.active .icon-filled {
      opacity: 1;
      transform: scale(1);
      animation: appStoreTabBounce 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
    }

    /* Signature Apple App Store Elastic Tab Bounce */
    @keyframes appStoreTabBounce {
      0% {
        transform: scale(0.8);
      }
      40% {
        transform: scale(1.18);
      }
      70% {
        transform: scale(0.96);
      }
      100% {
        transform: scale(1);
      }
    }

    /* Clean Apple SF Typography (10px, Medium -> Semibold on Active) */
    .tab-label {
      font-size: 10px;
      font-weight: 500;
      letter-spacing: -0.015em;
      margin-top: 2px;
      color: inherit;
      transition: font-weight 0.2s ease, color 0.2s ease;
    }

    .tab-item.active .tab-label {
      font-weight: 600;
    }

    /* Raised Center ＋ Action Button (Apple Glass Orb) */
    .raised-add-button {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background: linear-gradient(135deg, #007aff 0%, #0056b3 100%);
      border: 2.5px solid rgba(255, 255, 255, 0.9);
      box-shadow: 
        0 6px 20px rgba(0, 122, 255, 0.4),
        inset 0 1px 1.5px rgba(255, 255, 255, 0.8);
      display: grid;
      place-items: center;
      cursor: pointer;
      margin-top: -16px;
      flex-shrink: 0;
      position: relative;
      z-index: 2;
      transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.25s ease;
      -webkit-tap-highlight-color: transparent;

      &:hover {
        transform: scale(1.08) translateY(-2px);
        box-shadow: 0 10px 26px rgba(0, 122, 255, 0.5), inset 0 1px 2px rgba(255, 255, 255, 0.9);
      }

      &:active {
        transform: scale(0.9) translateY(0);
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.35);
      }
    }
  `,
})
export class TabBarComponent {
  readonly openAdd = output<void>();
}

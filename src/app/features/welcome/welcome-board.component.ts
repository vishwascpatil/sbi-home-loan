import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { LedgerStore, UserProfileStore } from '../../core/state';
import { AvatarComponent } from '../../shared/ui';
import { formatPaise, Member, triggerHaptic } from '../../core/engine';

@Component({
  selector: 'app-welcome-board',
  standalone: true,
  imports: [AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="welcome-overlay-backdrop" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <!-- Ambient Lighting Blobs -->
      <div class="ambient-glow glow-top-left" aria-hidden="true"></div>
      <div class="ambient-glow glow-bottom-right" aria-hidden="true"></div>

      <div class="welcome-container">
        <!-- Close button if already configured and just switching -->
        @if (userProfile.isConfigured()) {
          <div class="top-close-bar">
            <button
              type="button"
              class="close-board-btn"
              (click)="userProfile.closeProfilePicker()"
              aria-label="Close profile switcher"
            >
              ✕
            </button>
          </div>
        }

        <!-- Header / Greeting -->
        <header class="welcome-header">
          <div class="welcome-pill">
            <span class="sparkle-icon">✨</span>
            <span>Family Member Profile</span>
          </div>

          <h1 id="welcome-title" class="welcome-headline">Who is using this phone?</h1>
          <p class="welcome-subtext">
            Choose your profile below. We'll save it to this phone so every time you open the app, it greets you with your personal loan numbers and targets.
          </p>
        </header>

        <!-- 5 Member Cards Grid -->
        <div class="members-selection-grid">
          @for (m of ledgerStore.activeMembers(); track m.id) {
            <button
              type="button"
              class="member-select-card"
              [class.is-current]="m.id === userProfile.currentMemberId()"
              [class.is-selected]="selectedId() === m.id"
              (click)="selectMember(m)"
            >
              <div class="member-avatar-col">
                <app-avatar [name]="m.name" [avatarUrl]="m.avatarUrl" [size]="52" [circular]="true" />
              </div>

              <div class="member-info-col">
                <div class="name-status-row">
                  <span class="member-card-name">{{ m.name }}</span>
                  @if (m.id === userProfile.currentMemberId()) {
                    <span class="current-phone-badge">This Phone</span>
                  }
                </div>

                <span class="member-card-phone">{{ m.phone || 'No phone set' }}</span>

                <div class="member-meta-row">
                  @if (m.target) {
                    <span class="target-tag tabular-nums">
                      Target: {{ formatPaise(m.target) }}/mo
                    </span>
                  }
                  <span class="role-caption">
                    {{ isCoBorrower(m) ? 'Co-Borrower' : 'Family Contributor' }}
                  </span>
                </div>
              </div>

              <div class="member-action-col">
                @if (selectedId() === m.id) {
                  <div class="selected-check-indicator" aria-label="Selected">✓</div>
                } @else {
                  <span class="select-arrow" aria-hidden="true">›</span>
                }
              </div>
            </button>
          }
        </div>

        <!-- Footer Note -->
        <footer class="welcome-footer">
          <div class="device-privacy-badge">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>Saved securely on this phone. You can switch profiles anytime in Settings.</span>
          </div>
        </footer>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .welcome-overlay-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(244, 241, 236, 0.94);
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
      display: flex;
      justify-content: center;
      align-items: flex-start;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding: max(20px, env(safe-area-inset-top)) 16px max(32px, env(safe-area-inset-bottom)) 16px;
      animation: fadeIn 0.25s ease-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: scale(0.98);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .ambient-glow {
      position: fixed;
      width: 320px;
      height: 320px;
      border-radius: 50%;
      filter: blur(75px);
      opacity: 0.28;
      pointer-events: none;
      z-index: 0;
    }

    .glow-top-left {
      top: -60px;
      left: -60px;
      background: radial-gradient(circle, #6c4cff, #4f35ff);
    }

    .glow-bottom-right {
      bottom: -60px;
      right: -60px;
      background: radial-gradient(circle, #ff5f9e, #ff8cb9);
    }

    .welcome-container {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 480px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin: auto 0;
    }

    .top-close-bar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: -10px;
    }

    .close-board-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: #ffffff;
      color: #15172b;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      transition: all 0.15s ease;
    }

    .close-board-btn:hover {
      transform: scale(1.08);
      background: #f4f1ec;
    }

    .welcome-header {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .welcome-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 99px;
      background: linear-gradient(135deg, rgba(108, 76, 255, 0.12), rgba(255, 95, 158, 0.12));
      border: 1px solid rgba(108, 76, 255, 0.2);
      font-size: 12px;
      font-weight: 700;
      color: #6c4cff;
      letter-spacing: 0.02em;
    }

    .sparkle-icon {
      font-size: 13px;
    }

    .welcome-headline {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #15172b;
      line-height: 1.2;
    }

    .welcome-subtext {
      margin: 0;
      font-size: 13.5px;
      line-height: 1.5;
      color: #767a90;
      max-width: 380px;
    }

    .members-selection-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .member-select-card {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 20px;
      border: 1.5px solid rgba(0, 0, 0, 0.07);
      background: #ffffff;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02);
      text-align: left;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
      position: relative;
    }

    .member-select-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(108, 76, 255, 0.12);
      border-color: rgba(108, 76, 255, 0.3);
    }

    .member-select-card:active,
    .member-select-card.is-selected {
      transform: scale(0.98);
      border-color: #6c4cff;
      background: linear-gradient(135deg, #ffffff, #faf8ff);
    }

    .member-select-card.is-current {
      border-color: rgba(15, 178, 124, 0.4);
      background: linear-gradient(135deg, #ffffff, #f4fbf8);
    }

    .member-avatar-col {
      flex-shrink: 0;
    }

    .member-info-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }

    .name-status-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .member-card-name {
      font-size: 17px;
      font-weight: 700;
      color: #15172b;
      letter-spacing: -0.01em;
    }

    .current-phone-badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 2px 7px;
      border-radius: 99px;
      background: rgba(15, 178, 124, 0.15);
      color: #0fb27c;
      border: 1px solid rgba(15, 178, 124, 0.3);
    }

    .member-card-phone {
      font-size: 12px;
      color: #767a90;
      font-family: inherit;
    }

    .member-meta-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 2px;
      flex-wrap: wrap;
    }

    .target-tag {
      font-size: 11px;
      font-weight: 600;
      color: #6c4cff;
      background: rgba(108, 76, 255, 0.08);
      padding: 2px 8px;
      border-radius: 6px;
    }

    .role-caption {
      font-size: 11px;
      color: #9399b4;
    }

    .member-action-col {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
    }

    .select-arrow {
      font-size: 22px;
      color: #9399b4;
      font-weight: 400;
      transition: transform 0.15s ease;
    }

    .member-select-card:hover .select-arrow {
      transform: translateX(3px);
      color: #6c4cff;
    }

    .selected-check-indicator {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #0fb27c;
      color: #ffffff;
      font-size: 14px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(15, 178, 124, 0.4);
      animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    @keyframes popIn {
      from {
        transform: scale(0);
      }
      to {
        transform: scale(1);
      }
    }

    .welcome-footer {
      text-align: center;
      padding-top: 4px;
    }

    .device-privacy-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 11.5px;
      color: #767a90;
      line-height: 1.4;
      max-width: 360px;
    }

    .device-privacy-badge svg {
      flex-shrink: 0;
      color: #6c4cff;
    }
  `,
})
export class WelcomeBoardComponent {
  readonly ledgerStore = inject(LedgerStore);
  readonly userProfile = inject(UserProfileStore);

  readonly formatPaise = formatPaise;
  readonly selectedId = signal<string | null>(null);

  isCoBorrower(m: Member): boolean {
    return m.name.toLowerCase() === 'vishwas' || m.name.toLowerCase() === 'vikas';
  }

  selectMember(m: Member): void {
    triggerHaptic('selection');
    this.selectedId.set(m.id);
    // Smooth transition
    setTimeout(() => {
      this.userProfile.setProfile(m.id);
      this.selectedId.set(null);
    }, 280);
  }
}

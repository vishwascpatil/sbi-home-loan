import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LedgerStore, UserProfileStore } from '../../core/state';
import {
  addPaise,
  buildMonthlyDueReminder,
  formatCompactPaise,
  formatPaise,
  MemberStatistics,
  Paise,
  triggerHaptic,
  ZERO_PAISE,
} from '../../core/engine';
import {
  AvatarComponent,
  CountUpDirective,
  ProgressBarComponent,
} from '../../shared/ui';
import { AddEditTransactionSheetComponent } from '../transaction-sheet/add-edit-transaction-sheet.component';

@Component({
  selector: 'app-members',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    CountUpDirective,
    AvatarComponent,
    ProgressBarComponent,
    AddEditTransactionSheetComponent,
  ],
  template: `
    <div class="members-page-container">
      <!-- Living Video-feel Background Ambient Mesh -->
      <div class="video-ambient-mesh" aria-hidden="true">
        <div class="mesh-orb orb-violet"></div>
        <div class="mesh-orb orb-pink"></div>
        <div class="mesh-orb orb-emerald"></div>
        <div class="mesh-orb orb-cyan"></div>
        <svg class="mesh-wave-svg" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path class="wave-path wave-path-1" d="M0,192L48,197.3C96,203,192,213,288,192C384,171,480,117,576,112C672,107,768,149,864,165.3C960,181,1056,171,1152,149.3C1248,128,1344,96,1392,80L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          <path class="wave-path wave-path-2" d="M0,96L48,128C96,160,192,224,288,213.3C384,203,480,117,576,101.3C672,85,768,139,864,165.3C960,192,1056,192,1152,176C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
      </div>

      <!-- 1. Top Bar (Matching Home Top Bar) -->
      <header class="app-top-bar">
        <div
          class="user-profile-cluster"
          (click)="userProfile.openProfilePicker()"
          (keydown.enter)="userProfile.openProfilePicker()"
          role="button"
          tabindex="0"
          aria-label="Switch User Profile"
          title="Click to switch member profile"
        >
          <app-avatar [name]="userProfile.currentMemberName()" [avatarUrl]="userProfile.currentMemberAvatar()" [size]="44" [circular]="true" />
          <div class="profile-text-wrap">
            <span class="profile-greeting">Due by 5th every month</span>
            <div class="profile-name-row">
              <h1 class="profile-user-name">Family Members</h1>
              <span class="profile-switch-indicator">▾</span>
            </div>
          </div>
        </div>

        <a
          routerLink="/settings"
          class="top-circle-action-btn"
          aria-label="Settings"
          title="Settings"
          (pointerdown)="triggerNavHaptic()"
          (click)="triggerNavHaptic()"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </a>
      </header>

      <!-- 2. Matte Black Hero Card (Go Premium style in screenshot) -->
      <div class="matte-hero-banner" role="region" aria-label="Monthly Money to Collect">
        <!-- Living Laser Trace Border (Conic Rotation) -->
        <div class="hero-laser-border" aria-hidden="true"></div>

        <!-- Internal Living Nebula Blooms -->
        <div class="hero-nebula-glow nebula-1" aria-hidden="true"></div>
        <div class="hero-nebula-glow nebula-2" aria-hidden="true"></div>

        <!-- Floating Digital Particle Embers -->
        <div class="hero-particles-field" aria-hidden="true">
          <span class="particle p-1"></span>
          <span class="particle p-2"></span>
          <span class="particle p-3"></span>
          <span class="particle p-4"></span>
          <span class="particle p-5"></span>
        </div>

        <!-- Dynamic Shimmer Ray -->
        <div class="hero-shimmer-sweep" aria-hidden="true"></div>

        <div class="hero-left-content">
          <div class="hero-badge-pill">
            <span class="lightning-bolt">⚡</span>
            <span>Total Monthly Target · {{ activeCount() }} Members</span>
          </div>
          <div class="hero-number-wrap">
            <div class="hero-balance-headline tabular-nums" [appCountUp]="totalMonthlyTarget()">
              {{ formatPaise(totalMonthlyTarget()) }}
            </div>
            <span class="hero-balance-sub">
              ₹1.05L for 2 people · ₹10k for 3 people · Due 5th
            </span>
          </div>
        </div>
      </div>

      <!-- 3. Section: Member Cards List ("Past Activities" style in screenshot) -->
      <section class="page-section">
        <div class="section-title-bar">
          <div>
            <h2 class="section-main-heading">All 5 Members</h2>
            <span class="section-sub-caption">Monthly amount each person needs to pay by the 5th</span>
          </div>
          <button type="button" class="section-see-all-btn" (click)="router.navigate(['/members/history'])">
            History ›
          </button>
        </div>

        <div class="squircle-cards-list">
          @for (m of ledgerStore.memberStats(); track m.memberId) {
            <div class="member-squircle-card">
              <div class="card-iridescent-edge" aria-hidden="true"></div>
              <!-- Member Header Row -->
              <div class="member-top-row">
                <div class="member-identity-group">
                  <app-avatar [name]="m.name" [colorIndex]="$index" [size]="44" [avatarUrl]="m.avatarUrl" />
                  <div class="member-text-group">
                    <span class="member-name">{{ m.name }}</span>
                    <span class="member-due-date">Due on the 5th</span>
                  </div>
                </div>
                <div class="member-badge-cluster">
                  <span class="pool-share-pill">{{ (m.targetSharePercentage || m.sharePercentage).toFixed(1) }}% share</span>
                  <button
                    type="button"
                    class="member-icon-circle-btn"
                    (click)="viewMemberHistory(m.memberId)"
                    [attr.aria-label]="'View history for ' + m.name"
                    title="View payment history"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#111216" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Metric Row: Monthly Share, This Month, Lifetime -->
              <div class="member-metrics-row">
                <div class="member-metric-col">
                  <span class="metric-col-label">Monthly Share</span>
                  <span class="metric-col-val tabular-nums highlight">
                    {{ m.target ? formatPaise(m.target) : '₹0' }}
                  </span>
                </div>
                <div class="member-metric-col">
                  <span class="metric-col-label">This Month</span>
                  <span class="metric-col-val tabular-nums">
                    {{ formatPaise(m.thisMonthContribution) }}
                  </span>
                </div>
                <div class="member-metric-col">
                  <span class="metric-col-label">Total Paid</span>
                  <span class="metric-col-val tabular-nums muted">
                    {{ formatCompactPaise(m.lifetimeContribution) }}
                  </span>
                </div>
              </div>

              <!-- Progress Bar for Monthly Target -->
              <div class="member-progress-wrap">
                <div class="progress-label-row">
                  <span
                    class="progress-status-badge"
                    [class.completed]="m.target && m.thisMonthContribution >= m.target"
                  >
                    @if (m.target && m.thisMonthContribution >= m.target) {
                      ✓ Fully Paid
                    } @else if (m.thisMonthContribution > 0) {
                      Partially Paid ({{ getMemberProgress(m).toFixed(0) }}%)
                    } @else {
                      Not Paid Yet
                    }
                  </span>
                  <span class="progress-ratio tabular-nums">
                    {{ formatCompactPaise(m.thisMonthContribution) }} / {{ m.target ? formatCompactPaise(m.target) : '₹0' }}
                  </span>
                </div>
                <app-progress-bar
                  [progressPercent]="getMemberProgress(m)"
                  [height]="6"
                  [color]="m.target && m.thisMonthContribution >= m.target ? '#0fb27c' : '#111216'"
                />
              </div>

              <!-- Footer Meta & History Action -->
              <div class="member-card-footer">
                <div class="footer-meta-info">
                  <span>{{ m.contributionCount }} {{ m.contributionCount === 1 ? 'payment' : 'payments' }}</span>
                  @if (m.lastContributionDate) {
                    <span> · Last {{ m.lastContributionDate }}</span>
                  }
                </div>
                <div class="footer-btn-group">
                  @if (m.target && m.thisMonthContribution < m.target) {
                    <a
                      [href]="getMemberWhatsAppReminder(m.memberId)"
                      target="_blank"
                      class="member-whatsapp-remind-btn"
                      title="Send WhatsApp Reminder"
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.53 7.37C9.36 7.37 9.09 7.43 8.85 7.69C8.61 7.95 7.94 8.58 7.94 9.87C7.94 11.15 8.88 12.39 9.01 12.56C9.14 12.73 10.84 15.36 13.45 16.49C14.07 16.76 14.56 16.92 14.94 17.04C15.56 17.24 16.13 17.21 16.57 17.15C17.07 17.07 18.09 16.53 18.3 15.93C18.52 15.34 18.52 14.83 18.45 14.73C18.39 14.62 18.21 14.56 17.95 14.43C17.69 14.3 16.42 13.67 16.18 13.59C15.95 13.5 15.78 13.46 15.6 13.72C15.43 13.97 14.95 14.56 14.8 14.73C14.66 14.9 14.51 14.92 14.25 14.79C14 14.66 12.92 14.31 11.64 13.17C10.65 12.28 9.98 11.19 9.79 10.85C9.59 10.51 9.77 10.33 9.9 10.2C10.02 10.08 10.16 9.89 10.29 9.74C10.42 9.59 10.46 9.49 10.55 9.32C10.64 9.15 10.59 9 10.53 8.87C10.46 8.74 9.95 7.48 9.73 6.97C9.52 6.47 9.31 6.54 9.15 6.53C9 6.52 8.83 6.52 8.65 6.52" />
                      </svg>
                      Remind
                    </a>
                  }
                  <button
                    type="button"
                    class="member-action-btn-subtle"
                    (click)="viewMemberHistory(m.memberId)"
                  >
                    History ›
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- Footnote Information Callout -->
      <div class="footnote-info-card">
        <span class="footnote-icon">ℹ️</span>
        <span class="footnote-text">
          Together, the 5 members contribute ₹2,40,000 every month by the 5th to pay the home loan. Every payment is tracked here automatically.
        </span>
      </div>

      <!-- Add Contribution Sheet Modal -->
      @if (isAddTxOpen()) {
        <app-add-edit-transaction-sheet
          [isOpen]="isAddTxOpen()"
          initialType="contribution"
          [initialMemberId]="selectedMemberId()"
          (dismissed)="isAddTxOpen.set(false)"
        />
      }
    </div>
  `,
  styles: `
    .members-page-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow-x: hidden;
      padding: 0 0 114px;
      position: relative;
    }

    /* Living Video-feel Background Ambient Mesh */
    .video-ambient-mesh {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
    }

    .mesh-orb {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      opacity: 0.35;
      will-change: transform;
    }

    .orb-violet {
      width: 320px;
      height: 320px;
      background: radial-gradient(circle, rgba(108, 76, 255, 0.4) 0%, rgba(79, 53, 255, 0.12) 50%, transparent 70%);
      top: -40px;
      left: -60px;
      animation: orbDrift1 20s ease-in-out infinite alternate;
    }

    .orb-pink {
      width: 340px;
      height: 340px;
      background: radial-gradient(circle, rgba(255, 95, 158, 0.35) 0%, rgba(255, 140, 185, 0.1) 50%, transparent 70%);
      top: 25%;
      right: -80px;
      animation: orbDrift2 24s ease-in-out infinite alternate;
    }

    .orb-emerald {
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(15, 178, 124, 0.3) 0%, rgba(52, 211, 153, 0.08) 50%, transparent 70%);
      bottom: 12%;
      left: -40px;
      animation: orbDrift3 22s ease-in-out infinite alternate;
    }

    .orb-cyan {
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(56, 189, 248, 0.3) 0%, rgba(129, 140, 248, 0.08) 50%, transparent 70%);
      top: 62%;
      right: -50px;
      animation: orbDrift4 26s ease-in-out infinite alternate;
    }

    .mesh-wave-svg {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 200%;
      height: 280px;
      opacity: 0.07;
      animation: waveFloat 16s linear infinite alternate;
    }

    .wave-path-1 {
      fill: #6c4cff;
    }

    .wave-path-2 {
      fill: #ff5f9e;
    }

    /* 1. Top Bar */
    .app-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 8px 0 20px;
      padding: 0 4px;
      width: 100%;
      box-sizing: border-box;
      position: relative;
      z-index: 2;
      animation: cinematicSlideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .user-profile-cluster {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      user-select: none;
      padding: 4px 8px 4px 4px;
      margin: -4px -8px -4px -4px;
      border-radius: 99px;
      transition: background 0.15s ease, transform 0.15s ease;

      &:hover {
        background: rgba(0, 0, 0, 0.04);
        transform: translateY(-1px);
      }
    }

    .profile-name-row {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .profile-switch-indicator {
      font-size: 11px;
      color: #8e8e93;
      transition: transform 0.15s ease;
    }

    .user-profile-cluster:hover .profile-switch-indicator {
      color: #6c4cff;
      transform: translateY(1px);
    }

    .profile-text-wrap {
      display: flex;
      flex-direction: column;
    }

    .profile-greeting {
      font-size: 11px;
      font-weight: 500;
      color: #8e8e93;
      letter-spacing: -0.01em;
    }

    .profile-user-name {
      font-size: 18px;
      font-weight: 800;
      color: #111216;
      letter-spacing: -0.02em;
      margin: 0;
    }

    .top-circle-action-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.06);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
      cursor: pointer;
      display: grid;
      place-items: center;
      color: #111216;
      text-decoration: none;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        background: #f7f8fa;
        transform: scale(1.06);
        color: #111216;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
      }

      &:active {
        transform: scale(0.94);
      }
    }

    /* 2. Matte Black Hero Card (Living Cyber-Card / Video UI) */
    .matte-hero-banner {
      background: #0f1118;
      color: #ffffff;
      border-radius: 28px;
      padding: 24px 24px;
      margin-bottom: 26px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 20px 48px -10px rgba(10, 12, 20, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08);
      position: relative;
      overflow: hidden;
      cursor: pointer;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      animation: heroCardEntrance 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);

      &::after {
        content: '';
        position: absolute;
        inset: 1.5px;
        border-radius: 26.5px;
        background: linear-gradient(150deg, #10121a 0%, #171a26 60%, #0d0f17 100%);
        z-index: 1;
        pointer-events: none;
      }

      &:hover {
        transform: translateY(-2px);
      }

      &:active {
        transform: scale(0.99);
      }
    }

    /* Living Conic Laser Border Sweep */
    .hero-laser-border {
      position: absolute;
      top: -60%;
      left: -60%;
      width: 220%;
      height: 220%;
      background: conic-gradient(
        from 0deg,
        transparent 0deg,
        transparent 70deg,
        rgba(108, 76, 255, 0.95) 110deg,
        rgba(255, 95, 158, 0.95) 140deg,
        rgba(15, 178, 124, 0.95) 170deg,
        transparent 210deg,
        transparent 360deg
      );
      animation: laserSpin 7.5s linear infinite;
      pointer-events: none;
      z-index: 0;
      will-change: transform;
    }

    /* Internal Living Nebula Blooms */
    .hero-nebula-glow {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      z-index: 2;
      opacity: 0.36;
    }

    .nebula-1 {
      width: 220px;
      height: 220px;
      background: radial-gradient(circle, rgba(108, 76, 255, 0.6) 0%, transparent 70%);
      top: -40px;
      right: -30px;
      animation: nebulaMorph1 9s ease-in-out infinite alternate;
    }

    .nebula-2 {
      width: 240px;
      height: 240px;
      background: radial-gradient(circle, rgba(255, 95, 158, 0.5) 0%, transparent 70%);
      bottom: -60px;
      left: 15%;
      animation: nebulaMorph2 11s ease-in-out infinite alternate;
    }

    /* Floating Digital Particle Embers */
    .hero-particles-field {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 2;
      overflow: hidden;
    }

    .particle {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 0 6px #6c4cff;
      bottom: -10px;
      animation: particleRise 6s ease-in infinite;
    }

    .p-1 { left: 15%; animation-duration: 5.5s; animation-delay: 0s; width: 3px; height: 3px; }
    .p-2 { left: 38%; animation-duration: 7.5s; animation-delay: 1.5s; width: 4px; height: 4px; }
    .p-3 { left: 62%; animation-duration: 6.2s; animation-delay: 3s; width: 2.5px; height: 2.5px; }
    .p-4 { left: 82%; animation-duration: 8.2s; animation-delay: 0.8s; width: 3.5px; height: 3.5px; }
    .p-5 { left: 93%; animation-duration: 6.8s; animation-delay: 2.2s; width: 3px; height: 3px; }

    /* Dynamic Shimmer Ray */
    .hero-shimmer-sweep {
      position: absolute;
      top: -100%;
      left: -100%;
      width: 300%;
      height: 300%;
      background: linear-gradient(
        115deg,
        transparent 35%,
        rgba(255, 255, 255, 0.12) 50%,
        transparent 65%
      );
      pointer-events: none;
      z-index: 2;
      animation: shimmerSweep 5.5s ease-in-out infinite;
    }

    .hero-left-content {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
      overflow: hidden;
      position: relative;
      z-index: 3;
    }

    .hero-badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.08);
      padding: 5px 12px;
      border-radius: 99px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      width: fit-content;
    }

    .lightning-bolt {
      color: #f59e0b;
      font-size: 14px;
      flex-shrink: 0;
      animation: liveBlink 2s ease-in-out infinite;
    }

    .hero-number-wrap {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }

    .hero-balance-headline {
      font-size: clamp(26px, 6.5vw, 36px);
      font-weight: 800;
      letter-spacing: -0.035em;
      line-height: 1.1;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-shadow: 0 0 35px rgba(255, 255, 255, 0.25);
      animation: headlineBreathe 4s ease-in-out infinite alternate;
    }

    .hero-balance-sub {
      font-size: 12px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.65);
      word-break: break-word;
    }

    /* 3. Section Containers */
    .page-section {
      display: flex;
      flex-direction: column;
      margin-bottom: 26px;
      width: 100%;
      box-sizing: border-box;
      position: relative;
      z-index: 2;
    }

    .section-main-heading {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #111216;
      margin: 0 0 4px;
      padding: 0;
    }

    .section-title-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin: 0 0 14px;
      padding: 0 4px;
      animation: cardPopUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.22s both;
    }

    .section-sub-caption {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #8e8e93;
      margin-top: 2px;
    }

    .section-see-all-btn {
      background: transparent;
      border: none;
      color: #8e8e93;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      padding: 4px 6px;
      white-space: nowrap;
      transition: color 0.15s ease, transform 0.15s ease;

      &:hover {
        color: #111216;
        transform: translateX(2px);
      }
    }

    /* Squircle Cards List for Members */
    .squircle-cards-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
      width: 100%;
      box-sizing: border-box;
    }

    .member-squircle-card {
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.04);
      border-radius: 26px;
      padding: 18px 18px;
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      gap: 14px;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      position: relative;
      overflow: hidden;
      animation: cardQuickEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, border-color 0.2s ease;

      &:hover {
        transform: translateY(-4px) scale(1.01);
        box-shadow: 0 16px 36px rgba(108, 76, 255, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04);
        border-color: rgba(108, 76, 255, 0.25);
      }
    }

    .card-iridescent-edge {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #6c4cff 0%, #ff5f9e 50%, #0fb27c 100%);
      border-radius: 26px 26px 0 0;
      opacity: 0.9;
    }

    /* Member Top Row */
    .member-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      width: 100%;
      min-width: 0;
    }

    .member-identity-group {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1;
    }

    .member-text-group {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .member-name {
      font-size: 16px;
      font-weight: 800;
      color: #111216;
      letter-spacing: -0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .member-due-date {
      font-size: 11px;
      font-weight: 500;
      color: #8e8e93;
    }

    .member-badge-cluster {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .pool-share-pill {
      font-size: 11px;
      font-weight: 700;
      background: #f2f3f6;
      color: #111216;
      padding: 4px 10px;
      border-radius: 9999px;
      letter-spacing: -0.01em;
      white-space: nowrap;
    }

    .member-icon-circle-btn {
      width: 34px;
      height: 34px;
      min-width: 34px;
      min-height: 34px;
      border-radius: 50%;
      background: #f2f3f6;
      border: none;
      display: grid;
      place-items: center;
      cursor: pointer;
      padding: 0;
      transition: all 0.2s ease;

      &:hover {
        background: #111216;
        svg {
          stroke: #ffffff;
        }
      }

      &:active {
        transform: scale(0.9);
      }
    }

    /* Metrics Row */
    .member-metrics-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      background: #f8f9fb;
      padding: 10px 12px;
      border-radius: 16px;
      width: 100%;
      box-sizing: border-box;
    }

    .member-metric-col {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .metric-col-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #8e8e93;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .metric-col-val {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #111216;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      &.highlight {
        color: #111216;
        font-weight: 800;
      }

      &.muted {
        color: #6b7280;
      }
    }

    /* Progress Wrap */
    .member-progress-wrap {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
    }

    .progress-label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      font-size: 11px;
    }

    .progress-status-badge {
      font-weight: 700;
      color: #6b7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      &.completed {
        color: #0fb27c;
      }
    }

    .progress-ratio {
      font-weight: 600;
      color: #8e8e93;
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* Member Card Footer */
    .member-card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      padding-top: 4px;
      width: 100%;
      box-sizing: border-box;
    }

    .footer-meta-info {
      font-size: 11px;
      font-weight: 500;
      color: #8e8e93;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .member-action-btn-subtle {
      background: #f2f3f6;
      color: #111216;
      border: none;
      border-radius: 9999px;
      padding: 6px 14px;
      min-height: 34px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;

      &:hover {
        background: #e5e7eb;
      }

      &:active {
        transform: scale(0.95);
      }
    }

    /* Footnote Info Card */
    .footnote-info-card {
      margin: 10px 0 0;
      background: #ffffff;
      border-radius: 20px;
      padding: 14px 18px;
      box-shadow: var(--shadow-card);
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
    }

    .footnote-icon {
      font-size: 18px;
      flex-shrink: 0;
    }

    .footnote-text {
      font-size: 12px;
      font-weight: 500;
      line-height: 1.45;
      color: #8e8e93;
    }

    .broadcast-hub-banner-btn {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      margin: 4px 0 16px;
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(37, 211, 102, 0.12) 0%, rgba(18, 140, 126, 0.08) 100%);
      border: 1px solid rgba(37, 211, 102, 0.35);
      cursor: pointer;
      width: 100%;
      box-sizing: border-box;
      text-align: left;
      transition: transform 0.15s ease, background 0.2s ease;

      &:active {
        transform: scale(0.99);
      }

      .banner-left-group {
        display: flex;
        align-items: center;
        gap: 12px;

        .banner-pulse-icon {
          font-size: 22px;
          flex-shrink: 0;
        }

        .banner-text-group {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .banner-main-title {
            font-size: 14px;
            font-weight: 800;
            color: #128c7e;
          }

          .banner-sub-caption {
            font-size: 11.5px;
            color: var(--muted, #767a90);
          }
        }
      }

      .banner-arrow-pill {
        padding: 5px 10px;
        border-radius: 99px;
        background: #25d366;
        color: #ffffff;
        font-size: 11px;
        font-weight: 800;
        flex-shrink: 0;
      }
    }

    .footer-btn-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .member-whatsapp-remind-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border-radius: 99px;
      background: rgba(37, 211, 102, 0.12);
      color: #128c7e;
      border: 1px solid rgba(37, 211, 102, 0.35);
      font-size: 11px;
      font-weight: 700;
      text-decoration: none;
      transition: background 0.15s ease;

      &:hover {
        background: rgba(37, 211, 102, 0.2);
      }
    }

    @media (max-width: 360px) {
      .member-card-footer {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }

      .member-action-btn-subtle {
        align-self: flex-end;
      }
    }

    /* Keyframe Animations for Living UI / Video Feel */
    @keyframes laserSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes nebulaMorph1 {
      0% { transform: scale(1) translate(0, 0); opacity: 0.28; }
      50% { transform: scale(1.25) translate(-20px, 15px); opacity: 0.44; }
      100% { transform: scale(1) translate(0, 0); opacity: 0.28; }
    }

    @keyframes nebulaMorph2 {
      0% { transform: scale(1.2) translate(0, 0); opacity: 0.22; }
      50% { transform: scale(0.9) translate(25px, -15px); opacity: 0.38; }
      100% { transform: scale(1.2) translate(0, 0); opacity: 0.22; }
    }

    @keyframes particleRise {
      0% { transform: translateY(0) scale(0.6); opacity: 0; }
      20% { opacity: 0.85; }
      80% { opacity: 0.85; }
      100% { transform: translateY(-160px) scale(1.2); opacity: 0; }
    }

    @keyframes shimmerSweep {
      0% { transform: translate(-50%, -50%) rotate(0deg); opacity: 0; }
      20% { opacity: 1; }
      50% { transform: translate(50%, 50%) rotate(0deg); opacity: 0; }
      100% { transform: translate(50%, 50%) rotate(0deg); opacity: 0; }
    }

    @keyframes headlineBreathe {
      0% { text-shadow: 0 0 25px rgba(255, 255, 255, 0.2); }
      100% { text-shadow: 0 0 45px rgba(255, 255, 255, 0.45), 0 0 15px rgba(108, 76, 255, 0.3); }
    }

    @keyframes orbDrift1 {
      0% { transform: translate(0, 0) scale(1); }
      100% { transform: translate(60px, 40px) scale(1.18); }
    }

    @keyframes orbDrift2 {
      0% { transform: translate(0, 0) scale(1); }
      100% { transform: translate(-50px, -60px) scale(1.22); }
    }

    @keyframes orbDrift3 {
      0% { transform: translate(0, 0) scale(1.1); }
      100% { transform: translate(40px, -30px) scale(0.9); }
    }

    @keyframes orbDrift4 {
      0% { transform: translate(0, 0) scale(0.95); }
      100% { transform: translate(-45px, 35px) scale(1.15); }
    }

    @keyframes waveFloat {
      0% { transform: translateX(0) scaleY(1); }
      100% { transform: translateX(-25%) scaleY(1.15); }
    }

    @keyframes cinematicSlideDown {
      from { opacity: 0.85; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes heroCardEntrance {
      from { opacity: 0.85; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes cardQuickEnter {
      from { opacity: 0.85; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes liveBlink {
      0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 6px #0fb27c; }
      50% { opacity: 0.4; transform: scale(0.7); box-shadow: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .video-ambient-mesh,
      .hero-laser-border,
      .hero-nebula-glow,
      .hero-particles-field,
      .hero-shimmer-sweep,
      .card-iridescent-edge {
        animation: none !important;
        display: none !important;
      }

      .app-top-bar,
      .matte-hero-banner,
      .section-title-bar,
      .member-squircle-card {
        animation: none !important;
        transform: none !important;
      }
    }
  `,
})
export class MembersComponent {
  readonly ledgerStore = inject(LedgerStore);
  readonly userProfile = inject(UserProfileStore);
  readonly router = inject(Router);

  private lastHapticTime = 0;

  triggerNavHaptic(): void {
    const now = Date.now();
    if (now - this.lastHapticTime > 60) {
      this.lastHapticTime = now;
      triggerHaptic('light');
    }
  }

  readonly isAddTxOpen = signal(false);
  readonly selectedMemberId = signal<string | undefined>(undefined);

  readonly formatPaise = formatPaise;
  readonly formatCompactPaise = formatCompactPaise;

  readonly activeCount = computed(
    () => this.ledgerStore.activeMembers().length
  );

  readonly totalMonthlyTarget = computed<Paise>(() => {
    const members = this.ledgerStore.members().filter((m) => !m.deletedAt);
    return members.reduce((sum, m) => addPaise(sum, m.target || ZERO_PAISE), ZERO_PAISE);
  });

  getMemberProgress(m: MemberStatistics): number {
    if (!m.target || m.target <= 0) return 0;
    return Math.min(100, (m.thisMonthContribution / m.target) * 100);
  }

  getMemberWhatsAppReminder(memberId: string): string {
    const member = this.ledgerStore.activeMembers().find((m) => m.id === memberId);
    if (!member) return '';
    return buildMonthlyDueReminder(member, this.ledgerStore.ledgerState()).whatsappUrl;
  }

  viewMemberHistory(memberId: string): void {
    void this.router.navigate(['/members/history'], { queryParams: { member: memberId } });
  }

  openAddContribution(memberId?: string): void {
    this.selectedMemberId.set(memberId);
    this.isAddTxOpen.set(true);
  }
}

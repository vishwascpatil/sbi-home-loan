import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LedgerStore, SettingsStore, UserProfileStore } from '../../core/state';
import {
  AvatarComponent,
  ConfirmSheetComponent,
  GlassCardComponent,
} from '../../shared/ui';
import {
  buildAnnualReportMailtoUrl,
  buildDailyInterestBroadcast,
  buildDailyInterestSms,
  buildMonthlyDueReminder,
  computeDailyInterest,
  dispatchSms,
  formatCompactPaise,
  formatPaise,
  generateAnnualExcelSpreadsheet,
  loadLocalSmsConfig,
  Member,
  MemberStatistics,
  Paise,
  paise,
  PushNotificationService,
  saveLocalSmsConfig,
  SmsGatewayConfig,
  TARGET_FAMILY_PHONE_NUMBERS,
  toPaise,
  toRupees,
  triggerHaptic,
  WOW_STATEMENTS,
  WowStatement,
  ZERO_PAISE,
} from '../../core/engine';
import { FirestoreLedgerRepository } from '../../core/data/firestore-ledger.repository';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    GlassCardComponent,
    AvatarComponent,
    ConfirmSheetComponent,
  ],
  template: `
    <div class="settings-page">
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

      <!-- 1. Top Bar -->
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
            <span class="profile-greeting">System &amp; Loan Control</span>
            <div class="profile-name-row">
              <h1 class="profile-user-name">App Settings</h1>
              <span class="profile-switch-indicator">▾</span>
            </div>
          </div>
        </div>

        <a
          routerLink="/home"
          class="top-circle-action-btn"
          aria-label="Back to Home"
          title="Back to Home"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 10.5 12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </a>
      </header>

      <!-- 2. Matte Black Obsidian Hero Card (Living Video UI) -->
      <div class="matte-hero-banner" role="region" aria-label="Device Profile & Active Member">
        <div class="hero-laser-border" aria-hidden="true"></div>
        <div class="hero-nebula-glow nebula-1" aria-hidden="true"></div>
        <div class="hero-nebula-glow nebula-2" aria-hidden="true"></div>
        <div class="hero-particles-field" aria-hidden="true">
          <span class="particle p-1"></span>
          <span class="particle p-2"></span>
          <span class="particle p-3"></span>
          <span class="particle p-4"></span>
          <span class="particle p-5"></span>
        </div>
        <div class="hero-shimmer-sweep" aria-hidden="true"></div>

        <div class="hero-left-content">
          <div class="hero-badge-pill">
            <span class="lightning-bolt">⚡</span>
            <span>Active on this Device · GA4 Tracking as {{ userProfile.currentMemberName() }}</span>
          </div>
          <div class="hero-profile-cluster">
            <app-avatar [name]="userProfile.currentMemberName()" [avatarUrl]="userProfile.currentMemberAvatar()" [size]="52" [circular]="true" />
            <div class="hero-profile-meta">
              <h2 class="hero-member-name">{{ userProfile.currentMemberName() }}</h2>
              <span class="hero-member-phone">{{ userProfile.currentMember()?.phone || 'No phone set' }}</span>
            </div>
          </div>
        </div>

        <div class="hero-right-action">
          <button
            type="button"
            class="hero-switch-btn"
            (click)="userProfile.openProfilePicker()"
          >
            <span>🔄</span>
            <span>Switch Member</span>
          </button>
        </div>
      </div>

      <!-- Storage Quota / Degradation Warning Alert -->
      @if (ledgerStore.storageWarning()) {
        <div class="alert-warning-card" role="alert">
          <span class="alert-icon">⚠️</span>
          <div class="alert-content">
            <strong>Storage Warning</strong>
            <p>{{ ledgerStore.storageWarning() }}</p>
          </div>
        </div>
      }

      <!-- 1. Loan Parameters Editor -->
      <app-glass-card [staggerIndex]="0">
        <div class="card-glow-strip strip-indigo"></div>
        <div class="card-title-row">
          <div>
            <h2 class="card-title">Loan Parameters</h2>
            <p class="section-sub">Bank account details, sanctioned limit, outstanding principal, and monthly target.</p>
          </div>
          <span class="card-status-badge">Live Ledger</span>
        </div>

        <div class="settings-form-grid">
          <div class="setting-item">
            <label class="setting-label" for="loan-type">Type of Loan</label>
            <input
              id="loan-type"
              type="text"
              class="setting-input"
              [ngModel]="loan().type"
              (ngModelChange)="updateLoanParam('type', $event)"
            />
          </div>

          <div class="setting-item">
            <label class="setting-label" for="loan-account">
              <span>Bank Account Number</span>
              <button
                type="button"
                class="eye-btn"
                (click)="settings.toggleMaskAccountNumber()"
              >
                {{ settings.maskAccountNumber() ? '👁️ Show' : '🔒 Hide' }}
              </button>
            </label>
            <input
              id="loan-account"
              [type]="settings.maskAccountNumber() ? 'password' : 'text'"
              class="setting-input font-mono"
              [ngModel]="loan().accountNumber"
              (ngModelChange)="updateLoanParam('accountNumber', $event)"
            />
          </div>

          <div class="setting-item">
            <label class="setting-label" for="loan-limit">
              <span>Total Sanctioned Limit (₹)</span>
              <span class="compact-hint">{{ formatCompactPaise(loan().sanctionedLimit) }}</span>
            </label>
            <input
              id="loan-limit"
              type="text"
              inputmode="decimal"
              class="setting-input tabular-nums"
              [value]="getMoneyParamDisplay('sanctionedLimit')"
              (focus)="onMoneyParamFocus('sanctionedLimit')"
              (input)="onMoneyParamInput('sanctionedLimit', $event)"
              (blur)="onMoneyParamBlur('sanctionedLimit', $event)"
            />
          </div>

          <div class="setting-item">
            <label class="setting-label" for="loan-outstanding">
              <span>Current Outstanding Amount (₹)</span>
              <span class="compact-hint">{{ formatCompactPaise(ledgerStore.currentOutstanding()) }}</span>
            </label>
            <input
              id="loan-outstanding"
              type="text"
              inputmode="decimal"
              class="setting-input tabular-nums"
              [value]="getMoneyParamDisplay('currentOutstanding')"
              (focus)="onMoneyParamFocus('currentOutstanding')"
              (input)="onMoneyParamInput('currentOutstanding', $event)"
              (blur)="onMoneyParamBlur('currentOutstanding', $event)"
            />
          </div>

          <div class="setting-item full-span">
            <label class="setting-label" for="loan-target">
              <span>Total Monthly Target to Collect (₹)</span>
              <span class="compact-hint">{{ formatCompactPaise(loan().monthlyTarget) }}</span>
            </label>
            <input
              id="loan-target"
              type="text"
              inputmode="decimal"
              class="setting-input tabular-nums"
              [value]="getMoneyParamDisplay('monthlyTarget')"
              (focus)="onMoneyParamFocus('monthlyTarget')"
              (input)="onMoneyParamInput('monthlyTarget', $event)"
              (blur)="onMoneyParamBlur('monthlyTarget', $event)"
            />
          </div>
        </div>
      </app-glass-card>

      <!-- 2. Interest Rate Revision Section -->
      <app-glass-card [staggerIndex]="1">
        <div class="card-glow-strip strip-violet"></div>
        <div class="card-title-row">
          <div>
            <h2 class="card-title">Change Interest Rate</h2>
            <p class="section-sub">Bank revisions update current and future interest without altering historical records.</p>
          </div>
          <span class="current-rate-tag tabular-nums">{{ (loan().currentRateBps / 100).toFixed(2) }}% Active</span>
        </div>

        <!-- Rate Revision Form -->
        <form class="rate-change-form" (ngSubmit)="applyRateChange()">
          <div class="rate-form-grid">
            <div class="setting-item">
              <label class="setting-label" for="new-rate">New Rate (% p.a.)</label>
              <div class="rate-input-wrap">
                <input
                  id="new-rate"
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="30"
                  class="setting-input rate-input tabular-nums"
                  placeholder="{{ (loan().currentRateBps / 100).toFixed(2) }}"
                  [(ngModel)]="newRateInput"
                  name="newRate"
                  required
                />
                <span class="percent-adornment">%</span>
              </div>
            </div>

            <div class="setting-item">
              <label class="setting-label" for="rate-date">Effective Date</label>
              <input
                id="rate-date"
                type="date"
                class="setting-input"
                [(ngModel)]="rateEffectiveDate"
                name="rateDate"
                required
              />
            </div>
          </div>

          <button type="submit" class="apply-rate-btn">
            <span>⚡ Apply Rate Revision</span>
          </button>
        </form>

        <!-- Rate Revisions Timeline -->
        @if (rateHistory().length > 0) {
          <div class="rate-history-section">
            <div class="history-section-title">Rate Revisions Log ({{ rateHistory().length }})</div>
            <div class="rate-timeline">
              @for (r of rateHistory(); track r.id) {
                <div class="timeline-entry" [class.current]="$first">
                  <div class="timeline-indicator">
                    <span class="timeline-bullet"></span>
                    @if (!$last) {
                      <span class="timeline-line"></span>
                    }
                  </div>
                  <div class="timeline-details">
                    <div class="timeline-top">
                      <strong class="timeline-rate tabular-nums">{{ (r.rateBps / 100).toFixed(2) }}% p.a.</strong>
                      @if ($first) {
                        <span class="timeline-active-tag">Active in Force</span>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </app-glass-card>

      <!-- 3. Family Members Roster -->
      <app-glass-card [staggerIndex]="2">
        <div class="card-glow-strip strip-pink"></div>
        <div class="card-title-row">
          <div>
            <h2 class="card-title">Family Members</h2>
            <p class="section-sub">Co-borrowers contributing to monthly EMI pool.</p>
          </div>
          <button
            type="button"
            class="add-m-btn"
            (click)="addNewMemberPrompt()"
            aria-label="Add family member"
            title="Add person"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>

        <div class="members-luxury-list">
          @for (m of nonDeletedMembers(); track m.id) {
            <div class="member-row">
              <div class="member-avatar-wrap">
                <app-avatar
                  [name]="m.name"
                  [colorIndex]="m.colorIndex"
                  [size]="38"
                  [circular]="true"
                  [avatarUrl]="m.avatarUrl"
                />
              </div>

              <input
                type="text"
                class="member-name-input"
                [ngModel]="m.name"
                (ngModelChange)="renameMember(m.id, $event)"
                placeholder="Member name"
                aria-label="Member name"
              />

              <button
                type="button"
                class="member-del-btn"
                (click)="confirmDeleteMember(m)"
                aria-label="Remove member"
                title="Remove member"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          }
        </div>
      </app-glass-card>

      <!-- 4. Family Alerts & Notifications Hub -->
      <app-glass-card [staggerIndex]="3">
        <div class="card-glow-strip strip-emerald"></div>
        <div class="card-title-row">
          <div>
            <h2 class="card-title">Family Alerts &amp; Notifications Hub</h2>
            <p class="section-sub">Daily 9 AM interest updates, 1st of month reminders &amp; November Excel reports.</p>
          </div>
          <span class="alerts-badge-pill">WhatsApp &amp; Email</span>
        </div>

        <!-- Segmented Tab Switcher -->
        <div class="settings-pill-tab-bar" role="tablist">
          <button
            type="button"
            class="settings-pill-tab"
            [class.active]="alertsTab() === 'daily'"
            (click)="selectAlertsTab('daily')"
          >
            ☀️ Daily 9 AM Interest
          </button>
          <button
            type="button"
            class="settings-pill-tab"
            [class.active]="alertsTab() === 'monthly'"
            (click)="selectAlertsTab('monthly')"
          >
            🔔 1st of Month Reminders
          </button>
          <button
            type="button"
            class="settings-pill-tab"
            [class.active]="alertsTab() === 'annual'"
            (click)="selectAlertsTab('annual')"
          >
            📊 Nov Excel &amp; Email
          </button>
          <button
            type="button"
            class="settings-pill-tab"
            [class.active]="alertsTab() === 'push_sms'"
            (click)="selectAlertsTab('push_sms')"
          >
            📲 Push &amp; SMS Hub
          </button>
        </div>

        <!-- TAB 1: DAILY 9 AM INTEREST -->
        @if (alertsTab() === 'daily') {
          <div class="alerts-tab-content">
            <div class="daily-stat-tile">
              <div class="tile-stat-row">
                <span class="tile-stat-label">Today's Interest Accrued</span>
                <span class="tile-stat-val highlight tabular-nums">+{{ formatPaise(dailyInterest()) }}</span>
              </div>
              <div class="tile-stat-row border-top">
                <span class="tile-stat-label">Effective Balance Today</span>
                <span class="tile-stat-val tabular-nums">{{ formatPaise(effectiveTodayBalance()) }}</span>
              </div>
            </div>

            <div class="settings-preview-box">
              <span class="preview-header-tag">WhatsApp Message Preview:</span>
              <pre class="preview-msg-text">{{ dailyMessage().body }}</pre>
            </div>

            <div class="action-btn-row">
              <a
                [href]="dailyMessage().whatsappUrl"
                target="_blank"
                class="settings-whatsapp-action-btn"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.53 7.37C9.36 7.37 9.09 7.43 8.85 7.69C8.61 7.95 7.94 8.58 7.94 9.87C7.94 11.15 8.88 12.39 9.01 12.56C9.14 12.73 10.84 15.36 13.45 16.49C14.07 16.76 14.56 16.92 14.94 17.04C15.56 17.24 16.13 17.21 16.57 17.15C17.07 17.07 18.09 16.53 18.3 15.93C18.52 15.34 18.52 14.83 18.45 14.73C18.39 14.62 18.21 14.56 17.95 14.43C17.69 14.3 16.42 13.67 16.18 13.59C15.95 13.5 15.78 13.46 15.6 13.72C15.43 13.97 14.95 14.56 14.8 14.73C14.66 14.9 14.51 14.92 14.25 14.79C14 14.66 12.92 14.31 11.64 13.17C10.65 12.28 9.98 11.19 9.79 10.85C9.59 10.51 9.77 10.33 9.9 10.2C10.02 10.08 10.16 9.89 10.29 9.74C10.42 9.59 10.46 9.49 10.55 9.32C10.64 9.15 10.59 9 10.53 8.87C10.46 8.74 9.95 7.48 9.73 6.97C9.52 6.47 9.31 6.54 9.15 6.53C9 6.52 8.83 6.52 8.65 6.52" />
                </svg>
                Share to Family WhatsApp Group
              </a>
            </div>

            <!-- Direct Test Buttons for iPhone Push & SMS -->
            <div class="quick-test-actions-row">
              <button
                type="button"
                class="quick-test-btn push-btn"
                (click)="triggerTestPush()"
                [disabled]="isTestingPush()"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
                </svg>
                {{ isTestingPush() ? 'Firing Push...' : '⚡ Test iPhone Lock-Screen Push' }}
              </button>

              <button
                type="button"
                class="quick-test-btn sms-btn"
                (click)="triggerTestSms()"
                [disabled]="isSendingSms()"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 11H7V9h2v2zm4 0h-2V9h2v2zm4 0h-2V9h2v2z"/>
                </svg>
                {{ isSendingSms() ? 'Sending SMS...' : '📲 Send Test SMS to 8105242578' }}
              </button>
            </div>

            @if (pushTestStatus()) {
              <div class="quick-feedback-note push-note" [class.success]="pushTestStatus()?.startsWith('✓')">
                {{ pushTestStatus() }}
              </div>
            }

            @if (smsStatusMessage()) {
              <div class="quick-feedback-note sms-note" [class.success]="smsStatusMessage()?.startsWith('✓')">
                {{ smsStatusMessage() }}
              </div>
            }

            <!-- Direct Personal Chips -->
            <div class="direct-chips-container">
              <span class="direct-label">Send directly to personal numbers:</span>
              <div class="chips-row">
                @for (m of ledgerStore.activeMembers(); track m.id) {
                  <a [href]="getMemberDailyWhatsApp(m)" target="_blank" class="direct-phone-chip">
                    <span>{{ m.name }}</span>
                    <small>({{ m.phone || 'N/A' }})</small>
                  </a>
                }
              </div>
            </div>
          </div>
        }

        <!-- TAB 2: MONTHLY 1ST REMINDERS -->
        @if (alertsTab() === 'monthly') {
          <div class="alerts-tab-content">
            <p class="section-sub" style="margin-bottom: 12px">
              Due on the 5th of every month. Each reminder includes the member's specific remaining target.
            </p>
            <div class="reminders-members-list">
              @for (m of ledgerStore.memberStats(); track m.memberId) {
                @let memberObj = getMember(m.memberId);
                <div class="settings-reminder-row">
                  <div class="reminder-left">
                    <span class="reminder-member-name">{{ m.name }}</span>
                    <span class="reminder-member-phone">{{ memberObj?.phone || 'No phone' }}</span>
                    <span class="reminder-target-text tabular-nums">
                      Due: <strong>{{ formatPaise(getMemberDue(m)) }}</strong>
                      <small>({{ formatPaise(m.thisMonthContribution) }} paid of {{ m.target ? formatPaise(m.target) : '₹0' }})</small>
                    </span>
                  </div>
                  <div class="reminder-right">
                    @if (m.target && m.thisMonthContribution >= m.target) {
                      <span class="paid-check-badge">✓ Fully Paid</span>
                    } @else {
                      <a [href]="getMonthlyReminderWhatsApp(memberObj)" target="_blank" class="send-remind-pill-btn">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.53 7.37C9.36 7.37 9.09 7.43 8.85 7.69C8.61 7.95 7.94 8.58 7.94 9.87C7.94 11.15 8.88 12.39 9.01 12.56C9.14 12.73 10.84 15.36 13.45 16.49C14.07 16.76 14.56 16.92 14.94 17.04C15.56 17.24 16.13 17.21 16.57 17.15C17.07 17.07 18.09 16.53 18.3 15.93C18.52 15.34 18.52 14.83 18.45 14.73C18.39 14.62 18.21 14.56 17.95 14.43C17.69 14.3 16.42 13.67 16.18 13.59C15.95 13.5 15.78 13.46 15.6 13.72C15.43 13.97 14.95 14.56 14.8 14.73C14.66 14.9 14.51 14.92 14.25 14.79C14 14.66 12.92 14.31 11.64 13.17C10.65 12.28 9.98 11.19 9.79 10.85C9.59 10.51 9.77 10.33 9.9 10.2C10.02 10.08 10.16 9.89 10.29 9.74C10.42 9.59 10.46 9.49 10.55 9.32C10.64 9.15 10.59 9 10.53 8.87C10.46 8.74 9.95 7.48 9.73 6.97C9.52 6.47 9.31 6.54 9.15 6.53C9 6.52 8.83 6.52 8.65 6.52" />
                </svg>
                Remind
              </a>
            }
          </div>
        </div>
      }
    </div>
  </div>
}

<!-- TAB 3: NOVEMBER ANNUAL EXCEL & EMAIL -->
@if (alertsTab() === 'annual') {
  <div class="alerts-tab-content">
    <p class="section-sub" style="margin-bottom: 12px">
      Maintains an Excel sheet of who paid how much, tracks all numbers, and emails the annual report on Nov 1st.
    </p>

    <div class="settings-excel-tile">
      <div class="excel-tile-header">
        <span class="excel-badge">Excel Ledger</span>
        <span class="excel-filename">SBI-Home-Loan-Annual-Report.xls</span>
      </div>
      <div class="excel-table-snippet">
        @for (m of ledgerStore.memberStats(); track m.memberId) {
          <div class="snippet-row">
            <span class="snip-name">{{ m.name }}</span>
            <span class="snip-phone tabular-nums">{{ getMember(m.memberId)?.phone || '-' }}</span>
            <span class="snip-paid tabular-nums font-bold">{{ formatPaise(m.lifetimeContribution) }}</span>
          </div>
        }
      </div>
    </div>

    <div class="excel-button-stack">
      <button type="button" class="btn-download-excel" (click)="downloadExcel()">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Download Annual Excel File (.xls)
      </button>

      <a [href]="annualEmailUrl()" class="btn-send-email">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
        Send Email to Vishwas &amp; Vikas
      </a>
    </div>
  </div>
}

<!-- TAB 4: PUSH & SMS GATEWAY HUB -->
@if (alertsTab() === 'push_sms') {
  <div class="alerts-tab-content">
    <p class="section-sub" style="margin-bottom: 16px">
      Configure and trigger real lock-screen banners on your iPhone 17 Pro Max and automated SMS to +918105242578.
    </p>

    <!-- SECTION A: IPHONE LOCK-SCREEN PUSH -->
    <div class="settings-sub-panel">
      <div class="sub-panel-header">
        <div class="panel-icon-wrap push-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
          </svg>
        </div>
        <div class="sub-panel-text">
          <h4 class="sub-panel-title">iPhone Lock-Screen Web Push</h4>
          <p class="sub-panel-desc">Fires native lock-screen notification banners on iPhone 17 Pro Max via Apple APNs.</p>
        </div>
        <div class="status-pill" [class.granted]="pushService.permission() === 'granted'" [class.denied]="pushService.permission() === 'denied'">
          {{ pushService.permission() === 'granted' ? '● Active' : pushService.permission() === 'denied' ? '✕ Blocked' : '○ Needed' }}
        </div>
      </div>

      <div class="panel-action-grid">
        @if (pushService.permission() !== 'granted') {
          <button type="button" class="panel-btn enable-push-btn" (click)="triggerEnablePush()" [disabled]="pushService.isBusy()">
            🔔 Enable iPhone Push Banners
          </button>
        }
        <button type="button" class="panel-btn test-push-btn" (click)="triggerTestPush()" [disabled]="isTestingPush()">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
          </svg>
          {{ isTestingPush() ? 'Firing Push...' : '⚡ Trigger Test Push to iPhone' }}
        </button>
      </div>

      @if (pushTestStatus()) {
        <div class="push-status-note" [class.success]="pushTestStatus()?.startsWith('✓')">
          {{ pushTestStatus() }}
        </div>
      }
    </div>

    <!-- SECTION B: AUTOMATED SMS GATEWAY -->
    <div class="settings-sub-panel" style="margin-top: 14px;">
      <div class="sub-panel-header">
        <div class="panel-icon-wrap sms-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 11H7V9h2v2zm4 0h-2V9h2v2zm4 0h-2V9h2v2z"/>
          </svg>
        </div>
        <div class="sub-panel-text">
          <h4 class="sub-panel-title">Automated SMS Gateway</h4>
          <p class="sub-panel-desc">Direct text message delivery to Vishwas (+918105242578) via Fast2SMS.</p>
        </div>
        <div class="status-pill granted">
          8105242578
        </div>
      </div>

      <!-- Fast2SMS API Key Input -->
      <div class="sms-input-group">
        <div class="sms-label-row">
          <label for="fast2sms-key-field" class="sms-input-label">Fast2SMS API Key (for direct carrier SMS):</label>
          <a href="https://www.fast2sms.com" target="_blank" class="get-key-link">Get Free Key (50 SMS) ↗</a>
        </div>
        <input
          id="fast2sms-key-field"
          type="password"
          class="sms-key-field"
          placeholder="Paste Fast2SMS API Key here..."
          [value]="smsConfig().fast2smsApiKey || ''"
          (input)="onSmsApiKeyInput($event)"
        />
        <small class="sms-helper-text">
          Sign up free at fast2sms.com to get your API key with 50 free credits for India SMS.
        </small>
      </div>

      <div class="panel-action-grid">
        <button
          type="button"
          class="panel-btn test-sms-btn"
          (click)="triggerTestSms()"
          [disabled]="isSendingSms()"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 11H7V9h2v2zm4 0h-2V9h2v2zm4 0h-2V9h2v2z"/>
          </svg>
          {{ isSendingSms() ? 'Sending SMS...' : '📲 Send Test SMS to 8105242578' }}
        </button>

        <a
          [href]="getMemberDailyWhatsApp(getMember('mem-vishwas') || { id: 'mem-vishwas', name: 'Vishwas', active: true, colorIndex: 0, phone: '8105242578', createdAt: '', updatedAt: '' })"
          target="_blank"
          class="panel-btn whatsapp-direct-btn"
        >
          💬 Free WhatsApp Direct (No Key Needed)
        </a>
      </div>

      @if (smsStatusMessage()) {
        <div class="sms-status-note" [class.success]="smsStatusMessage()?.startsWith('✓')">
          {{ smsStatusMessage() }}
        </div>
      }
    </div>

    <!-- SECTION C: 5-MINUTE FUNNY WOW NOTIFICATION HUB (20 STATEMENTS) -->
    <div class="settings-sub-panel wow-sub-panel" style="margin-top: 14px;">
      <div class="sub-panel-header">
        <div class="panel-icon-wrap wow-icon">
          <span style="font-size: 18px;">🎭</span>
        </div>
        <div class="sub-panel-text">
          <h4 class="sub-panel-title">5-Min WOW Notification Hub (20 Funny Statements)</h4>
          <p class="sub-panel-desc">
            Continuous round-robin notifications &amp; SMS to Vishwas, Vikas, Bhavya, CSP &amp; Shruthi.
          </p>
        </div>
        <div
          class="status-pill"
          [class.granted]="pushService.isFiveMinTimerActive()"
        >
          {{ pushService.isFiveMinTimerActive() ? '● Loop Active (' + pushService.nextTriggerSeconds() + 's)' : '○ Standby' }}
        </div>
      </div>

      <!-- Live WOW Statement Carousel Card -->
      <div class="wow-card-viewer">
        <div class="wow-card-top">
          <span class="wow-badge">#{{ currentWowStatement().id }} of 20 · {{ currentWowStatement().tag }}</span>
          <span class="wow-target-hint">Target: All 5 Family Numbers</span>
        </div>
        <h3 class="wow-headline">{{ currentWowStatement().title }}</h3>
        <p class="wow-body-text">{{ currentWowStatement().body }}</p>

        <!-- Carousel navigation -->
        <div class="wow-nav-controls">
          <button type="button" class="wow-nav-btn" (click)="prevWowStatement()" aria-label="Previous statement">
            ◀ Previous
          </button>
          <button type="button" class="wow-nav-btn random-btn" (click)="randomWowStatement()" aria-label="Random statement">
            🎲 Random
          </button>
          <button type="button" class="wow-nav-btn" (click)="nextWowStatement()" aria-label="Next statement">
            Next ▶
          </button>
        </div>
      </div>

      <!-- Interval Selector -->
      <div class="interval-selection-row">
        <span class="interval-label">Loop Cadence:</span>
        <div class="interval-pill-group">
          <button
            type="button"
            class="interval-pill"
            [class.active]="selectedLoopInterval() === 5"
            (click)="setLoopInterval(5)"
          >
            5 Mins (Standard)
          </button>
          <button
            type="button"
            class="interval-pill"
            [class.active]="selectedLoopInterval() === 1"
            (click)="setLoopInterval(1)"
          >
            1 Min
          </button>
          <button
            type="button"
            class="interval-pill demo-pill"
            [class.active]="selectedLoopInterval() === 0.16"
            (click)="setLoopInterval(0.16)"
            title="10-second fast demonstration for instant testing"
          >
            ⚡ 10s (Fast Demo)
          </button>
        </div>
      </div>

      <!-- Main Action Buttons -->
      <div class="panel-action-grid">
        <button
          type="button"
          class="panel-btn wow-loop-btn"
          [class.active-loop]="pushService.isFiveMinTimerActive()"
          (click)="toggleFiveMinAutoLoop()"
        >
          @if (pushService.isFiveMinTimerActive()) {
            ⏹️ Stop Notification Loop
          } @else {
            ⏱️ Start 5-Min Notification Loop
          }
        </button>

        <button
          type="button"
          class="panel-btn test-push-btn"
          (click)="triggerCurrentWowPush()"
          [disabled]="isSendingWowPush()"
        >
          {{ isSendingWowPush() ? 'Firing Push...' : '⚡ Trigger This Lock-Screen Push Now' }}
        </button>
      </div>

      <!-- Quick WhatsApp Send to all 5 Family Members -->
      <div class="direct-chips-container" style="margin-top: 14px;">
        <span class="direct-label">Send this WOW quote instantly via WhatsApp:</span>
        <div class="chips-row">
          @for (m of targetFamilyMembers; track m.phone) {
            <a
              [href]="getWowWhatsAppUrl(m.phone, currentWowStatement())"
              target="_blank"
              class="direct-phone-chip"
              [title]="'Send to ' + m.name + ' (' + m.role + ')'"
            >
              <span>{{ m.name }}</span>
              <small>({{ m.phone }})</small>
            </a>
          }
        </div>
      </div>
    </div>
  </div>
}
</app-glass-card>

      <!-- Delete Member Confirmation Sheet -->
      <app-confirm-sheet
        [isOpen]="isDeleteConfirmOpen()"
        title="Remove Family Member?"
        [message]="'Are you sure you want to remove ' + (memberToDelete()?.name || 'this member') + '? Their past payment history will be preserved.'"
        confirmText="Remove Member"
        cancelText="Cancel"
        [isDanger]="true"
        (confirmed)="executeDeleteMember()"
        (cancelled)="isDeleteConfirmOpen.set(false); memberToDelete.set(null)"
      />
    </div>
  `,
  styles: `
    .settings-page {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow-x: hidden;
      padding-bottom: 114px;
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
    }

    .orb-violet {
      width: 380px;
      height: 380px;
      background: radial-gradient(circle, rgba(108, 76, 255, 0.4) 0%, rgba(155, 77, 255, 0.12) 50%, transparent 70%);
      top: -80px;
      left: -80px;
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

    .wave-path-1 { fill: #6c4cff; }
    .wave-path-2 { fill: #ff5f9e; }

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

    .profile-name-row {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .profile-user-name {
      font-size: 18px;
      font-weight: 800;
      color: #111216;
      letter-spacing: -0.02em;
      margin: 0;
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
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
      }

      &:active {
        transform: scale(0.94);
      }
    }

    /* 2. Matte Black Hero Card (Living Cyber-Card) */
    .matte-hero-banner {
      background: #0f1118;
      color: #ffffff;
      border-radius: 28px;
      padding: 24px;
      margin-bottom: 26px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 20px 48px -10px rgba(10, 12, 20, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08);
      position: relative;
      overflow: hidden;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      animation: heroCardEntrance 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      flex-wrap: wrap;
      gap: 16px;

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
    }

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
      position: relative;
      z-index: 3;
    }

    .hero-badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.08);
      padding: 4px 10px;
      border-radius: 99px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      width: fit-content;
    }

    .lightning-bolt {
      color: #ffb800;
      filter: drop-shadow(0 0 6px #ffb800);
    }

    .hero-profile-cluster {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-top: 4px;
    }

    .hero-profile-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .hero-member-name {
      font-size: 20px;
      font-weight: 800;
      color: #ffffff;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .hero-member-phone {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.65);
    }

    .hero-right-action {
      position: relative;
      z-index: 3;
    }

    .hero-switch-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 99px;
      background: rgba(255, 255, 255, 0.12);
      border: 1.5px solid rgba(255, 255, 255, 0.25);
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);

      &:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(108, 76, 255, 0.3);
      }

      &:active {
        transform: scale(0.96);
      }
    }

    /* Luminous Card Glow Strips */
    .card-glow-strip {
      position: absolute;
      top: 0;
      left: 24px;
      right: 24px;
      height: 3px;
      border-radius: 99px;
      z-index: 2;
    }

    .strip-indigo { background: linear-gradient(90deg, #6c4cff, #9b4dff); }
    .strip-violet { background: linear-gradient(90deg, #9b4dff, #ff5f9e); }
    .strip-pink { background: linear-gradient(90deg, #ff5f9e, #ff8cb9); }
    .strip-emerald { background: linear-gradient(90deg, #0fb27c, #34d399); }

    /* Card Titles & Subtitles */
    .card-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 18px;
      gap: 12px;
    }

    .card-title {
      font-size: 19px;
      font-weight: 800;
      color: var(--ink);
      letter-spacing: -0.02em;
      margin: 0;
    }

    .section-sub {
      font-size: 12.5px;
      color: var(--muted);
      line-height: 1.45;
      margin: 4px 0 0;
    }

    .card-status-badge {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 99px;
      background: rgba(108, 76, 255, 0.1);
      color: #6c4cff;
      border: 1px solid rgba(108, 76, 255, 0.2);
      white-space: nowrap;
    }

    .current-rate-tag {
      font-size: 12px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 99px;
      background: rgba(15, 178, 124, 0.12);
      color: #0fb27c;
      border: 1px solid rgba(15, 178, 124, 0.25);
      white-space: nowrap;
    }

    /* Form Fields Grid */
    .settings-form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }
    }

    .setting-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .setting-item.full-span {
      grid-column: 1 / -1;
    }

    .setting-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .setting-input {
      width: 100%;
      height: 48px;
      padding: 0 16px;
      border-radius: 14px;
      border: 1.5px solid var(--border);
      background: var(--card-inner, rgba(0, 0, 0, 0.02));
      color: var(--ink);
      font-size: 15px;
      font-weight: 600;
      outline: none;
      box-sizing: border-box;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:focus {
        border-color: #6c4cff;
        background: #ffffff;
        box-shadow: 0 0 0 4px rgba(108, 76, 255, 0.12);
      }
    }

    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .eye-btn {
      background: transparent;
      border: none;
      color: #6c4cff;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 6px;

      &:hover {
        background: rgba(108, 76, 255, 0.08);
      }
    }

    .compact-hint {
      font-size: 11px;
      font-weight: 700;
      color: #0fb27c;
      background: rgba(15, 178, 124, 0.1);
      padding: 2px 7px;
      border-radius: 6px;
    }

    /* Rate Revision Form */
    .rate-change-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-bottom: 20px;
    }

    .rate-form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;

      @media (max-width: 500px) {
        grid-template-columns: 1fr;
      }
    }

    .rate-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .rate-input {
      padding-right: 36px;
    }

    .percent-adornment {
      position: absolute;
      right: 14px;
      font-weight: 700;
      color: var(--muted);
      font-size: 15px;
      pointer-events: none;
    }

    .apply-rate-btn {
      width: 100%;
      height: 48px;
      border-radius: 14px;
      border: none;
      background: linear-gradient(135deg, #6c4cff 0%, #ff5f9e 100%);
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 22px -4px rgba(108, 76, 255, 0.4);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 26px -4px rgba(108, 76, 255, 0.5);
      }

      &:active {
        transform: scale(0.98);
      }
    }

    /* Rate Timeline */
    .rate-history-section {
      border-top: 1px solid var(--border);
      padding-top: 16px;
      margin-top: 8px;
    }

    .history-section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
      margin-bottom: 12px;
    }

    .rate-timeline {
      display: flex;
      flex-direction: column;
    }

    .timeline-entry {
      display: flex;
      gap: 12px;
      min-height: 28px;
    }

    .timeline-indicator {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 14px;
    }

    .timeline-bullet {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--muted);
      margin-top: 5px;
    }

    .timeline-entry.current .timeline-bullet {
      background: #0fb27c;
      box-shadow: 0 0 8px #0fb27c;
    }

    .timeline-line {
      flex: 1;
      width: 2px;
      background: var(--border);
      margin: 4px 0;
    }

    .timeline-details {
      flex: 1;
      padding-bottom: 8px;
    }

    .timeline-top {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .timeline-rate {
      font-size: 14px;
      font-weight: 800;
      color: var(--ink);
    }

    .timeline-active-tag {
      font-size: 10px;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 99px;
      background: rgba(15, 178, 124, 0.15);
      color: #0fb27c;
    }

    /* Family Members List */
    .add-m-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #111216;
      color: #ffffff;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      flex-shrink: 0;

      &:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 16px rgba(108, 76, 255, 0.3);
      }

      &:active {
        transform: scale(0.92);
      }
    }

    .members-luxury-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .member-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 14px;
      background: var(--card-inner, rgba(0, 0, 0, 0.02));
      border: 1px solid var(--border);
      transition: all 0.2s ease;

      &:hover {
        border-color: rgba(108, 76, 255, 0.3);
        background: rgba(255, 255, 255, 0.8);
      }
    }

    .member-avatar-wrap {
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }

    .member-name-input {
      flex: 1;
      min-width: 0;
      font-size: 15px;
      font-weight: 700;
      color: var(--ink);
      border: none;
      background: transparent;
      outline: none;
      padding: 4px 0;
      letter-spacing: -0.01em;
    }

    .member-del-btn {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: var(--muted);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      flex-shrink: 0;

      &:hover {
        background: rgba(238, 77, 107, 0.12);
        color: #ee4d6b;
      }

      &:active {
        transform: scale(0.92);
      }
    }

    /* Alerts Hub */
    .alerts-badge-pill {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 99px;
      background: rgba(108, 76, 255, 0.12);
      color: #6c4cff;
      border: 1px solid rgba(108, 76, 255, 0.2);
      white-space: nowrap;
    }

    .settings-pill-tab-bar {
      display: flex;
      background: var(--card-inner, rgba(0, 0, 0, 0.04));
      padding: 4px;
      border-radius: 14px;
      gap: 4px;
      margin-bottom: 18px;
      overflow-x: auto;
    }

    .settings-pill-tab {
      flex: 1;
      min-width: fit-content;
      border: none;
      background: transparent;
      padding: 9px 14px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;

      &:hover {
        color: var(--ink);
      }
    }

    .settings-pill-tab.active {
      background: #ffffff;
      color: #111216;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .alerts-tab-content {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .daily-stat-tile {
      background: var(--card-inner, rgba(0, 0, 0, 0.02));
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .tile-stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }

    .tile-stat-row.border-top {
      border-top: 1px solid var(--border);
      padding-top: 10px;
    }

    .tile-stat-label {
      color: var(--muted);
      font-weight: 600;
    }

    .tile-stat-val {
      font-weight: 800;
      color: var(--ink);
    }

    .tile-stat-val.highlight {
      color: #ee4d6b;
    }

    .settings-preview-box {
      background: var(--card-inner, rgba(0, 0, 0, 0.02));
      border: 1px dashed var(--border);
      border-radius: 14px;
      padding: 14px;
      font-size: 12px;
    }

    .preview-header-tag {
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      display: block;
      margin-bottom: 8px;
    }

    .preview-msg-text {
      white-space: pre-wrap;
      font-family: inherit;
      margin: 0;
      line-height: 1.5;
      color: var(--ink);
      font-size: 12px;
    }

    .action-btn-row {
      display: flex;
      gap: 8px;
    }

    .settings-whatsapp-action-btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 13px 18px;
      border-radius: 14px;
      background: #25d366;
      color: #ffffff;
      font-size: 13.5px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
      box-shadow: 0 8px 20px -4px rgba(37, 211, 102, 0.4);

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 24px -4px rgba(37, 211, 102, 0.5);
      }

      &:active {
        transform: scale(0.98);
      }
    }

    .direct-chips-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 4px;
    }

    .direct-label {
      font-size: 11px;
      color: var(--muted);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .direct-phone-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(37, 211, 102, 0.1);
      color: #128c7e;
      border: 1px solid rgba(37, 211, 102, 0.25);
      padding: 6px 12px;
      border-radius: 99px;
      font-size: 11.5px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.15s ease;

      small {
        opacity: 0.75;
        font-size: 10px;
      }

      &:hover {
        background: rgba(37, 211, 102, 0.2);
        transform: translateY(-1px);
      }
    }

    /* Reminders List */
    .reminders-members-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .settings-reminder-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--card-inner, rgba(0, 0, 0, 0.02));
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 12px 16px;
    }

    .reminder-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .reminder-member-name {
      font-size: 14px;
      font-weight: 700;
      color: var(--ink);
    }

    .reminder-member-phone {
      font-size: 11px;
      color: var(--muted);
    }

    .reminder-target-text {
      font-size: 11.5px;
      color: var(--ink);
      margin-top: 2px;
    }

    .paid-check-badge {
      display: inline-flex;
      align-items: center;
      padding: 5px 12px;
      border-radius: 99px;
      background: rgba(15, 178, 124, 0.12);
      color: #0fb27c;
      font-size: 11.5px;
      font-weight: 800;
    }

    .send-remind-pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 99px;
      background: #25d366;
      color: #ffffff;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.15s ease;
      box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3);

      &:hover {
        transform: translateY(-1px);
      }

      &:active {
        transform: scale(0.96);
      }
    }

    /* Excel Section */
    .settings-excel-tile {
      background: var(--card-inner, rgba(0, 0, 0, 0.02));
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 14px 16px;
    }

    .excel-tile-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .excel-badge {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(15, 178, 124, 0.15);
      color: #0fb27c;
    }

    .excel-filename {
      font-size: 11px;
      color: var(--muted);
      font-family: ui-monospace, monospace;
    }

    .excel-table-snippet {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .snippet-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      padding: 5px 0;
      border-bottom: 1px dashed var(--border);

      &:last-child {
        border-bottom: none;
      }
    }

    .snip-name {
      font-weight: 700;
      color: var(--ink);
    }

    .snip-phone {
      color: var(--muted);
      font-size: 11px;
    }

    .snip-paid {
      color: #0fb27c;
      font-weight: 800;
    }

    .excel-button-stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .btn-download-excel,
    .btn-send-email {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 13px 18px;
      border-radius: 14px;
      font-size: 13.5px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      border: none;
    }

    .btn-download-excel {
      background: #0fb27c;
      color: #ffffff;
      box-shadow: 0 8px 20px -4px rgba(15, 178, 124, 0.4);

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 24px -4px rgba(15, 178, 124, 0.5);
      }

      &:active {
        transform: scale(0.98);
      }
    }

    .btn-send-email {
      background: var(--card-inner, rgba(0, 0, 0, 0.04));
      border: 1.5px solid var(--border);
      color: var(--ink);

      &:hover {
        background: var(--border);
        transform: translateY(-1px);
      }

      &:active {
        transform: scale(0.98);
      }
    }

    /* Quick Test Action Buttons */
    .quick-test-actions-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }

    .quick-test-btn {
      flex: 1;
      min-width: 170px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      border: 1.5px solid transparent;
      transition: all 0.2s ease;

      &:active {
        transform: scale(0.97);
      }
    }

    .quick-test-btn.push-btn {
      background: rgba(99, 102, 241, 0.12);
      color: #6366f1;
      border-color: rgba(99, 102, 241, 0.25);

      &:hover {
        background: rgba(99, 102, 241, 0.18);
      }
    }

    .quick-test-btn.sms-btn {
      background: rgba(16, 185, 129, 0.12);
      color: #10b981;
      border-color: rgba(16, 185, 129, 0.25);

      &:hover {
        background: rgba(16, 185, 129, 0.18);
      }
    }

    .quick-feedback-note {
      margin-top: 8px;
      padding: 9px 12px;
      border-radius: 10px;
      font-size: 11.5px;
      font-weight: 600;
      line-height: 1.4;
      background: rgba(238, 77, 107, 0.1);
      color: #ee4d6b;
      border: 1px solid rgba(238, 77, 107, 0.2);

      &.success {
        background: rgba(15, 178, 124, 0.1);
        color: #0fb27c;
        border-color: rgba(15, 178, 124, 0.25);
      }
    }

    /* Sub-panels in Push & SMS Hub */
    .settings-sub-panel {
      background: var(--card-inner, rgba(0, 0, 0, 0.03));
      border: 1.5px solid var(--border);
      border-radius: 18px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .sub-panel-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .panel-icon-wrap {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      flex-shrink: 0;

      &.push-icon {
        background: rgba(99, 102, 241, 0.12);
        color: #6366f1;
      }

      &.sms-icon {
        background: rgba(16, 185, 129, 0.12);
        color: #10b981;
      }
    }

    .sub-panel-text {
      flex: 1;
      min-width: 0;
    }

    .sub-panel-title {
      font-size: 14px;
      font-weight: 800;
      color: var(--ink);
      margin: 0 0 3px 0;
      letter-spacing: -0.01em;
    }

    .sub-panel-desc {
      font-size: 11.5px;
      color: var(--muted);
      margin: 0;
      line-height: 1.4;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      background: rgba(245, 159, 0, 0.12);
      color: #f59f00;
      border: 1px solid rgba(245, 159, 0, 0.25);

      &.granted {
        background: rgba(16, 185, 129, 0.12);
        color: #10b981;
        border-color: rgba(16, 185, 129, 0.25);
      }

      &.denied {
        background: rgba(238, 77, 107, 0.12);
        color: #ee4d6b;
        border-color: rgba(238, 77, 107, 0.25);
      }
    }

    .panel-action-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .panel-btn {
      flex: 1;
      min-width: 170px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
      border: 1.5px solid transparent;

      &:active {
        transform: scale(0.98);
      }
    }

    .enable-push-btn {
      background: #6366f1;
      color: #ffffff;
      box-shadow: 0 6px 16px -3px rgba(99, 102, 241, 0.4);

      &:hover {
        background: #4f46e5;
      }
    }

    .test-push-btn {
      background: rgba(99, 102, 241, 0.1);
      color: #6366f1;
      border-color: rgba(99, 102, 241, 0.3);

      &:hover {
        background: rgba(99, 102, 241, 0.16);
      }
    }

    .test-sms-btn {
      background: #10b981;
      color: #ffffff;
      box-shadow: 0 6px 16px -3px rgba(16, 185, 129, 0.4);

      &:hover {
        background: #059669;
      }
    }

    .whatsapp-direct-btn {
      background: rgba(37, 211, 102, 0.1);
      color: #128c7e;
      border-color: rgba(37, 211, 102, 0.3);

      &:hover {
        background: rgba(37, 211, 102, 0.16);
      }
    }

    .sms-input-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .sms-label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .sms-input-label {
      font-size: 11.5px;
      font-weight: 700;
      color: var(--ink);
    }

    .get-key-link {
      font-size: 11px;
      font-weight: 700;
      color: #6366f1;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    .sms-key-field {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 14px;
      border-radius: 11px;
      border: 1.5px solid var(--border);
      background: var(--card, #ffffff);
      color: var(--ink);
      font-size: 12.5px;
      font-family: inherit;
      outline: none;
      transition: all 0.2s ease;

      &:focus {
        border-color: #10b981;
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
      }
    }

    .sms-helper-text {
      font-size: 10.5px;
      color: var(--muted);
      line-height: 1.35;
    }

    .push-status-note,
    .sms-status-note {
      padding: 10px 14px;
      border-radius: 11px;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.4;
      background: rgba(238, 77, 107, 0.1);
      color: #ee4d6b;
      border: 1px solid rgba(238, 77, 107, 0.2);

      &.success {
        background: rgba(16, 185, 129, 0.1);
        color: #059669;
        border-color: rgba(16, 185, 129, 0.25);
      }
    }

    /* WOW 5-Min Hub Styles */
    .wow-sub-panel {
      border-color: rgba(108, 76, 255, 0.22);
      background: linear-gradient(180deg, rgba(108, 76, 255, 0.03) 0%, rgba(0, 0, 0, 0.02) 100%);
    }

    .wow-icon {
      background: linear-gradient(135deg, rgba(108, 76, 255, 0.2) 0%, rgba(255, 95, 158, 0.2) 100%);
    }

    .wow-card-viewer {
      background: var(--card, #ffffff);
      border: 1px solid var(--line-strong, rgba(0, 0, 0, 0.08));
      border-radius: 16px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
    }

    .wow-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .wow-badge {
      font-size: 11px;
      font-weight: 800;
      color: #6c4cff;
      background: rgba(108, 76, 255, 0.1);
      padding: 3px 8px;
      border-radius: 99px;
      letter-spacing: 0.02em;
    }

    .wow-target-hint {
      font-size: 11px;
      color: var(--muted);
      font-weight: 600;
    }

    .wow-headline {
      font-size: 14px;
      font-weight: 800;
      color: var(--ink);
      margin: 0;
      line-height: 1.35;
    }

    .wow-body-text {
      font-size: 12.5px;
      color: var(--ink-secondary, #4b4c52);
      margin: 0;
      line-height: 1.45;
    }

    .wow-nav-controls {
      display: flex;
      gap: 6px;
      margin-top: 4px;
    }

    .wow-nav-btn {
      flex: 1;
      height: 32px;
      border-radius: 8px;
      background: var(--bg, #f2f3f6);
      border: 1px solid var(--line, rgba(0, 0, 0, 0.06));
      color: var(--ink);
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: background 0.15s ease;

      &:hover {
        background: #e5e7eb;
      }

      &.random-btn {
        background: rgba(108, 76, 255, 0.08);
        color: #6c4cff;
      }
    }

    .interval-selection-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 4px;
    }

    .interval-label {
      font-size: 11.5px;
      font-weight: 700;
      color: var(--muted);
    }

    .interval-pill-group {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .interval-pill {
      border: 1px solid var(--line-strong, rgba(0, 0, 0, 0.08));
      background: var(--bg, #f2f3f6);
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 99px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        color: var(--ink);
      }

      &.active {
        background: var(--ink);
        color: #ffffff;
        border-color: var(--ink);
      }

      &.demo-pill.active {
        background: #f59e0b;
        border-color: #f59e0b;
        color: #ffffff;
      }
    }

    .wow-loop-btn {
      background: linear-gradient(135deg, #6c4cff 0%, #4f35ff 100%);
      color: #ffffff;
      box-shadow: 0 6px 16px -3px rgba(108, 76, 255, 0.4);

      &.active-loop {
        background: #ef4444;
        box-shadow: 0 6px 16px -3px rgba(239, 68, 68, 0.4);
      }
    }

    /* Warning Card */
    .alert-warning-card {
      background: rgba(245, 159, 0, 0.12);
      border: 1px solid #f59f00;
      border-radius: var(--radius-tile, 16px);
      padding: 14px;
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      color: var(--ink);
    }

    .alert-icon { font-size: 24px; }
    .alert-content p { font-size: 12px; margin: 4px 0 0; }

    /* Keyframes */
    @keyframes laserSpin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    @keyframes nebulaMorph1 {
      0% { transform: scale(1) translate(0, 0); opacity: 0.3; }
      50% { transform: scale(1.15) translate(-10px, 15px); opacity: 0.45; }
      100% { transform: scale(0.95) translate(15px, -10px); opacity: 0.3; }
    }

    @keyframes nebulaMorph2 {
      0% { transform: scale(1) translate(0, 0); opacity: 0.25; }
      50% { transform: scale(1.2) translate(15px, -12px); opacity: 0.42; }
      100% { transform: scale(0.9) translate(-10px, 8px); opacity: 0.25; }
    }

    @keyframes particleRise {
      0% { transform: translateY(0) scale(0.8); opacity: 0; }
      20% { opacity: 0.8; }
      80% { opacity: 0.6; }
      100% { transform: translateY(-160px) scale(1.4); opacity: 0; }
    }

    @keyframes shimmerSweep {
      0% { transform: translate(-30%, -30%); }
      50% { transform: translate(15%, 15%); }
      100% { transform: translate(-30%, -30%); }
    }

    @keyframes heroCardEntrance {
      0% { opacity: 0; transform: translateY(12px) scale(0.98); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }

    @keyframes cinematicSlideDown {
      0% { opacity: 0; transform: translateY(-8px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    @keyframes orbDrift1 {
      0% { transform: translate(0, 0) scale(1); }
      100% { transform: translate(30px, 40px) scale(1.1); }
    }

    @keyframes orbDrift2 {
      0% { transform: translate(0, 0) scale(1); }
      100% { transform: translate(-35px, 25px) scale(1.08); }
    }

    @keyframes orbDrift3 {
      0% { transform: translate(0, 0) scale(1); }
      100% { transform: translate(25px, -30px) scale(1.12); }
    }

    @keyframes orbDrift4 {
      0% { transform: translate(0, 0) scale(1); }
      100% { transform: translate(-20px, -25px) scale(1.06); }
    }

    @keyframes waveFloat {
      0% { transform: translateX(0); }
      100% { transform: translateX(-40px); }
    }
  `,
})
export class SettingsComponent {
  readonly ledgerStore = inject(LedgerStore);
  readonly userProfile = inject(UserProfileStore);
  readonly settings = inject(SettingsStore);
  readonly pushService = inject(PushNotificationService);
  private readonly repo = inject(FirestoreLedgerRepository);

  readonly formatPaise = formatPaise;
  readonly formatCompactPaise = formatCompactPaise;
  readonly toRupees = toRupees;
  readonly toPaise = toPaise;
  readonly ZERO_PAISE = ZERO_PAISE;

  readonly loan = this.ledgerStore.loan;

  newRateInput: number | null = null;
  rateEffectiveDate = new Date().toISOString().slice(0, 10);
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private memberNameTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private focusedMoneyField = signal<'sanctionedLimit' | 'currentOutstanding' | 'monthlyTarget' | null>(null);
  private moneyFieldRaw = new Map<'sanctionedLimit' | 'currentOutstanding' | 'monthlyTarget', string>();

  readonly memberToDelete = signal<Member | null>(null);
  readonly isDeleteConfirmOpen = signal(false);

  readonly alertsTab = signal<'daily' | 'monthly' | 'annual' | 'push_sms'>('daily');

  // Push & SMS state
  readonly isTestingPush = signal(false);
  readonly pushTestStatus = signal<string | null>(null);

  readonly smsConfig = signal<SmsGatewayConfig>(loadLocalSmsConfig());
  readonly isSendingSms = signal(false);
  readonly smsStatusMessage = signal<string | null>(null);
  readonly smsTargetPhone = signal('8105242578');

  private lastHapticTime = 0;

  selectAlertsTab(tab: 'daily' | 'monthly' | 'annual' | 'push_sms'): void {
    const now = Date.now();
    if (now - this.lastHapticTime > 60) {
      this.lastHapticTime = now;
      triggerHaptic('selection');
    }
    this.alertsTab.set(tab);
  }

  async triggerTestPush(): Promise<void> {
    this.isTestingPush.set(true);
    triggerHaptic('medium');
    const res = await this.pushService.sendLocalTestNotification(
      '🏦 SBI Home Loan Daily Update',
      `Today's Interest: +${this.formatPaise(this.dailyInterest())} | Total Balance: ${this.formatPaise(this.effectiveTodayBalance())}. Lock-screen banner active on your iPhone!`
    );
    this.pushTestStatus.set(res.message);
    this.isTestingPush.set(false);
  }

  async triggerEnablePush(): Promise<void> {
    triggerHaptic('selection');
    const res = await this.pushService.requestPermissionAndSubscribe('mem-vishwas', '8105242578');
    this.pushTestStatus.set(res.message);
  }

  async triggerTestSms(): Promise<void> {
    this.isSendingSms.set(true);
    triggerHaptic('medium');
    const msg = buildDailyInterestSms(this.ledgerStore.ledgerState());
    const res = await dispatchSms(this.smsTargetPhone(), msg, this.smsConfig());
    this.smsStatusMessage.set(res.message);
    this.isSendingSms.set(false);
  }

  onSmsApiKeyInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const key = input.value.trim();
    const updated: SmsGatewayConfig = { ...this.smsConfig(), fast2smsApiKey: key };
    this.smsConfig.set(updated);
    saveLocalSmsConfig(updated);
    void this.repo.saveSmsConfig({ fast2smsApiKey: key, updatedAt: new Date().toISOString() });
  }

  readonly dailyInterest = computed<Paise>(() => {
    const loan = this.ledgerStore.loan();
    const principal = this.ledgerStore.currentPrincipal();
    const basisDays = loan.bankRules?.dayCountBasis === '360' ? 360 : 365;
    return computeDailyInterest(principal, loan.currentRateBps, basisDays);
  });

  readonly effectiveTodayBalance = computed<Paise>(() => {
    return paise(this.ledgerStore.currentPrincipal() + this.dailyInterest());
  });

  readonly dailyMessage = computed(() => {
    return buildDailyInterestBroadcast(this.ledgerStore.ledgerState());
  });

  readonly annualEmailUrl = computed(() => {
    return buildAnnualReportMailtoUrl(this.ledgerStore.ledgerState());
  });

  getMember(memberId: string): Member | undefined {
    return this.ledgerStore.activeMembers().find((m) => m.id === memberId);
  }

  getMemberDue(m: MemberStatistics): Paise {
    if (!m.target) return paise(0);
    return paise(Math.max(0, m.target - m.thisMonthContribution));
  }

  getMemberDailyWhatsApp(member: Member): string {
    return buildDailyInterestBroadcast(this.ledgerStore.ledgerState(), member.phone).whatsappUrl;
  }

  getMonthlyReminderWhatsApp(member?: Member): string {
    if (!member) return '';
    return buildMonthlyDueReminder(member, this.ledgerStore.ledgerState()).whatsappUrl;
  }

  readonly wowStatements = WOW_STATEMENTS;
  readonly targetFamilyMembers = TARGET_FAMILY_PHONE_NUMBERS;
  readonly isSendingWowPush = signal(false);
  readonly selectedLoopInterval = signal<number>(5);

  currentWowStatement(): WowStatement {
    return this.pushService.getCurrentWowStatement();
  }

  nextWowStatement(): void {
    triggerHaptic('light');
    this.pushService.nextWowStatement();
  }

  prevWowStatement(): void {
    triggerHaptic('light');
    this.pushService.prevWowStatement();
  }

  randomWowStatement(): void {
    triggerHaptic('selection');
    const randomIdx = Math.floor(Math.random() * WOW_STATEMENTS.length);
    this.pushService.setWowStatementIndex(randomIdx);
  }

  async triggerCurrentWowPush(): Promise<void> {
    this.isSendingWowPush.set(true);
    triggerHaptic('medium');
    const res = await this.pushService.sendWowNotification();
    this.pushTestStatus.set(res.message);
    this.isSendingWowPush.set(false);
  }

  toggleFiveMinAutoLoop(): void {
    triggerHaptic('selection');
    if (this.pushService.isFiveMinTimerActive()) {
      this.pushService.stopFiveMinuteTimer();
    } else {
      this.pushService.startFiveMinuteTimer(this.selectedLoopInterval());
    }
  }

  setLoopInterval(minutes: number): void {
    triggerHaptic('selection');
    this.selectedLoopInterval.set(minutes);
    if (this.pushService.isFiveMinTimerActive()) {
      this.pushService.startFiveMinuteTimer(minutes);
    }
  }

  getWowWhatsAppUrl(phone: string, statement: WowStatement): string {
    const text = `${statement.title}\n\n${statement.body}\n\nLive Tracker: https://vishwascpatil.github.io/sbi-home-loan/`;
    const clean = phone.replace(/\D/g, '');
    const phoneParam = clean.startsWith('91') ? clean : `91${clean}`;
    return `https://wa.me/${phoneParam}?text=${encodeURIComponent(text)}`;
  }

  downloadExcel(): void {
    const blob = generateAnnualExcelSpreadsheet(this.ledgerStore.ledgerState());
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SBI-Home-Loan-Annual-Report-Nov-${new Date().getFullYear()}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  readonly nonDeletedMembers = computed(() => {
    return this.ledgerStore.members().filter((m) => !m.deletedAt);
  });

  readonly rateHistory = computed(() => {
    return [...this.ledgerStore.rateChanges()]
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.createdAt.localeCompare(a.createdAt));
  });

  formatRupeesWithCommas(p: Paise | null | undefined): string {
    if (p === undefined || p === null) return '0';
    const isNegative = p < 0;
    const absPaise = Math.abs(p);
    const rupees = Math.floor(absPaise / 100);
    const paiseRem = absPaise % 100;
    let formatted = rupees.toLocaleString('en-IN');
    if (paiseRem > 0) {
      formatted += '.' + paiseRem.toString().padStart(2, '0');
    }
    return isNegative ? `-${formatted}` : formatted;
  }

  getMoneyParamDisplay(key: 'sanctionedLimit' | 'currentOutstanding' | 'monthlyTarget'): string {
    if (this.focusedMoneyField() === key && this.moneyFieldRaw.has(key)) {
      return this.moneyFieldRaw.get(key)!;
    }
    if (key === 'currentOutstanding') {
      return this.formatRupeesWithCommas(this.ledgerStore.currentOutstanding());
    }
    return this.formatRupeesWithCommas(this.loan()[key]);
  }

  onMoneyParamFocus(key: 'sanctionedLimit' | 'currentOutstanding' | 'monthlyTarget'): void {
    this.focusedMoneyField.set(key);
  }

  onMoneyParamInput(
    key: 'sanctionedLimit' | 'currentOutstanding' | 'monthlyTarget',
    event: Event
  ): void {
    this.focusedMoneyField.set(key);
    const input = event.target as HTMLInputElement;
    const raw = input.value;
    this.moneyFieldRaw.set(key, raw);

    const clean = raw.replace(/,/g, '').trim();
    if (!clean) return;
    const num = parseFloat(clean);
    if (isNaN(num) || num < 0) return;

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(async () => {
      if (key === 'currentOutstanding') {
        await this.ledgerStore.setCurrentOutstanding(toPaise(clean));
      } else {
        await this.ledgerStore.updateLoanDetails({ [key]: toPaise(clean) });
      }
    }, 450);
  }

  onMoneyParamBlur(
    key: 'sanctionedLimit' | 'currentOutstanding' | 'monthlyTarget',
    event: Event
  ): void {
    this.focusedMoneyField.set(null);
    const input = event.target as HTMLInputElement;
    const clean = input.value.replace(/,/g, '').trim();
    this.moneyFieldRaw.delete(key);

    if (clean) {
      const num = parseFloat(clean);
      if (!isNaN(num) && num >= 0) {
        if (this.saveTimeout) {
          clearTimeout(this.saveTimeout);
          this.saveTimeout = null;
        }
        const savePromise = key === 'currentOutstanding'
          ? this.ledgerStore.setCurrentOutstanding(toPaise(clean))
          : this.ledgerStore.updateLoanDetails({ [key]: toPaise(clean) });
        void savePromise.then(() => {
          const displayVal = key === 'currentOutstanding'
            ? this.ledgerStore.currentOutstanding()
            : this.loan()[key];
          input.value = this.formatRupeesWithCommas(displayVal);
        });
        return;
      }
    }
    const displayVal = key === 'currentOutstanding'
      ? this.ledgerStore.currentOutstanding()
      : this.loan()[key];
    input.value = this.formatRupeesWithCommas(displayVal);
  }

  async updateLoanParam(key: string, value: unknown): Promise<void> {
    await this.ledgerStore.updateLoanDetails({ [key]: value });
  }

  async applyRateChange(): Promise<void> {
    if (!this.newRateInput || this.newRateInput <= 0) {
      return;
    }
    const rateBps = Math.round(this.newRateInput * 100);
    await this.ledgerStore.updateRate(rateBps, this.rateEffectiveDate, 'Bank interest rate revision');
    this.newRateInput = null;
  }

  async addNewMemberPrompt(): Promise<void> {
    const count = this.nonDeletedMembers().length + 1;
    await this.ledgerStore.addMember(`Member ${count}`, toPaise(10000));
  }

  renameMember(id: string, name: string): void {
    const existing = this.memberNameTimeouts.get(id);
    if (existing) clearTimeout(existing);

    const t = setTimeout(async () => {
      if (!name || !name.trim()) return;
      await this.ledgerStore.updateMember(id, { name: name.trim() });
      this.memberNameTimeouts.delete(id);
    }, 450);
    this.memberNameTimeouts.set(id, t);
  }

  confirmDeleteMember(m: Member): void {
    this.memberToDelete.set(m);
    this.isDeleteConfirmOpen.set(true);
  }

  async executeDeleteMember(): Promise<void> {
    const m = this.memberToDelete();
    if (!m) return;
    await this.ledgerStore.deleteMember(m.id);
    this.isDeleteConfirmOpen.set(false);
    this.memberToDelete.set(null);
  }
}

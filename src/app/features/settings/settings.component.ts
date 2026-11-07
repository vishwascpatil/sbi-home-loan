import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LedgerStore, SettingsStore, UserProfileStore } from '../../core/state';
import {
  AvatarComponent,
  ConfirmSheetComponent,
  GlassCardComponent,
} from '../../shared/ui';
import {
  buildAnnualReportMailtoUrl,
  buildDailyInterestBroadcast,
  buildMonthlyDueReminder,
  computeDailyInterest,
  formatCompactPaise,
  formatPaise,
  generateAnnualExcelSpreadsheet,
  Member,
  MemberStatistics,
  Paise,
  paise,
  toPaise,
  toRupees,
  ZERO_PAISE,
} from '../../core/engine';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    GlassCardComponent,
    AvatarComponent,
    ConfirmSheetComponent,
  ],
  template: `
    <div class="settings-page">
      <header class="settings-header">
        <div>
          <small class="header-sub">App & Loan Settings</small>
          <h1 class="header-title">Settings</h1>
        </div>
      </header>

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

      <!-- 0. Active Device Profile Card -->
      <app-glass-card [staggerIndex]="0">
        <div class="device-profile-card">
          <div class="device-profile-main">
            <app-avatar [name]="userProfile.currentMemberName()" [avatarUrl]="userProfile.currentMemberAvatar()" [size]="52" [circular]="true" />
            <div class="device-profile-info">
              <span class="device-profile-pill">Active on this Phone</span>
              <h2 class="device-profile-name">{{ userProfile.currentMemberName() }}</h2>
              <span class="device-profile-sub">{{ userProfile.currentMember()?.phone || 'No phone set' }}</span>
            </div>
          </div>
          <button
            type="button"
            class="switch-profile-btn"
            (click)="userProfile.openProfilePicker()"
          >
            <span>🔄</span> Switch Member
          </button>
        </div>
      </app-glass-card>

      <!-- 1. Loan Parameters Editor -->
      <app-glass-card [staggerIndex]="0">
        <h2 class="card-title">Loan Details</h2>
        <p class="section-sub">Your loan account number, approved limit, outstanding balance, and monthly target.</p>

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
              Bank Account Number
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
              class="setting-input"
              [ngModel]="loan().accountNumber"
              (ngModelChange)="updateLoanParam('accountNumber', $event)"
            />
          </div>

          <div class="setting-item">
            <label class="setting-label" for="loan-limit">
              <span>Total Loan Approved by Bank (₹)</span>
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
              <span>Outstanding Amount (₹)</span>
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

          <div class="setting-item">
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

      <!-- 2. Classic Interest Rate Update Section -->
      <app-glass-card [staggerIndex]="1">
        <h2 class="card-title">Change Interest Rate</h2>
        <p class="section-sub">Bank revisions update current and future interest without altering historical records.</p>

        <!-- Rate Revision Form (Clean - No Suggestions, No Reason) -->
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
            Apply
          </button>
        </form>

        <!-- Rate Revisions Timeline -->
        @if (rateHistory().length > 0) {
          <div class="rate-history-section">
            <div class="history-section-title">Rate History ({{ rateHistory().length }})</div>
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
                        <span class="timeline-active-tag">Active</span>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </app-glass-card>

      <!-- 3. Minimal Family Members Section -->
      <app-glass-card [staggerIndex]="2">
        <div class="card-title-row">
          <h2 class="card-title">Family Members</h2>
          <button
            type="button"
            class="add-m-btn"
            (click)="addNewMemberPrompt()"
            aria-label="Add family member"
            title="Add person"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
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
                  [size]="36"
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
            (click)="alertsTab.set('daily')"
          >
            ☀️ Daily 9 AM Interest
          </button>
          <button
            type="button"
            class="settings-pill-tab"
            [class.active]="alertsTab() === 'monthly'"
            (click)="alertsTab.set('monthly')"
          >
            🔔 1st of Month Reminders
          </button>
          <button
            type="button"
            class="settings-pill-tab"
            [class.active]="alertsTab() === 'annual'"
            (click)="alertsTab.set('annual')"
          >
            📊 Nov Excel &amp; Email
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
      padding-bottom: 96px;
    }

    .settings-header {
      margin: 8px 4px 18px;
    }

    .header-sub {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* Active Device Profile Card */
    .device-profile-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .device-profile-main {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .device-profile-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .device-profile-pill {
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #0fb27c;
      background: rgba(15, 178, 124, 0.12);
      padding: 2px 8px;
      border-radius: 99px;
      width: fit-content;
    }

    .device-profile-name {
      font-size: 19px;
      font-weight: 800;
      color: var(--ink);
      margin: 2px 0 0 0;
      letter-spacing: -0.02em;
    }

    .device-profile-sub {
      font-size: 12px;
      color: var(--muted);
    }

    .switch-profile-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 16px;
      border-radius: 99px;
      border: 1px solid rgba(108, 76, 255, 0.25);
      background: rgba(108, 76, 255, 0.08);
      color: #6c4cff;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .switch-profile-btn:hover {
      background: rgba(108, 76, 255, 0.16);
      transform: translateY(-1px);
    }

    .switch-profile-btn:active {
      transform: scale(0.96);
    }

    .header-title {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.025em;
      margin: 2px 0 0;
    }

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

    .alert-icon {
      font-size: 24px;
    }

    .alert-content p {
      font-size: 12px;
      margin-top: 4px;
      line-height: 1.4;
    }

    .card-title {
      font-size: 16px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.015em;
    }

    .card-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .section-sub {
      font-size: 13px;
      color: var(--muted);
      margin: 4px 0 16px;
      line-height: 1.4;
    }

    .settings-form-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
    }

    .setting-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
    }

    .setting-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .eye-btn {
      background: transparent;
      border: none;
      color: var(--brand-a);
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
    }

    .compact-hint {
      font-size: 11px;
      font-weight: 700;
      color: var(--brand-a);
      background: rgba(108, 76, 255, 0.08);
      padding: 1px 8px;
      border-radius: var(--radius-pill, 99px);
      text-transform: none;
      letter-spacing: normal;
    }

    .setting-input {
      width: 100%;
      max-width: 100%;
      min-width: 0;
      height: 46px;
      border-radius: var(--radius-tile, 16px);
      border: 1px solid var(--line);
      background: var(--bg);
      color: var(--ink);
      padding: 0 14px;
      font-size: 14px;
      font-weight: 700;
      outline: none;
      font-family: inherit;
      transition: border-color 0.2s ease, background 0.2s ease;
      box-sizing: border-box;
    }

    input[type='date'].setting-input {
      box-sizing: border-box;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      display: block;
      -webkit-appearance: none;
      appearance: none;
    }

    input[type='date']::-webkit-date-and-time-value {
      text-align: left;
    }

    .setting-input:focus {
      border-color: var(--brand-a);
      background: var(--card);
    }

    /* ----------------------------------------------------
       Rate Revision Form (Clean Grid)
       ---------------------------------------------------- */
    .rate-change-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: var(--bg-subtle, #f5f5f7);
      padding: 16px;
      border-radius: var(--radius-tile, 18px);
      border: 1px solid var(--line);
      width: 100%;
      box-sizing: border-box;
    }

    .rate-form-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
    }

    @media (max-width: 480px) {
      .rate-form-grid {
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
      font-size: 15px;
      font-weight: 800;
      color: var(--muted);
      pointer-events: none;
    }

    .apply-rate-btn {
      width: 100%;
      height: 44px;
      border-radius: var(--radius-pill, 99px);
      background: var(--ink);
      color: var(--card);
      border: none;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 4px;
      box-shadow: 0 3px 12px rgba(0, 0, 0, 0.1);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .apply-rate-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(17, 18, 22, 0.24);
    }

    .apply-rate-btn:active {
      transform: scale(0.97);
    }

    /* ----------------------------------------------------
       Rate Timeline
       ---------------------------------------------------- */
    .rate-history-section {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
    }

    .history-section-title {
      font-size: 12px;
      font-weight: 800;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
    }

    .rate-timeline {
      display: flex;
      flex-direction: column;
      gap: 0;
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
      background: #10b981;
      box-shadow: 0 0 6px #10b981;
    }

    .timeline-line {
      flex: 1;
      width: 2px;
      background: var(--line);
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
      padding: 1px 6px;
      border-radius: var(--radius-pill, 99px);
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
    }

    /* ----------------------------------------------------
       Family Members Section (Minimal & Clean)
       ---------------------------------------------------- */
    .add-m-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--ink);
      color: var(--card);
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      flex-shrink: 0;
    }

    .add-m-btn:hover {
      opacity: 0.9;
      transform: scale(1.06);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .add-m-btn:active {
      transform: scale(0.92);
    }

    .members-luxury-list {
      display: flex;
      flex-direction: column;
    }

    .member-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--line);
      transition: opacity 0.2s ease;
    }

    .member-row:last-child {
      border-bottom: none;
      padding-bottom: 2px;
    }

    .member-row:first-child {
      padding-top: 4px;
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
      font-weight: 600;
      color: var(--ink);
      border: none;
      background: transparent;
      outline: none;
      padding: 4px 0;
      letter-spacing: -0.01em;
      transition: border-color 0.2s ease;
    }

    .member-name-input:focus {
      border-bottom: 1.5px solid var(--ink);
    }

    /* Modern SVG Trash Button */
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
    }

    .member-del-btn:hover {
      background: rgba(238, 77, 107, 0.12);
      color: #ee4d6b;
    }

    .member-del-btn:active {
      transform: scale(0.92);
    }

    /* Family Alerts & Notifications Hub Styles */
    .card-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 14px;
      gap: 12px;
    }

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
      background: var(--bg-alt, rgba(0, 0, 0, 0.04));
      padding: 4px;
      border-radius: 12px;
      gap: 4px;
      margin-bottom: 18px;
      overflow-x: auto;
    }

    .settings-pill-tab {
      flex: 1;
      min-width: fit-content;
      border: none;
      background: transparent;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    .settings-pill-tab.active {
      background: var(--card);
      color: var(--ink);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
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
      font-weight: 500;
    }

    .tile-stat-val {
      font-weight: 700;
      color: var(--ink);
    }

    .tile-stat-val.highlight {
      color: #ee4d6b;
    }

    .settings-preview-box {
      background: var(--card-inner, rgba(0, 0, 0, 0.02));
      border: 1px dashed var(--border);
      border-radius: 14px;
      padding: 12px 14px;
      font-size: 12px;
    }

    .preview-header-tag {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      display: block;
      margin-bottom: 6px;
    }

    .preview-msg-text {
      white-space: pre-wrap;
      font-family: inherit;
      margin: 0;
      line-height: 1.45;
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
      padding: 11px 16px;
      border-radius: 12px;
      background: #25d366;
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: transform 0.15s ease, filter 0.15s ease;
      cursor: pointer;
    }

    .settings-whatsapp-action-btn:hover {
      filter: brightness(1.05);
      transform: translateY(-1px);
    }

    .settings-whatsapp-action-btn:active {
      transform: scale(0.98);
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
      font-weight: 600;
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
      gap: 4px;
      background: rgba(37, 211, 102, 0.1);
      color: #128c7e;
      border: 1px solid rgba(37, 211, 102, 0.25);
      padding: 5px 10px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.15s ease;
    }

    .direct-phone-chip small {
      opacity: 0.8;
      font-size: 10px;
    }

    .direct-phone-chip:hover {
      background: rgba(37, 211, 102, 0.2);
      transform: translateY(-1px);
    }

    /* Reminders List */
    .reminders-members-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .settings-reminder-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--card-inner, rgba(0, 0, 0, 0.02));
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 10px 14px;
    }

    .reminder-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .reminder-member-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--ink);
    }

    .reminder-member-phone {
      font-size: 11px;
      color: var(--muted);
    }

    .reminder-target-text {
      font-size: 11px;
      color: var(--ink);
      margin-top: 2px;
    }

    .paid-check-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 99px;
      background: rgba(15, 178, 124, 0.12);
      color: #0fb27c;
      font-size: 11px;
      font-weight: 700;
    }

    .send-remind-pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 12px;
      border-radius: 99px;
      background: #25d366;
      color: #ffffff;
      font-size: 11px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.15s ease;
    }

    .send-remind-pill-btn:hover {
      filter: brightness(1.05);
      transform: translateY(-1px);
    }

    /* Excel Section */
    .settings-excel-tile {
      background: var(--card-inner, rgba(0, 0, 0, 0.02));
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 12px 14px;
    }

    .excel-tile-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .excel-badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(15, 178, 124, 0.15);
      color: #0fb27c;
    }

    .excel-filename {
      font-size: 11px;
      color: var(--muted);
      font-family: monospace;
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
      padding: 4px 0;
      border-bottom: 1px dashed var(--border);
    }

    .snippet-row:last-child {
      border-bottom: none;
    }

    .snip-name {
      font-weight: 600;
      color: var(--ink);
    }

    .snip-phone {
      color: var(--muted);
      font-size: 11px;
    }

    .snip-paid {
      color: #0fb27c;
    }

    .excel-button-stack {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .btn-download-excel,
    .btn-send-email {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 11px 16px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.15s ease;
      border: none;
    }

    .btn-download-excel {
      background: #0fb27c;
      color: #ffffff;
    }

    .btn-download-excel:hover {
      filter: brightness(1.05);
      transform: translateY(-1px);
    }

    .btn-send-email {
      background: var(--card-inner, rgba(0, 0, 0, 0.05));
      border: 1px solid var(--border);
      color: var(--ink);
    }

    .btn-send-email:hover {
      background: var(--border);
      transform: translateY(-1px);
    }
  `,
})
export class SettingsComponent {
  readonly ledgerStore = inject(LedgerStore);
  readonly userProfile = inject(UserProfileStore);
  readonly settings = inject(SettingsStore);

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

  readonly alertsTab = signal<'daily' | 'monthly' | 'annual'>('daily');

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

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LedgerStore, NotificationsStore, SettingsStore } from '../../core/state';
import {
  ConfirmSheetComponent,
  GlassCardComponent,
  SegmentedControlComponent,
  SegmentOption,
  ToastService,
} from '../../shared/ui';
import {
  CalculationMethod,
  DayCountBasis,
  DebitFrequency,
  formatPaise,
  Member,
  monthlySummary,
  Paise,
  paise,
  subPaise,
  toPaise,
  toRupees,
} from '../../core/engine';
import { DailyLedgerSheetComponent } from '../daily-ledger/daily-ledger-sheet.component';
import { ReconciliationWizardComponent } from '../reconciliation/reconciliation-wizard.component';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    GlassCardComponent,
    SegmentedControlComponent,
    ConfirmSheetComponent,
    DailyLedgerSheetComponent,
    ReconciliationWizardComponent,
  ],
  template: `
    <div class="settings-page">
      <header class="settings-header">
        <div>
          <small class="header-sub">Preferences & Parameters</small>
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

      <!-- Loan Parameters Editor -->
      <app-glass-card [staggerIndex]="0">
        <h2 class="card-title">Loan Parameters</h2>
        <p class="section-sub">Configure account details and target thresholds.</p>

        <div class="settings-form-grid">
          <div class="setting-item">
            <label class="setting-label" for="loan-type">Loan Type</label>
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
              Account Number
              <button
                type="button"
                class="eye-btn"
                (click)="settings.toggleMaskAccountNumber()"
              >
                {{ settings.maskAccountNumber() ? '👁️ Reveal' : '🔒 Mask' }}
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
            <label class="setting-label" for="loan-limit">Sanctioned Limit (₹)</label>
            <input
              id="loan-limit"
              type="number"
              class="setting-input tabular-nums"
              [ngModel]="toRupees(loan().sanctionedLimit)"
              (ngModelChange)="updateLoanParam('sanctionedLimit', toPaise($event))"
            />
          </div>

          <div class="setting-item">
            <label class="setting-label" for="loan-target">Monthly Repayment Target (₹)</label>
            <input
              id="loan-target"
              type="number"
              class="setting-input tabular-nums"
              [ngModel]="toRupees(loan().monthlyTarget)"
              (ngModelChange)="updateLoanParam('monthlyTarget', toPaise($event))"
            />
          </div>
        </div>
      </app-glass-card>

      <!-- Interest Rate Update Section -->
      <app-glass-card [staggerIndex]="1">
        <h2 class="card-title">Update Interest Rate</h2>
        <p class="section-sub">
          Current rate is <strong>{{ (loan().currentRateBps / 100).toFixed(2) }}%</strong>.
          Updates append a dated rate change to the ledger.
        </p>

        <form class="rate-change-form" (ngSubmit)="applyRateChange()">
          <div class="setting-row">
            <div class="setting-item" style="flex: 1">
              <label class="setting-label" for="new-rate">New Annual Rate (%)</label>
              <input
                id="new-rate"
                type="number"
                step="0.05"
                class="setting-input tabular-nums"
                placeholder="e.g. 7.90"
                [(ngModel)]="newRateInput"
                name="newRate"
                required
              />
            </div>

            <div class="setting-item" style="flex: 1">
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
            Record Rate Change
          </button>
        </form>
      </app-glass-card>

      <!-- Reconciliation & Period Locking Section -->
      <app-glass-card [staggerIndex]="2">
        <div class="card-title-row">
          <h2 class="card-title">Reconciliation & Period Locking</h2>
          <span
            class="status-badge"
            [class.reconciled]="isCurrentMonthReconciled()"
            [class.estimated]="!isCurrentMonthReconciled()"
          >
            {{ isCurrentMonthReconciled() ? '✓ Reconciled' : 'Estimated' }}
          </span>
        </div>
        <p class="section-sub">
          Computed balance: <strong>{{ formatPaise(ledgerStore.currentOutstanding()) }}</strong>.
          Locked until period: <strong>{{ loan().lockedUntilPeriod || 'None (Open)' }}</strong>.
        </p>

        <div class="reconcile-actions-grid">
          <button type="button" class="wizard-launch-btn" (click)="isReconciliationOpen.set(true)">
            ⚖️ Launch Reconciliation Wizard
          </button>
        </div>

        <div class="close-month-box" style="margin-top: 14px">
          <div class="setting-row">
            <div class="setting-item" style="flex: 1">
              <label class="setting-label" for="close-period-select">Period to Finalize</label>
              <input
                id="close-period-select"
                type="month"
                class="setting-input"
                [(ngModel)]="periodToClose"
              />
            </div>
            <div style="display: flex; align-items: flex-end;">
              <button
                type="button"
                class="close-period-btn"
                (click)="triggerMonthClose()"
              >
                🔒 Close & Lock
              </button>
            </div>
          </div>
        </div>
      </app-glass-card>

      <!-- Member Management -->
      <app-glass-card [staggerIndex]="3">
        <div class="card-title-row">
          <h2 class="card-title">Members Management</h2>
          <button type="button" class="add-m-btn" (click)="addNewMemberPrompt()">
            ＋ Add Member
          </button>
        </div>

        <div class="members-edit-list">
          @for (m of ledgerStore.members(); track m.id) {
            <div class="member-edit-item">
              <input
                type="text"
                class="member-name-input"
                [ngModel]="m.name"
                (ngModelChange)="renameMember(m.id, $event)"
                aria-label="Member name"
              />
              <button
                type="button"
                class="toggle-status-btn"
                [class.active]="m.active"
                (click)="toggleMemberActive(m)"
              >
                {{ m.active ? 'Active' : 'Inactive' }}
              </button>
            </div>
          }
        </div>
      </app-glass-card>

      <!-- Appearance & Calculation Method -->
      <app-glass-card [staggerIndex]="4">
        <h2 class="card-title">Preferences</h2>

        <div class="setting-group" style="margin-top: 14px">
          <span class="setting-label" id="theme-label">Theme</span>
          <app-segmented-control
            [options]="themeOptions"
            [selectedValue]="settings.theme()"
            (changed)="settings.setTheme($event)"
          />
        </div>

        <div class="setting-group" style="margin-top: 16px">
          <span class="setting-label" id="method-label">Interest Engine</span>
          <app-segmented-control
            [options]="methodOptions"
            [selectedValue]="loan().calculationMethod"
            (changed)="updateCalculationMethod($event)"
          />
        </div>
      </app-glass-card>

      <!-- Bank Rules Settings (Day-Count & Accrual Rules) -->
      <app-glass-card [staggerIndex]="5">
        <div class="card-title-row">
          <h2 class="card-title">Bank Rules & Day-Count Basis</h2>
          <button type="button" class="view-ledger-pill-btn" (click)="isDailyLedgerOpen.set(true)">
            📊 View Daily Ledger
          </button>
        </div>
        <p class="section-sub">Bank calculation conventions for Overdraft (OD) interest accrual.</p>

        <div class="setting-group" style="margin-top: 14px">
          <span class="setting-label">Day-Count Basis</span>
          <app-segmented-control
            [options]="dayCountOptions"
            [selectedValue]="loan().bankRules?.dayCountBasis || 'actual/365'"
            (changed)="updateDayCountBasis($any($event))"
          />
        </div>

        <div class="setting-group" style="margin-top: 16px">
          <span class="setting-label">Interest Debit Frequency</span>
          <app-segmented-control
            [options]="debitFreqOptions"
            [selectedValue]="loan().bankRules?.debitFrequency || 'monthlyLastDay'"
            (changed)="updateDebitFrequency($any($event))"
          />
        </div>

        <div class="checkbox-setting-row" style="margin-top: 16px">
          <label class="checkbox-label" for="capitalise-interest">
            <input
              id="capitalise-interest"
              type="checkbox"
              class="setting-checkbox"
              [ngModel]="loan().bankRules?.isCapitalised ?? true"
              (ngModelChange)="toggleCapitalisation($event)"
            />
            <span>Capitalise debited interest into outstanding principal</span>
          </label>
        </div>

        <div class="info-note-box" style="margin-top: 14px">
          <span class="note-icon">ℹ️</span>
          <div class="note-text">
            <strong>Value Date & Fixed-Point Accrual:</strong>
            Transactions take effect from their recorded <code>valueDate</code> (or transaction date).
            Accrual runs on unrounded fixed-point BigInt (scale 10⁶ paise) daily, rounding half-up only when interest is debited to the account.
          </div>
        </div>
      </app-glass-card>

      <!-- Estimated vs Bank-Actual Interest Variance -->
      <app-glass-card [staggerIndex]="6">
        <h2 class="card-title">Interest Verification & Variance</h2>
        <p class="section-sub">Compare ledger computed interest with bank passbook debits.</p>

        <div class="reconcile-interest-form">
          <div class="setting-row">
            <div class="setting-item" style="flex: 1">
              <label class="setting-label" for="verify-period">Period (Month)</label>
              <input
                id="verify-period"
                type="month"
                class="setting-input"
                [(ngModel)]="verificationPeriod"
              />
            </div>
            <div class="setting-item" style="flex: 1">
              <label class="setting-label" for="actual-interest-input">Actual Bank Debit (₹)</label>
              <input
                id="actual-interest-input"
                type="number"
                step="0.01"
                class="setting-input tabular-nums"
                placeholder="e.g. 79692.49"
                [(ngModel)]="actualInterestInput"
              />
            </div>
          </div>

          <div class="variance-display-row" style="margin-top: 14px">
            <div class="variance-item">
              <span class="var-sub">Estimated Interest</span>
              <span class="var-val tabular-nums">{{ formatPaise(computedPeriodInterest()) }}</span>
            </div>
            <div class="variance-item">
              <span class="var-sub">Bank Actual</span>
              <span class="var-val tabular-nums">{{ actualInterestInput ? '₹' + actualInterestInput : '—' }}</span>
            </div>
            <div class="variance-item">
              <span class="var-sub">Variance</span>
              <span class="var-val tabular-nums" [class.highlight]="interestVariance() !== 0">
                {{ formatPaise(interestVariance()) }}
              </span>
            </div>
          </div>

          <button
            type="button"
            class="reconcile-btn"
            style="margin-top: 14px"
            [disabled]="!actualInterestInput"
            (click)="recordActualInterestSnapshot()"
          >
            Record Verified Bank Interest
          </button>
        </div>
      </app-glass-card>

      <!-- Notifications & Alert Preferences -->
      <app-glass-card [staggerIndex]="7">
        <h2 class="card-title">Notifications & Smart Alerts</h2>
        <p class="section-sub">Configure in-app alert triggers, anomaly detection, and quiet hours.</p>

        <div class="notif-pref-list">
          <label class="setting-checkbox-label">
            <input
              type="checkbox"
              class="setting-checkbox"
              [ngModel]="notifsStore.preferences().enableContributionReminders"
              (ngModelChange)="updateNotifPref('enableContributionReminders', $event)"
            />
            <div>
              <strong>Monthly Contribution Reminders</strong>
              <small class="pref-desc">Notify members when monthly targets are due.</small>
            </div>
          </label>

          <label class="setting-checkbox-label">
            <input
              type="checkbox"
              class="setting-checkbox"
              [ngModel]="notifsStore.preferences().enablePaymentDue"
              (ngModelChange)="updateNotifPref('enablePaymentDue', $event)"
            />
            <div>
              <strong>Bank Payment (EMI) Reminders</strong>
              <small class="pref-desc">Alert when monthly bank target is not yet fulfilled.</small>
            </div>
          </label>

          <label class="setting-checkbox-label">
            <input
              type="checkbox"
              class="setting-checkbox"
              [ngModel]="notifsStore.preferences().enableLimitExpiry"
              (ngModelChange)="updateNotifPref('enableLimitExpiry', $event)"
            />
            <div>
              <strong>Loan Limit & Tenure Expiry Warnings</strong>
              <small class="pref-desc">Warn at 90, 30, and 7 days before sanction limit expiry.</small>
            </div>
          </label>

          <label class="setting-checkbox-label">
            <input
              type="checkbox"
              class="setting-checkbox"
              [ngModel]="notifsStore.preferences().enableAnomalyAlerts"
              (ngModelChange)="updateNotifPref('enableAnomalyAlerts', $event)"
            />
            <div>
              <strong>Unusual Transaction & Anomaly Detection</strong>
              <small class="pref-desc">Flag duplicate entries within 24h, amounts &gt;3× median, and bank variances.</small>
            </div>
          </label>
        </div>

        <div class="quiet-hours-row" style="margin-top: 14px; display: flex; gap: 12px;">
          <div class="setting-item" style="flex: 1">
            <label class="setting-label" for="quiet-start">Quiet Hours Start</label>
            <input
              id="quiet-start"
              type="time"
              class="setting-input"
              [ngModel]="notifsStore.preferences().quietHoursStart || '22:00'"
              (ngModelChange)="updateNotifPref('quietHoursStart', $event)"
            />
          </div>
          <div class="setting-item" style="flex: 1">
            <label class="setting-label" for="quiet-end">Quiet Hours End</label>
            <input
              id="quiet-end"
              type="time"
              class="setting-input"
              [ngModel]="notifsStore.preferences().quietHoursEnd || '08:00'"
              (ngModelChange)="updateNotifPref('quietHoursEnd', $event)"
            />
          </div>
        </div>

        <div class="push-optin-box" style="margin-top: 14px">
          <button
            type="button"
            class="reconcile-btn"
            (click)="requestWebPush()"
          >
            🔔 Enable Web Push Notifications
          </button>
          <small class="pref-desc" style="display: block; margin-top: 6px">
            Push notifications work via the browser service worker. On iOS, install the app to your Home Screen first.
          </small>
        </div>
      </app-glass-card>

      <!-- Backup, Restore & Data Reset -->
      <app-glass-card [staggerIndex]="8">
        <h2 class="card-title">Data & Backup</h2>
        <p class="section-sub">Download your complete encrypted ledger or restore from a JSON backup.</p>

        <div class="backup-actions-grid">
          <button type="button" class="backup-btn" (click)="downloadBackup()">
            💾 Download Backup JSON
          </button>

          <label class="backup-btn upload-label">
            📂 Restore Backup JSON
            <input type="file" accept=".json" (change)="onFileRestore($event)" hidden />
          </label>

          <button type="button" class="sample-btn" (click)="loadSampleData()">
            🔄 Load Sample Data
          </button>

          <button
            type="button"
            class="reset-btn"
            (click)="isConfirmClearOpen.set(true)"
          >
            🗑️ Clear All Data
          </button>
        </div>

        <div class="security-notice">
          <strong>Security Notice:</strong>
          Browser localStorage is unencrypted. Do not store sensitive banking login credentials or OTPs in this app.
        </div>
      </app-glass-card>

      <!-- Confirm Clear Data Sheet -->
      <app-confirm-sheet
        [isOpen]="isConfirmClearOpen()"
        title="Clear All Ledger Data"
        message="Are you sure you want to clear all transactions and records? This action cannot be undone unless you have a JSON backup."
        confirmText="Clear All Data"
        [isDanger]="true"
        (confirmed)="clearAllData()"
        (cancelled)="isConfirmClearOpen.set(false)"
      />

      <!-- Daily Ledger Sheet -->
      <app-daily-ledger-sheet
        [isOpen]="isDailyLedgerOpen()"
        (dismissed)="isDailyLedgerOpen.set(false)"
      />

      <!-- Bank Reconciliation Wizard -->
      <app-reconciliation-wizard
        [isOpen]="isReconciliationOpen()"
        (dismissed)="isReconciliationOpen.set(false)"
      />
    </div>
  `,
  styles: `
    .settings-page {
      display: flex;
      flex-direction: column;
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
    }

    .setting-row {
      display: flex;
      gap: 12px;
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

    .setting-input {
      width: 100%;
      height: 46px;
      border-radius: var(--radius-tile, 16px);
      border: 1px solid var(--line);
      background: var(--bg);
      color: var(--ink);
      padding: 0 14px;
      font-size: 14px;
      font-weight: 700;
      outline: none;
      transition: border-color 0.2s ease;
    }

    .setting-input:focus {
      border-color: var(--brand-a);
      background: var(--card);
    }

    .rate-change-form, .reconcile-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .apply-rate-btn, .reconcile-btn {
      width: 100%;
      height: 44px;
      border-radius: var(--radius-pill, 99px);
      background: var(--ink);
      color: var(--bg);
      border: none;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
    }

    .wizard-launch-btn {
      width: 100%;
      height: 46px;
      border-radius: var(--radius-pill, 99px);
      background: linear-gradient(135deg, #6c4cff, #9b4dff);
      color: #ffffff;
      border: none;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(108, 76, 255, 0.3);
    }

    .close-period-btn {
      height: 44px;
      padding: 0 16px;
      border-radius: var(--radius-pill, 99px);
      background: var(--ink);
      color: var(--bg);
      border: none;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      white-space: nowrap;
    }

    .status-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: var(--radius-pill, 99px);
      text-transform: uppercase;
    }

    .status-badge.reconciled {
      background: rgba(15, 178, 124, 0.15);
      color: var(--success);
      border: 1px solid var(--success);
    }

    .status-badge.estimated {
      background: rgba(108, 76, 255, 0.12);
      color: var(--brand-a);
      border: 1px solid rgba(108, 76, 255, 0.25);
    }

    .add-m-btn {
      padding: 6px 14px;
      border-radius: var(--radius-pill, 99px);
      background: var(--brand-gradient);
      color: #ffffff;
      border: none;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }

    .members-edit-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 14px;
    }

    .member-edit-item {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .member-name-input {
      flex: 1;
      height: 40px;
      border-radius: var(--radius-tile, 16px);
      border: 1px solid var(--line);
      background: var(--bg);
      color: var(--ink);
      padding: 0 12px;
      font-size: 13px;
      font-weight: 700;
      outline: none;
    }

    .toggle-status-btn {
      padding: 8px 14px;
      border-radius: var(--radius-pill, 99px);
      border: 1px solid var(--line);
      background: var(--bg);
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      min-height: 40px;
    }

    .toggle-status-btn.active {
      background: rgba(15, 178, 124, 0.15);
      color: var(--success);
      border-color: var(--success);
    }

    .backup-actions-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      margin-top: 14px;
    }

    .backup-btn, .sample-btn, .reset-btn {
      width: 100%;
      height: 44px;
      border-radius: var(--radius-pill, 99px);
      border: 1px solid var(--line);
      background: var(--bg);
      color: var(--ink);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: grid;
      place-items: center;
      text-align: center;
    }

    .upload-label {
      cursor: pointer;
    }

    .sample-btn {
      color: var(--brand-a);
    }

    .reset-btn {
      color: var(--danger);
      border-color: rgba(238, 77, 107, 0.3);
    }

    .security-notice {
      margin-top: 16px;
      padding: 12px 14px;
      border-radius: var(--radius-tile, 16px);
      background: var(--bg);
      border: 1px solid var(--line);
      font-size: 11px;
      color: var(--muted);
      line-height: 1.45;
    }

    .view-ledger-pill-btn {
      padding: 6px 12px;
      border-radius: var(--radius-pill, 99px);
      border: 1px solid rgba(108, 76, 255, 0.25);
      background: rgba(108, 76, 255, 0.1);
      color: var(--brand-a);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .view-ledger-pill-btn:hover {
      background: rgba(108, 76, 255, 0.18);
    }

    .notif-pref-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .setting-checkbox-label {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      font-size: 13px;
      color: var(--ink);
      cursor: pointer;

      strong {
        display: block;
        font-size: 13px;
        color: var(--ink);
      }
    }

    .pref-desc {
      display: block;
      font-size: 11px;
      color: var(--muted);
      margin-top: 2px;
    }

    .checkbox-setting-row {
      display: flex;
      align-items: center;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      font-weight: 600;
      color: var(--ink);
      cursor: pointer;
    }

    .setting-checkbox {
      width: 18px;
      height: 18px;
      accent-color: var(--brand-a);
      cursor: pointer;
    }

    .info-note-box {
      display: flex;
      gap: 10px;
      padding: 12px;
      border-radius: var(--radius-tile, 16px);
      background: var(--bg);
      border: 1px solid var(--line);
      font-size: 12px;
      color: var(--muted);
      line-height: 1.45;
    }

    .note-icon {
      font-size: 16px;
      flex-shrink: 0;
    }

    .note-text code {
      font-family: monospace;
      color: var(--brand-a);
    }

    .reconcile-interest-form {
      display: flex;
      flex-direction: column;
    }

    .variance-display-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .variance-item {
      background: var(--bg);
      border: 1px solid var(--line);
      border-radius: var(--radius-tile, 16px);
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .var-sub {
      font-size: 11px;
      color: var(--muted);
      font-weight: 600;
    }

    .var-val {
      font-size: 14px;
      font-weight: 800;
      color: var(--ink);
    }

    .var-val.highlight {
      color: var(--danger);
    }
  `,
})
export class SettingsComponent {
  readonly ledgerStore = inject(LedgerStore);
  readonly settings = inject(SettingsStore);
  readonly notifsStore = inject(NotificationsStore);
  readonly toast = inject(ToastService);

  readonly formatPaise = formatPaise;
  readonly toRupees = toRupees;
  readonly toPaise = toPaise;

  readonly loan = this.ledgerStore.loan;
  readonly isConfirmClearOpen = signal<boolean>(false);
  readonly isDailyLedgerOpen = signal<boolean>(false);
  readonly isReconciliationOpen = signal<boolean>(false);

  newRateInput: number | null = null;
  rateEffectiveDate = new Date().toISOString().slice(0, 10);
  actualBalanceInput: number | null = null;

  verificationPeriod = new Date().toISOString().slice(0, 7);
  periodToClose = new Date().toISOString().slice(0, 7);
  actualInterestInput: number | null = null;

  readonly isCurrentMonthReconciled = computed<boolean>(() => {
    const curMonth = new Date().toISOString().slice(0, 7);
    return this.ledgerStore.snapshots().some(
      (s) => !s.deletedAt && s.date.slice(0, 7) === curMonth && s.variance === 0
    );
  });

  readonly themeOptions: SegmentOption<'auto' | 'light' | 'dark'>[] = [
    { label: 'Auto (System)', value: 'auto' },
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
  ];

  readonly methodOptions: SegmentOption<CalculationMethod>[] = [
    { label: 'Monthly Reducing', value: 'monthly' },
    { label: 'Daily OD (Day-Accurate)', value: 'daily' },
  ];

  readonly dayCountOptions: SegmentOption<DayCountBasis>[] = [
    { label: 'Actual/365 (SBI/HDFC)', value: 'actual/365' },
    { label: '360 (US)', value: '360' },
    { label: 'Actual/Actual (ISMA)', value: 'actual/actual' },
  ];

  readonly debitFreqOptions: SegmentOption<DebitFrequency>[] = [
    { label: 'Monthly (Last Day)', value: 'monthlyLastDay' },
    { label: 'Quarterly', value: 'quarterly' },
    { label: 'Custom Day', value: 'customDay' },
  ];

  readonly computedPeriodInterest = computed<Paise>(() => {
    return monthlySummary(this.verificationPeriod, this.ledgerStore.ledgerState()).interestIncurredEst;
  });

  readonly interestVariance = computed<Paise>(() => {
    if (!this.actualInterestInput) return paise(0);
    const actual = toPaise(this.actualInterestInput);
    const computedEst = this.computedPeriodInterest();
    return subPaise(actual, computedEst);
  });

  async updateDayCountBasis(basis: DayCountBasis): Promise<void> {
    await this.ledgerStore.updateBankRules({ dayCountBasis: basis });
    this.toast.show(`Day-count basis set to ${basis}`, 'info');
  }

  async updateDebitFrequency(freq: DebitFrequency): Promise<void> {
    await this.ledgerStore.updateBankRules({ debitFrequency: freq });
    this.toast.show(`Debit frequency set to ${freq}`, 'info');
  }

  async toggleCapitalisation(capitalise: boolean): Promise<void> {
    await this.ledgerStore.updateBankRules({ isCapitalised: capitalise });
    this.toast.show(`Interest capitalisation ${capitalise ? 'enabled' : 'disabled'}`, 'info');
  }

  async recordActualInterestSnapshot(): Promise<void> {
    if (!this.actualInterestInput) return;
    const actual = toPaise(this.actualInterestInput);
    const est = this.computedPeriodInterest();
    const variance = subPaise(actual, est);

    await this.ledgerStore.recordBankPayment({
      amount: actual,
      interestPortion: actual,
      date: `${this.verificationPeriod}-28`,
      forMonth: this.verificationPeriod,
      mode: 'Bank transfer',
      notes: `Verified Bank Interest Debit (Variance: ${formatPaise(variance)})`,
    });

    this.toast.show(`Verified bank interest recorded (Variance: ${formatPaise(variance)})`, 'success');
    this.actualInterestInput = null;
  }

  async triggerMonthClose(): Promise<void> {
    const res = await this.ledgerStore.closeMonthPeriod(this.periodToClose);
    this.toast.show(
      `Period ${this.periodToClose} finalized & locked. Interest: ${formatPaise(res.entry.calculatedInterest)}`,
      'success'
    );
  }

  async updateLoanParam(key: string, value: unknown): Promise<void> {
    await this.ledgerStore.updateLoanDetails({ [key]: value });
    this.toast.show('Loan parameters updated', 'success');
  }

  async applyRateChange(): Promise<void> {
    if (!this.newRateInput || this.newRateInput <= 0) {
      this.toast.show('Please enter a valid rate', 'danger');
      return;
    }
    const rateBps = Math.round(this.newRateInput * 100);
    await this.ledgerStore.updateRate(rateBps, this.rateEffectiveDate, 'User settings update');
    this.toast.show(`Interest rate updated to ${this.newRateInput}%`, 'success');
    this.newRateInput = null;
  }

  async applyReconciliation(): Promise<void> {
    if (!this.actualBalanceInput || this.actualBalanceInput <= 0) {
      this.toast.show('Please enter actual statement balance', 'danger');
      return;
    }
    const actual = toPaise(this.actualBalanceInput);
    const today = new Date().toISOString().slice(0, 10);
    const result = await this.ledgerStore.reconcileBalance(actual, today, 'Passbook reconciliation');

    const varRupees = Math.abs(toRupees(result.variance)).toLocaleString('en-IN');
    const msg =
      result.variance === 0
        ? 'Reconciled! Zero variance with bank balance.'
        : `Reconciled! Variance of ₹${varRupees} recorded.`;
    this.toast.show(msg, result.variance === 0 ? 'success' : 'info');
    this.actualBalanceInput = null;
  }

  async addNewMemberPrompt(): Promise<void> {
    const count = this.ledgerStore.members().length + 1;
    await this.ledgerStore.addMember(`Member ${count}`);
    this.toast.show(`Member ${count} added`, 'success');
  }

  async renameMember(id: string, name: string): Promise<void> {
    await this.ledgerStore.updateMember(id, { name: name.trim() });
  }

  async toggleMemberActive(member: Member): Promise<void> {
    await this.ledgerStore.updateMember(member.id, { active: !member.active });
  }

  async updateCalculationMethod(method: CalculationMethod): Promise<void> {
    await this.ledgerStore.updateLoanDetails({ calculationMethod: method });
    this.toast.show(`Calculation method set to ${method}`, 'info');
  }

  async downloadBackup(): Promise<void> {
    const json = await this.ledgerStore.exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loan-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.show('Backup downloaded', 'success');
  }

  async onFileRestore(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    if (!inputEl.files || inputEl.files.length === 0) return;

    const file = inputEl.files[0]!;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await this.ledgerStore.restoreBackup(reader.result as string);
        this.toast.show('Backup restored successfully', 'success');
      } catch {
        this.toast.show('Failed to restore backup: Invalid JSON', 'danger');
      }
    };
    reader.readAsText(file);
    inputEl.value = '';
  }

  async loadSampleData(): Promise<void> {
    await this.ledgerStore.loadSampleData();
    this.toast.show('Sample data loaded', 'success');
  }

  async clearAllData(): Promise<void> {
    await this.ledgerStore.clearAllData();
    this.isConfirmClearOpen.set(false);
    this.toast.show('All ledger records cleared', 'danger');
  }

  updateNotifPref(key: string, value: boolean | string): void {
    this.notifsStore.updatePreferences({ [key]: value });
  }

  async requestWebPush(): Promise<void> {
    const res = await this.notifsStore.requestPushPermission();
    if (res === 'granted') {
      this.toast.show('Web push notifications enabled successfully', 'success');
    } else if (res === 'unsupported') {
      this.toast.show('Browser notifications are not supported in this environment', 'info');
    } else {
      this.toast.show('Notification permission was denied or dismissed', 'danger');
    }
  }
}

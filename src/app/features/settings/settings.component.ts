import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LedgerStore, NotificationsStore, SettingsStore } from '../../core/state';
import {
  ConfirmSheetComponent,
  GlassCardComponent,
  SegmentedControlComponent,
  SegmentOption,
  ToastService,
} from '../../shared/ui';
import {
  BackupDiffSummary,
  CalculationMethod,
  DayCountBasis,
  DebitFrequency,
  formatPaise,
  inspectBackupDiff,
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
import { RestorePreviewModalComponent } from './restore-preview-modal.component';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    GlassCardComponent,
    SegmentedControlComponent,
    ConfirmSheetComponent,
    DailyLedgerSheetComponent,
    ReconciliationWizardComponent,
    RestorePreviewModalComponent,
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

      <!-- Loan Parameters Editor -->
      <app-glass-card [staggerIndex]="0">
        <h2 class="card-title">Loan Details</h2>
        <p class="section-sub">Your loan account number, total approved limit, and monthly target.</p>

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
            <label class="setting-label" for="loan-limit">Total Loan Approved by Bank (₹)</label>
            <input
              id="loan-limit"
              type="number"
              class="setting-input tabular-nums"
              [ngModel]="toRupees(loan().sanctionedLimit)"
              (ngModelChange)="updateLoanParam('sanctionedLimit', toPaise($event))"
            />
          </div>

          <div class="setting-item">
            <label class="setting-label" for="loan-target">Total Monthly Target to Collect (₹)</label>
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
        <h2 class="card-title">Change Interest Rate</h2>
        <p class="section-sub">
          Current interest is <strong>{{ (loan().currentRateBps / 100).toFixed(2) }}%</strong>.
          Enter the new rate when the bank changes it. Past records stay accurate.
        </p>

        <form class="rate-change-form" (ngSubmit)="applyRateChange()">
          <div class="setting-row">
            <div class="setting-item" style="flex: 1">
              <label class="setting-label" for="new-rate">New Bank Interest Rate (%)</label>
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
              <label class="setting-label" for="rate-date">Date Changed</label>
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
            Save New Rate
          </button>
        </form>
      </app-glass-card>

      <!-- Reconciliation & Period Locking Section -->
      <app-glass-card [staggerIndex]="2">
        <div class="card-title-row">
          <h2 class="card-title">Match with Bank & Lock Past Months</h2>
          <span
            class="status-badge"
            [class.reconciled]="isCurrentMonthReconciled()"
            [class.estimated]="!isCurrentMonthReconciled()"
          >
            {{ isCurrentMonthReconciled() ? '✓ Matches Bank' : 'Estimated' }}
          </span>
        </div>
        <p class="section-sub">
          Current loan left: <strong>{{ formatPaise(ledgerStore.currentOutstanding()) }}</strong>.
          Locked up to: <strong>{{ loan().lockedUntilPeriod || 'None (Open)' }}</strong>.
        </p>

        <div class="reconcile-actions-grid">
          <button type="button" class="wizard-launch-btn" (click)="isReconciliationOpen.set(true)">
            ⚖️ Compare with Bank Passbook
          </button>
        </div>

        <div class="close-month-box" style="margin-top: 14px">
          <div class="setting-row">
            <div class="setting-item" style="flex: 1">
              <label class="setting-label" for="close-period-select">Month to Lock</label>
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
                🔒 Lock Month
              </button>
            </div>
          </div>
        </div>
      </app-glass-card>

      <!-- Member Management -->
      <app-glass-card [staggerIndex]="3">
        <div class="card-title-row">
          <h2 class="card-title">Family Members</h2>
          <button type="button" class="add-m-btn" (click)="addNewMemberPrompt()">
            ＋ Add New Person
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

      <!-- Calculation Method Preference -->
      <app-glass-card [staggerIndex]="4">
        <h2 class="card-title">How Interest is Calculated</h2>

        <div class="setting-group" style="margin-top: 14px">
          <span class="setting-label" id="method-label">Calculation Mode</span>
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
          <h2 class="card-title">Bank Rules & Daily Calculation</h2>
          <button type="button" class="view-ledger-pill-btn" (click)="isDailyLedgerOpen.set(true)">
            📊 View Daily Interest Table
          </button>
        </div>
        <p class="section-sub">Rules your bank uses to calculate daily interest on your loan.</p>

        <div class="setting-group" style="margin-top: 14px">
          <span class="setting-label">Days in a Year</span>
          <app-segmented-control
            [options]="dayCountOptions"
            [selectedValue]="loan().bankRules?.dayCountBasis || 'actual/365'"
            (changed)="updateDayCountBasis($any($event))"
          />
        </div>

        <div class="setting-group" style="margin-top: 16px">
          <span class="setting-label">When Bank Charges Interest</span>
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
            <span>Add monthly interest directly to loan balance (Standard for SBI Maxgain)</span>
          </label>
        </div>

        <div class="info-note-box" style="margin-top: 14px">
          <span class="note-icon">ℹ️</span>
          <div class="note-text">
            <strong>Payment Date & Daily Interest:</strong>
            Payments take effect on the day you pay them.
            Interest is calculated on the remaining balance every single day, and added only when the bank debits interest at month-end.
          </div>
        </div>
      </app-glass-card>

      <!-- Estimated vs Bank-Actual Interest Variance -->
      <app-glass-card [staggerIndex]="6">
        <h2 class="card-title">Check Passbook Interest</h2>
        <p class="section-sub">Enter the interest amount shown in your bank passbook to see if it matches our calculation.</p>

        <div class="reconcile-interest-form">
          <div class="setting-row">
            <div class="setting-item" style="flex: 1">
              <label class="setting-label" for="verify-period">Month</label>
              <input
                id="verify-period"
                type="month"
                class="setting-input"
                [(ngModel)]="verificationPeriod"
              />
            </div>
            <div class="setting-item" style="flex: 1">
              <label class="setting-label" for="actual-interest-input">Interest Charged in Passbook (₹)</label>
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
              <span class="var-sub">App Calculated Interest</span>
              <span class="var-val tabular-nums">{{ formatPaise(computedPeriodInterest()) }}</span>
            </div>
            <div class="variance-item">
              <span class="var-sub">Passbook Interest</span>
              <span class="var-val tabular-nums">{{ actualInterestInput ? '₹' + actualInterestInput : '—' }}</span>
            </div>
            <div class="variance-item">
              <span class="var-sub">Difference</span>
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
            Save Passbook Interest
          </button>
        </div>
      </app-glass-card>

      <!-- Notifications & Alert Preferences -->
      <app-glass-card [staggerIndex]="7">
        <h2 class="card-title">Reminders & Alerts</h2>
        <p class="section-sub">Choose when to get reminders, warnings, and quiet hours.</p>

        <div class="notif-pref-list">
          <label class="setting-checkbox-label">
            <input
              type="checkbox"
              class="setting-checkbox"
              [ngModel]="notifsStore.preferences().enableContributionReminders"
              (ngModelChange)="updateNotifPref('enableContributionReminders', $event)"
            />
            <div>
              <strong>Family Member Reminders</strong>
              <small class="pref-desc">Remind everyone before the 5th of every month.</small>
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
              <strong>Bank EMI Due Reminders</strong>
              <small class="pref-desc">Alert if the bank payment hasn't been made for the month.</small>
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
              <strong>Loan End-Date Warnings</strong>
              <small class="pref-desc">Warn 90, 30, and 7 days before loan tenure expires.</small>
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
              <strong>Warn on Mistakes & Double Payments</strong>
              <small class="pref-desc">Warn if a payment is entered twice or if an unusually large amount is typed.</small>
            </div>
          </label>
        </div>

        <div class="quiet-hours-row" style="margin-top: 14px; display: flex; gap: 12px;">
          <div class="setting-item" style="flex: 1">
            <label class="setting-label" for="quiet-start">Do Not Disturb Starts</label>
            <input
              id="quiet-start"
              type="time"
              class="setting-input"
              [ngModel]="notifsStore.preferences().quietHoursStart || '22:00'"
              (ngModelChange)="updateNotifPref('quietHoursStart', $event)"
            />
          </div>
          <div class="setting-item" style="flex: 1">
            <label class="setting-label" for="quiet-end">Do Not Disturb Ends</label>
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
            🔔 Turn on Phone / Browser Notifications
          </button>
          <small class="pref-desc" style="display: block; margin-top: 6px">
            Get alerts on your phone. On iPhone, tap 'Add to Home Screen' in Safari first.
          </small>
        </div>
      </app-glass-card>

      <!-- Backup, Restore & Data Reset -->
      <app-glass-card [staggerIndex]="8">
        <h2 class="card-title">Save or Restore Your Data</h2>
        <p class="section-sub">Download a backup file so you never lose your records, or restore from a saved file.</p>

        <div class="backup-actions-grid">
          <button type="button" class="backup-btn" (click)="downloadBackup()">
            💾 Download Backup File
          </button>

          <label class="backup-btn upload-label">
            📂 Restore from Backup File
            <input type="file" accept=".json" (change)="onFileRestore($event)" hidden />
          </label>

          <button type="button" class="sample-btn" (click)="loadSampleData()">
            🔄 Load Example Data
          </button>

          <a routerLink="/admin/audit" class="sample-btn" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center;">
            🛡️ View Change History Log
          </a>

          <button
            type="button"
            class="reset-btn"
            (click)="isConfirmClearOpen.set(true)"
          >
            🗑️ Delete All Data
          </button>
        </div>

        <div class="security-notice">
          <strong>Security Tip:</strong>
          Never type bank passwords or OTPs here. This app only tracks your loan and member payments.
        </div>
      </app-glass-card>

      <!-- Confirm Clear Data Sheet -->
      <app-confirm-sheet
        [isOpen]="isConfirmClearOpen()"
        title="Delete All Data"
        message="Are you sure you want to delete all payment records? You will lose all data unless you have downloaded a backup file."
        confirmText="Yes, Delete Everything"
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

      <!-- Restore Preview Modal -->
      <app-restore-preview-modal
        [isOpen]="isRestoreModalOpen()"
        [diff]="pendingRestoreDiff()"
        (confirmed)="confirmRestore()"
        (cancelled)="cancelRestore()"
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
      background: var(--bg-subtle, #f5f5f7);
      color: var(--ink);
      padding: 0 12px;
      font-size: 13px;
      font-weight: 700;
      outline: none;
      transition: all 0.2s ease;
    }

    .member-name-input:focus {
      border-color: var(--brand-a);
      box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.15);
      background: #ffffff;
    }

    .toggle-status-btn {
      padding: 8px 14px;
      border-radius: var(--radius-pill, 9999px);
      border: 1px solid var(--line);
      background: var(--bg-subtle, #f5f5f7);
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      min-height: 40px;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .toggle-status-btn:active {
      transform: scale(0.96);
    }

    .toggle-status-btn.active {
      background: var(--success-bg, rgba(52, 199, 89, 0.12));
      color: #248a3d;
      border-color: rgba(52, 199, 89, 0.25);
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
      border-radius: var(--radius-pill, 9999px);
      border: 1px solid var(--line);
      background: #ffffff;
      color: var(--ink);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: grid;
      place-items: center;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .backup-btn:hover, .sample-btn:hover, .reset-btn:hover {
      transform: translateY(-1.5px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    }

    .backup-btn:active, .sample-btn:active, .reset-btn:active {
      transform: scale(0.97);
    }

    .upload-label {
      cursor: pointer;
    }

    .sample-btn {
      color: var(--brand-a);
    }

    .reset-btn {
      color: var(--danger);
      border-color: rgba(255, 59, 48, 0.3);
    }

    .security-notice {
      margin-top: 16px;
      padding: 12px 14px;
      border-radius: var(--radius-tile, 16px);
      background: var(--bg-subtle, #f5f5f7);
      border: 1px solid var(--line);
      font-size: 11px;
      color: var(--muted);
      line-height: 1.45;
    }

    .view-ledger-pill-btn {
      padding: 6px 14px;
      border-radius: var(--radius-pill, 9999px);
      border: 1px solid rgba(0, 113, 227, 0.2);
      background: rgba(0, 113, 227, 0.08);
      color: var(--brand-a);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .view-ledger-pill-btn:hover {
      background: rgba(0, 113, 227, 0.16);
      transform: translateY(-1px);
    }

    .view-ledger-pill-btn:active {
      transform: scale(0.96);
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
  readonly isRestoreModalOpen = signal<boolean>(false);
  readonly pendingRestoreDiff = signal<BackupDiffSummary | null>(null);
  readonly pendingRestoreJson = signal<string | null>(null);

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

  readonly methodOptions: SegmentOption<CalculationMethod>[] = [
    { label: 'Monthly (Normal)', value: 'monthly' },
    { label: 'Daily (Overdraft / Maxgain)', value: 'daily' },
  ];

  readonly dayCountOptions: SegmentOption<DayCountBasis>[] = [
    { label: '365 Days (SBI/HDFC)', value: 'actual/365' },
    { label: '360 Days', value: '360' },
    { label: '365 / 366 (Leap)', value: 'actual/actual' },
  ];

  readonly debitFreqOptions: SegmentOption<DebitFrequency>[] = [
    { label: 'Month-End (30th/31st)', value: 'monthlyLastDay' },
    { label: 'Every 3 Months', value: 'quarterly' },
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
    this.toast.show(`Days in year set to ${basis}`, 'info');
  }

  async updateDebitFrequency(freq: DebitFrequency): Promise<void> {
    await this.ledgerStore.updateBankRules({ debitFrequency: freq });
    this.toast.show(`Interest charge timing updated`, 'info');
  }

  async toggleCapitalisation(capitalise: boolean): Promise<void> {
    await this.ledgerStore.updateBankRules({ isCapitalised: capitalise });
    this.toast.show(`Adding interest to balance ${capitalise ? 'enabled' : 'disabled'}`, 'info');
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
      notes: `Verified Bank Interest Debit (Difference: ${formatPaise(variance)})`,
    });

    this.toast.show(`Passbook interest recorded (Difference: ${formatPaise(variance)})`, 'success');
    this.actualInterestInput = null;
  }

  async triggerMonthClose(): Promise<void> {
    const res = await this.ledgerStore.closeMonthPeriod(this.periodToClose);
    this.toast.show(
      `Month ${this.periodToClose} locked. Interest: ${formatPaise(res.entry.calculatedInterest)}`,
      'success'
    );
  }

  async updateLoanParam(key: string, value: unknown): Promise<void> {
    await this.ledgerStore.updateLoanDetails({ [key]: value });
    this.toast.show('Loan details saved', 'success');
  }

  async applyRateChange(): Promise<void> {
    if (!this.newRateInput || this.newRateInput <= 0) {
      this.toast.show('Please enter a valid interest rate', 'danger');
      return;
    }
    const rateBps = Math.round(this.newRateInput * 100);
    await this.ledgerStore.updateRate(rateBps, this.rateEffectiveDate, 'User settings update');
    this.toast.show(`Interest rate changed to ${this.newRateInput}%`, 'success');
    this.newRateInput = null;
  }

  async applyReconciliation(): Promise<void> {
    if (!this.actualBalanceInput || this.actualBalanceInput <= 0) {
      this.toast.show('Please enter balance from bank passbook', 'danger');
      return;
    }
    const actual = toPaise(this.actualBalanceInput);
    const today = new Date().toISOString().slice(0, 10);
    const result = await this.ledgerStore.reconcileBalance(actual, today, 'Passbook reconciliation');

    const varRupees = Math.abs(toRupees(result.variance)).toLocaleString('en-IN');
    const msg =
      result.variance === 0
        ? 'Matches bank passbook exactly!'
        : `Recorded difference of ₹${varRupees} with bank passbook.`;
    this.toast.show(msg, result.variance === 0 ? 'success' : 'info');
    this.actualBalanceInput = null;
  }

  async addNewMemberPrompt(): Promise<void> {
    const count = this.ledgerStore.members().length + 1;
    await this.ledgerStore.addMember(`Member ${count}`);
    this.toast.show(`New member added`, 'success');
  }

  async renameMember(id: string, name: string): Promise<void> {
    await this.ledgerStore.updateMember(id, { name: name.trim() });
  }

  async toggleMemberActive(member: Member): Promise<void> {
    await this.ledgerStore.updateMember(member.id, { active: !member.active });
  }

  async updateCalculationMethod(method: CalculationMethod): Promise<void> {
    await this.ledgerStore.updateLoanDetails({ calculationMethod: method });
    this.toast.show(`Calculation mode updated`, 'info');
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
    this.toast.show('Backup file downloaded', 'success');
  }

  async onFileRestore(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    if (!inputEl.files || inputEl.files.length === 0) return;

    const file = inputEl.files[0]!;
    const reader = new FileReader();
    reader.onload = async () => {
      const rawText = reader.result as string;
      try {
        const diff = inspectBackupDiff(rawText, this.ledgerStore.ledgerState());
        this.pendingRestoreJson.set(rawText);
        this.pendingRestoreDiff.set(diff);
        this.isRestoreModalOpen.set(true);
      } catch {
        this.toast.show('Could not read backup file', 'danger');
      }
    };
    reader.readAsText(file);
    inputEl.value = '';
  }

  async confirmRestore(): Promise<void> {
    const json = this.pendingRestoreJson();
    if (!json) return;

    try {
      await this.ledgerStore.restoreBackup(json);
      this.isRestoreModalOpen.set(false);
      this.pendingRestoreJson.set(null);
      this.pendingRestoreDiff.set(null);
      this.toast.show('Backup restored successfully', 'success');
    } catch {
      this.toast.show('Could not restore: File is invalid or damaged', 'danger');
    }
  }

  cancelRestore(): void {
    this.isRestoreModalOpen.set(false);
    this.pendingRestoreJson.set(null);
    this.pendingRestoreDiff.set(null);
  }

  async loadSampleData(): Promise<void> {
    await this.ledgerStore.loadSampleData();
    this.toast.show('Example data loaded', 'success');
  }

  async clearAllData(): Promise<void> {
    await this.ledgerStore.clearAllData();
    this.isConfirmClearOpen.set(false);
    this.toast.show('All data deleted', 'danger');
  }

  updateNotifPref(key: string, value: boolean | string): void {
    this.notifsStore.updatePreferences({ [key]: value });
  }

  async requestWebPush(): Promise<void> {
    const res = await this.notifsStore.requestPushPermission();
    if (res === 'granted') {
      this.toast.show('Notifications enabled successfully', 'success');
    } else if (res === 'unsupported') {
      this.toast.show('Notifications are not supported in this browser', 'info');
    } else {
      this.toast.show('Notification permission was not allowed', 'danger');
    }
  }
}

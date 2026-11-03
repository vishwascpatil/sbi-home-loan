import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LedgerStore, SettingsStore } from '../../core/state';
import {
  ConfirmSheetComponent,
  GlassCardComponent,
  SegmentedControlComponent,
  SegmentOption,
  ToastService,
} from '../../shared/ui';
import { CalculationMethod, formatPaise, Member, toPaise, toRupees } from '../../core/engine';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    GlassCardComponent,
    SegmentedControlComponent,
    ConfirmSheetComponent,
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

      <!-- Reconcile Balance Section -->
      <app-glass-card [staggerIndex]="2">
        <h2 class="card-title">Reconcile Outstanding Balance</h2>
        <p class="section-sub">
          Ledger computed outstanding is <strong>{{ formatPaise(ledgerStore.currentOutstanding()) }}</strong>.
          Compare with your bank passbook/statement.
        </p>

        <form class="reconcile-form" (ngSubmit)="applyReconciliation()">
          <div class="setting-item">
            <label class="setting-label" for="actual-balance">Bank Statement Balance (₹)</label>
            <input
              id="actual-balance"
              type="number"
              class="setting-input tabular-nums"
              placeholder="e.g. 12105189"
              [(ngModel)]="actualBalanceInput"
              name="actualBalance"
              required
            />
          </div>

          <button type="submit" class="reconcile-btn">
            Save Reconciliation Snapshot
          </button>
        </form>
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

      <!-- Backup, Restore & Data Reset -->
      <app-glass-card [staggerIndex]="5">
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
  `,
})
export class SettingsComponent {
  readonly ledgerStore = inject(LedgerStore);
  readonly settings = inject(SettingsStore);
  readonly toast = inject(ToastService);

  readonly formatPaise = formatPaise;
  readonly toRupees = toRupees;
  readonly toPaise = toPaise;

  readonly loan = this.ledgerStore.loan;
  readonly isConfirmClearOpen = signal<boolean>(false);

  newRateInput: number | null = null;
  rateEffectiveDate = new Date().toISOString().slice(0, 10);
  actualBalanceInput: number | null = null;

  readonly themeOptions: SegmentOption<'auto' | 'light' | 'dark'>[] = [
    { label: 'Auto (System)', value: 'auto' },
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
  ];

  readonly methodOptions: SegmentOption<CalculationMethod>[] = [
    { label: 'Monthly Reducing', value: 'monthly' },
    { label: 'Daily Balance (Stub)', value: 'daily' },
  ];

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
}

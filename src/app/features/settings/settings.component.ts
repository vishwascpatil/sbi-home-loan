import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LedgerStore, SettingsStore } from '../../core/state';
import { GlassCardComponent, ToastService } from '../../shared/ui';
import {
  formatPaise,
  Member,
  toPaise,
  toRupees,
} from '../../core/engine';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    GlassCardComponent,
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

      <!-- Member Management -->
      <app-glass-card [staggerIndex]="2">
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

    .rate-change-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .apply-rate-btn {
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

  newRateInput: number | null = null;
  rateEffectiveDate = new Date().toISOString().slice(0, 10);

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
}

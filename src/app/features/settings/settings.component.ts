import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LedgerStore, SettingsStore } from '../../core/state';
import {
  AvatarComponent,
  ConfirmSheetComponent,
  GlassCardComponent,
  ToastService,
} from '../../shared/ui';
import {
  formatPaise,
  Member,
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
            <label class="setting-label" for="loan-limit">Total Loan Approved by Bank (₹)</label>
            <input
              id="loan-limit"
              type="number"
              class="setting-input tabular-nums"
              [ngModel]="toRupees(loan().sanctionedLimit)"
              (ngModelChange)="updateLoanMoneyParam('sanctionedLimit', $event)"
              (change)="commitLoanMoneyParam('sanctionedLimit', $event)"
            />
          </div>

          <div class="setting-item">
            <label class="setting-label" for="loan-outstanding">Outstanding Amount (₹)</label>
            <input
              id="loan-outstanding"
              type="number"
              class="setting-input tabular-nums"
              [ngModel]="toRupees(loan().openingOutstanding)"
              (ngModelChange)="updateLoanMoneyParam('openingOutstanding', $event)"
              (change)="commitLoanMoneyParam('openingOutstanding', $event)"
            />
          </div>

          <div class="setting-item">
            <label class="setting-label" for="loan-target">Total Monthly Target to Collect (₹)</label>
            <input
              id="loan-target"
              type="number"
              class="setting-input tabular-nums"
              [ngModel]="toRupees(loan().monthlyTarget)"
              (ngModelChange)="updateLoanMoneyParam('monthlyTarget', $event)"
              (change)="commitLoanMoneyParam('monthlyTarget', $event)"
            />
          </div>
        </div>
      </app-glass-card>

      <!-- 2. Classic Interest Rate Update Section -->
      <app-glass-card [staggerIndex]="1">
        <h2 class="card-title">Change Interest Rate</h2>
        <p class="section-sub">Bank revisions update current and future interest without altering historical records.</p>

        <!-- Active Rate Spotlight Tile -->
        <div class="active-rate-spotlight">
          <div class="spotlight-top">
            <span class="spotlight-badge-title">CURRENT BANK RATE</span>
            <span class="spotlight-live-pill">
              <span class="live-dot"></span> Active
            </span>
          </div>

          <div class="spotlight-main">
            <span class="spotlight-rate tabular-nums">{{ (loan().currentRateBps / 100).toFixed(2) }}%</span>
            <div class="spotlight-meta">
              <span class="spotlight-unit">p.a.</span>
              <span class="spotlight-type">Daily Reducing Balance</span>
            </div>
          </div>

          <div class="spotlight-footer">
            <span class="spotlight-date-text">
              In effect from {{ formatEffectiveDate(loan().openingDate) }}
            </span>
            @if (previousRateFormatted()) {
              <span class="prev-rate-chip">Prior: {{ previousRateFormatted() }}</span>
            }
          </div>
        </div>

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
            Save & Apply New Rate
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
                    <span class="timeline-meta">
                      {{ formatEffectiveDate(r.effectiveFrom) }}
                    </span>
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
          <button type="button" class="add-m-btn" (click)="addNewMemberPrompt()">
            ＋ Add Person
          </button>
        </div>

        <div class="members-luxury-list">
          @for (m of nonDeletedMembers(); track m.id) {
            <div class="member-row" [class.inactive]="!m.active">
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

              <div class="member-controls">
                <button
                  type="button"
                  class="ios-switch"
                  role="switch"
                  [attr.aria-checked]="m.active"
                  (click)="toggleMemberActive(m)"
                  [title]="m.active ? 'Active (tap to pause)' : 'Paused (tap to activate)'"
                  [attr.aria-label]="m.name + (m.active ? ' is active' : ' is paused')"
                >
                  <span class="ios-switch-thumb"></span>
                </button>

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
            </div>
          }
        </div>
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
      transition: border-color 0.2s ease, background 0.2s ease;
      box-sizing: border-box;
    }

    .setting-input:focus {
      border-color: var(--brand-a);
      background: var(--card);
    }

    /* ----------------------------------------------------
       Active Rate Spotlight Tile (Classic Luxury)
       ---------------------------------------------------- */
    .active-rate-spotlight {
      background: #111216;
      border-radius: var(--radius-card, 22px);
      padding: 18px 20px;
      margin-bottom: 18px;
      color: #ffffff;
      box-shadow: 0 8px 24px rgba(17, 18, 22, 0.16);
      position: relative;
      overflow: hidden;
    }

    .spotlight-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .spotlight-badge-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: #8e8e93;
      text-transform: uppercase;
    }

    .spotlight-live-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: var(--radius-pill, 99px);
      background: rgba(16, 185, 129, 0.16);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #10b981;
      font-size: 11px;
      font-weight: 700;
    }

    .live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 6px #10b981;
      animation: pulseLive 2s infinite ease-in-out;
    }

    @keyframes pulseLive {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.45; transform: scale(0.85); }
    }

    .spotlight-main {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 12px;
    }

    .spotlight-rate {
      font-size: 38px;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1;
      color: #ffffff;
    }

    .spotlight-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .spotlight-unit {
      font-size: 14px;
      font-weight: 700;
      color: #8e8e93;
    }

    .spotlight-type {
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.7);
    }

    .spotlight-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .spotlight-date-text {
      font-size: 12px;
      color: #8e8e93;
      font-weight: 500;
    }

    .prev-rate-chip {
      font-size: 11px;
      font-weight: 600;
      color: #d1d1d6;
      background: rgba(255, 255, 255, 0.1);
      padding: 3px 9px;
      border-radius: var(--radius-pill, 99px);
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
    }

    .rate-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
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
      height: 46px;
      border-radius: var(--radius-pill, 99px);
      background: #111216;
      color: #ffffff;
      border: none;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      margin-top: 4px;
      box-shadow: 0 4px 14px rgba(17, 18, 22, 0.18);
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
      min-height: 42px;
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
      margin-top: 4px;
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
      padding-bottom: 10px;
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

    .timeline-meta {
      font-size: 12px;
      color: var(--muted);
      margin-top: 2px;
      display: block;
    }

    /* ----------------------------------------------------
       Family Members Section (Minimal & Clean)
       ---------------------------------------------------- */
    .add-m-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: var(--radius-pill, 99px);
      background: var(--ink);
      color: var(--card);
      border: none;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      white-space: nowrap;
    }

    .add-m-btn:hover {
      opacity: 0.9;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    }

    .add-m-btn:active {
      transform: scale(0.96);
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

    .member-row.inactive {
      opacity: 0.45;
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

    .member-controls {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    /* iOS-Style Toggle Switch */
    .ios-switch {
      position: relative;
      width: 40px;
      height: 24px;
      border-radius: 9999px;
      background: var(--line, #e2e4ea);
      border: none;
      cursor: pointer;
      padding: 2px;
      transition: background-color 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      outline: none;
    }

    .ios-switch:focus-visible {
      box-shadow: 0 0 0 2px var(--card), 0 0 0 4px #34c759;
    }

    .ios-switch[aria-checked="true"] {
      background: #34c759;
    }

    .ios-switch-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #ffffff;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2), 0 0 1px rgba(0, 0, 0, 0.1);
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      transform: translateX(0);
    }

    .ios-switch[aria-checked="true"] .ios-switch-thumb {
      transform: translateX(16px);
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
  `,
})
export class SettingsComponent {
  readonly ledgerStore = inject(LedgerStore);
  readonly settings = inject(SettingsStore);
  readonly toast = inject(ToastService);

  readonly formatPaise = formatPaise;
  readonly toRupees = toRupees;
  readonly toPaise = toPaise;
  readonly ZERO_PAISE = ZERO_PAISE;

  readonly loan = this.ledgerStore.loan;

  newRateInput: number | null = null;
  rateEffectiveDate = new Date().toISOString().slice(0, 10);
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private memberNameTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  readonly memberToDelete = signal<Member | null>(null);
  readonly isDeleteConfirmOpen = signal(false);

  readonly nonDeletedMembers = computed(() => {
    return this.ledgerStore.members().filter((m) => !m.deletedAt);
  });

  readonly rateHistory = computed(() => {
    return [...this.ledgerStore.rateChanges()]
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.createdAt.localeCompare(a.createdAt));
  });

  readonly previousRateFormatted = computed(() => {
    const changes = this.rateHistory();
    if (changes.length > 1) {
      return `${(changes[1].rateBps / 100).toFixed(2)}% p.a.`;
    }
    return null;
  });

  formatEffectiveDate(dateStr?: string): string {
    if (!dateStr) return 'Active Baseline';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    }
    return dateStr;
  }

  async updateLoanParam(key: string, value: unknown): Promise<void> {
    await this.ledgerStore.updateLoanDetails({ [key]: value });
    this.toast.show('Loan details saved', 'success');
  }

  updateLoanMoneyParam(
    key: 'sanctionedLimit' | 'openingOutstanding' | 'monthlyTarget',
    value: number | string | null | undefined
  ): void {
    if (value === null || value === undefined || value === '') return;
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num) || num < 0) return;

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(async () => {
      await this.ledgerStore.updateLoanDetails({ [key]: toPaise(num) });
      const label = key === 'openingOutstanding' ? 'Outstanding amount' : 'Loan details';
      this.toast.show(`${label} updated & recalculated`, 'success');
    }, 450);
  }

  commitLoanMoneyParam(
    key: 'sanctionedLimit' | 'openingOutstanding' | 'monthlyTarget',
    event: Event
  ): void {
    const input = event.target as HTMLInputElement;
    if (!input || input.value === '') return;
    const num = parseFloat(input.value);
    if (isNaN(num) || num < 0) return;

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    void this.ledgerStore.updateLoanDetails({ [key]: toPaise(num) }).then(() => {
      const label = key === 'openingOutstanding' ? 'Outstanding amount' : 'Loan details';
      this.toast.show(`${label} updated & recalculated`, 'success');
    });
  }

  async applyRateChange(): Promise<void> {
    if (!this.newRateInput || this.newRateInput <= 0) {
      this.toast.show('Please enter a valid interest rate', 'danger');
      return;
    }
    const rateBps = Math.round(this.newRateInput * 100);
    await this.ledgerStore.updateRate(rateBps, this.rateEffectiveDate, 'Bank interest rate revision');
    this.toast.show(`Interest rate updated to ${this.newRateInput.toFixed(2)}%`, 'success');
    this.newRateInput = null;
  }

  async addNewMemberPrompt(): Promise<void> {
    const count = this.nonDeletedMembers().length + 1;
    await this.ledgerStore.addMember(`Member ${count}`, toPaise(10000));
    this.toast.show(`New member added`, 'success');
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

  async toggleMemberActive(member: Member): Promise<void> {
    await this.ledgerStore.updateMember(member.id, { active: !member.active });
    const status = !member.active ? 'active' : 'paused';
    this.toast.show(`${member.name} marked as ${status}`, 'info');
  }

  confirmDeleteMember(m: Member): void {
    this.memberToDelete.set(m);
    this.isDeleteConfirmOpen.set(true);
  }

  async executeDeleteMember(): Promise<void> {
    const m = this.memberToDelete();
    if (!m) return;
    await this.ledgerStore.deleteMember(m.id);
    this.toast.show(`${m.name} removed`, 'info');
    this.isDeleteConfirmOpen.set(false);
    this.memberToDelete.set(null);
  }
}

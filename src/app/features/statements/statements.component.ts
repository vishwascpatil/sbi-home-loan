import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LedgerStore } from '../../core/state';
import {
  formatPaise,
  FinancialYearSummary,
  Paise,
  StatementSnapshot,
} from '../../core/engine';
import {
  AvatarComponent,
  ToastService,
} from '../../shared/ui';

@Component({
  selector: 'app-statements',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AvatarComponent,
  ],
  template: `
    <div class="statements-page">
      <!-- Printable / Screen Header -->
      <header class="page-header no-print">
        <div class="header-titles">
          <a routerLink="/history" class="back-link">← Back to History</a>
          <h1 class="header-title">Statements & Tax Reports</h1>
        </div>

        <div class="header-actions">
          <div class="tab-toggle" role="tablist">
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === 'monthly'"
              class="tab-btn"
              [class.active]="activeTab() === 'monthly'"
              (click)="activeTab.set('monthly')"
            >
              Monthly Statement
            </button>
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === 'annual'"
              class="tab-btn"
              [class.active]="activeTab() === 'annual'"
              (click)="activeTab.set('annual')"
            >
              Indian FY (April–March)
            </button>
          </div>
        </div>
      </header>

      <!-- MONTHLY STATEMENT TAB -->
      @if (activeTab() === 'monthly') {
        <section class="controls-bar no-print">
          <div class="control-group">
            <label for="periodSelect" class="control-label">Select Month</label>
            <input
              id="periodSelect"
              type="month"
              class="month-picker"
              [ngModel]="selectedPeriod()"
              (ngModelChange)="selectedPeriod.set($event)"
            />
          </div>

          <div class="action-buttons">
            <button
              type="button"
              class="btn btn-secondary"
              (click)="archiveStatement()"
              title="Store immutable snapshot in ledger state"
            >
              💾 Archive Snapshot
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              (click)="shareStatement()"
              title="Share statement summary"
            >
              📤 Share
            </button>
            <button
              type="button"
              class="btn btn-primary"
              (click)="printStatement()"
              title="Print or Save as PDF"
            >
              🖨️ Print / Save PDF
            </button>
          </div>
        </section>

        <!-- PRINTABLE STATEMENT SHEET -->
        <article class="statement-sheet printable-document" id="statement-doc">
          <!-- Document Header -->
          <div class="doc-header">
            <div class="bank-brand">
              <span class="brand-badge">HOME LOAN STATEMENT</span>
              <h2 class="doc-loan-name">{{ ledgerStore.loan().type }}</h2>
              <p class="account-num">
                A/C No: <strong>{{ currentStatement().accountNumber }}</strong>
              </p>
            </div>

            <div class="doc-meta">
              <div class="status-badge" [class.reconciled]="currentStatement().status === 'reconciled'">
                {{ currentStatement().status === 'reconciled' ? '✓ Reconciled' : 'Estimated Split' }}
              </div>
              <div class="period-title">{{ formatPeriodTitle(currentStatement().period) }}</div>
              <small class="generated-at">Generated: {{ currentStatement().generatedAt | date:'medium' }}</small>
            </div>
          </div>

          <!-- Financial Highlights Grid -->
          <div class="metrics-grid">
            <div class="metric-card">
              <span class="metric-label">Opening Balance</span>
              <strong class="metric-value">{{ formatPaise(currentStatement().openingOutstanding) }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Bank Payment (EMI)</span>
              <strong class="metric-value highlight">{{ formatPaise(currentStatement().paidToBank) }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Interest Charged</span>
              <strong class="metric-value danger">{{ formatPaise(currentStatement().interestPaid) }}</strong>
            </div>
            <div class="metric-card">
              <span class="metric-label">Principal Repaid</span>
              <strong class="metric-value success">{{ formatPaise(currentStatement().principalReduced) }}</strong>
            </div>
            <div class="metric-card full-width closing-card">
              <span class="metric-label">Closing Outstanding Balance</span>
              <strong class="metric-value big">{{ formatPaise(currentStatement().closingOutstanding) }}</strong>
            </div>
          </div>

          <!-- Member-wise Contributions Breakdown -->
          <div class="section-block">
            <h3 class="section-title">Member Contributions & Shares</h3>
            <table class="styled-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th class="text-right">Contribution</th>
                  <th class="text-right">Share of Total</th>
                </tr>
              </thead>
              <tbody>
                @for (m of currentStatement().memberContributions; track m.memberId) {
                  <tr>
                    <td>
                      <div class="member-cell">
                        <app-avatar [name]="m.name" [colorIndex]="$index" [size]="28"></app-avatar>
                        <span class="member-name">{{ m.name }}</span>
                      </div>
                    </td>
                    <td class="text-right tabular-nums font-bold">
                      {{ formatPaise(m.amount) }}
                    </td>
                    <td class="text-right tabular-nums">
                      {{ m.sharePercentage | number:'1.1-2' }}%
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <th class="font-bold">Total Group Contributions</th>
                  <th class="text-right tabular-nums font-bold">
                    {{ formatPaise(currentStatement().totalContributions) }}
                  </th>
                  <th class="text-right">100%</th>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Group Funds Summary -->
          <div class="section-block funds-block">
            <h3 class="section-title">Group Pool Accounting</h3>
            <div class="funds-row">
              <div class="fund-item">
                <span class="fund-label">Total Collected:</span>
                <span class="tabular-nums font-bold">{{ formatPaise(currentStatement().totalContributions) }}</span>
              </div>
              <div class="fund-item">
                <span class="fund-label">Bank Transferred:</span>
                <span class="tabular-nums font-bold">{{ formatPaise(currentStatement().paidToBank) }}</span>
              </div>
              <div class="fund-item">
                <span class="fund-label">Surplus / (Shortfall):</span>
                <span class="tabular-nums font-bold" [class.success]="currentStatement().unusedGroupFunds >= 0" [class.danger]="currentStatement().unusedGroupFunds < 0">
                  {{ formatPaise(currentStatement().unusedGroupFunds) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Disclaimers & Signatures -->
          <div class="doc-footer">
            <p class="disclaimer-text">
              * Group Loan Statement generated by Loan EMI Tracker. Figures tagged "Reconciled" reflect verified bank balance snapshots. Figures tagged "Estimated Split" use standard reducing balance interest accrual until bank statement verification is closed.
            </p>
          </div>
        </article>
      }

      <!-- ANNUAL INDIAN FY TAB -->
      @if (activeTab() === 'annual') {
        <section class="controls-bar no-print">
          <div class="control-group">
            <label for="fySelect" class="control-label">Financial Year (April–March)</label>
            <select
              id="fySelect"
              class="month-picker"
              [ngModel]="selectedFyYear()"
              (ngModelChange)="selectedFyYear.set(+$event)"
            >
              @for (y of availableFyYears(); track y) {
                <option [value]="y">FY {{ y }}–{{ (y + 1) % 100 }}</option>
              }
            </select>
          </div>

          <div class="action-buttons">
            <button
              type="button"
              class="btn btn-primary"
              (click)="printStatement()"
              title="Print or Save as PDF"
            >
              🖨️ Print Tax Certificate
            </button>
          </div>
        </section>

        <!-- PRINTABLE TAX & FY CERTIFICATE SHEET -->
        <article class="statement-sheet printable-document" id="fy-doc">
          <!-- Document Header -->
          <div class="doc-header">
            <div class="bank-brand">
              <span class="brand-badge tax-badge">ANNUAL PROVISIONAL / ACTUAL CERTIFICATE</span>
              <h2 class="doc-loan-name">{{ ledgerStore.loan().type }}</h2>
              <p class="account-num">
                A/C No: <strong>{{ ledgerStore.loan().accountNumber }}</strong>
              </p>
            </div>

            <div class="doc-meta">
              <div class="period-title">{{ currentFySummary().financialYear }}</div>
              <small class="generated-at">Assessment Year {{ selectedFyYear() + 1 }}–{{ (selectedFyYear() + 2) % 100 }}</small>
            </div>
          </div>

          <!-- Tax Deduction Cards (Sec 24b and Sec 80C) -->
          <div class="tax-cards-grid">
            <div class="tax-card">
              <div class="tax-card-header">
                <span class="tax-section">Section 24(b)</span>
                <span class="tax-title">Interest on Housing Loan</span>
              </div>
              <div class="tax-amount danger">
                {{ formatPaise(currentFySummary().totalInterestPaid) }}
              </div>
              <small class="tax-sub">Deductible up to ₹2,00,000 per co-borrower for self-occupied property</small>
            </div>

            <div class="tax-card">
              <div class="tax-card-header">
                <span class="tax-section">Section 80C</span>
                <span class="tax-title">Principal Repayment</span>
              </div>
              <div class="tax-amount success">
                {{ formatPaise(currentFySummary().totalPrincipalReduced) }}
              </div>
              <small class="tax-sub">Part of ₹1,50,000 overall 80C cap per co-borrower</small>
            </div>
          </div>

          <!-- 12-Month Table Breakdown -->
          <div class="section-block">
            <h3 class="section-title">Monthly Breakup ({{ currentFySummary().startPeriod }} – {{ currentFySummary().endPeriod }})</h3>
            <table class="styled-table fy-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th class="text-right">Opening</th>
                  <th class="text-right">Bank EMI</th>
                  <th class="text-right">Interest (24b)</th>
                  <th class="text-right">Principal (80C)</th>
                  <th class="text-right">Closing</th>
                </tr>
              </thead>
              <tbody>
                @for (m of currentFySummary().months; track m.period) {
                  <tr>
                    <td class="font-bold">{{ formatPeriodTitle(m.period) }}</td>
                    <td class="text-right tabular-nums">{{ formatPaise(m.opening) }}</td>
                    <td class="text-right tabular-nums">{{ formatPaise(m.paidToBank) }}</td>
                    <td class="text-right tabular-nums danger">{{ formatPaise(m.interest) }}</td>
                    <td class="text-right tabular-nums success">{{ formatPaise(m.principalReduction) }}</td>
                    <td class="text-right tabular-nums font-bold">{{ formatPaise(m.closing) }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <th class="font-bold">Total FY</th>
                  <th class="text-right">—</th>
                  <th class="text-right tabular-nums font-bold">{{ formatPaise(currentFySummary().totalPaidToBank) }}</th>
                  <th class="text-right tabular-nums font-bold danger">{{ formatPaise(currentFySummary().totalInterestPaid) }}</th>
                  <th class="text-right tabular-nums font-bold success">{{ formatPaise(currentFySummary().totalPrincipalReduced) }}</th>
                  <th class="text-right">—</th>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Co-borrowers Split Reference -->
          <div class="section-block">
            <h3 class="section-title">Group Co-borrower Contributions</h3>
            <table class="styled-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th class="text-right">Total Contributed</th>
                  <th class="text-right">Share of FY</th>
                </tr>
              </thead>
              <tbody>
                @for (s of currentFySummary().memberShares; track s.memberId) {
                  <tr>
                    <td>
                      <div class="member-cell">
                        <app-avatar [name]="s.name" [colorIndex]="$index" [size]="28"></app-avatar>
                        <span class="member-name">{{ s.name }}</span>
                      </div>
                    </td>
                    <td class="text-right tabular-nums font-bold">{{ formatPaise(s.totalContributed) }}</td>
                    <td class="text-right tabular-nums">{{ s.sharePercentage | number:'1.1-2' }}%</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="doc-footer">
            <p class="disclaimer-text">
              * Note: Co-borrowers who are also co-owners may claim deductions under Section 24(b) and Section 80C in proportion to their share in the home loan repayment. Please consult your chartered accountant or tax advisor.
            </p>
          </div>
        </article>
      }
    </div>
  `,
  styles: [`
    .statements-page {
      max-width: 860px;
      margin: 0 auto;
      padding: 16px 16px 80px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .page-header {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .back-link {
      font-size: 0.85rem;
      color: var(--brand-a, #0071e3);
      text-decoration: none;
      font-weight: 700;
      transition: all 0.2s ease;
    }

    .back-link:hover {
      text-decoration: underline;
    }

    .header-title {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: var(--ink, #1d1d1f);
      margin: 4px 0 0;
    }

    .tab-toggle {
      display: flex;
      background: rgba(0, 0, 0, 0.05);
      padding: 3px;
      border-radius: var(--radius-pill, 9999px);
      border: 1px solid rgba(0, 0, 0, 0.04);
      width: fit-content;
    }

    .tab-btn {
      padding: 8px 18px;
      border: none;
      background: transparent;
      border-radius: var(--radius-pill, 9999px);
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--muted, #86868b);
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

      &:active {
        transform: scale(0.96);
      }

      &.active {
        background: #ffffff;
        color: var(--ink, #1d1d1f);
        font-weight: 700;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
      }
    }

    .controls-bar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      background: var(--card, #ffffff);
      padding: 14px 20px;
      border-radius: var(--radius-card, 22px);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--line);
    }

    .control-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .control-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--muted, #86868b);
    }

    .month-picker {
      padding: 8px 14px;
      border-radius: 12px;
      border: 1px solid var(--line);
      font-size: 0.9rem;
      font-weight: 600;
      background: var(--bg-subtle, #f5f5f7);
      color: var(--ink, #1d1d1f);
      outline: none;
      transition: all 0.2s ease;

      &:focus {
        border-color: var(--brand-a);
        box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.15);
      }
    }

    .action-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .btn {
      padding: 8px 16px;
      border-radius: var(--radius-pill, 9999px);
      font-size: 0.85rem;
      font-weight: 700;
      border: 1px solid var(--line);
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      display: inline-flex;
      align-items: center;
      gap: 6px;

      &:active {
        transform: scale(0.96);
      }

      &.btn-primary {
        background: linear-gradient(135deg, #0071e3 0%, #0056b3 100%);
        color: #fff;
        border: none;
        box-shadow: 0 4px 14px rgba(0, 113, 227, 0.3);
        &:hover { opacity: 0.94; transform: translateY(-1px); }
      }

      &.btn-secondary {
        background: #ffffff;
        color: var(--ink, #1d1d1f);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        &:hover { background: rgba(0, 0, 0, 0.03); transform: translateY(-1px); }
      }
    }

    /* PRINTABLE DOCUMENT STYLES */
    .statement-sheet {
      background: #ffffff;
      color: #15172b;
      border-radius: 22px;
      padding: 32px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.06);
      border: 1px solid rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      gap: 24px;
      font-family: inherit;
    }

    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #f0f0f5;
      padding-bottom: 18px;
    }

    .brand-badge {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: #6c4cff;
      background: rgba(108, 76, 255, 0.1);
      padding: 3px 10px;
      border-radius: 99px;
      margin-bottom: 6px;

      &.tax-badge {
        color: #0fb27c;
        background: rgba(15, 178, 124, 0.1);
      }
    }

    .doc-loan-name {
      font-size: 1.4rem;
      font-weight: 800;
      margin: 0;
      color: #15172b;
    }

    .account-num {
      margin: 4px 0 0;
      font-size: 0.85rem;
      color: #767a90;
    }

    .doc-meta {
      text-align: right;
    }

    .status-badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 99px;
      background: #fff3d6;
      color: #946200;
      margin-bottom: 6px;

      &.reconciled {
        background: #e6f9f2;
        color: #0c8a60;
      }
    }

    .period-title {
      font-size: 1.15rem;
      font-weight: 800;
      color: #15172b;
    }

    .generated-at {
      font-size: 0.72rem;
      color: #767a90;
      display: block;
    }

    /* Financial Highlights Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .metric-card {
      background: #f8f9fc;
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px solid #ededf4;
      display: flex;
      flex-direction: column;
      gap: 4px;

      &.full-width {
        grid-column: 1 / -1;
      }

      &.closing-card {
        background: linear-gradient(135deg, #151929, #252c48);
        color: #ffffff;
        .metric-label { color: #9399b4; }
        .metric-value { color: #ffffff; }
      }
    }

    .metric-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #767a90;
    }

    .metric-value {
      font-size: 1.15rem;
      font-weight: 800;
      font-variant-numeric: tabular-nums;

      &.big {
        font-size: 1.45rem;
      }
      &.highlight { color: #6c4cff; }
      &.danger { color: #ee4d6b; }
      &.success { color: #0fb27c; }
    }

    /* Tables */
    .section-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #15172b;
      margin: 0 0 10px;
    }

    .styled-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88rem;

      th {
        background: #f4f5f9;
        padding: 10px 12px;
        text-align: left;
        font-weight: 700;
        color: #555b72;
        border-top: 1px solid #e5e7eb;
        border-bottom: 1px solid #e5e7eb;
      }

      td {
        padding: 10px 12px;
        border-bottom: 1px solid #f0f0f5;
      }

      tfoot th {
        background: #f8f9fc;
        padding: 12px;
        border-top: 2px solid #dedee6;
        border-bottom: none;
      }
    }

    .text-right { text-align: right; }
    .tabular-nums { font-variant-numeric: tabular-nums; }
    .font-bold { font-weight: 700; }
    .danger { color: #ee4d6b; }
    .success { color: #0fb27c; }

    .member-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .member-name {
      font-weight: 600;
    }

    /* Group Funds Block */
    .funds-block {
      background: #fafafc;
      padding: 14px 18px;
      border-radius: 14px;
      border: 1px dashed #dcdce6;
    }

    .funds-row {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 14px;
    }

    .fund-item {
      display: flex;
      gap: 6px;
      font-size: 0.88rem;
    }

    .fund-label {
      color: #767a90;
    }

    /* Tax Cards */
    .tax-cards-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .tax-card {
      background: #f8f9fc;
      border: 1px solid #e2e4ef;
      border-radius: 16px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .tax-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .tax-section {
      font-size: 0.75rem;
      font-weight: 800;
      color: #6c4cff;
      background: rgba(108, 76, 255, 0.1);
      padding: 2px 8px;
      border-radius: 6px;
    }

    .tax-title {
      font-size: 0.82rem;
      font-weight: 600;
      color: #767a90;
    }

    .tax-amount {
      font-size: 1.5rem;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }

    .tax-sub {
      font-size: 0.72rem;
      color: #8f94a6;
      line-height: 1.3;
    }

    .doc-footer {
      border-top: 1px solid #f0f0f5;
      padding-top: 14px;
    }

    .disclaimer-text {
      font-size: 0.72rem;
      color: #8e93a6;
      line-height: 1.4;
      margin: 0;
    }

    /* PRINT MEDIA QUERY */
    @media print {
      body {
        background: #ffffff !important;
        color: #000000 !important;
      }

      .no-print,
      app-tab-bar,
      app-side-rail,
      header.app-header {
        display: none !important;
      }

      .statements-page {
        max-width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      .statement-sheet {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        border-radius: 0 !important;
      }
    }
  `],
})
export class StatementsComponent {
  readonly ledgerStore = inject(LedgerStore);
  private readonly toast = inject(ToastService);

  readonly activeTab = signal<'monthly' | 'annual'>('monthly');

  // Selected period defaults to current month
  readonly selectedPeriod = signal<string>(
    new Date().toISOString().slice(0, 7)
  );

  // Selected FY year (e.g. 2024 for FY 2024-25)
  readonly selectedFyYear = signal<number>(
    new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1
  );

  readonly availableFyYears = computed<number[]>(() => {
    const loan = this.ledgerStore.loan();
    const startYear = parseInt(loan.openingDate.slice(0, 4), 10) || 2024;
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = startYear; y <= currentYear + 1; y++) {
      years.push(y);
    }
    return years.reverse();
  });

  readonly currentStatement = computed<StatementSnapshot>(() => {
    return this.ledgerStore.getStatement(this.selectedPeriod());
  });

  readonly currentFySummary = computed<FinancialYearSummary>(() => {
    return this.ledgerStore.getFinancialYearSummary(this.selectedFyYear());
  });

  formatPaise(amount: Paise): string {
    return formatPaise(amount);
  }

  formatPeriodTitle(period: string): string {
    const [y, m] = period.split('-');
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  async archiveStatement(): Promise<void> {
    try {
      await this.ledgerStore.archiveStatement(this.selectedPeriod());
      this.toast.show(
        `Statement for ${this.selectedPeriod()} archived successfully`,
        'success'
      );
    } catch {
      this.toast.show('Failed to archive statement', 'danger');
    }
  }

  async shareStatement(): Promise<void> {
    const stmt = this.currentStatement();
    const title = `Statement for ${this.formatPeriodTitle(stmt.period)} - ${this.ledgerStore.loan().type}`;
    const text = `Loan Statement: ${this.formatPeriodTitle(stmt.period)}\nClosing Balance: ${formatPaise(stmt.closingOutstanding)}\nInterest: ${formatPaise(stmt.interestPaid)}\nPrincipal: ${formatPaise(stmt.principalReduced)}`;

    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title,
          text,
          url: window.location.href,
        });
        return;
      } catch {
        // User cancelled share
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${title}\n\n${text}`);
      this.toast.show('Statement summary copied to clipboard', 'info');
    }
  }

  printStatement(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }
}

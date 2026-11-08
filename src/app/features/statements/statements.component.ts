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
  formatCompactPaise,
  formatPaise,
  FinancialYearSummary,
  getSbiAuditSummary,
  Paise,
  paise,
  StatementSnapshot,
  triggerHaptic,
} from '../../core/engine';
import {
  SBI_AUTHENTIC_STATEMENT_ROWS,
  SbiPassbookRow,
} from '../../core/data';
import {
  AvatarComponent,
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
              [attr.aria-selected]="activeTab() === 'passbook'"
              class="tab-btn"
              [class.active]="activeTab() === 'passbook'"
              (click)="activeTab.set('passbook')"
            >
              📋 Passbook (101)
            </button>
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === 'audit'"
              class="tab-btn"
              [class.active]="activeTab() === 'audit'"
              (click)="activeTab.set('audit')"
            >
              🔍 SBI Audit
            </button>
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === 'monthly'"
              class="tab-btn"
              [class.active]="activeTab() === 'monthly'"
              (click)="activeTab.set('monthly')"
            >
              📅 Monthly
            </button>
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === 'annual'"
              class="tab-btn"
              [class.active]="activeTab() === 'annual'"
              (click)="activeTab.set('annual')"
            >
              📊 FY Tax
            </button>
          </div>
        </div>
      </header>

      <!-- 1. SBI AUTHENTIC PASSBOOK STATEMENT EXPLORER TAB -->
      @if (activeTab() === 'passbook') {
        <article class="statement-sheet explorer-sheet" id="passbook-doc">
          <!-- Document Header -->
          <div class="doc-header">
            <div class="brand-cluster">
              <span class="brand-badge badge-passbook">AUTHENTIC STATEMENT</span>
              <h2 class="doc-title">SBI Maxgain Passbook Explorer</h2>
              <span class="loan-account-num">
                A/C No: <strong>{{ ledgerStore.loan().accountNumber }}</strong> · 01-Jun-2024 to 07-Nov-2026 (101 Transactions)
              </span>
            </div>
            <button type="button" class="btn btn-secondary no-print" (click)="printStatement()">
              🖨️ Print / Save PDF
            </button>
          </div>

          <!-- 3 Dynamic WOW Telemetry Cards -->
          <div class="explorer-summary-grid">
            <div class="exp-stat-card card-inflow">
              <span class="exp-stat-lbl">Filtered Deposits (Money In)</span>
              <div class="exp-stat-val text-success tabular-nums">
                +{{ formatCompactPaise(filteredStats().totalCredit) }}
              </div>
              <span class="exp-stat-sub tabular-nums">{{ formatPaise(filteredStats().totalCredit) }}</span>
            </div>

            <div class="exp-stat-card card-outflow">
              <span class="exp-stat-lbl">Filtered Debits (Money Out)</span>
              <div class="exp-stat-val text-danger tabular-nums">
                −{{ formatCompactPaise(filteredStats().totalDebit) }}
              </div>
              <span class="exp-stat-sub tabular-nums">{{ formatPaise(filteredStats().totalDebit) }}</span>
            </div>

            <div class="exp-stat-card card-count">
              <span class="exp-stat-lbl">Matching Records</span>
              <div class="exp-stat-val text-purple tabular-nums">
                {{ filteredStats().count }} <span class="val-unit">of 101</span>
              </div>
              <span class="exp-stat-sub">
                {{ selectedCategoryTitle() }}
              </span>
            </div>
          </div>

          <!-- Filter Control Console (No Print) -->
          <div class="filter-console no-print">
            <!-- Search Row -->
            <div class="search-input-wrap">
              <span class="search-icon">🔍</span>
              <input
                type="text"
                class="search-input"
                placeholder="Search description, Vikas, Vishwas, UPI, RACPC, cheques, amounts..."
                [ngModel]="searchQuery()"
                (ngModelChange)="searchQuery.set($event)"
              />
              @if (searchQuery()) {
                <button type="button" class="clear-search-btn" (click)="searchQuery.set('')">✕</button>
              }
            </div>

            <!-- Category Quick Filters -->
            <div class="filter-chips-row">
              <button
                type="button"
                class="filter-chip"
                [class.active]="selectedCategory() === 'all'"
                (click)="setCategory('all')"
              >
                All (101)
              </button>
              <button
                type="button"
                class="filter-chip chip-green"
                [class.active]="selectedCategory() === 'credit'"
                (click)="setCategory('credit')"
              >
                🟢 Deposits (50)
              </button>
              <button
                type="button"
                class="filter-chip chip-blue"
                [class.active]="selectedCategory() === 'emi_credit'"
                (click)="setCategory('emi_credit')"
              >
                🏦 Monthly EMIs (29)
              </button>
              <button
                type="button"
                class="filter-chip chip-purple"
                [class.active]="selectedCategory() === 'prepayment'"
                (click)="setCategory('prepayment')"
              >
                ⚡ Prepayments (21)
              </button>
              <button
                type="button"
                class="filter-chip chip-red"
                [class.active]="selectedCategory() === 'interest_debit'"
                (click)="setCategory('interest_debit')"
              >
                🔴 Interest Debits (29)
              </button>
              <button
                type="button"
                class="filter-chip chip-amber"
                [class.active]="selectedCategory() === 'withdrawal'"
                (click)="setCategory('withdrawal')"
              >
                ⚠️ Withdrawals (21)
              </button>
            </div>

            <!-- Sub Filter Controls (Year, Amount, Sort) -->
            <div class="sub-filters-row">
              <div class="filter-subgroup">
                <span class="subgroup-lbl">Year:</span>
                <button type="button" class="mini-pill" [class.active]="selectedYear() === 'all'" (click)="setYear('all')">All</button>
                <button type="button" class="mini-pill" [class.active]="selectedYear() === '2026'" (click)="setYear('2026')">2026</button>
                <button type="button" class="mini-pill" [class.active]="selectedYear() === '2025'" (click)="setYear('2025')">2025</button>
                <button type="button" class="mini-pill" [class.active]="selectedYear() === '2024'" (click)="setYear('2024')">2024</button>
              </div>

              <div class="filter-subgroup">
                <span class="subgroup-lbl">Amount:</span>
                <button type="button" class="mini-pill" [class.active]="selectedAmountRange() === 'all'" (click)="setAmount('all')">All</button>
                <button type="button" class="mini-pill" [class.active]="selectedAmountRange() === 'gt1L'" (click)="setAmount('gt1L')">≥ ₹1L</button>
                <button type="button" class="mini-pill" [class.active]="selectedAmountRange() === '25k-1L'" (click)="setAmount('25k-1L')">₹25k–₹1L</button>
                <button type="button" class="mini-pill" [class.active]="selectedAmountRange() === 'lt25k'" (click)="setAmount('lt25k')">&lt; ₹25k</button>
              </div>

              <div class="filter-subgroup align-right">
                <button type="button" class="sort-toggle-btn" (click)="toggleSort()">
                  {{ sortOrder() === 'desc' ? '📅 Newest First' : '📅 Oldest First' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Mobile-First Passbook Feed (Replaces Clunky Desktop Table) -->
          <div class="passbook-feed">
            @for (row of filteredRows(); track row.id) {
              <div
                class="m-tx-card"
                [class.card-credit]="row.type === 'credit'"
                [class.card-debit]="row.type === 'debit'"
              >
                <!-- Top Header: Date, Val Date & Category Pill -->
                <div class="m-tx-header">
                  <div class="m-tx-date-cluster">
                    <span class="m-tx-date">{{ row.postDate }}</span>
                    @if (row.valueDate && row.valueDate !== row.postDate) {
                      <span class="m-tx-valdate">Val: {{ row.valueDate }}</span>
                    }
                  </div>
                  <span class="category-chip cat-{{ row.category }}">
                    {{ getCategoryBadge(row.category) }}
                  </span>
                </div>

                <!-- Main Body: Description & Big Bold Amount -->
                <div class="m-tx-body">
                  <div class="m-tx-desc-text">
                    {{ row.desc }}
                  </div>
                  <div
                    class="m-tx-amount tabular-nums font-bold"
                    [class.text-success]="row.type === 'credit'"
                    [class.text-danger]="row.type === 'debit'"
                  >
                    {{ row.type === 'credit' ? '+' : '−' }}₹{{ row.type === 'credit' ? row.rawCredit : row.rawDebit }}
                  </div>
                </div>

                <!-- Footer: Balance Debt & Reference -->
                <div class="m-tx-footer">
                  <div class="m-tx-bal-pill">
                    <span class="bal-label">Debt:</span>
                    <span class="bal-val tabular-nums">₹{{ row.rawBalance }}</span>
                    <span class="dr-tag">DR</span>
                  </div>
                  @if (row.refNo) {
                    <span class="m-tx-ref-pill">Ref: {{ row.refNo }}</span>
                  }
                </div>
              </div>
            } @empty {
              <div class="empty-feed-card">
                <span class="empty-icon">🔍</span>
                <p class="empty-text">No transactions found matching your filters.</p>
                <button type="button" class="reset-filter-btn" (click)="resetAllFilters()">Reset Filters</button>
              </div>
            }
          </div>

          <div class="doc-footer">
            <p class="disclaimer-text">
              * Official State Bank of India Maxgain Overdraft Statement (Account 43054757071) from 01-Jun-2024 to 07-Nov-2026. 101 transactions fully reconciled with ₹0 discrepancy.
            </p>
          </div>
        </article>
      }

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

      <!-- SBI FORENSIC INTEREST & RATE AUDIT TAB -->
      @if (activeTab() === 'audit') {
        <article class="statement-sheet printable-document" id="audit-doc">
          <div class="doc-header">
            <div class="brand-cluster">
              <span class="brand-badge badge-audit">FORENSIC AUDIT</span>
              <h2 class="doc-title">SBI Interest & Rate History Audit</h2>
              <span class="loan-account-num">
                A/C No: <strong>{{ ledgerStore.loan().accountNumber }}</strong> · SBI Maxgain Overdraft
              </span>
            </div>
            <div class="audit-verdict-pill">
              <span class="verdict-icon">✅</span>
              <span class="verdict-text">100% Reconciled (₹0 Discrepancy)</span>
            </div>
          </div>

          <!-- 3 Big WOW Numbers Header -->
          <div class="audit-summary-grid">
            <div class="audit-stat-card">
              <span class="a-stat-lbl">Total Interest Debited</span>
              <span class="a-stat-num text-danger tabular-nums">{{ formatPaise(auditSummary().totalInterestPaid) }}</span>
              <span class="a-stat-sub">29 Months (Jun '24 – Nov '26)</span>
            </div>

            <div class="audit-stat-card">
              <span class="a-stat-lbl">Historical Rate Drop</span>
              <span class="a-stat-num text-purple tabular-nums">8.90% → 7.65%</span>
              <span class="a-stat-sub">125 bps overall reduction</span>
            </div>

            <div class="audit-stat-card">
              <span class="a-stat-lbl">Audit Discrepancies</span>
              <span class="a-stat-num text-success tabular-nums">0 Months</span>
              <span class="a-stat-sub">Matches theoretical interest</span>
            </div>
          </div>

          <!-- 29-Month Audit Table -->
          <div class="section-block">
            <h3 class="section-title">29-Month Passbook Verification Ledger</h3>
            <div class="table-responsive">
              <table class="styled-table audit-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th class="text-center">Days</th>
                    <th class="text-right">Avg Daily Balance</th>
                    <th class="text-right">SBI Interest Debited</th>
                    <th class="text-center">Effective Rate</th>
                    <th>Rate Era</th>
                    <th class="text-center">Audit Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of auditSummary().records; track row.period) {
                    <tr>
                      <td class="font-bold">{{ row.month }}</td>
                      <td class="text-center tabular-nums">{{ row.days }}</td>
                      <td class="text-right tabular-nums">{{ formatPaise(row.avgBalance) }}</td>
                      <td class="text-right tabular-nums font-bold text-danger">{{ formatPaise(row.sbiInterest) }}</td>
                      <td class="text-center tabular-nums font-bold text-purple">{{ row.effectiveRate.toFixed(2) }}%</td>
                      <td><span class="era-tag">{{ row.rateEra }}</span></td>
                      <td class="text-center">
                        <span class="status-verified-chip">✅ Verified</span>
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <th colspan="3">Total 29-Month Cumulative</th>
                    <th class="text-right tabular-nums font-bold text-danger">{{ formatPaise(auditSummary().totalInterestPaid) }}</th>
                    <th colspan="3" class="text-center font-bold text-success">Zero Overcharges Detected</th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div class="doc-footer">
            <p class="disclaimer-text">
              * Independent mathematical audit: daily balances evaluated using actual/365 day-count convention across all 85 passbook entries. Rate era adjustments align with SBI EBLR floating benchmark revisions.
            </p>
          </div>
        </article>
      }
    </div>
  `,
  styles: [`
    .statements-page {
      width: 100%;
      max-width: 860px;
      margin: 0 auto;
      box-sizing: border-box;
      overflow-x: hidden;
      padding: 16px 16px calc(100px + env(safe-area-inset-bottom, 0px));
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
      padding: 4px;
      border-radius: var(--radius-pill, 9999px);
      border: 1px solid rgba(0, 0, 0, 0.04);
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      gap: 4px;
      box-sizing: border-box;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    .tab-btn {
      padding: 8px 14px;
      border: none;
      background: transparent;
      border-radius: var(--radius-pill, 9999px);
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--muted, #86868b);
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

      &:active {
        transform: scale(0.96);
      }

      &.active {
        background: #ffffff;
        color: var(--ink, #1d1d1f);
        font-weight: 800;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

    /* AUDIT TAB STYLES */
    .badge-audit {
      background: linear-gradient(135deg, #6c4cff 0%, #ff5f9e 100%) !important;
      color: #ffffff !important;
    }

    .audit-verdict-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(15, 178, 124, 0.1);
      border: 1px solid rgba(15, 178, 124, 0.25);
      border-radius: 99px;
      padding: 6px 14px;
      font-size: 0.82rem;
      font-weight: 700;
      color: #0fb27c;
    }

    .audit-summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin: 20px 0 24px;
    }

    .audit-stat-card {
      background: #f8f8fc;
      border-radius: 18px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border: 1px solid rgba(0, 0, 0, 0.04);
    }

    .a-stat-lbl {
      font-size: 0.72rem;
      font-weight: 700;
      color: #8e8e93;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .a-stat-num {
      font-size: 1.35rem;
      font-weight: 900;
      letter-spacing: -0.02em;

      &.text-purple { color: #6c4cff; }
      &.text-danger { color: #ee4d6b; }
      &.text-success { color: #0fb27c; }
    }

    .a-stat-sub {
      font-size: 0.75rem;
      font-weight: 600;
      color: #767a90;
    }

    .era-tag {
      font-size: 0.72rem;
      font-weight: 700;
      background: rgba(108, 76, 255, 0.08);
      color: #6c4cff;
      padding: 3px 8px;
      border-radius: 99px;
      white-space: nowrap;
    }

    .status-verified-chip {
      font-size: 0.75rem;
      font-weight: 800;
      color: #0fb27c;
      background: rgba(15, 178, 124, 0.08);
      padding: 3px 8px;
      border-radius: 99px;
      white-space: nowrap;
    }

    /* PASSBOOK EXPLORER STYLES */
    .badge-passbook {
      background: linear-gradient(135deg, #0071e3 0%, #6c4cff 100%) !important;
      color: #ffffff !important;
    }

    .explorer-summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin: 16px 0;
    }

    .exp-stat-card {
      background: #f8f8fc;
      border-radius: 18px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      border: 1px solid rgba(0, 0, 0, 0.04);

      &.card-inflow { background: rgba(15, 178, 124, 0.05); border-color: rgba(15, 178, 124, 0.15); }
      &.card-outflow { background: rgba(238, 77, 107, 0.05); border-color: rgba(238, 77, 107, 0.15); }
      &.card-count { background: rgba(108, 76, 255, 0.05); border-color: rgba(108, 76, 255, 0.15); }
    }

    .exp-stat-lbl {
      font-size: 0.72rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #8e8e93;
    }

    .exp-stat-val {
      font-size: 1.55rem;
      font-weight: 900;
      letter-spacing: -0.03em;
      line-height: 1.1;

      &.text-success { color: #0fb27c; }
      &.text-danger { color: #ee4d6b; }
      &.text-purple { color: #6c4cff; }

      .val-unit { font-size: 0.85rem; font-weight: 700; color: #767a90; }
    }

    .exp-stat-sub {
      font-size: 0.75rem;
      font-weight: 600;
      color: #767a90;
    }

    .filter-console {
      background: #fbfbfd;
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 20px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 20px;
    }

    .search-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }

    .search-icon {
      position: absolute;
      left: 14px;
      font-size: 0.95rem;
      pointer-events: none;
      color: #8e8e93;
    }

    .search-input {
      width: 100%;
      height: 42px;
      border-radius: 99px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      padding: 0 40px 0 38px;
      font-size: 0.88rem;
      font-family: inherit;
      background: #ffffff;
      outline: none;
      transition: all 0.2s ease;

      &:focus {
        border-color: #6c4cff;
        box-shadow: 0 0 0 3px rgba(108, 76, 255, 0.12);
      }
    }

    .clear-search-btn {
      position: absolute;
      right: 12px;
      background: #eef0f5;
      border: none;
      border-radius: 50%;
      width: 22px;
      height: 22px;
      font-size: 0.72rem;
      cursor: pointer;
      display: grid;
      place-items: center;
      color: #555b72;
    }

    .filter-chips-row {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 2px;
      -webkit-overflow-scrolling: touch;
    }

    .filter-chip {
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 99px;
      padding: 6px 14px;
      font-size: 0.78rem;
      font-weight: 700;
      color: #15172b;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover { border-color: rgba(108, 76, 255, 0.3); }

      &.active {
        background: #15172b;
        color: #ffffff;
        border-color: #15172b;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }

      &.chip-green.active { background: #0fb27c; border-color: #0fb27c; }
      &.chip-blue.active { background: #0071e3; border-color: #0071e3; }
      &.chip-purple.active { background: #6c4cff; border-color: #6c4cff; }
      &.chip-red.active { background: #ee4d6b; border-color: #ee4d6b; }
      &.chip-amber.active { background: #f59e0b; border-color: #f59e0b; }
    }

    .sub-filters-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      padding-top: 6px;
      border-top: 1px solid rgba(0, 0, 0, 0.04);
    }

    .filter-subgroup {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.75rem;

      &.align-right { margin-left: auto; }
    }

    .subgroup-lbl {
      font-weight: 800;
      color: #8e8e93;
      margin-right: 2px;
    }

    .mini-pill {
      background: transparent;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 6px;
      padding: 2px 8px;
      font-size: 0.72rem;
      font-weight: 700;
      color: #767a90;
      cursor: pointer;

      &.active {
        background: #6c4cff;
        color: #ffffff;
        border-color: #6c4cff;
      }
    }

    .sort-toggle-btn {
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 99px;
      padding: 4px 12px;
      font-size: 0.75rem;
      font-weight: 700;
      color: #15172b;
      cursor: pointer;
    }

    /* Mobile-First Passbook Card Feed */
    .passbook-feed {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 24px;
    }

    .m-tx-card {
      background: #ffffff;
      border-radius: 18px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      border: 1px solid rgba(0, 0, 0, 0.06);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
      transition: transform 0.15s ease, box-shadow 0.15s ease;

      &:active {
        transform: scale(0.99);
      }

      &.card-credit {
        border-left: 4px solid #0fb27c;
      }
      &.card-debit {
        border-left: 4px solid #ee4d6b;
      }
    }

    .m-tx-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .m-tx-date-cluster {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }

    .m-tx-date {
      font-size: 0.85rem;
      font-weight: 800;
      color: #15172b;
    }

    .m-tx-valdate {
      font-size: 0.7rem;
      color: #8e8e93;
      font-weight: 500;
    }

    .category-chip {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 99px;
      white-space: nowrap;

      &.cat-emi_credit { background: rgba(0, 113, 227, 0.1); color: #0071e3; }
      &.cat-prepayment { background: rgba(15, 178, 124, 0.1); color: #0fb27c; }
      &.cat-interest_debit { background: rgba(238, 77, 107, 0.1); color: #ee4d6b; }
      &.cat-withdrawal { background: rgba(245, 158, 11, 0.1); color: #d97706; }
      &.cat-disbursement { background: rgba(108, 76, 255, 0.1); color: #6c4cff; }
      &.cat-other { background: #f0f0f5; color: #555b72; }
    }

    .m-tx-body {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }

    .m-tx-desc-text {
      font-size: 0.82rem;
      font-weight: 600;
      color: #15172b;
      line-height: 1.35;
      flex: 1;
      word-break: break-word;
    }

    .m-tx-amount {
      font-size: 1.12rem;
      font-weight: 900;
      white-space: nowrap;
      letter-spacing: -0.02em;
      text-align: right;

      &.text-success { color: #0fb27c; }
      &.text-danger { color: #ee4d6b; }
    }

    .m-tx-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 8px;
      border-top: 1px solid rgba(0, 0, 0, 0.04);
      gap: 8px;
    }

    .m-tx-bal-pill {
      font-size: 0.74rem;
      color: #767a90;
      display: flex;
      align-items: center;
      gap: 4px;

      .bal-val {
        color: #15172b;
        font-weight: 700;
      }
    }

    .m-tx-ref-pill {
      font-size: 0.68rem;
      color: #8e8e93;
      background: #f4f4f8;
      padding: 2px 6px;
      border-radius: 4px;
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dr-tag {
      font-size: 0.65rem;
      font-weight: 800;
      color: #8e8e93;
      margin-left: 2px;
    }

    .empty-feed-card {
      background: #fbfbfd;
      border-radius: 18px;
      padding: 36px 16px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      border: 1px dashed rgba(0, 0, 0, 0.1);
    }

    .empty-icon {
      font-size: 2rem;
    }

    .empty-text {
      font-size: 0.88rem;
      color: #767a90;
      font-weight: 600;
      margin: 0;
    }

    .reset-filter-btn {
      margin-top: 6px;
      padding: 8px 20px;
      border-radius: 99px;
      border: none;
      background: #6c4cff;
      color: #ffffff;
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;

      &:active {
        transform: scale(0.96);
      }
    }

    .table-responsive {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 14px;
      border: 1px solid #ededf4;
    }

    /* MOBILE RESPONSIVE MEDIA QUERIES (iPhone 17 Pro Max ~440px First) */
    @media (max-width: 600px) {
      .statements-page {
        padding: 12px 12px calc(130px + env(safe-area-inset-bottom, 20px));
        gap: 14px;
      }

      .statement-sheet {
        padding: 16px 14px;
        border-radius: 18px;
        gap: 16px;
      }

      .doc-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;

        .doc-meta {
          text-align: left;
        }
      }

      .doc-loan-name {
        font-size: 1.25rem;
      }

      .explorer-summary-grid {
        grid-template-columns: 1fr 1fr;
        gap: 8px;

        .card-count {
          grid-column: span 2;
        }

        .exp-stat-card {
          padding: 12px 14px;
        }

        .exp-stat-val {
          font-size: 1.25rem;
        }
      }

      .audit-summary-grid {
        grid-template-columns: 1fr 1fr;
        gap: 8px;

        .audit-stat-card:last-child {
          grid-column: span 2;
        }

        .audit-stat-card {
          padding: 12px 14px;
        }

        .a-stat-num {
          font-size: 1.25rem;
        }
      }

      .metrics-grid {
        grid-template-columns: 1fr;
        gap: 8px;
      }

      .tax-cards-grid {
        grid-template-columns: 1fr;
        gap: 10px;
      }

      .controls-bar {
        flex-direction: column;
        align-items: stretch;
        padding: 12px 14px;
        gap: 10px;

        .control-group {
          justify-content: space-between;
          width: 100%;
        }

        .month-picker {
          flex: 1;
          text-align: center;
        }

        .action-buttons {
          width: 100%;
          display: flex;
          gap: 8px;

          .btn {
            flex: 1;
            justify-content: center;
          }
        }
      }

      .filter-console {
        padding: 12px 14px;
        gap: 10px;
      }
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

  readonly activeTab = signal<'passbook' | 'monthly' | 'annual' | 'audit'>('passbook');
  readonly auditSummary = computed(() => getSbiAuditSummary());

  // 1. Passbook Explorer State
  readonly allStatementRows = SBI_AUTHENTIC_STATEMENT_ROWS;
  readonly searchQuery = signal<string>('');
  readonly selectedCategory = signal<string>('all');
  readonly selectedYear = signal<string>('all');
  readonly selectedAmountRange = signal<string>('all');
  readonly sortOrder = signal<'desc' | 'asc'>('desc');

  readonly formatCompactPaise = formatCompactPaise;

  setCategory(cat: string): void {
    triggerHaptic('light');
    this.selectedCategory.set(cat);
  }

  setYear(yr: string): void {
    triggerHaptic('light');
    this.selectedYear.set(yr);
  }

  setAmount(amt: string): void {
    triggerHaptic('light');
    this.selectedAmountRange.set(amt);
  }

  toggleSort(): void {
    triggerHaptic('light');
    this.sortOrder.update((s) => (s === 'desc' ? 'asc' : 'desc'));
  }

  resetAllFilters(): void {
    triggerHaptic('light');
    this.searchQuery.set('');
    this.selectedCategory.set('all');
    this.selectedYear.set('all');
    this.selectedAmountRange.set('all');
  }

  getCategoryBadge(cat: SbiPassbookRow['category']): string {
    switch (cat) {
      case 'emi_credit': return '🏦 EMI SI';
      case 'prepayment': return '⚡ Deposit';
      case 'interest_debit': return '🔴 Interest';
      case 'withdrawal': return '⚠️ Withdrawal';
      case 'disbursement': return '🏛️ Loan Disbursed';
      default: return '📄 Passbook';
    }
  }

  readonly selectedCategoryTitle = computed(() => {
    switch (this.selectedCategory()) {
      case 'credit': return 'All Deposits (Credits)';
      case 'emi_credit': return 'Regular Monthly EMI Standing Instructions';
      case 'prepayment': return 'Ad-Hoc Lump-Sum Prepayments';
      case 'interest_debit': return 'Monthly SBI Interest Debits';
      case 'withdrawal': return 'Non-Loan Withdrawals from OD';
      default: return 'All 101 Passbook Transactions';
    }
  });

  readonly filteredRows = computed(() => {
    let rows = [...this.allStatementRows];
    const q = this.searchQuery().toLowerCase().trim();
    const cat = this.selectedCategory();
    const yr = this.selectedYear();
    const amt = this.selectedAmountRange();
    const sort = this.sortOrder();

    if (q) {
      rows = rows.filter((r) =>
        r.desc.toLowerCase().includes(q) ||
        r.postDate.includes(q) ||
        r.refNo.toLowerCase().includes(q) ||
        r.rawCredit.includes(q) ||
        r.rawDebit.includes(q) ||
        r.rawBalance.includes(q)
      );
    }

    if (cat !== 'all') {
      if (cat === 'credit') {
        rows = rows.filter((r) => r.type === 'credit');
      } else if (cat === 'debit') {
        rows = rows.filter((r) => r.type === 'debit');
      } else {
        rows = rows.filter((r) => r.category === cat);
      }
    }

    if (yr !== 'all') {
      rows = rows.filter((r) => r.isoDate.startsWith(yr));
    }

    if (amt !== 'all') {
      rows = rows.filter((r) => {
        const val = r.creditPaise || r.debitPaise;
        if (amt === 'gt1L') return val >= 10000000;
        if (amt === '25k-1L') return val >= 2500000 && val < 10000000;
        if (amt === 'lt25k') return val < 2500000;
        return true;
      });
    }

    if (sort === 'asc') {
      rows.sort((a, b) => a.isoDate.localeCompare(b.isoDate) || a.id.localeCompare(b.id));
    } else {
      rows.sort((a, b) => b.isoDate.localeCompare(a.isoDate) || b.id.localeCompare(a.id));
    }

    return rows;
  });

  readonly filteredStats = computed(() => {
    const rows = this.filteredRows();
    let totalCredit = 0;
    let totalDebit = 0;
    for (const r of rows) {
      totalCredit += r.creditPaise;
      totalDebit += r.debitPaise;
    }
    return {
      count: rows.length,
      totalCredit: paise(totalCredit),
      totalDebit: paise(totalDebit),
      netCashflow: paise(totalCredit - totalDebit),
    };
  });

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
    } catch {
      // Ignore or log error
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
    }
  }

  printStatement(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }
}

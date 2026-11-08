import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LedgerStore } from '../../core/state';
import {
  BankPaymentTransaction,
  FinancialYearSummary,
  formatCompactPaise,
  formatPaise,
  outstandingAt,
  Paise,
  paise,
  StatementSnapshot,
  triggerHaptic,
} from '../../core/engine';
import {
  SbiPassbookRow,
} from '../../core/data';

@Component({
  selector: 'app-statements',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
  ],
  template: `
    <div class="statements-page">
      <!-- Minimal Header -->
      <header class="page-header no-print">
        <div class="header-row">
          <h1 class="header-title">Statements</h1>
          <button type="button" class="print-pill-btn" (click)="printStatement()" title="Print / Save PDF">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            <span>Print</span>
          </button>
        </div>

        <div class="tab-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeTab() === 'passbook'"
            class="tab-btn"
            [class.active]="activeTab() === 'passbook'"
            (click)="activeTab.set('passbook')"
          >
            Passbook
          </button>
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeTab() === 'monthly'"
            class="tab-btn"
            [class.active]="activeTab() === 'monthly'"
            (click)="activeTab.set('monthly')"
          >
            Monthly
          </button>
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeTab() === 'audit'"
            class="tab-btn"
            [class.active]="activeTab() === 'audit'"
            (click)="activeTab.set('audit')"
          >
            Audit
          </button>
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeTab() === 'annual'"
            class="tab-btn"
            [class.active]="activeTab() === 'annual'"
            (click)="activeTab.set('annual')"
          >
            Tax
          </button>
        </div>
      </header>

      <!-- 1. PASSBOOK STATEMENT TAB -->
      @if (activeTab() === 'passbook') {
        <section class="passbook-view" id="passbook-doc">
          <!-- Sleek Summary Bar -->
          <div class="summary-pill-bar">
            <div class="sum-chip in">
              <span class="sum-lbl">In</span>
              <strong class="sum-num text-success tabular-nums">+{{ formatCompactPaise(filteredStats().totalCredit) }}</strong>
            </div>
            <div class="sum-chip out">
              <span class="sum-lbl">Out</span>
              <strong class="sum-num text-danger tabular-nums">−{{ formatCompactPaise(filteredStats().totalDebit) }}</strong>
            </div>
            <div class="sum-chip count">
              <span class="sum-lbl">Items</span>
              <strong class="sum-num tabular-nums">{{ filteredStats().count }}</strong>
            </div>
          </div>

          <!-- Clean Filter Ribbon & Refine Controls (No Search) -->
          <div class="filter-strip no-print">
            <!-- Category Chips -->
            <div class="category-chips-track">
              <button
                type="button"
                class="cat-chip"
                [class.active]="selectedCategory() === 'all'"
                (click)="setCategory('all')"
              >
                All
              </button>
              <button
                type="button"
                class="cat-chip"
                [class.active]="selectedCategory() === 'credit'"
                (click)="setCategory('credit')"
              >
                Deposits
              </button>
              <button
                type="button"
                class="cat-chip"
                [class.active]="selectedCategory() === 'emi_credit'"
                (click)="setCategory('emi_credit')"
              >
                EMIs
              </button>
              <button
                type="button"
                class="cat-chip"
                [class.active]="selectedCategory() === 'prepayment'"
                (click)="setCategory('prepayment')"
              >
                Prepayments
              </button>
              <button
                type="button"
                class="cat-chip"
                [class.active]="selectedCategory() === 'interest_debit'"
                (click)="setCategory('interest_debit')"
              >
                Interest
              </button>
              <button
                type="button"
                class="cat-chip"
                [class.active]="selectedCategory() === 'withdrawal'"
                (click)="setCategory('withdrawal')"
              >
                Withdrawals
              </button>
            </div>

            <!-- Refine Controls: Year, Amount & Sort Direction -->
            <div class="refine-bar">
              <select
                class="refine-select"
                [ngModel]="selectedYear()"
                (ngModelChange)="setYear($event)"
                aria-label="Filter by Year"
              >
                <option value="all">All Years</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>

              <select
                class="refine-select"
                [ngModel]="selectedAmountRange()"
                (ngModelChange)="setAmount($event)"
                aria-label="Filter by Amount"
              >
                <option value="all">Any Amount</option>
                <option value="gt1L">≥ ₹1L</option>
                <option value="25k-1L">₹25k – ₹1L</option>
                <option value="lt25k">&lt; ₹25k</option>
              </select>

              <button
                type="button"
                class="sort-chip-btn"
                (click)="toggleSort()"
                title="Toggle sort direction"
              >
                {{ sortOrder() === 'desc' ? '↓ Newest' : '↑ Oldest' }}
              </button>

              @if (hasActiveFilters()) {
                <button type="button" class="reset-chip-btn" (click)="resetAllFilters()">
                  Reset
                </button>
              }
            </div>
          </div>

          <!-- Minimalist Transaction Feed -->
          <div class="tx-feed">
            @for (row of filteredRows(); track row.id) {
              <div
                class="tx-card"
                [class.credit]="row.type === 'credit'"
                [class.debit]="row.type === 'debit'"
                role="button"
                tabindex="0"
                (click)="toggleExpand(row.id)"
                (keydown.enter)="toggleExpand(row.id)"
              >
                <div class="tx-top">
                  <div class="tx-primary">
                    <span class="tx-title">{{ getCleanNarration(row.desc, row.category) }}</span>
                    <span class="tx-badge cat-{{ row.category }}">{{ getCategoryBadge(row.category) }}</span>
                  </div>
                  <span
                    class="tx-amount tabular-nums"
                    [class.text-success]="row.type === 'credit'"
                    [class.text-danger]="row.type === 'debit'"
                  >
                    {{ row.type === 'credit' ? '+' : '−' }}₹{{ row.type === 'credit' ? row.rawCredit : row.rawDebit }}
                  </span>
                </div>

                <div class="tx-sub">
                  <span class="tx-date">{{ formatDateDisplay(row.postDate) }}</span>
                  <span class="sub-sep">·</span>
                  <span class="tx-balance tabular-nums">Bal ₹{{ row.rawBalance }}</span>
                </div>

                @if (expandedTxId() === row.id) {
                  <div class="tx-expanded">
                    <span class="raw-label">Bank Narration</span>
                    <p class="raw-text">{{ sanitizeNarration(row.desc) }}</p>
                    @if (row.refNo) {
                      <span class="raw-ref">Ref: {{ row.refNo }}</span>
                    }
                  </div>
                }
              </div>
            } @empty {
              <div class="empty-state">
                <p>No transactions match filters.</p>
                <button type="button" class="reset-chip-btn" (click)="resetAllFilters()">Clear Filters</button>
              </div>
            }
          </div>
        </section>
      }

      <!-- 2. MONTHLY STATEMENT TAB (Official Bank Split Only) -->
      @if (activeTab() === 'monthly') {
        <section class="tab-view" id="statement-doc">
          <div class="controls-bar no-print">
            <div class="control-group">
              <label for="periodSelect" class="control-label">Month</label>
              <input
                id="periodSelect"
                type="month"
                class="month-picker"
                [ngModel]="selectedPeriod()"
                (ngModelChange)="selectedPeriod.set($event)"
              />
            </div>

            <div class="action-buttons">
              <button type="button" class="btn btn-secondary" (click)="shareStatement()" title="Share">
                Share
              </button>
              <button type="button" class="btn btn-primary" (click)="printStatement()" title="Print">
                Print
              </button>
            </div>
          </div>

          <article class="clean-sheet">
            <div class="sheet-title-row">
              <div>
                <h2 class="sheet-period">{{ formatPeriodTitle(currentStatement().period) }}</h2>
                <span class="sheet-sub">A/C {{ currentStatement().accountNumber }}</span>
              </div>
              <span class="status-pill" [class.reconciled]="currentStatement().status === 'reconciled'">
                {{ currentStatement().status === 'reconciled' ? 'Reconciled' : 'Estimated' }}
              </span>
            </div>

            <!-- Financial Highlights Grid -->
            <div class="metrics-grid">
              <div class="metric-card">
                <span class="metric-label">Opening</span>
                <strong class="metric-value">{{ formatPaise(currentStatement().openingOutstanding) }}</strong>
              </div>
              <div class="metric-card">
                <span class="metric-label">Bank EMI</span>
                <strong class="metric-value highlight">{{ formatPaise(currentStatement().paidToBank) }}</strong>
              </div>
              <div class="metric-card">
                <span class="metric-label">Interest</span>
                <strong class="metric-value danger">{{ formatPaise(currentStatement().interestPaid) }}</strong>
              </div>
              <div class="metric-card">
                <span class="metric-label">Principal</span>
                <strong class="metric-value success">{{ formatPaise(currentStatement().principalReduced) }}</strong>
              </div>
              <div class="metric-card full-width closing-card">
                <span class="metric-label">Closing Balance</span>
                <strong class="metric-value big">{{ formatPaise(currentStatement().closingOutstanding) }}</strong>
              </div>
            </div>

            <!-- Upcoming Payment Banner (Month End / Due Calculation) -->
            @if (ledgerStore.upcomingPayment().isMonthEnd || selectedPeriod() === ledgerStore.upcomingPayment().closedPeriod || selectedPeriod() === ledgerStore.upcomingPayment().nextPeriod) {
              <div class="upcoming-due-banner">
                <div class="due-banner-head">
                  <div class="due-banner-title">
                    <span class="due-dot"></span>
                    <span class="due-tag">Payment Due: {{ ledgerStore.upcomingPayment().nextDueLabel }}</span>
                  </div>
                  <span class="due-interest-pill">+{{ formatPaise(ledgerStore.upcomingPayment().calculatedInterest) }} Interest Debited</span>
                </div>
                <div class="due-amounts-row">
                  <div class="due-col bank">
                    <span class="due-lbl">Bank Scheduled EMI</span>
                    <strong class="due-val tabular-nums">{{ formatPaise(ledgerStore.upcomingPayment().bankRegularEmi) }}</strong>
                    <span class="due-sub">Principal: {{ formatPaise(ledgerStore.upcomingPayment().bankEmiPrincipalReduction) }}</span>
                  </div>
                  <div class="due-col target">
                    <span class="due-lbl">Family Target</span>
                    <strong class="due-val text-success tabular-nums">{{ formatPaise(ledgerStore.upcomingPayment().familyTarget) }}</strong>
                    <span class="due-sub">Principal: {{ formatPaise(ledgerStore.upcomingPayment().targetPrincipalReduction) }}</span>
                  </div>
                </div>
              </div>
            }
          </article>
        </section>
      }

      <!-- 3. SBI AUDIT TAB -->
      @if (activeTab() === 'audit') {
        <section class="tab-view" id="audit-doc">
          <div class="audit-stats-row">
            <div class="audit-stat">
              <span class="stat-lbl">Total Interest Debited</span>
              <strong class="stat-val text-danger tabular-nums">{{ formatPaise(auditSummary().totalInterestPaid) }}</strong>
            </div>
            <div class="audit-stat">
              <span class="stat-lbl">Rate Range</span>
              <strong class="stat-val text-purple tabular-nums">8.90% → 7.65%</strong>
            </div>
            <div class="audit-stat">
              <span class="stat-lbl">Audit Discrepancies</span>
              <strong class="stat-val text-success tabular-nums">0</strong>
            </div>
          </div>

          <article class="clean-sheet">
            <div class="table-section">
              <h3 class="section-title">29-Month Interest Audit</h3>
              <div class="table-responsive">
                <table class="minimal-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th class="text-center">Days</th>
                      <th class="text-right">Avg Balance</th>
                      <th class="text-right">SBI Interest</th>
                      <th class="text-center">Rate</th>
                      <th class="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of auditSummary().records; track row.period) {
                      <tr>
                        <td class="font-bold">{{ row.month }}</td>
                        <td class="text-center tabular-nums text-muted">{{ row.days }}</td>
                        <td class="text-right tabular-nums">{{ formatPaise(row.avgBalance) }}</td>
                        <td class="text-right tabular-nums font-bold text-danger">{{ formatPaise(row.sbiInterest) }}</td>
                        <td class="text-center tabular-nums text-purple font-bold">{{ row.effectiveRate.toFixed(2) }}%</td>
                        <td class="text-center">
                          <span class="verified-tag">Verified</span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </article>
        </section>
      }

      <!-- 4. TAX (FY) TAB -->
      @if (activeTab() === 'annual') {
        <section class="tab-view" id="fy-doc">
          <div class="controls-bar no-print">
            <div class="control-group">
              <label for="fySelect" class="control-label">Financial Year</label>
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
              <button type="button" class="btn btn-primary" (click)="printStatement()">
                Print
              </button>
            </div>
          </div>

          <article class="clean-sheet">
            <div class="tax-cards-grid">
              <div class="tax-card">
                <span class="tax-section">Section 24(b) · Interest</span>
                <strong class="tax-amount danger tabular-nums">{{ formatPaise(currentFySummary().totalInterestPaid) }}</strong>
              </div>

              <div class="tax-card">
                <span class="tax-section">Section 80C · Principal</span>
                <strong class="tax-amount success tabular-nums">{{ formatPaise(currentFySummary().totalPrincipalReduced) }}</strong>
              </div>
            </div>

            <div class="table-section">
              <h3 class="section-title">Monthly Breakup</h3>
              <div class="table-responsive">
                <table class="minimal-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th class="text-right">EMI</th>
                      <th class="text-right">Interest (24b)</th>
                      <th class="text-right">Principal (80C)</th>
                      <th class="text-right">Closing</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (m of currentFySummary().months; track m.period) {
                      <tr>
                        <td class="font-bold">{{ formatPeriodTitle(m.period) }}</td>
                        <td class="text-right tabular-nums">{{ formatPaise(m.paidToBank) }}</td>
                        <td class="text-right tabular-nums danger">{{ formatPaise(m.interest) }}</td>
                        <td class="text-right tabular-nums success">{{ formatPaise(m.principalReduction) }}</td>
                        <td class="text-right tabular-nums font-bold">{{ formatPaise(m.closing) }}</td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr>
                      <th class="font-bold">Total</th>
                      <th class="text-right tabular-nums font-bold">{{ formatPaise(currentFySummary().totalPaidToBank) }}</th>
                      <th class="text-right tabular-nums font-bold danger">{{ formatPaise(currentFySummary().totalInterestPaid) }}</th>
                      <th class="text-right tabular-nums font-bold success">{{ formatPaise(currentFySummary().totalPrincipalReduced) }}</th>
                      <th class="text-right">—</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </article>
        </section>
      }
    </div>
  `,
  styles: [`
    .statements-page {
      width: 100%;
      max-width: 680px;
      margin: 0 auto;
      box-sizing: border-box;
      overflow-x: hidden;
      padding: 12px 14px calc(110px + env(safe-area-inset-bottom, 20px));
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* Minimal Header */
    .page-header {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-title {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: var(--ink, #15172b);
      margin: 0;
    }

    .print-pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 12px;
      border-radius: 99px;
      border: 1px solid var(--line, rgba(0, 0, 0, 0.08));
      background: var(--card, #ffffff);
      color: var(--ink, #15172b);
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;

      &:active {
        transform: scale(0.96);
      }
    }

    .tab-toggle {
      display: flex;
      background: rgba(0, 0, 0, 0.04);
      padding: 3px;
      border-radius: 99px;
      gap: 2px;
      box-sizing: border-box;
    }

    .tab-btn {
      flex: 1;
      padding: 7px 10px;
      border: none;
      background: transparent;
      border-radius: 99px;
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--muted, #767a90);
      cursor: pointer;
      text-align: center;
      white-space: nowrap;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:active {
        transform: scale(0.96);
      }

      &.active {
        background: #ffffff;
        color: var(--ink, #15172b);
        font-weight: 800;
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
      }
    }

    /* Summary Bar */
    .summary-pill-bar {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .sum-chip {
      background: var(--card, #ffffff);
      border: 1px solid var(--line, rgba(0, 0, 0, 0.06));
      border-radius: 14px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .sum-lbl {
      font-size: 0.68rem;
      font-weight: 700;
      color: var(--muted, #767a90);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .sum-num {
      font-size: 1.05rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.15;
    }

    /* Passbook View & Filter Strip */
    .passbook-view {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .filter-strip {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 2px 0 4px;
    }

    .category-chips-track {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      padding: 4px 2px;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    .cat-chip {
      height: 36px;
      padding: 0 16px;
      border-radius: 99px;
      border: 1px solid var(--line, rgba(0, 0, 0, 0.08));
      background: var(--card, #ffffff);
      color: var(--muted, #767a90);
      font-size: 0.82rem;
      font-weight: 700;
      white-space: nowrap;
      cursor: pointer;
      flex-shrink: 0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:active {
        transform: scale(0.96);
      }

      &.active {
        background: #15172b;
        color: #ffffff;
        border-color: transparent;
        box-shadow: 0 2px 8px rgba(21, 23, 43, 0.18);
      }
    }

    .refine-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .refine-select {
      height: 34px;
      padding: 0 28px 0 12px;
      border-radius: 99px;
      border: 1px solid var(--line, rgba(0, 0, 0, 0.08));
      background: var(--card, #ffffff);
      color: var(--muted, #555b72);
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      outline: none;
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='none' stroke='%23767a90' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M1 1l4 4 4-4'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
      transition: all 0.2s ease;

      &:focus {
        border-color: #6c4cff;
      }
    }

    .sort-chip-btn {
      height: 34px;
      padding: 0 14px;
      border-radius: 99px;
      border: 1px solid var(--line, rgba(0, 0, 0, 0.08));
      background: var(--card, #ffffff);
      color: var(--ink, #15172b);
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
      transition: all 0.2s ease;

      &:active {
        transform: scale(0.96);
      }
    }

    .reset-chip-btn {
      height: 34px;
      padding: 0 14px;
      border-radius: 99px;
      border: 1px solid rgba(238, 77, 107, 0.3);
      background: rgba(238, 77, 107, 0.08);
      color: #ee4d6b;
      font-size: 0.76rem;
      font-weight: 700;
      cursor: pointer;
      margin-left: auto;
      transition: all 0.2s ease;

      &:active {
        transform: scale(0.96);
      }
    }

    /* Minimalist Transaction Feed */
    .tx-feed {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .tx-card {
      background: var(--card, #ffffff);
      border-radius: 16px;
      padding: 12px 14px;
      border: 1px solid var(--line, rgba(0, 0, 0, 0.05));
      display: flex;
      flex-direction: column;
      gap: 4px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:active {
        transform: scale(0.99);
      }

      &.credit {
        border-left: 3.5px solid #0fb27c;
      }

      &.debit {
        border-left: 3.5px solid #ee4d6b;
      }
    }

    .tx-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }

    .tx-primary {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .tx-title {
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--ink, #15172b);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tx-badge {
      font-size: 0.65rem;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 99px;
      white-space: nowrap;
      flex-shrink: 0;

      &.cat-emi_credit { background: rgba(0, 113, 227, 0.1); color: #0071e3; }
      &.cat-prepayment { background: rgba(15, 178, 124, 0.1); color: #0fb27c; }
      &.cat-interest_debit { background: rgba(238, 77, 107, 0.1); color: #ee4d6b; }
      &.cat-withdrawal { background: rgba(245, 158, 11, 0.1); color: #d97706; }
      &.cat-disbursement { background: rgba(108, 76, 255, 0.1); color: #6c4cff; }
      &.cat-other { background: #f0f0f5; color: #767a90; }
    }

    .tx-amount {
      font-size: 0.98rem;
      font-weight: 800;
      white-space: nowrap;
      letter-spacing: -0.01em;

      &.text-success { color: #0fb27c; }
      &.text-danger { color: #ee4d6b; }
    }

    .tx-sub {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.74rem;
      color: var(--muted, #767a90);
    }

    .sub-sep {
      color: #c0c4d6;
    }

    .tx-balance {
      font-weight: 600;
      color: #555b72;
    }

    .tx-expanded {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed rgba(0, 0, 0, 0.08);
      font-size: 0.72rem;
      color: var(--muted, #767a90);
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .raw-label {
      font-weight: 700;
      text-transform: uppercase;
      font-size: 0.65rem;
      letter-spacing: 0.03em;
    }

    .raw-text {
      margin: 0;
      color: var(--ink, #15172b);
      line-height: 1.35;
      word-break: break-word;
    }

    .raw-ref {
      font-family: monospace;
      font-size: 0.68rem;
      color: #6c4cff;
    }

    /* Tab Views & Clean Sheet */
    .tab-view {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .clean-sheet {
      background: var(--card, #ffffff);
      border-radius: 20px;
      padding: 20px;
      border: 1px solid var(--line, rgba(0, 0, 0, 0.06));
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .sheet-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--line, rgba(0, 0, 0, 0.06));
    }

    .sheet-period {
      font-size: 1.15rem;
      font-weight: 800;
      margin: 0;
      color: var(--ink, #15172b);
    }

    .sheet-sub {
      font-size: 0.76rem;
      color: var(--muted, #767a90);
    }

    .status-pill {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 99px;
      background: #fff3d6;
      color: #946200;

      &.reconciled {
        background: #e6f9f2;
        color: #0c8a60;
      }
    }

    .upcoming-due-banner {
      background: linear-gradient(135deg, rgba(79, 53, 255, 0.06), rgba(255, 95, 158, 0.06));
      border: 1px solid rgba(108, 76, 255, 0.2);
      border-radius: 16px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 6px;

      .due-banner-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }

      .due-banner-title {
        display: flex;
        align-items: center;
        gap: 8px;

        .due-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #4f35ff;
          box-shadow: 0 0 8px rgba(79, 53, 255, 0.6);
        }

        .due-tag {
          font-size: 0.82rem;
          font-weight: 800;
          color: var(--ink, #15172b);
          letter-spacing: -0.01em;
        }
      }

      .due-interest-pill {
        font-size: 0.72rem;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 99px;
        background: rgba(238, 77, 107, 0.12);
        color: #ee4d6b;
      }

      .due-amounts-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        padding-top: 6px;
        border-top: 1px dashed rgba(0, 0, 0, 0.08);

        .due-col {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .due-lbl {
            font-size: 0.68rem;
            font-weight: 600;
            color: var(--muted, #767a90);
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .due-val {
            font-size: 1.05rem;
            font-weight: 800;
            color: var(--ink, #15172b);
          }

          .due-sub {
            font-size: 0.7rem;
            font-weight: 500;
            color: var(--muted, #767a90);
          }
        }
      }
    }

    /* Controls Bar */
    .controls-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      background: var(--card, #ffffff);
      padding: 10px 14px;
      border-radius: 16px;
      border: 1px solid var(--line, rgba(0, 0, 0, 0.06));
    }

    .control-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .control-label {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--muted, #767a90);
    }

    .month-picker {
      padding: 5px 10px;
      border-radius: 10px;
      border: 1px solid var(--line, rgba(0, 0, 0, 0.08));
      font-size: 0.82rem;
      font-weight: 600;
      background: #f8f8fc;
      color: var(--ink, #15172b);
      outline: none;
    }

    .action-buttons {
      display: flex;
      gap: 6px;
    }

    .btn {
      padding: 6px 14px;
      border-radius: 99px;
      font-size: 0.8rem;
      font-weight: 700;
      border: 1px solid var(--line, rgba(0, 0, 0, 0.08));
      cursor: pointer;
      transition: all 0.2s ease;

      &.btn-primary {
        background: #15172b;
        color: #ffffff;
        border: none;
      }

      &.btn-secondary {
        background: #ffffff;
        color: var(--ink, #15172b);
      }
    }

    /* Metrics Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .metric-card {
      background: #f8f8fc;
      padding: 12px 14px;
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      gap: 3px;

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
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--muted, #767a90);
    }

    .metric-value {
      font-size: 1.05rem;
      font-weight: 800;

      &.big { font-size: 1.3rem; }
      &.highlight { color: #6c4cff; }
      &.danger { color: #ee4d6b; }
      &.success { color: #0fb27c; }
    }

    /* Minimal Tables */
    .table-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .section-title {
      font-size: 0.88rem;
      font-weight: 800;
      margin: 0;
      color: var(--ink, #15172b);
    }

    .table-responsive {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .minimal-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;

      th {
        padding: 8px 10px;
        text-align: left;
        font-weight: 700;
        color: var(--muted, #767a90);
        border-bottom: 1px solid var(--line, rgba(0, 0, 0, 0.08));
        font-size: 0.74rem;
      }

      td {
        padding: 9px 10px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.04);
      }

      tfoot th {
        padding: 10px;
        border-top: 1.5px solid var(--line, rgba(0, 0, 0, 0.12));
      }
    }

    /* Audit View */
    .audit-stats-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .audit-stat {
      background: var(--card, #ffffff);
      border: 1px solid var(--line, rgba(0, 0, 0, 0.06));
      border-radius: 14px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .stat-lbl {
      font-size: 0.68rem;
      font-weight: 700;
      color: var(--muted, #767a90);
    }

    .stat-val {
      font-size: 1.1rem;
      font-weight: 800;
      letter-spacing: -0.02em;

      &.text-danger { color: #ee4d6b; }
      &.text-purple { color: #6c4cff; }
      &.text-success { color: #0fb27c; }
    }

    .verified-tag {
      font-size: 0.68rem;
      font-weight: 800;
      color: #0fb27c;
      background: rgba(15, 178, 124, 0.1);
      padding: 2px 7px;
      border-radius: 99px;
    }

    /* Tax Cards */
    .tax-cards-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .tax-card {
      background: #f8f8fc;
      border-radius: 14px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .tax-section {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--muted, #767a90);
    }

    .tax-amount {
      font-size: 1.35rem;
      font-weight: 800;

      &.danger { color: #ee4d6b; }
      &.success { color: #0fb27c; }
    }

    .empty-state {
      padding: 30px 16px;
      text-align: center;
      background: var(--card, #ffffff);
      border-radius: 16px;
      border: 1px dashed var(--line, rgba(0, 0, 0, 0.1));
      color: var(--muted, #767a90);
      font-size: 0.85rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;

      p { margin: 0; }
    }

    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .tabular-nums { font-variant-numeric: tabular-nums; }
    .font-bold { font-weight: 700; }
    .text-muted { color: var(--muted, #767a90); }
    .danger { color: #ee4d6b; }
    .success { color: #0fb27c; }

    @media print {
      body { background: #fff !important; }
      .no-print { display: none !important; }
      .statements-page { max-width: 100% !important; padding: 0 !important; }
      .clean-sheet { border: none !important; padding: 0 !important; }
    }
  `],
})
export class StatementsComponent {
  readonly ledgerStore = inject(LedgerStore);

  readonly activeTab = signal<'passbook' | 'monthly' | 'annual' | 'audit'>('passbook');
  readonly auditSummary = this.ledgerStore.sbiAuditSummary;

  // 1. Passbook Explorer State (Cloud Firestore statement records + user-recorded direct statement deposits)
  readonly allStatementRows = computed<SbiPassbookRow[]>(() => {
    const cloudRows = this.ledgerStore.effectiveStatementRecords();
    const liveTxs = this.ledgerStore
      .transactions()
      .filter((t): t is BankPaymentTransaction => !t.deletedAt && t.type === 'bankPayment' && !t.id.startsWith('tx-sbi-'));

    if (liveTxs.length === 0) {
      return cloudRows;
    }

    const dynamicRows: SbiPassbookRow[] = liveTxs.map((t) => {
      const parts = (t.valueDate || t.date).split('-');
      const y = parts[0] || '2026';
      const m = parts[1] || '11';
      const d = parts[2] || '01';
      const postDate = `${d}/${m}/${y}`;
      const creditPaise = t.amount;
      const balancePaise = outstandingAt(t.date, this.ledgerStore.ledgerState());
      return {
        id: t.id,
        postDate,
        valueDate: postDate,
        isoDate: t.date,
        desc: t.notes || 'Direct Statement Deposit',
        refNo: t.reference || '',
        type: 'credit' as const,
        category: 'prepayment' as const,
        debitPaise: paise(0),
        creditPaise,
        balancePaise,
        rawDebit: '',
        rawCredit: (creditPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        rawBalance: (balancePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      };
    });

    return [...dynamicRows, ...cloudRows].sort((a, b) => b.isoDate.localeCompare(a.isoDate));
  });

  readonly selectedCategory = signal<string>('all');
  readonly selectedYear = signal<string>('all');
  readonly selectedAmountRange = signal<string>('all');
  readonly sortOrder = signal<'desc' | 'asc'>('desc');
  readonly expandedTxId = signal<string | null>(null);

  readonly formatCompactPaise = formatCompactPaise;

  readonly hasActiveFilters = computed(() => {
    return (
      this.selectedCategory() !== 'all' ||
      this.selectedYear() !== 'all' ||
      this.selectedAmountRange() !== 'all'
    );
  });

  toggleExpand(id: string): void {
    triggerHaptic('light');
    this.expandedTxId.update((curr) => (curr === id ? null : id));
  }

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
    this.selectedCategory.set('all');
    this.selectedYear.set('all');
    this.selectedAmountRange.set('all');
  }

  getCategoryBadge(cat: SbiPassbookRow['category']): string {
    switch (cat) {
      case 'emi_credit': return 'EMI';
      case 'prepayment': return 'Deposit';
      case 'interest_debit': return 'Interest';
      case 'withdrawal': return 'Withdrawal';
      case 'disbursement': return 'Disbursal';
      default: return 'Transfer';
    }
  }

  getCleanNarration(desc: string, cat: SbiPassbookRow['category']): string {
    if (!desc) return 'Transaction';
    const upper = desc.toUpperCase();

    // 1. Interest debits
    if (cat === 'interest_debit' || upper.includes('TO INTEREST')) {
      return 'Monthly SBI Interest';
    }

    // 2. Standing Instruction / EMI
    if (cat === 'emi_credit' || upper.includes('SI 54897') || upper.includes('TFR SI')) {
      return 'Monthly EMI';
    }

    // 3. Direct statement deposit
    if (upper.includes('DIRECT STATEMENT DEPOSIT') || upper.includes('DEP DIRECT TO STATEMENT')) {
      return 'Direct Statement Deposit';
    }

    // 4. UPI Transfers / Prepayments (NO member names)
    if (upper.includes('UPI/CR/') || upper.includes('UPI/DR/') || upper.includes('UPI')) {
      return 'UPI Prepayment';
    }

    // 5. Loan repayments & memos (NO member names)
    if (upper.includes('LOAN REPAYMENT') || upper.includes('LOAN PREPAYMENT')) {
      return 'Loan Prepayment';
    }
    if (upper.includes('BILL PAYMENT')) {
      return 'Bill Payment';
    }

    // 6. Withdrawals & Disbursements
    if (cat === 'withdrawal' || upper.startsWith('WDL')) {
      return 'OD Withdrawal';
    }
    if (cat === 'disbursement') {
      return 'Loan Disbursement';
    }

    // 7. General deposits vs debits
    if (cat === 'prepayment' || upper.startsWith('DEP')) {
      return 'Online Prepayment';
    }

    return 'Account Transfer';
  }

  sanitizeNarration(desc: string): string {
    if (!desc) return '';
    return desc
      .replace(/VIKAS\s*C?\s*PATIL/gi, 'ACCOUNT HOLDER')
      .replace(/VIKAS\s*(?:&|AND|\/)?\s*SHRUTHI/gi, 'ONLINE PREPAYMENT')
      .replace(/VISHWAS\s*(?:&|AND|\/)?\s*BHAVYA/gi, 'ONLINE PREPAYMENT')
      .replace(/VISHWAS/gi, 'ONLINE')
      .replace(/BHAVYA/gi, 'ONLINE')
      .replace(/SHRUTHI/gi, 'ONLINE')
      .replace(/VIKAS/gi, 'ONLINE')
      .replace(/CSP/gi, 'ONLINE');
  }

  formatDateDisplay(postDate: string): string {
    const parts = postDate.split('/');
    if (parts.length === 3) {
      const d = parts[0];
      const m = parseInt(parts[1], 10);
      const y = parts[2];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d} ${months[m - 1] || parts[1]} ${y}`;
    }
    return postDate;
  }

  readonly filteredRows = computed(() => {
    let rows = [...this.allStatementRows()];
    const cat = this.selectedCategory();
    const yr = this.selectedYear();
    const amt = this.selectedAmountRange();
    const sort = this.sortOrder();

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

  readonly selectedPeriod = signal<string>(
    new Date().toISOString().slice(0, 7)
  );

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
        // User cancelled
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

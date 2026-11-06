import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LedgerStore, SettingsStore } from '../../core/state';
import {
  AvatarComponent,
  BarChartComponent,
  SparklineChartComponent,
} from '../../shared/ui';
import { CountUpDirective } from '../../shared/ui/count-up/count-up.directive';
import {
  computeRupeeSplit,
  ContributionTransaction,
  divideHalfUp,
  formatCompactPaise,
  formatPaise,
  getTransactionAmount,
  getTransactionMode,
  Paise,
  paise,
  simulate,
  simulateV2,
  toPaise,
  toRupees,
  Transaction,
} from '../../core/engine';
import { AddEditTransactionSheetComponent } from '../transaction-sheet/add-edit-transaction-sheet.component';
import { DailyLedgerSheetComponent } from '../daily-ledger/daily-ledger-sheet.component';

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CountUpDirective,
    SparklineChartComponent,
    BarChartComponent,
    AvatarComponent,
    AddEditTransactionSheetComponent,
    DailyLedgerSheetComponent,
  ],
  template: `
    <div class="home-page-container">
      <!-- 1. Top User Profile Bar (Screenshot Matched) -->
      <header class="app-top-bar">
        <div class="user-profile-cluster">
          <app-avatar name="Vishwas" [size]="44" [circular]="true" />
          <div class="profile-text-wrap">
            <span class="profile-greeting">Welcome back</span>
            <h1 class="profile-user-name">Vishwas</h1>
          </div>
        </div>
      </header>

      <!-- 2. Matte Black Hero Card (Current Loan Balance) -->
      <div class="matte-hero-banner" role="region" aria-label="Current Loan Balance">
        <div class="hero-left-content">
          <div class="hero-badge-pill">
            <span class="lightning-bolt">⚡</span>
            <span>Total Loan Left to Pay · {{ (ledgerStore.loan().currentRateBps / 100).toFixed(2) }}% Interest</span>
          </div>
          <div class="hero-number-wrap">
            <div class="hero-balance-headline tabular-nums" [appCountUp]="ledgerStore.currentOutstanding()">
              {{ formatPaise(ledgerStore.currentOutstanding()) }}
            </div>
            <span class="hero-balance-sub">
              Adds ₹2,573 interest every day · Debited on 30th
            </span>
          </div>
        </div>

        <button
          type="button"
          class="hero-circle-cta"
          (click)="openAddWith('bankPayment')"
          aria-label="Pay Bank EMI"
          title="Record Bank Payment"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#111216" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      <!-- 3. Section: This Month & Future -->
      <section class="home-section">
        <h2 class="section-main-heading">This Month & Future</h2>

        <div class="dual-squircle-grid">
          <!-- Card 1: This Month -->
          <button
            type="button"
            class="squircle-metric-card"
            (click)="isDailyLedgerOpen.set(true)"
            aria-label="View This Month Breakdown"
          >
            <div class="card-top-header">
              <span class="card-caption-title">This Month</span>
              <span class="card-chevron-icon">›</span>
            </div>
            <div class="card-metric-body">
              <div class="metric-pair">
                <span class="metric-big-num tabular-nums" [appCountUp]="monthlyCutCalculation().totalCut">
                  {{ formatPaise(monthlyCutCalculation().totalCut) }}
                </span>
                <span class="metric-label-sub">
                  {{ monthlyCutCalculation().isRecorded ? 'Money Cut (Paid)' : 'Per Month Cut (Est.)' }}
                </span>
              </div>
              <div class="metric-split-row">
                <div class="metric-split-item">
                  <span class="metric-split-val tabular-nums text-green">
                    {{ formatPaise(monthlyCutCalculation().principalCut) }}
                  </span>
                  <span class="metric-split-lbl">Loan Reduced</span>
                </div>
                <div class="metric-split-item">
                  <span class="metric-split-val tabular-nums">
                    {{ formatPaise(monthlyCutCalculation().interestCut) }}
                  </span>
                  <span class="metric-split-lbl">Interest Cut</span>
                </div>
              </div>
            </div>
          </button>

          <!-- Card 2: Debt Free Target -->
          <div
            class="squircle-metric-card"
            aria-label="Debt Free Target"
          >
            <div class="card-top-header">
              <span class="card-caption-title">Debt Free By</span>
              <span class="card-badge-chip">{{ baselineSimResult()?.closureDate || 'Active' }}</span>
            </div>
            <div class="card-metric-body">
              <div class="metric-stat-row">
                <div>
                  <span class="metric-big-num tabular-nums">
                    {{ ((baselineSimResult()?.months || 62) / 12).toFixed(1) }}
                  </span>
                  <span class="metric-label-sub">Years Left</span>
                </div>
                <div>
                  <span class="metric-big-num tabular-nums">
                    {{ baselineSimResult()?.months || 62 }}
                  </span>
                  <span class="metric-label-sub">Months Target</span>
                </div>
              </div>
              @if (simulationResult()) {
                <div class="sparkline-wrap">
                  <app-sparkline-chart [data]="simulationResult()!.schedule" />
                </div>
              }
            </div>
          </div>

          <!-- Card 3: Daily Bank Interest & Monthly Estimate -->
          <button
            type="button"
            class="squircle-metric-card full-span-card"
            (click)="isDailyLedgerOpen.set(true)"
            aria-label="View Daily Bank Interest Breakdown"
          >
            <div class="card-top-header">
              <div class="header-left-cluster">
                <span class="card-caption-title">Daily Bank Interest</span>
                <span class="card-badge-chip rate-pill">{{ (ledgerStore.loan().currentRateBps / 100).toFixed(2) }}% p.a.</span>
              </div>
              <span class="card-chevron-icon">›</span>
            </div>
            <div class="card-metric-body">
              <div class="metric-pair">
                <span class="metric-big-num tabular-nums" [appCountUp]="dailyInterestCalculation().dailyInterest" [showDecimals]="true">
                  {{ formatPaise(dailyInterestCalculation().dailyInterest, { showPaise: true }) }}
                </span>
                <span class="metric-label-sub">
                  <span class="today-highlight-pill">Today</span> Interest added to loan
                </span>
              </div>
              <div class="metric-split-row">
                <div class="metric-split-item">
                  <span class="metric-split-val tabular-nums">
                    {{ formatPaise(dailyInterestCalculation().monthlyEstimate) }}
                  </span>
                  <span class="metric-split-lbl">Per Month Estimate</span>
                </div>
                <div class="metric-split-item text-right">
                  <span class="metric-split-val tabular-nums">
                    {{ formatCompactPaise(ledgerStore.currentOutstanding()) }}
                  </span>
                  <span class="metric-split-lbl">Current Balance</span>
                </div>
              </div>
            </div>
          </button>
        </div>
      </section>

      <!-- 4. Section: Feature Progress Card -->
      <section class="home-section">
        <div class="progress-feature-card">
          <div class="progress-card-info">
            <span class="progress-eyebrow">Overall Progress</span>
            <h3 class="progress-main-title">
              {{ formatPaise(repaidAmount()) }} Cleared
            </h3>
            <p class="progress-desc">
              You have cleared {{ repaidPercent().toFixed(1) }}% of the total {{ formatCompactPaise(ledgerStore.loan().sanctionedLimit) }} loan amount so far.
            </p>
          </div>

          <!-- Circular SVG Radial Gauge -->
          <div class="progress-arc-visual">
            <svg class="progress-radial-svg" viewBox="0 0 100 100">
              <circle class="arc-bg-ring" cx="50" cy="50" r="40" fill="none" stroke-width="7" />
              <circle
                class="arc-progress-ring"
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke-width="7"
                stroke-linecap="round"
                [style.strokeDasharray]="arcCircumference"
                [style.strokeDashoffset]="arcStrokeDashoffset()"
              />
            </svg>
            <div class="arc-inner-label">
              <span class="arc-pct-text">{{ repaidPercent().toFixed(1) }}%</span>
              <span class="arc-pct-sub">PAID OFF</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 5. Section: Where Did All Your Money Go? -->
      <section class="home-section">
        <div class="insight-squircle-card">
          <h2 class="section-main-heading">Where Did All Your Money Go?</h2>
          <span class="section-sub-caption">
            @if (hasRecordedPayments()) {
              How much of your deposited money actually reduced the loan vs went to bank interest
            } @else {
              Estimated breakdown of your ₹{{ (toRupees(ledgerStore.loan().monthlyTarget) || 240000).toLocaleString('en-IN') }} monthly target between loan reduction and bank interest
            }
          </span>

          <div class="rupee-split-container">
            <div class="split-bar-track">
              <div
                class="split-segment principal"
                [style.width.%]="rupeeSplit().principalPercent"
                [title]="'Reduced Loan: ' + rupeeSplit().principalPercent.toFixed(1) + '%'"
              ></div>
              <div
                class="split-segment interest"
                [style.width.%]="rupeeSplit().interestPercent"
                [title]="'Bank Interest: ' + rupeeSplit().interestPercent.toFixed(1) + '%'"
              ></div>
            </div>

            <div class="split-stats-grid">
              <div class="split-stat-card principal">
                <span class="stat-badge green">Reduced Your Loan</span>
                <strong class="stat-amount tabular-nums">{{ formatPaise(rupeeSplit().totalPrincipalReduced) }}</strong>
                <small class="stat-percent">{{ rupeeSplit().principalPercent.toFixed(1) }}% of total paid</small>
              </div>
              <div class="split-stat-card interest">
                <span class="stat-badge dark">Bank Interest Charges</span>
                <strong class="stat-amount tabular-nums">{{ formatPaise(rupeeSplit().totalInterestPaid) }}</strong>
                <small class="stat-percent">{{ rupeeSplit().interestPercent.toFixed(1) }}% of total paid</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 6. Section: Monthly Deposit Trend -->
      <section class="home-section">
        <div class="insight-squircle-card">
          <h2 class="section-main-heading">Monthly Deposit Trend</h2>
          <span class="section-sub-caption">Total money deposited each month over past 6 months</span>

          <div class="chart-embed-wrapper" style="margin-top: 14px">
            <span class="custom-chart-label" style="margin-bottom: 8px; display: block">Total Deposited Each Month (₹)</span>
            <app-bar-chart [data]="monthlyBarData()" />
          </div>
        </div>
      </section>

      <!-- 5. Section: Recent Payments -->
      <section class="home-section">
        <div class="section-title-bar">
          <div>
            <h2 class="section-main-heading">Recent Payments</h2>
            <span class="section-sub-caption">Latest bank payments & member deposits</span>
          </div>
          <button type="button" class="section-see-all-btn" (click)="router.navigate(['/history'])">
            View all ›
          </button>
        </div>

        <div class="squircle-items-list">
          @for (tx of ledgerStore.recentTransactions(); track tx.id) {
            <button
              type="button"
              class="squircle-item-row clickable"
              (click)="editSelectedTx(tx)"
              [attr.aria-label]="'Edit payment ' + getTxTitle(tx)"
            >
              <div class="item-left-cluster">
                <div class="activity-icon-bubble" [class.payment]="tx.type === 'bankPayment'">
                  {{ tx.type === 'bankPayment' ? '🏦' : '👤' }}
                </div>
                <div class="item-text-info">
                  <span class="item-primary-name">{{ getTxTitle(tx) }}</span>
                  <span class="item-secondary-sub">
                    {{ tx.date }} · {{ getTransactionMode(tx) }}
                  </span>
                </div>
              </div>
              <div class="item-right-cluster">
                <span
                  class="item-amount-val tabular-nums"
                  [class.positive]="tx.type === 'contribution'"
                  [class.negative]="tx.type === 'bankPayment'"
                >
                  {{ tx.type === 'contribution' ? '+' : '−' }}{{ formatPaise(getTransactionAmount(tx)) }}
                </span>
                <span class="item-chevron">›</span>
              </div>
            </button>
          } @empty {
            <div class="squircle-empty-card">
              <p class="empty-hint">No payments recorded yet. Tap ＋ below to add a payment or deposit.</p>
            </div>
          }
        </div>
      </section>

      <!-- Add/Edit Transaction Bottom Sheet Instance -->
      <app-add-edit-transaction-sheet
        [isOpen]="isSheetOpen()"
        [editTransaction]="selectedTxForEdit()"
        [initialType]="initialSheetType()"
        (dismissed)="isSheetOpen.set(false); selectedTxForEdit.set(null)"
      />

      <!-- Daily Ledger Sheet Instance -->
      <app-daily-ledger-sheet
        [isOpen]="isDailyLedgerOpen()"
        (dismissed)="isDailyLedgerOpen.set(false)"
      />
    </div>
  `,
  styles: `
    .home-page-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow-x: hidden;
      padding: 0 0 96px;
    }

    /* 1. Top User Profile Bar */
    .app-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 8px 0 20px;
      padding: 0 4px;
    }

    .user-profile-cluster {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .profile-avatar-circle {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #111216;
      color: #ffffff;
      display: grid;
      place-items: center;
      font-size: 16px;
      font-weight: 800;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
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

    .profile-user-name {
      font-size: 18px;
      font-weight: 800;
      color: #111216;
      letter-spacing: -0.02em;
      margin: 0;
    }

    .top-circle-action-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.04);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        background: #f7f8fa;
        transform: scale(1.05);
      }

      &:active {
        transform: scale(0.95);
      }
    }

    /* 2. Matte Black Hero Card */
    .matte-hero-banner {
      background: #111216;
      color: #ffffff;
      border-radius: 28px;
      padding: 22px 24px;
      margin-bottom: 26px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 12px 32px -6px rgba(0, 0, 0, 0.22);
      cursor: pointer;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        transform: translateY(-2px);
      }

      &:active {
        transform: scale(0.99);
      }
    }

    .hero-left-content {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .hero-badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
      letter-spacing: -0.01em;
    }

    .lightning-bolt {
      color: #f59e0b;
      font-size: 14px;
    }

    .hero-number-wrap {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .hero-balance-headline {
      font-size: clamp(26px, 6.5vw, 34px);
      font-weight: 800;
      letter-spacing: -0.035em;
      line-height: 1.1;
      color: #ffffff;
    }

    .hero-balance-sub {
      font-size: 12px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.6);
    }

    .hero-circle-cta {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #ffffff;
      border: none;
      display: grid;
      place-items: center;
      cursor: pointer;
      flex-shrink: 0;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        transform: scale(1.08);
      }

      &:active {
        transform: scale(0.92);
      }
    }

    /* 3. Section Containers */
    .home-section {
      display: flex;
      flex-direction: column;
      margin-bottom: 26px;
    }

    .section-main-heading {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #111216;
      margin: 0 0 14px 4px;
    }

    .section-title-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin: 0 4px 14px;
    }

    .section-sub-caption {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #8e8e93;
      margin-top: 2px;
    }

    .section-see-all-btn {
      background: transparent;
      border: none;
      color: #8e8e93;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      padding: 4px 6px;
      transition: color 0.15s ease;

      &:hover {
        color: #111216;
      }
    }

    /* Dual Squircle Grid */
    .dual-squircle-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .squircle-metric-card {
      background: #ffffff;
      border: none;
      width: 100%;
      text-align: left;
      font-family: inherit;
      border-radius: 26px;
      padding: 18px 20px;
      box-shadow: var(--shadow-card);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 150px;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.05);
      }

      &:active {
        transform: scale(0.98);
      }

      &.full-span-card {
        grid-column: 1 / -1;
      }
    }

    .card-top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-left-cluster {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .rate-pill {
      font-size: 11px;
      font-weight: 700;
      color: #6c4cff;
      background: rgba(108, 76, 255, 0.08);
      padding: 3px 8px;
      border-radius: var(--radius-pill, 99px);
    }

    .card-caption-title {
      font-size: 14px;
      font-weight: 700;
      color: #111216;
      letter-spacing: -0.01em;
    }

    .card-chevron-icon {
      font-size: 16px;
      color: #9ca3af;
      font-weight: 700;
    }

    .card-metric-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .metric-pair {
      display: flex;
      flex-direction: column;
      gap: 2px;

      &.secondary {
        margin-top: 4px;
      }
    }

    .metric-split-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      margin-top: 4px;
      padding-top: 8px;
      border-top: 1px solid var(--line, rgba(0, 0, 0, 0.06));
    }

    .metric-split-item {
      display: flex;
      flex-direction: column;
      gap: 1px;

      &.text-right {
        text-align: right;
        align-items: flex-end;
      }
    }

    .metric-split-val {
      font-size: 13px;
      font-weight: 700;
      color: #111216;
      line-height: 1.2;

      &.text-green {
        color: #0fb27c;
      }
    }

    .metric-split-lbl {
      font-size: 10px;
      font-weight: 500;
      color: #8e8e93;
    }

    .metric-big-num {
      font-size: clamp(18px, 4.5vw, 22px);
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #111216;
      line-height: 1.15;
    }

    .metric-small-num {
      font-size: 13px;
      font-weight: 700;
      color: #4b4c52;
    }

    .metric-label-sub {
      font-size: 11px;
      font-weight: 500;
      color: #8e8e93;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .today-highlight-pill {
      display: inline-flex;
      align-items: center;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: #111216;
      color: #ffffff;
      padding: 1px 7px;
      border-radius: var(--radius-pill, 99px);
      line-height: 1.4;
    }

    .metric-stat-row {
      display: flex;
      gap: 16px;
    }

    .sparkline-wrap {
      margin-top: 4px;
    }

    /* 4. Progress Feature Card (Screenshot Matched) */
    .progress-feature-card {
      background: #ffffff;
      border-radius: 28px;
      padding: 24px;
      box-shadow: var(--shadow-card);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }

    .progress-card-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .progress-eyebrow {
      font-size: 11px;
      font-weight: 600;
      color: #8e8e93;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .progress-main-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #111216;
      margin: 2px 0;
    }

    .progress-desc {
      font-size: 12px;
      font-weight: 500;
      color: #8e8e93;
      line-height: 1.4;
      margin: 0;
    }

    .action-pill-black {
      background: #111216;
      color: #ffffff;
      border-radius: var(--radius-pill, 9999px);
      padding: 10px 20px;
      font-size: 13px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      align-self: flex-start;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        background: #2a2b32;
        transform: translateY(-1px);
      }

      &:active {
        transform: scale(0.96);
      }
    }

    /* Circular SVG Gauge */
    .progress-arc-visual {
      position: relative;
      width: 90px;
      height: 90px;
      flex-shrink: 0;
    }

    .progress-radial-svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    .arc-bg-ring {
      stroke: #f0f1f4;
    }

    .arc-progress-ring {
      stroke: #111216;
      transition: stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .arc-inner-label {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .arc-pct-text {
      font-size: 14px;
      font-weight: 800;
      color: #111216;
      letter-spacing: -0.02em;
    }

    .arc-pct-sub {
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #8e8e93;
    }

    /* 5. Squircle Items List (Members & Activity) */
    .squircle-items-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .squircle-item-row {
      background: #ffffff;
      border: none;
      width: 100%;
      text-align: left;
      font-family: inherit;
      border-radius: 22px;
      padding: 14px 18px;
      box-shadow: var(--shadow-card);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.22s ease;

      &:hover {
        transform: translateY(-1.5px);
        box-shadow: 0 6px 20px -2px rgba(0, 0, 0, 0.04);
      }

      &:active {
        transform: scale(0.985);
      }
    }

    .item-left-cluster {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
      flex: 1;
    }

    .item-text-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .item-primary-name {
      font-size: 14px;
      font-weight: 700;
      color: #111216;
      letter-spacing: -0.01em;
    }

    .item-secondary-sub {
      font-size: 11px;
      font-weight: 500;
      color: #8e8e93;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-right-cluster {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .item-share-pill {
      font-size: 12px;
      font-weight: 700;
      color: #111216;
      background: #f3f4f7;
      padding: 4px 10px;
      border-radius: var(--radius-pill, 9999px);
    }

    .item-chevron {
      font-size: 16px;
      color: #9ca3af;
      font-weight: 700;
    }

    .activity-icon-bubble {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: #f3f4f7;
      display: grid;
      place-items: center;
      font-size: 18px;
      flex-shrink: 0;

      &.payment {
        background: #eaecee;
      }
    }

    .item-amount-val {
      font-size: 14px;
      font-weight: 800;

      &.positive {
        color: #10b981;
      }

      &.negative {
        color: #111216;
      }
    }

    .squircle-empty-card {
      background: #ffffff;
      border-radius: 22px;
      padding: 24px;
      text-align: center;
      box-shadow: var(--shadow-card);
    }

    .empty-hint {
      font-size: 13px;
      font-weight: 500;
      color: #8e8e93;
      margin: 0;
    }

    /* Luxury Squircle Card for Insights on Home */
    .insight-squircle-card {
      background: #ffffff;
      border-radius: 26px;
      padding: 22px 24px;
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .card-badge-chip {
      font-size: 11px;
      font-weight: 800;
      color: #10b981;
      background: rgba(16, 185, 129, 0.12);
      padding: 3px 8px;
      border-radius: var(--radius-pill, 99px);
    }

    .custom-chart-label {
      font-size: 10px;
      font-weight: 700;
      color: #8e8e93;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .chart-embed-wrapper {
      margin-top: 4px;
    }

    /* Rupee Split */
    .rupee-split-container {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .split-bar-track {
      height: 18px;
      border-radius: 99px;
      background: #f2f3f6;
      display: flex;
      overflow: hidden;
    }

    .split-segment {
      height: 100%;
      transition: width 0.3s ease;
      &.principal { background: #0fb27c; }
      &.interest { background: #111216; }
    }

    .split-stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .split-stat-card {
      background: #f8f9fb;
      border-radius: 18px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border: 1px solid var(--line, rgba(0,0,0,0.06));
    }

    .stat-badge {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 9999px;
      width: fit-content;

      &.green {
        background: rgba(15, 178, 124, 0.15);
        color: #0fb27c;
      }

      &.dark {
        background: #111216;
        color: #ffffff;
      }
    }

    .stat-amount {
      font-size: 16px;
      font-weight: 800;
      color: #111216;
      letter-spacing: -0.02em;
    }

    .stat-percent {
      font-size: 11px;
      font-weight: 500;
      color: #8e8e93;
    }
  `,
})
export class HomeComponent {
  readonly ledgerStore = inject(LedgerStore);
  readonly settings = inject(SettingsStore);
  readonly router = inject(Router);

  readonly formatPaise = formatPaise;
  readonly formatCompactPaise = formatCompactPaise;
  readonly toRupees = toRupees;
  readonly getTransactionAmount = getTransactionAmount;
  readonly getTransactionMode = getTransactionMode;

  readonly isSheetOpen = signal<boolean>(false);
  readonly isDailyLedgerOpen = signal<boolean>(false);
  readonly selectedTxForEdit = signal<Transaction | null>(null);
  readonly initialSheetType = signal<'contribution' | 'bankPayment'>('contribution');

  readonly summary = this.ledgerStore.thisMonthSummary;
  readonly funds = this.ledgerStore.groupFunds;

  readonly arcRadius = 40;
  readonly arcCircumference = 2 * Math.PI * this.arcRadius;

  readonly monthlyCutCalculation = computed(() => {
    const sum = this.summary();
    const loan = this.ledgerStore.loan();
    const principal = this.ledgerStore.currentOutstanding();
    const rateBps = loan.currentRateBps;

    let estInterest = sum.interestIncurredEst;
    if (estInterest <= 0 && principal > 0 && rateBps > 0) {
      estInterest = paise(Math.round((principal * rateBps) / (12 * 10000)));
    }

    const target = loan.monthlyTarget || toPaise(240000);
    const hasRecordedPayment = sum.paidToBank > 0;

    const totalCut = hasRecordedPayment ? sum.paidToBank : target;
    const interestCut = hasRecordedPayment
      ? paise(Math.min(sum.paidToBank, estInterest))
      : paise(Math.min(target, estInterest));
    const principalCut = hasRecordedPayment
      ? sum.principalReduced
      : paise(Math.max(0, target - interestCut));

    return {
      isRecorded: hasRecordedPayment,
      totalCut,
      principalCut,
      interestCut,
    };
  });

  readonly dailyInterestCalculation = computed(() => {
    const loan = this.ledgerStore.loan();
    const principal = this.ledgerStore.currentOutstanding();
    const rateBps = loan.currentRateBps;
    const basisDays = loan.bankRules?.dayCountBasis === '360' ? 360 : 365;

    let dailyInterest = paise(0);
    if (principal > 0 && rateBps > 0) {
      const numerator = BigInt(principal) * BigInt(rateBps) * 1_000_000n;
      const denominator = BigInt(basisDays) * 10_000n;
      const scaled = numerator / denominator;
      dailyInterest = paise(Number(divideHalfUp(scaled, 1_000_000n)));
    }

    const sum = this.summary();
    let monthlyEstimate = sum.interestIncurredEst;
    if (monthlyEstimate <= 0 && principal > 0 && rateBps > 0) {
      const numMonth = BigInt(principal) * BigInt(rateBps) * 1_000_000n;
      const denMonth = 12n * 10_000n * 1_000_000n;
      monthlyEstimate = paise(Number(divideHalfUp(numMonth, denMonth)));
    }

    return {
      dailyInterest,
      monthlyEstimate,
      rateBps,
    };
  });

  readonly repaidAmount = computed<Paise>(() => {
    const lim = this.ledgerStore.loan().sanctionedLimit;
    const out = this.ledgerStore.currentOutstanding();
    return Math.max(0, lim - out) as Paise;
  });

  readonly repaidPercent = computed(() => {
    const lim = this.ledgerStore.loan().sanctionedLimit;
    if (lim <= 0) return 0;
    return (this.repaidAmount() / lim) * 100;
  });

  readonly arcStrokeDashoffset = computed(() => {
    const pct = Math.min(100, Math.max(0, this.repaidPercent()));
    return this.arcCircumference - (pct / 100) * this.arcCircumference;
  });

  readonly currentMonthFormatted = computed(() => {
    return new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  });

  readonly isThisMonthReconciled = computed<boolean>(() => {
    const curMonth = new Date().toISOString().slice(0, 7);
    return this.ledgerStore.snapshots().some(
      (s) => !s.deletedAt && s.date.slice(0, 7) === curMonth && s.variance === 0
    );
  });

  readonly simulationResult = computed(() => {
    const loan = this.ledgerStore.loan();
    const out = this.ledgerStore.currentOutstanding();
    return simulate(out, loan.monthlyTarget, loan.currentRateBps);
  });

  readonly rupeeSplit = computed(() => {
    return computeRupeeSplit(this.ledgerStore.ledgerState());
  });

  readonly hasRecordedPayments = computed<boolean>(() => {
    return this.ledgerStore
      .transactions()
      .some((t) => !t.deletedAt && (t.type === 'contribution' || t.type === 'bankPayment'));
  });

  readonly monthlyBarData = computed(() => {
    const txs = this.ledgerStore
      .transactions()
      .filter((t): t is ContributionTransaction => t.type === 'contribution' && !t.deletedAt);
    const monthsMap = new Map<string, number>();

    const now = new Date();
    for (let k = 5; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsMap.set(key, 0);
    }

    for (const t of txs) {
      if (monthsMap.has(t.forMonth)) {
        monthsMap.set(t.forMonth, (monthsMap.get(t.forMonth) || 0) + t.amount / 100);
      }
    }

    return Array.from(monthsMap.entries()).map(([monthKey, val]) => {
      const d = new Date(`${monthKey}-01T12:00:00`);
      const label = d.toLocaleDateString('en-IN', { month: 'short' });
      return { label, value: Math.round(val) };
    });
  });

  readonly baselineSimResult = computed(() => {
    const principal = this.ledgerStore.currentOutstanding();
    const rateBps = this.ledgerStore.loan().currentRateBps;
    const monthlyTarget = this.ledgerStore.loan().monthlyTarget || toPaise(240000);
    return simulateV2({
      principal,
      monthlyPayment: monthlyTarget,
      rateBps,
      paymentDayOfMonth: 5,
      rateShiftBps: 0,
      prepayments: [],
      drawdowns: [],
      dayCountBasis: this.ledgerStore.loan().bankRules?.dayCountBasis || 'actual/365',
    });
  });

  openAddWith(type: 'contribution' | 'bankPayment'): void {
    this.initialSheetType.set(type);
    this.selectedTxForEdit.set(null);
    this.isSheetOpen.set(true);
  }

  editSelectedTx(tx: Transaction): void {
    this.selectedTxForEdit.set(tx);
    this.isSheetOpen.set(true);
  }

  getTxTitle(tx: Transaction): string {
    if (tx.type === 'contribution') {
      const member = this.ledgerStore.members().find((m) => m.id === tx.memberId);
      return member ? `${member.name} (Deposit)` : 'Member Deposit';
    }
    if (tx.type === 'bankPayment') return 'Payment to Bank (EMI)';
    if (tx.type === 'withdrawal') return 'Money Withdrawn';
    if (tx.type === 'principalAdjustment') return 'Balance Adjustment';
    if (tx.type === 'manualCorrection') return 'Bank Passbook Match';
    return 'Payment';
  }
}

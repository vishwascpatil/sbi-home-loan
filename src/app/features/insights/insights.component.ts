import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { LedgerStore } from '../../core/state';
import { BarChartComponent } from '../../shared/ui';
import {
  computeRupeeSplit,
  ContributionTransaction,
  formatCompactPaise,
  formatPaise,
  simulateV2,
  toPaise,
  toRupees,
} from '../../core/engine';

@Component({
  selector: 'app-insights',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BarChartComponent],
  template: `
    <div class="insights-page-container">
      <!-- 1. Top Bar -->
      <header class="app-top-bar">
        <div class="user-profile-cluster">
          <div class="profile-avatar-circle" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 3v18h18"></path>
              <path d="m19 9-5 5-4-4-3 3"></path>
            </svg>
          </div>
          <div class="profile-text-wrap">
            <span class="profile-greeting">Loan Forecast & Stats</span>
            <h1 class="profile-user-name">Loan Insights</h1>
          </div>
        </div>
      </header>

      <!-- 2. Matte Black Hero Banner -->
      <div class="matte-hero-banner" role="region" aria-label="Debt Free Target Overview">
        <div class="hero-left-content">
          <div class="hero-badge-pill">
            <span class="lightning-bolt">⚡</span>
            <span>Debt-Free Target · Daily Interest</span>
          </div>
          <div class="hero-number-wrap">
            @if (baselineSimResult()) {
              <div class="hero-balance-headline tabular-nums">
                {{ baselineSimResult()!.closureDate }}
              </div>
              <span class="hero-balance-sub">
                Takes {{ baselineSimResult()!.months }} months at current monthly target (₹{{ (toRupees(ledgerStore.loan().monthlyTarget) || 240000).toLocaleString('en-IN') }}/mo)
              </span>
            } @else {
              <div class="hero-balance-headline">Active Loan</div>
              <span class="hero-balance-sub">Based on current bank interest rate and monthly target</span>
            }
          </div>
        </div>
      </div>

      <!-- 3. Section: Monthly Deposit Trend -->
      <section class="page-section">
        <div class="insight-squircle-card">
          <h2 class="card-main-title">Monthly Deposit Trend</h2>
          <span class="card-sub-caption">Total money the family deposited each month over past 6 months</span>

          <div class="chart-embed-wrapper" style="margin-top: 14px">
            <span class="custom-label" style="margin-bottom: 8px; display: block">Total Deposited Each Month (₹)</span>
            <app-bar-chart [data]="monthlyBarData()" />
          </div>
        </div>
      </section>

      <!-- 4. Section: Where Did All Your Money Go? -->
      <section class="page-section">
        <div class="insight-squircle-card">
          <h2 class="card-main-title">Where Did All Your Money Go?</h2>
          <span class="card-sub-caption">How much of your money actually reduced the loan vs went to bank interest</span>

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
    </div>
  `,
  styles: `
    .insights-page-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow-x: hidden;
      padding: 0 0 96px;
    }

    /* 1. Top Bar */
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
      font-size: clamp(24px, 6vw, 32px);
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

    /* Section Containers */
    .page-section {
      display: flex;
      flex-direction: column;
      margin-bottom: 24px;
    }

    /* Luxury Squircle Card Component */
    .insight-squircle-card {
      background: #ffffff;
      border-radius: 26px;
      padding: 22px 24px;
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .card-main-title {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #111216;
      margin: 0;
    }

    .card-sub-caption {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #8e8e93;
      margin-top: 2px;
    }

    .custom-label {
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
export class InsightsComponent {
  readonly ledgerStore = inject(LedgerStore);

  readonly rupeeSplit = computed(() => {
    return computeRupeeSplit(this.ledgerStore.ledgerState());
  });

  readonly formatPaise = formatPaise;
  readonly formatCompactPaise = formatCompactPaise;
  readonly toRupees = toRupees;

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
}

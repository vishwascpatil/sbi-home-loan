import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { LedgerStore } from '../../core/state';
import {
  AmortizationAreaChartComponent,
  AvatarComponent,
  BarChartComponent,
  CountUpDirective,
} from '../../shared/ui';
import {
  computeAmortizationHistory,
  computeMemberConsistencyScores,
  computeRupeeSplit,
  ContributionTransaction,
  formatCompactPaise,
  formatPaise,
  Paise,
  simulateV2,
  toPaise,
  toRupees,
  ZERO_PAISE,
} from '../../core/engine';

@Component({
  selector: 'app-insights',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CountUpDirective,
    BarChartComponent,
    AvatarComponent,
    AmortizationAreaChartComponent,
  ],
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

      <!-- 3. Section: Overview Dual Squircle Grid -->
      <section class="page-section">
        <h2 class="section-main-heading">Quick Summary</h2>

        <div class="dual-squircle-grid">
          <!-- Card 1: Monthly Deposit Average -->
          <div class="squircle-metric-card">
            <div class="card-top-header">
              <span class="card-caption-title">Average Monthly Deposit</span>
              <span class="card-chevron-icon">›</span>
            </div>
            <div class="card-metric-body">
              <div class="metric-pair">
                <span class="metric-big-num tabular-nums" [appCountUp]="monthlyAverage()">
                  {{ formatPaise(monthlyAverage()) }}
                </span>
                <span class="metric-label-sub">Average collected per month</span>
              </div>
              <div class="metric-pair secondary">
                <span class="metric-small-num">
                  Top Contributor: {{ highestContributor().name }}
                </span>
                <span class="metric-label-sub">{{ formatCompactPaise(highestContributor().lifetimeContribution) }} total paid</span>
              </div>
            </div>
          </div>

          <!-- Card 2: Rupee Equity Ratio -->
          <div class="squircle-metric-card">
            <div class="card-top-header">
              <span class="card-caption-title">Where Your Money Goes</span>
              <span class="card-chevron-icon">›</span>
            </div>
            <div class="card-metric-body">
              <div class="metric-stat-row">
                <div>
                  <span class="metric-big-num">{{ rupeeSplit().principalPercent.toFixed(0) }}%</span>
                  <span class="metric-label-sub">Loan Reduced</span>
                </div>
                <div>
                  <span class="metric-big-num">{{ rupeeSplit().interestPercent.toFixed(0) }}%</span>
                  <span class="metric-label-sub">Bank Interest</span>
                </div>
              </div>
              <!-- Mini Dual Split Track -->
              <div class="mini-split-track">
                <div class="split-fill principal" [style.width.%]="rupeeSplit().principalPercent"></div>
                <div class="split-fill interest" [style.width.%]="rupeeSplit().interestPercent"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. Section: Contribution Analytics & Trend -->
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

      <!-- 5. Section: Where Each Rupee Went -->
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

      <!-- 6. Section: Historical Amortization -->
      <section class="page-section">
        <div class="insight-squircle-card">
          <h2 class="card-main-title">Loan Reduction vs Interest Over Time</h2>
          <span class="card-sub-caption">Track how the loan goes down as you keep paying interest</span>
          <div class="chart-embed-wrapper">
            <app-amortization-area-chart [points]="amortizationHistory()" />
          </div>
        </div>
      </section>

      <!-- 7. Section: Member Consistency & Streaks -->
      <section class="page-section">
        <div class="insight-squircle-card">
          <h2 class="card-main-title">On-Time Payment Streaks</h2>
          <span class="card-sub-caption">Who pays regularly on or before the 5th of each month</span>

          <div class="consistency-list">
            @for (c of memberConsistency(); track c.memberId) {
              <div class="consistency-row">
                <div class="member-info-col">
                  <app-avatar [name]="c.name" [colorIndex]="$index" [size]="32" />
                  <div>
                    <strong class="c-name">{{ c.name }}</strong>
                    <small class="c-streak">🔥 {{ c.currentStreakMonths }} month streak</small>
                  </div>
                </div>

                <div class="metrics-col">
                  <div class="metric-pill">
                    <span class="pill-label">On-Time</span>
                    <span class="pill-val" [class.high]="c.onTimePercent >= 80">{{ c.onTimePercent }}%</span>
                  </div>
                  <div class="metric-pill">
                    <span class="pill-label">Target Met</span>
                    <span class="pill-val" [class.high]="c.targetAdherencePercent >= 80">{{ c.targetAdherencePercent }}%</span>
                  </div>
                </div>
              </div>
            }
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

    /* 3. Section Containers */
    .page-section {
      display: flex;
      flex-direction: column;
      margin-bottom: 24px;
    }

    .section-main-heading {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #111216;
      margin: 0 0 14px 4px;
    }

    /* Dual Squircle Grid */
    .dual-squircle-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .squircle-metric-card {
      background: #ffffff;
      border-radius: 26px;
      padding: 18px 20px;
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 140px;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.05);
      }
    }

    .card-top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
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
      &.secondary { margin-top: 4px; }
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

    .metric-label-sub, .stat-percent, .c-streak {
      font-size: 11px;
      font-weight: 500;
      color: #8e8e93;
    }

    .metric-stat-row {
      display: flex;
      gap: 16px;
    }

    .mini-split-track {
      height: 6px;
      border-radius: 99px;
      background: #f2f3f6;
      display: flex;
      overflow: hidden;
      margin-top: 4px;
    }

    .split-fill {
      height: 100%;
      &.principal { background: #0fb27c; }
      &.interest { background: #111216; }
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

    .custom-label, .pill-label {
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

    /* Consistency List */
    .consistency-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .consistency-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 14px;
      background: #f8f9fb;
      border-radius: 18px;
    }

    .member-info-col {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .c-name {
      display: block;
      font-size: 14px;
      font-weight: 800;
      color: #111216;
    }

    .metrics-col {
      display: flex;
      gap: 8px;
    }

    .metric-pill {
      background: #ffffff;
      padding: 4px 10px;
      border-radius: 12px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .pill-val {
      font-size: 12px;
      font-weight: 800;
      color: #111216;
      &.high { color: #0fb27c; }
    }
  `,
})
export class InsightsComponent {
  readonly ledgerStore = inject(LedgerStore);

  readonly amortizationHistory = computed(() => {
    return computeAmortizationHistory(this.ledgerStore.ledgerState());
  });

  readonly rupeeSplit = computed(() => {
    return computeRupeeSplit(this.ledgerStore.ledgerState());
  });

  readonly memberConsistency = computed(() => {
    return computeMemberConsistencyScores(this.ledgerStore.ledgerState());
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

  readonly monthlyAverage = computed<Paise>(() => {
    const bars = this.monthlyBarData();
    const sum = bars.reduce((s, b) => s + b.value, 0);
    const avg = bars.length > 0 ? Math.round(sum / bars.length) : 0;
    return toPaise(avg);
  });

  readonly highestContributor = computed(() => {
    const list = [...this.ledgerStore.memberStats()].sort(
      (a, b) => b.lifetimeContribution - a.lifetimeContribution
    );
    return list[0] ?? { name: '—', lifetimeContribution: ZERO_PAISE };
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

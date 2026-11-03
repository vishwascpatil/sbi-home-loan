import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LedgerStore } from '../../core/state';
import {
  AvatarComponent,
  BarChartComponent,
  GlassCardComponent,
  ProgressBarComponent,
  StatTileComponent,
} from '../../shared/ui';
import {
  compareScenarios,
  ContributionTransaction,
  formatCompactPaise,
  formatPaise,
  Paise,
  toPaise,
} from '../../core/engine';

const MEMBER_COLORS = ['#6c4cff', '#ff5f9e', '#0fb27c', '#f59f00', '#2e90ff'];

@Component({
  selector: 'app-insights',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    GlassCardComponent,
    StatTileComponent,
    BarChartComponent,
    AvatarComponent,
    ProgressBarComponent,
  ],
  template: `
    <div class="insights-page">
      <header class="insights-header">
        <div>
          <small class="header-sub">Contributions & Scenarios</small>
          <h1 class="header-title">Insights</h1>
        </div>
      </header>

      <!-- Contribution Analytics Card -->
      <app-glass-card [staggerIndex]="0">
        <h2 class="card-title">Contribution Analytics</h2>

        <div class="stats-3-grid" style="margin-top: 12px">
          <app-stat-tile label="Avg / Month" [value]="formatPaise(monthlyAverage())" />
          <app-stat-tile
            label="Highest"
            [value]="highestContributor().name || '—'"
            [subtext]="highestContributor() ? formatCompactPaise(highestContributor().lifetimeContribution) : undefined"
          />
          <app-stat-tile
            label="Lowest"
            [value]="lowestContributor().name || '—'"
            [subtext]="lowestContributor() ? formatCompactPaise(lowestContributor().lifetimeContribution) : undefined"
          />
        </div>

        <div style="margin-top: 20px">
          <h3 class="chart-subtitle">Monthly Trend (Last 6 Months)</h3>
          <app-bar-chart [data]="monthlyBarData()" />
        </div>
      </app-glass-card>

      <!-- Share of Contributions Card -->
      <app-glass-card [staggerIndex]="1">
        <h2 class="card-title">Share of Contributions</h2>

        <div class="share-breakdown-list" style="margin-top: 14px">
          @for (m of ledgerStore.memberStats(); track m.memberId) {
            <div class="share-row">
              <div class="share-row-top">
                <div class="member-pill">
                  <app-avatar [name]="m.name" [colorIndex]="$index" [size]="24" />
                  <span class="m-name">{{ m.name }}</span>
                </div>
                <span class="m-percent tabular-nums">{{ m.sharePercentage.toFixed(1) }}%</span>
              </div>
              <app-progress-bar
                [progressPercent]="m.sharePercentage"
                [height]="8"
                [color]="getColor($index)"
              />
            </div>
          }
        </div>
      </app-glass-card>

      <!-- Repayment Simulator Card -->
      <app-glass-card [staggerIndex]="2">
        <h2 class="card-title">Repayment Simulator</h2>
        <p class="sim-disclaimer">
          Estimates derived from current outstanding balance and interest rate ({{ methodLabel() }}).
          The bank calculates OD interest on daily balances, so actual figures will vary.
        </p>

        <!-- Scenario Cards List -->
        <div class="scenarios-list">
          @for (sc of scenarios(); track sc.payment) {
            <div class="scenario-card" [class.highlight]="sc.isCustom">
              <div class="sc-left">
                <span class="sc-payment-title">
                  {{ sc.isCustom ? 'Custom · ' : '' }}{{ formatCompactPaise(sc.payment) }}/month
                </span>
                @if (sc.result) {
                  <span class="sc-payoff-sub">
                    {{ sc.result.closureDate }} · {{ sc.result.months }} months
                    <br />
                    Total Paid: {{ formatCompactPaise(sc.result.totalPaid) }}
                  </span>
                } @else {
                  <span class="sc-fail-sub">Never closes — payment is below monthly interest</span>
                }
              </div>

              <div class="sc-right">
                <span class="sc-interest-amount tabular-nums">
                  {{ sc.result ? formatPaise(sc.result.totalInterest) : '—' }}
                </span>
                <span class="sc-interest-sub">
                  @if (sc.differenceVsBaseline) {
                    {{ sc.differenceVsBaseline.isSaved ? 'saves ' : 'costs ' }}
                    {{ formatCompactPaise(sc.differenceVsBaseline.interestSaved) }} vs ₹1.9L
                  } @else {
                    future interest
                  }
                </span>
              </div>
            </div>
          }
        </div>

        <!-- Custom Monthly Payment Field -->
        <div class="custom-input-group">
          <label class="custom-label" for="custom-payment">Custom Monthly Payment (₹)</label>
          <input
            id="custom-payment"
            type="number"
            class="custom-payment-input tabular-nums"
            [ngModel]="customPaymentInput()"
            (ngModelChange)="onCustomPaymentChange($event)"
            min="1000"
            step="5000"
          />
        </div>
      </app-glass-card>
    </div>
  `,
  styles: `
    .insights-page {
      display: flex;
      flex-direction: column;
    }

    .insights-header {
      margin: 8px 4px 20px;
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

    .card-title {
      font-size: 16px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.015em;
    }

    .chart-subtitle {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 8px;
    }

    .stats-3-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .share-breakdown-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .share-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .share-row-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .member-pill {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .m-name {
      font-size: 13px;
      font-weight: 800;
    }

    .m-percent {
      font-size: 13px;
      font-weight: 800;
      color: var(--muted);
    }

    .sim-disclaimer {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.45;
      margin: 6px 0 16px;
    }

    .scenarios-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .scenario-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg);
      border: 1px solid var(--line);
      border-radius: var(--radius-tile, 16px);
      padding: 12px 14px;
      transition: border-color 0.2s ease;
    }

    .scenario-card.highlight {
      border-color: var(--brand-a);
    }

    .sc-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .sc-payment-title {
      font-size: 14px;
      font-weight: 800;
    }

    .sc-payoff-sub {
      font-size: 11px;
      color: var(--muted);
      line-height: 1.35;
    }

    .sc-fail-sub {
      font-size: 11px;
      color: var(--danger);
      font-weight: 600;
    }

    .sc-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      text-align: right;
    }

    .sc-interest-amount {
      font-size: 14px;
      font-weight: 800;
    }

    .sc-interest-sub {
      font-size: 11px;
      color: var(--muted);
      font-weight: 600;
    }

    .custom-input-group {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .custom-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .custom-payment-input {
      width: 100%;
      height: 48px;
      border-radius: var(--radius-tile, 16px);
      border: 1px solid var(--line);
      background: var(--bg);
      color: var(--ink);
      padding: 0 14px;
      font-size: 16px;
      font-weight: 800;
      outline: none;
    }

    .custom-payment-input:focus {
      border-color: var(--brand-a);
      background: var(--card);
    }
  `,
})
export class InsightsComponent {
  readonly ledgerStore = inject(LedgerStore);

  readonly formatPaise = formatPaise;
  readonly formatCompactPaise = formatCompactPaise;

  readonly customPaymentInput = signal<number>(200000);

  readonly methodLabel = computed(() => {
    return this.ledgerStore.loan().calculationMethod === 'daily'
      ? 'Daily balance'
      : 'Monthly reducing balance';
  });

  readonly monthlyBarData = computed(() => {
    const txs = this.ledgerStore
      .transactions()
      .filter((t): t is ContributionTransaction => t.type === 'contribution' && !t.deletedAt);
    const monthsMap = new Map<string, number>();

    // 6 preceding months
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
    return list[0];
  });

  readonly lowestContributor = computed(() => {
    const list = [...this.ledgerStore.memberStats()].sort(
      (a, b) => a.lifetimeContribution - b.lifetimeContribution
    );
    return list[0];
  });

  readonly scenarios = computed(() => {
    const principal = this.ledgerStore.currentOutstanding();
    const rateBps = this.ledgerStore.loan().currentRateBps;
    const baseline = toPaise(190000);
    const customAmt = toPaise(this.customPaymentInput() || 0);

    const scenarioDefs = [
      { payment: toPaise(240000), isCustom: false },
      { payment: toPaise(230000), isCustom: false },
      { payment: toPaise(190000), isCustom: false },
      { payment: customAmt, isCustom: true },
    ];

    return compareScenarios(principal, scenarioDefs, rateBps, baseline);
  });

  onCustomPaymentChange(val: number): void {
    this.customPaymentInput.set(val || 0);
  }

  getColor(index: number): string {
    return MEMBER_COLORS[index % MEMBER_COLORS.length]!;
  }
}

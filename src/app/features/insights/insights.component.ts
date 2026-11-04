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
  OverlayProjectionChartComponent,
  ProgressBarComponent,
  StatTileComponent,
  ToastService,
} from '../../shared/ui';
import {
  ContributionTransaction,
  DrawdownEvent,
  formatCompactPaise,
  formatPaise,
  Paise,
  paise,
  PrepaymentEvent,
  SavedScenario,
  simulateV2,
  subPaise,
  toPaise,
  toRupees,
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
    OverlayProjectionChartComponent,
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

      <!-- Repayment Simulator v2 Card -->
      <app-glass-card [staggerIndex]="2">
        <div class="card-title-row">
          <h2 class="card-title">Repayment Simulator v2 (Day-Accurate)</h2>
          <button type="button" class="save-scenario-btn" (click)="promptSaveScenario()">
            💾 Save Scenario
          </button>
        </div>
        <p class="sim-disclaimer">
          Day-accurate projection with prepayments, drawdowns, payment days, and rate shifts (all figures est.).
        </p>

        <!-- Saved Scenarios Chips -->
        @if (savedScenarios().length > 0) {
          <div class="saved-scenarios-bar">
            <span class="saved-label">Saved Scenarios:</span>
            <div class="saved-chips-scroll">
              @for (sc of savedScenarios(); track sc.id) {
                <button type="button" class="saved-chip" (click)="loadSavedScenario(sc)">
                  <span>{{ sc.name }}</span>
                  <button
                    type="button"
                    class="del-scenario-icon"
                    (click)="deleteSavedScenario(sc.id, $event)"
                    aria-label="Delete scenario"
                  >
                    ✕
                  </button>
                </button>
              }
            </div>
          </div>
        }

        <!-- Interactive Controls -->
        <div class="sim-controls-grid">
          <div class="sim-field">
            <label class="custom-label" for="custom-payment">Monthly Payment (₹)</label>
            <input
              id="custom-payment"
              type="number"
              class="sim-input tabular-nums"
              [ngModel]="customPaymentInput()"
              (ngModelChange)="onCustomPaymentChange($event)"
              min="1000"
              step="5000"
            />
          </div>

          <div class="sim-field">
            <label class="custom-label" for="pay-day">Payment Day of Month</label>
            <select
              id="pay-day"
              class="sim-select"
              [ngModel]="paymentDayOfMonth()"
              (ngModelChange)="paymentDayOfMonth.set(+$event)"
            >
              <option [value]="1">1st of month</option>
              <option [value]="5">5th of month</option>
              <option [value]="10">10th of month</option>
              <option [value]="15">15th of month</option>
              <option [value]="20">20th of month</option>
              <option [value]="25">25th of month</option>
              <option [value]="28">28th of month</option>
            </select>
          </div>
        </div>

        <!-- Rate Shift Selector -->
        <div class="rate-shift-row">
          <span class="custom-label">Interest Rate Shift</span>
          <div class="rate-shift-chips">
            @for (shift of rateShiftOptions; track shift.value) {
              <button
                type="button"
                class="shift-chip"
                [class.active]="rateShiftBps() === shift.value"
                (click)="rateShiftBps.set(shift.value)"
              >
                {{ shift.label }}
              </button>
            }
          </div>
        </div>

        <!-- Prepayments & Drawdowns Management -->
        <div class="events-management-row">
          <div class="event-col">
            <div class="event-col-header">
              <span class="custom-label">Scheduled Prepayments</span>
              <button type="button" class="add-event-mini-btn" (click)="addPrepaymentPrompt()">
                ＋ Prepay
              </button>
            </div>
            @if (prepayments().length > 0) {
              <div class="event-chips-list">
                @for (p of prepayments(); track $index) {
                  <span class="event-pill prepay">
                    {{ p.date }}: +{{ formatCompactPaise(p.amount) }}
                    <button type="button" (click)="removePrepayment($index)">✕</button>
                  </span>
                }
              </div>
            } @else {
              <span class="empty-subtext">No prepayments added</span>
            }
          </div>

          <div class="event-col">
            <div class="event-col-header">
              <span class="custom-label">Extra Drawdowns</span>
              <button type="button" class="add-event-mini-btn" (click)="addDrawdownPrompt()">
                ＋ Drawdown
              </button>
            </div>
            @if (drawdowns().length > 0) {
              <div class="event-chips-list">
                @for (d of drawdowns(); track $index) {
                  <span class="event-pill draw">
                    {{ d.date }}: −{{ formatCompactPaise(d.amount) }}
                    <button type="button" (click)="removeDrawdown($index)">✕</button>
                  </span>
                }
              </div>
            } @else {
              <span class="empty-subtext">No drawdowns added</span>
            }
          </div>
        </div>

        <!-- Overlay Trajectory Chart -->
        @if (customSimResult() && baselineSimResult()) {
          <app-overlay-projection-chart
            [baselineSchedule]="baselineSimResult()!.schedule"
            [scenarioSchedule]="customSimResult()!.schedule"
          />
        }

        <!-- Side-by-Side Comparison Metrics Card -->
        @if (customSimResult()) {
          <div class="v2-summary-card">
            <div class="v2-stat">
              <span class="v2-stat-label">Estimated Payoff</span>
              <span class="v2-stat-val">{{ customSimResult()!.closureDate }}</span>
              <span class="v2-stat-sub">{{ customSimResult()!.months }} months</span>
            </div>
            <div class="v2-stat">
              <span class="v2-stat-label">Future Interest (est.)</span>
              <span class="v2-stat-val tabular-nums">{{ formatPaise(customSimResult()!.totalInterest) }}</span>
              <span class="v2-stat-sub highlight">
                {{ interestDifference().isSaved ? 'Saves ' : 'Costs ' }}
                {{ formatCompactPaise(interestDifference().interestSaved) }} vs baseline
              </span>
            </div>
            <div class="v2-stat">
              <span class="v2-stat-label">Total Outflow</span>
              <span class="v2-stat-val tabular-nums">{{ formatCompactPaise(customSimResult()!.totalPaid) }}</span>
              <span class="v2-stat-sub">Principal + Interest</span>
            </div>
          </div>
        } @else {
          <div class="alert-fail-card">
            ⚠️ Never closes with current parameters: monthly payment is insufficient to cover accrued interest.
          </div>
        }
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

    .card-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .save-scenario-btn {
      padding: 6px 14px;
      border-radius: var(--radius-pill, 99px);
      border: 1px solid var(--brand-a);
      background: rgba(108, 76, 255, 0.1);
      color: var(--brand-a);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .save-scenario-btn:hover {
      background: rgba(108, 76, 255, 0.2);
    }

    .saved-scenarios-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 12px 0 14px;
    }

    .saved-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      white-space: nowrap;
    }

    .saved-chips-scroll {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .saved-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: var(--radius-pill, 99px);
      background: var(--bg);
      border: 1px solid var(--line);
      font-size: 12px;
      font-weight: 700;
      color: var(--ink);
      cursor: pointer;
      white-space: nowrap;
    }

    .del-scenario-icon {
      background: transparent;
      border: none;
      color: var(--muted);
      font-size: 10px;
      cursor: pointer;
      padding: 0 2px;
    }

    .del-scenario-icon:hover {
      color: var(--danger);
    }

    .sim-controls-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 12px;
    }

    .sim-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .sim-input, .sim-select {
      width: 100%;
      height: 44px;
      border-radius: var(--radius-tile, 16px);
      border: 1px solid var(--line);
      background: var(--bg);
      color: var(--ink);
      padding: 0 12px;
      font-size: 14px;
      font-weight: 700;
      outline: none;
    }

    .rate-shift-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 14px;
    }

    .rate-shift-chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .shift-chip {
      padding: 6px 12px;
      border-radius: var(--radius-pill, 99px);
      border: 1px solid var(--line);
      background: var(--bg);
      color: var(--ink);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .shift-chip.active {
      background: var(--brand-gradient);
      color: #ffffff;
      border-color: transparent;
    }

    .events-management-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 14px;
    }

    .event-col {
      background: var(--bg);
      border: 1px solid var(--line);
      border-radius: var(--radius-tile, 16px);
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .event-col-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .add-event-mini-btn {
      background: transparent;
      border: none;
      color: var(--brand-a);
      font-size: 11px;
      font-weight: 800;
      cursor: pointer;
      padding: 2px 4px;
    }

    .event-chips-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .event-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      border-radius: var(--radius-pill, 99px);
      font-size: 11px;
      font-weight: 700;
    }

    .event-pill button {
      background: transparent;
      border: none;
      font-size: 9px;
      cursor: pointer;
      color: inherit;
    }

    .event-pill.prepay {
      background: rgba(15, 178, 124, 0.15);
      color: var(--success);
      border: 1px solid rgba(15, 178, 124, 0.3);
    }

    .event-pill.draw {
      background: rgba(238, 77, 107, 0.15);
      color: var(--danger);
      border: 1px solid rgba(238, 77, 107, 0.3);
    }

    .empty-subtext {
      font-size: 11px;
      color: var(--muted);
      font-style: italic;
    }

    .v2-summary-card {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      background: var(--bg);
      border: 1px solid var(--line);
      border-radius: var(--radius-tile, 16px);
      padding: 12px;
      margin-top: 14px;
    }

    .v2-stat {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .v2-stat-label {
      font-size: 10px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
    }

    .v2-stat-val {
      font-size: 13px;
      font-weight: 800;
      color: var(--ink);
    }

    .v2-stat-sub {
      font-size: 10px;
      color: var(--muted);
      font-weight: 600;
    }

    .v2-stat-sub.highlight {
      color: var(--success);
      font-weight: 700;
    }

    .alert-fail-card {
      margin-top: 14px;
      padding: 12px;
      border-radius: var(--radius-tile, 16px);
      background: rgba(238, 77, 107, 0.12);
      border: 1px solid rgba(238, 77, 107, 0.3);
      color: var(--danger);
      font-size: 12px;
      font-weight: 700;
      text-align: center;
    }
  `,
})
export class InsightsComponent {
  readonly ledgerStore = inject(LedgerStore);
  readonly toast = inject(ToastService);

  readonly formatPaise = formatPaise;
  readonly formatCompactPaise = formatCompactPaise;

  readonly customPaymentInput = signal<number>(240000);
  readonly paymentDayOfMonth = signal<number>(5);
  readonly rateShiftBps = signal<number>(0);
  readonly prepayments = signal<PrepaymentEvent[]>([]);
  readonly drawdowns = signal<DrawdownEvent[]>([]);

  readonly rateShiftOptions = [
    { label: '−0.50%', value: -50 },
    { label: '−0.25%', value: -25 },
    { label: 'Current Rate', value: 0 },
    { label: '+0.25%', value: 25 },
    { label: '+0.50%', value: 50 },
  ];

  readonly savedScenarios = computed<SavedScenario[]>(() => {
    return this.ledgerStore.loan().savedScenarios || [];
  });

  readonly methodLabel = computed(() => {
    return this.ledgerStore.loan().calculationMethod === 'daily'
      ? 'Daily OD (Day-Accurate)'
      : 'Monthly reducing balance';
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

  readonly baselineSimResult = computed(() => {
    const principal = this.ledgerStore.currentOutstanding();
    const rateBps = this.ledgerStore.loan().currentRateBps;
    return simulateV2({
      principal,
      monthlyPayment: toPaise(190000),
      rateBps,
      paymentDayOfMonth: 1,
      rateShiftBps: 0,
    });
  });

  readonly customSimResult = computed(() => {
    const principal = this.ledgerStore.currentOutstanding();
    const rateBps = this.ledgerStore.loan().currentRateBps;
    const payment = toPaise(this.customPaymentInput() || 0);

    return simulateV2({
      principal,
      monthlyPayment: payment,
      rateBps,
      paymentDayOfMonth: this.paymentDayOfMonth(),
      rateShiftBps: this.rateShiftBps(),
      prepayments: this.prepayments(),
      drawdowns: this.drawdowns(),
      dayCountBasis: this.ledgerStore.loan().bankRules?.dayCountBasis || 'actual/365',
    });
  });

  readonly interestDifference = computed(() => {
    const base = this.baselineSimResult();
    const custom = this.customSimResult();
    if (!base || !custom) {
      return { interestSaved: paise(0), isSaved: false };
    }
    const diff = subPaise(base.totalInterest, custom.totalInterest);
    return {
      interestSaved: paise(Math.abs(diff)),
      isSaved: diff >= 0,
    };
  });

  onCustomPaymentChange(val: number): void {
    this.customPaymentInput.set(val || 0);
  }

  getColor(index: number): string {
    return MEMBER_COLORS[index % MEMBER_COLORS.length]!;
  }

  addPrepaymentPrompt(): void {
    const today = new Date().toISOString().slice(0, 10);
    const dateStr = window.prompt('Enter prepayment date (YYYY-MM-DD):', today);
    if (!dateStr) return;
    const amountStr = window.prompt('Enter prepayment amount (₹):', '100000');
    if (!amountStr) return;
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) return;

    this.prepayments.update((prev) => [
      ...prev,
      { date: dateStr.trim(), amount: toPaise(amt) },
    ]);
    this.toast.show(`Prepayment of ₹${amt.toLocaleString('en-IN')} added`, 'success');
  }

  removePrepayment(index: number): void {
    this.prepayments.update((prev) => prev.filter((_, i) => i !== index));
  }

  addDrawdownPrompt(): void {
    const today = new Date().toISOString().slice(0, 10);
    const dateStr = window.prompt('Enter drawdown date (YYYY-MM-DD):', today);
    if (!dateStr) return;
    const amountStr = window.prompt('Enter drawdown amount (₹):', '50000');
    if (!amountStr) return;
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) return;

    this.drawdowns.update((prev) => [
      ...prev,
      { date: dateStr.trim(), amount: toPaise(amt) },
    ]);
    this.toast.show(`Drawdown of ₹${amt.toLocaleString('en-IN')} added`, 'info');
  }

  removeDrawdown(index: number): void {
    this.drawdowns.update((prev) => prev.filter((_, i) => i !== index));
  }

  async promptSaveScenario(): Promise<void> {
    const name = window.prompt('Enter a name for this scenario:', 'Aggressive Payoff');
    if (!name || !name.trim()) return;

    await this.ledgerStore.saveScenario({
      name: name.trim(),
      monthlyPayment: toPaise(this.customPaymentInput()),
      paymentDayOfMonth: this.paymentDayOfMonth(),
      rateShiftBps: this.rateShiftBps(),
      prepayments: this.prepayments(),
      drawdowns: this.drawdowns(),
    });

    this.toast.show(`Scenario "${name.trim()}" saved`, 'success');
  }

  loadSavedScenario(sc: SavedScenario): void {
    this.customPaymentInput.set(toRupees(sc.monthlyPayment));
    this.paymentDayOfMonth.set(sc.paymentDayOfMonth);
    this.rateShiftBps.set(sc.rateShiftBps);
    this.prepayments.set([...sc.prepayments]);
    this.drawdowns.set([...sc.drawdowns]);
    this.toast.show(`Loaded scenario "${sc.name}"`, 'info');
  }

  async deleteSavedScenario(id: string, event: Event): Promise<void> {
    event.stopPropagation();
    await this.ledgerStore.deleteScenario(id);
    this.toast.show('Scenario deleted', 'danger');
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  formatCompactPaise,
  formatPaise,
  getSbiPaymentsSummary,
  SbiMonthlyPaymentRecord,
  SbiPaymentsSummary,
  triggerHaptic,
} from '../../../core/engine';

@Component({
  selector: 'app-monthly-payments-audit-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="payments-card" role="region" aria-label="How Much Money We Have Paid So Far">
      <div class="card-iridescent-edge" aria-hidden="true"></div>

      <!-- Header -->
      <div class="payments-header">
        <div class="header-cluster">
          <div class="badge-row">
            <span class="payments-badge">REPAYMENTS AUDIT</span>
            <span class="live-tag">
              <span class="live-dot" aria-hidden="true"></span>
              <span>Jun '24 – Nov '26</span>
            </span>
          </div>
          <h2 class="payments-title">Repayment Inflows</h2>
        </div>
      </div>

      <!-- 3 Big WOW Telemetry Cards -->
      <div class="wow-stats-grid">
        <!-- 1. Total Cumulative Deposited -->
        <div class="wow-stat-tile tile-emerald">
          <span class="wow-stat-lbl">Total Inflow</span>
          <div class="wow-stat-val text-emerald tabular-nums">
            {{ formatCompactPaise(summary().totalPaidSoFar) }}
          </div>
          <span class="wow-stat-sub tabular-nums">
            30 Months Total
          </span>
        </div>

        <!-- 2. Regular Bank EMIs -->
        <div class="wow-stat-tile tile-blue">
          <span class="wow-stat-lbl">Regular EMIs</span>
          <div class="wow-stat-val text-blue tabular-nums">
            {{ formatCompactPaise(summary().totalEmiPaid) }}
          </div>
          <span class="wow-stat-sub tabular-nums">
            29 Bank Debits
          </span>
        </div>

        <!-- 3. Extra Lump-Sum Prepayments -->
        <div class="wow-stat-tile tile-purple">
          <span class="wow-stat-lbl">Prepayments</span>
          <div class="wow-stat-val text-purple tabular-nums">
            +{{ formatCompactPaise(summary().totalPrepaymentsPaid) }}
          </div>
          <span class="wow-stat-sub tabular-nums">
            21 Ad-hoc Deposits
          </span>
        </div>
      </div>

      <!-- Filter Capsule Pill Row (All 30 mos / 2026 / 2025 / 2024) -->
      <div class="year-filter-row">
        <button
          type="button"
          class="year-chip"
          [class.active]="selectedYearFilter() === 'all'"
          (click)="setYearFilter('all')"
        >
          All (30 mos)
        </button>
        <button
          type="button"
          class="year-chip"
          [class.active]="selectedYearFilter() === '2026'"
          (click)="setYearFilter('2026')"
        >
          2026 (11 mos)
        </button>
        <button
          type="button"
          class="year-chip"
          [class.active]="selectedYearFilter() === '2025'"
          (click)="setYearFilter('2025')"
        >
          2025 (12 mos)
        </button>
        <button
          type="button"
          class="year-chip"
          [class.active]="selectedYearFilter() === '2024'"
          (click)="setYearFilter('2024')"
        >
          2024 (7 mos)
        </button>
      </div>

      <!-- Interactive SVG Chart -->
      <div class="chart-container">
        <div class="chart-top-bar">
          <span class="chart-caption">
            {{ selectedYearFilter() === 'all' ? '30-Month Payment Trajectory' : selectedYearFilter() + ' Monthly Payments' }}
          </span>
          @if (selectedRecord()) {
            <span class="selected-pill">
              {{ selectedRecord()!.month }}: <strong>{{ formatPaise(selectedRecord()!.totalPaid) }}</strong>
            </span>
          } @else {
            <span class="chart-hint">Tap any bar to inspect breakdown</span>
          }
        </div>

        <!-- Target reference line indicator -->
        <div class="chart-legend-line">
          <span class="legend-key target-key">
            <span class="legend-dash"></span> ₹2.40L Monthly Target
          </span>
          <span class="legend-key emi-key">
            <span class="legend-box emi-box"></span> Regular EMI (₹1.19L)
          </span>
          <span class="legend-key prepay-key">
            <span class="legend-box prepay-box"></span> Prepayment
          </span>
        </div>

        <svg
          class="payments-svg"
          [attr.viewBox]="svgViewBox()"
          preserveAspectRatio="none"
          role="img"
          aria-label="Monthly Repayments Bar Chart"
        >
          <!-- Grid lines for ₹2.4L target & ₹6L peak -->
          <line
            x1="0"
            [attr.y1]="getY(24000000)"
            [attr.x2]="svgWidth()"
            [attr.y2]="getY(24000000)"
            stroke="rgba(108, 76, 255, 0.35)"
            stroke-dasharray="3 3"
            stroke-width="1.2"
          />
          <line
            x1="0"
            [attr.y1]="getY(11890000)"
            [attr.x2]="svgWidth()"
            [attr.y2]="getY(11890000)"
            stroke="rgba(0, 113, 227, 0.25)"
            stroke-dasharray="2 2"
            stroke-width="1"
          />
          <line
            x1="0"
            y1="130"
            [attr.x2]="svgWidth()"
            y2="130"
            stroke="rgba(0,0,0,0.08)"
            stroke-width="1"
          />

          <!-- Monthly Stacked Bars -->
          @for (rec of displayedRecords(); track rec.period; let idx = $index) {
            <g
              class="bar-group"
              [class.active]="selectedRecord()?.period === rec.period"
              [class.is-peak]="rec.isPeak"
              (click)="selectRecord(rec)"
            >
              <!-- Touch Target -->
              <rect
                [attr.x]="idx * barStep() + 2"
                y="0"
                [attr.width]="barStep() - 4"
                height="130"
                fill="transparent"
                style="cursor: pointer;"
              />

              <!-- Base EMI Bar portion (Blue) -->
              @if (rec.emiPaid > 0) {
                <rect
                  class="bar-rect-emi"
                  [attr.x]="idx * barStep() + barOffset()"
                  [attr.y]="getY(rec.emiPaid)"
                  [attr.width]="barWidth()"
                  [attr.height]="getHeight(rec.emiPaid)"
                  rx="3"
                />
              }

              <!-- Prepayment Bar Cap (Emerald or Purple) -->
              @if (rec.prepayPaid > 0) {
                <rect
                  class="bar-rect-prepay"
                  [attr.x]="idx * barStep() + barOffset()"
                  [attr.y]="getY(rec.totalPaid)"
                  [attr.width]="barWidth()"
                  [attr.height]="getHeight(rec.prepayPaid)"
                  rx="3"
                />
              }

              <!-- Zero Bar Marker (e.g. Jun '24) -->
              @if (rec.totalPaid === 0) {
                <circle
                  [attr.cx]="idx * barStep() + barStep() / 2"
                  cy="126"
                  r="3"
                  fill="rgba(0,0,0,0.15)"
                />
              }

              <!-- Peak indicator star/dot for Sep '24 -->
              @if (rec.isPeak) {
                <polygon
                  [attr.points]="getStarPoints(idx * barStep() + barStep() / 2, getY(rec.totalPaid) - 8)"
                  fill="#ff5f9e"
                />
              }
            </g>
          }
        </svg>

        <!-- Milestones axis labels -->
        <div class="chart-x-labels">
          @if (selectedYearFilter() === 'all') {
            <span>Jun '24 (Disbursed)</span>
            <span class="peak-txt">Sep '24 (₹6.55L Peak)</span>
            <span>Feb '25 (₹2.75L)</span>
            <span>Nov '26 (₹2.19L)</span>
          } @else if (selectedYearFilter() === '2026') {
            <span>Jan '26 (₹1.19L)</span>
            <span>Jun '26 (₹1.82L)</span>
            <span>Nov '26 (₹2.19L)</span>
          } @else if (selectedYearFilter() === '2025') {
            <span>Jan '25 (₹1.19L)</span>
            <span>Feb '25 (₹2.75L)</span>
            <span>Sep '25 (₹1.93L)</span>
            <span>Dec '25 (₹1.19L)</span>
          } @else {
            <span>Jun '24 (₹0 · Opening)</span>
            <span>Jul '24 (₹3.19L)</span>
            <span class="peak-txt">Sep '24 (₹6.55L Peak)</span>
            <span>Dec '24 (₹1.19L)</span>
          }
        </div>
      </div>

      <!-- Selected Month Math Inspector Pill -->
      @if (activeDetails(); as det) {
        <div class="inspector-card" [class.is-peak-card]="det.isPeak">
          <div class="inspector-header">
            <div class="insp-left">
              <span class="inspector-title">📅 {{ det.month }} Payment Breakdown</span>
              @if (det.note) {
                <span class="inspector-badge" [class.peak-badge]="det.isPeak">{{ det.note }}</span>
              }
            </div>
            <div class="insp-total tabular-nums text-emerald font-bold">
              {{ formatPaise(det.totalPaid) }}
            </div>
          </div>

          <div class="inspector-body">
            @if (det.totalPaid > 0) {
              <div class="breakdown-pills">
                <div class="mini-breakdown-tile">
                  <span class="b-lbl">Regular Bank EMI</span>
                  <span class="b-val tabular-nums text-blue">{{ formatPaise(det.emiPaid) }}</span>
                </div>
                <div class="mini-breakdown-tile">
                  <span class="b-lbl">Extra Prepayment</span>
                  <span class="b-val tabular-nums text-purple">+{{ formatPaise(det.prepayPaid) }}</span>
                </div>
                <div class="mini-breakdown-tile">
                  <span class="b-lbl">Passbook Deposits</span>
                  <span class="b-val tabular-nums text-ink">{{ det.txCount }} credits</span>
                </div>
              </div>
            } @else {
              <p class="zero-payment-desc">
                Loan sanctioned & disbursed on 12-Jun-2024. First scheduled bank EMI debited on July 2024.
              </p>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .payments-card {
      position: relative;
      background: #ffffff;
      border-radius: 26px;
      padding: 22px 20px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
      border: 1px solid rgba(0, 0, 0, 0.05);
      display: flex;
      flex-direction: column;
      gap: 18px;
      overflow: hidden;
    }

    .card-iridescent-edge {
      position: absolute;
      inset: 0;
      border-radius: 26px;
      padding: 1.5px;
      background: linear-gradient(135deg, rgba(15, 178, 124, 0.25) 0%, rgba(108, 76, 255, 0.25) 100%);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }

    .payments-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .header-cluster {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .badge-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .payments-badge {
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      background: linear-gradient(135deg, #0fb27c 0%, #0071e3 100%);
      color: #ffffff;
      padding: 3px 10px;
      border-radius: 99px;
    }

    .live-tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.72rem;
      font-weight: 700;
      color: #767a90;
      background: rgba(0, 0, 0, 0.04);
      padding: 3px 8px;
      border-radius: 99px;
    }

    .live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #0fb27c;
      box-shadow: 0 0 6px rgba(15, 178, 124, 0.6);
    }

    .payments-title {
      font-size: 1.25rem;
      font-weight: 900;
      color: #15172b;
      margin: 4px 0 0;
      letter-spacing: -0.02em;
    }

    .payments-subtitle {
      font-size: 0.78rem;
      font-weight: 600;
      color: #767a90;
    }

    .wow-stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    @media (max-width: 600px) {
      .wow-stats-grid {
        grid-template-columns: 1fr 1fr;
      }
      .wow-stat-tile:last-child {
        grid-column: span 2;
      }
    }

    .wow-stat-tile {
      background: #f8f9fd;
      border-radius: 18px;
      padding: 14px 12px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      border: 1px solid rgba(0, 0, 0, 0.04);

      &.tile-emerald { background: rgba(15, 178, 124, 0.05); border-color: rgba(15, 178, 124, 0.15); }
      &.tile-blue { background: rgba(0, 113, 227, 0.05); border-color: rgba(0, 113, 227, 0.15); }
      &.tile-purple { background: rgba(108, 76, 255, 0.05); border-color: rgba(108, 76, 255, 0.15); }
    }

    .wow-stat-lbl {
      font-size: 0.68rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #8e8e93;
    }

    .wow-stat-val {
      font-size: 1.35rem;
      font-weight: 900;
      letter-spacing: -0.02em;
      line-height: 1.1;

      &.text-emerald { color: #0fb27c; }
      &.text-blue { color: #0071e3; }
      &.text-purple { color: #6c4cff; }
    }

    .wow-stat-sub {
      font-size: 0.72rem;
      font-weight: 600;
      color: #767a90;
    }

    .year-filter-row {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      &::-webkit-scrollbar { display: none; }
    }

    .year-chip {
      height: 32px;
      padding: 0 14px;
      border-radius: 99px;
      border: 1px solid rgba(0, 0, 0, 0.07);
      background: #ffffff;
      color: #767a90;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transition: all 0.2s ease;

      &:active {
        transform: scale(0.96);
      }

      &.active {
        background: #15172b;
        color: #ffffff;
        border-color: #15172b;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      }
    }

    .chart-container {
      background: #fbfbfd;
      border-radius: 20px;
      padding: 16px 14px;
      border: 1px solid rgba(0, 0, 0, 0.04);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .chart-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
    }

    .chart-caption {
      font-weight: 800;
      color: #15172b;
    }

    .chart-hint {
      color: #8e8e93;
      font-size: 0.7rem;
    }

    .selected-pill {
      background: #15172b;
      color: #ffffff;
      padding: 3px 10px;
      border-radius: 99px;
      font-size: 0.72rem;
      strong {
        color: #0fb27c;
      }
    }

    .chart-legend-line {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.68rem;
      color: #767a90;
      font-weight: 600;
      flex-wrap: wrap;
    }

    .legend-key {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .legend-dash {
      width: 12px;
      height: 2px;
      border-top: 2px dashed #6c4cff;
    }

    .legend-box {
      width: 8px;
      height: 8px;
      border-radius: 2px;

      &.emi-box { background: #0071e3; }
      &.prepay-box { background: #0fb27c; }
    }

    .payments-svg {
      width: 100%;
      height: 140px;
      overflow: visible;
    }

    .bar-group {
      cursor: pointer;
      transition: opacity 0.15s ease;

      &:hover,
      &.active {
        opacity: 0.95;
        .bar-rect-emi {
          filter: drop-shadow(0 0 4px rgba(0, 113, 227, 0.4));
        }
        .bar-rect-prepay {
          filter: drop-shadow(0 0 6px rgba(15, 178, 124, 0.5));
        }
      }
    }

    .bar-rect-emi {
      fill: #0071e3;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .bar-rect-prepay {
      fill: #0fb27c;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .is-peak .bar-rect-prepay {
      fill: #ff5f9e;
    }

    .chart-x-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.68rem;
      font-weight: 700;
      color: #8e8e93;
      padding-top: 4px;
      border-top: 1px solid rgba(0, 0, 0, 0.04);

      .peak-txt {
        color: #ff5f9e;
        font-weight: 800;
      }
    }

    .inspector-card {
      background: #f8f8fc;
      border-radius: 18px;
      padding: 14px 16px;
      border: 1px solid rgba(0, 0, 0, 0.05);
      display: flex;
      flex-direction: column;
      gap: 10px;

      &.is-peak-card {
        background: linear-gradient(135deg, rgba(255, 95, 158, 0.05) 0%, #ffffff 100%);
        border-color: rgba(255, 95, 158, 0.25);
      }
    }

    .inspector-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .insp-left {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .inspector-title {
      font-size: 0.85rem;
      font-weight: 800;
      color: #15172b;
    }

    .inspector-badge {
      font-size: 0.68rem;
      font-weight: 700;
      background: rgba(108, 76, 255, 0.08);
      color: #6c4cff;
      padding: 2px 8px;
      border-radius: 99px;

      &.peak-badge {
        background: rgba(255, 95, 158, 0.15);
        color: #d81b60;
      }
    }

    .insp-total {
      font-size: 1.15rem;
      letter-spacing: -0.02em;
    }

    .breakdown-pills {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    @media (max-width: 480px) {
      .breakdown-pills {
        grid-template-columns: 1fr;
        gap: 6px;
      }
    }

    .mini-breakdown-tile {
      background: #ffffff;
      border-radius: 12px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      border: 1px solid rgba(0, 0, 0, 0.04);
    }

    .b-lbl {
      font-size: 0.68rem;
      font-weight: 700;
      color: #8e8e93;
    }

    .b-val {
      font-size: 0.95rem;
      font-weight: 800;

      &.text-blue { color: #0071e3; }
      &.text-purple { color: #6c4cff; }
      &.text-ink { color: #15172b; }
    }

    .zero-payment-desc {
      font-size: 0.78rem;
      color: #767a90;
      line-height: 1.4;
      margin: 0;
    }
  `],
})
export class MonthlyPaymentsAuditChartComponent {
  readonly paymentsSummary = input<SbiPaymentsSummary>();
  readonly summary = computed(() => this.paymentsSummary() ?? getSbiPaymentsSummary());
  readonly selectedYearFilter = signal<'all' | '2026' | '2025' | '2024'>('all');
  readonly selectedRecord = signal<SbiMonthlyPaymentRecord | null>(null);

  readonly displayedRecords = computed<SbiMonthlyPaymentRecord[]>(() => {
    const all = this.summary().records;
    const filter = this.selectedYearFilter();
    if (filter === 'all') return all;
    return all.filter((r) => r.period.startsWith(filter));
  });

  readonly svgWidth = computed(() => {
    const count = this.displayedRecords().length;
    return Math.max(300, count * this.barStep());
  });

  readonly svgViewBox = computed(() => `0 0 ${this.svgWidth()} 140`);

  readonly barStep = computed(() => {
    const count = this.displayedRecords().length;
    if (count <= 8) return 40;
    if (count <= 14) return 26;
    return 20; // 30 bars = 600 width
  });

  readonly barWidth = computed(() => {
    const step = this.barStep();
    return Math.max(8, step - 6);
  });

  readonly barOffset = computed(() => {
    return (this.barStep() - this.barWidth()) / 2;
  });

  // Scale: Max amount is ~₹7,00,000 for ₹6.55L peak bar
  readonly maxAmountPaise = 70000000; // 7,00,000 in paise
  readonly chartHeight = 120; // max px height of bar

  readonly formatCompactPaise = formatCompactPaise;
  readonly formatPaise = formatPaise;

  setYearFilter(filter: 'all' | '2026' | '2025' | '2024'): void {
    triggerHaptic('light');
    this.selectedYearFilter.set(filter);
    const displayed = this.displayedRecords();
    if (this.selectedRecord() && !displayed.find((r) => r.period === this.selectedRecord()!.period)) {
      this.selectedRecord.set(null);
    }
  }

  selectRecord(rec: SbiMonthlyPaymentRecord): void {
    triggerHaptic('selection');
    if (this.selectedRecord()?.period === rec.period) {
      this.selectedRecord.set(null);
    } else {
      this.selectedRecord.set(rec);
    }
  }

  readonly activeDetails = computed<SbiMonthlyPaymentRecord | null>(() => {
    if (this.selectedRecord()) return this.selectedRecord();
    // Default to the all-time peak month (Sep 2024) or latest
    const displayed = this.displayedRecords();
    const peak = displayed.find((r) => r.isPeak);
    return peak || displayed[displayed.length - 1] || null;
  });

  getY(amountPaise: number): number {
    const clamped = Math.min(this.maxAmountPaise, Math.max(0, amountPaise));
    const h = (clamped / this.maxAmountPaise) * this.chartHeight;
    return 130 - h;
  }

  getHeight(amountPaise: number): number {
    const clamped = Math.min(this.maxAmountPaise, Math.max(0, amountPaise));
    return Math.max(2, (clamped / this.maxAmountPaise) * this.chartHeight);
  }

  getStarPoints(cx: number, cy: number): string {
    const points: string[] = [];
    const rOuter = 5;
    const rInner = 2.5;
    for (let i = 0; i < 5; i++) {
      const angleOuter = (i * 72 - 90) * (Math.PI / 180);
      const angleInner = ((i + 0.5) * 72 - 90) * (Math.PI / 180);
      points.push(`${cx + rOuter * Math.cos(angleOuter)},${cy + rOuter * Math.sin(angleOuter)}`);
      points.push(`${cx + rInner * Math.cos(angleInner)},${cy + rInner * Math.sin(angleInner)}`);
    }
    return points.join(' ');
  }
}


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
  getSbiAuditSummary,
  SbiAuditSummary,
  SbiMonthlyAuditRecord,
  triggerHaptic,
} from '../../../core/engine';

@Component({
  selector: 'app-interest-audit-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="interest-card" role="region" aria-label="How Interest Got Added So Far">
      <div class="card-iridescent-edge" aria-hidden="true"></div>

      <!-- Header -->
      <div class="interest-header">
        <div class="header-cluster">
          <span class="interest-badge">INTEREST AUDIT</span>
          <h2 class="interest-title">SBI Interest Trajectory</h2>
        </div>
      </div>

      <!-- 3 Big WOW Telemetry Cards -->
      <div class="wow-stats-grid">
        <!-- 1. Total Cumulative Interest -->
        <div class="wow-stat-tile tile-danger">
          <span class="wow-stat-lbl">Total Debited</span>
          <div class="wow-stat-val text-danger tabular-nums">
            {{ formatCompactPaise(auditData().totalInterestPaid) }}
          </div>
          <span class="wow-stat-sub tabular-nums">
            29 Months Debits
          </span>
        </div>

        <!-- 2. Monthly Drop / Relief -->
        <div class="wow-stat-tile tile-emerald">
          <span class="wow-stat-lbl">Monthly Drop</span>
          <div class="wow-stat-val text-emerald tabular-nums">
            −₹22.5K <span class="val-unit">/mo</span>
          </div>
          <span class="wow-stat-sub tabular-nums">
            Peak ₹98.9K → ₹76.5K
          </span>
        </div>

        <!-- 3. Rate Reduction -->
        <div class="wow-stat-tile tile-purple">
          <span class="wow-stat-lbl">Rate Relief</span>
          <div class="wow-stat-val text-purple tabular-nums">
            −125 bps
          </div>
          <span class="wow-stat-sub">
            8.90% → 7.65%
          </span>
        </div>
      </div>

      <!-- Interactive 29-Month SVG Step-Down Chart -->
      <div class="chart-container">
        <div class="chart-top-bar">
          <span class="chart-caption">29-Month Debit Trajectory</span>
          @if (selectedRecord()) {
            <span class="selected-pill">
              {{ selectedRecord()!.month }}: <strong>{{ formatPaise(selectedRecord()!.sbiInterest) }}</strong> ({{ selectedRecord()!.effectiveRate.toFixed(2) }}%)
            </span>
          } @else {
            <span class="chart-hint">Tap any bar to inspect formula</span>
          }
        </div>

        <svg
          class="interest-svg"
          viewBox="0 0 580 140"
          preserveAspectRatio="none"
          role="img"
          aria-label="Monthly SBI Interest Bar Chart"
        >
          <!-- Grid line for peak ~₹1,00,000 -->
          <line x1="0" y1="15" x2="580" y2="15" stroke="rgba(0,0,0,0.06)" stroke-dasharray="4" />
          <line x1="0" y1="75" x2="580" y2="75" stroke="rgba(0,0,0,0.06)" stroke-dasharray="4" />
          <line x1="0" y1="130" x2="580" y2="130" stroke="rgba(0,0,0,0.08)" />

          <!-- Bars -->
          @for (rec of auditData().records; track rec.period; let idx = $index) {
            <g
              class="bar-group"
              [class.active]="selectedRecord()?.period === rec.period"
              (click)="selectRecord(rec)"
            >
              <!-- Bar background touch target -->
              <rect
                [attr.x]="idx * 20 + 2"
                y="0"
                width="16"
                height="130"
                fill="transparent"
                style="cursor: pointer;"
              />
              <!-- The Bar -->
              <rect
                class="bar-rect"
                [attr.x]="idx * 20 + 4"
                [attr.y]="getY(rec.sbiInterest)"
                width="12"
                [attr.height]="getHeight(rec.sbiInterest)"
                rx="4"
              />
            </g>
          }
        </svg>

        <div class="chart-x-labels">
          <span>Jun '24 (₹61.6K · 19d)</span>
          <span>Jul '24 (₹98.9K Peak)</span>
          <span>Jan '26 (7.65% Cut)</span>
          <span>Oct '26 (₹79.7K)</span>
        </div>
      </div>

      <!-- Selected Month Math Inspector Pill -->
      @if (activeDetails(); as det) {
        <div class="inspector-card">
          <div class="inspector-header">
            <span class="inspector-title">🧮 {{ det.month }} Formula</span>
            <span class="inspector-badge">{{ det.rateEra }} · {{ det.effectiveRate.toFixed(2) }}%</span>
          </div>
          <div class="formula-box">
            <span class="formula-math">
              ({{ formatCompactPaise(det.avgBalance) }} × {{ det.effectiveRate.toFixed(2) }}% × {{ det.days }}d) ÷ 365
            </span>
            <span class="formula-equals">=</span>
            <span class="formula-result text-danger tabular-nums">
              {{ formatPaise(det.sbiInterest) }}
            </span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .interest-card {
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
      background: linear-gradient(135deg, rgba(238, 77, 107, 0.25) 0%, rgba(108, 76, 255, 0.25) 100%);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }

    .interest-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .header-cluster {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .interest-badge {
      align-self: flex-start;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      background: linear-gradient(135deg, #ee4d6b 0%, #6c4cff 100%);
      color: #ffffff;
      padding: 3px 10px;
      border-radius: 99px;
    }

    .interest-title {
      font-size: 1.25rem;
      font-weight: 900;
      color: #15172b;
      margin: 4px 0 0;
      letter-spacing: -0.02em;
    }

    .interest-subtitle {
      font-size: 0.78rem;
      font-weight: 600;
      color: #767a90;
    }

    .wow-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
    }

    .wow-stat-tile {
      background: #f8f9fd;
      border-radius: 18px;
      padding: 14px 12px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      border: 1px solid rgba(0, 0, 0, 0.04);

      &.tile-danger { background: rgba(238, 77, 107, 0.05); border-color: rgba(238, 77, 107, 0.15); }
      &.tile-emerald { background: rgba(15, 178, 124, 0.05); border-color: rgba(15, 178, 124, 0.15); }
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
      font-size: 1.45rem;
      font-weight: 900;
      letter-spacing: -0.03em;
      line-height: 1.1;

      &.text-danger { color: #ee4d6b; }
      &.text-emerald { color: #0fb27c; }
      &.text-purple { color: #6c4cff; }

      .val-unit {
        font-size: 0.85rem;
        font-weight: 700;
      }
    }

    .wow-stat-sub {
      font-size: 0.72rem;
      font-weight: 600;
      color: #767a90;
    }

    .chart-container {
      background: #fbfbfd;
      border-radius: 20px;
      padding: 14px 12px;
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
      font-weight: 700;
    }

    .chart-caption {
      color: #15172b;
    }

    .chart-hint {
      color: #8e8e93;
    }

    .selected-pill {
      color: #ee4d6b;
      background: rgba(238, 77, 107, 0.1);
      padding: 2px 8px;
      border-radius: 99px;
    }

    .interest-svg {
      width: 100%;
      height: 120px;
      overflow: visible;
    }

    .bar-group {
      cursor: pointer;

      .bar-rect {
        fill: #ee4d6b;
        opacity: 0.75;
        transition: all 0.2s ease;
      }

      &:hover .bar-rect {
        opacity: 1;
        fill: #ff2d55;
        transform: scaleY(1.03);
      }

      &.active .bar-rect {
        opacity: 1;
        fill: #6c4cff;
        filter: drop-shadow(0 2px 6px rgba(108, 76, 255, 0.4));
      }
    }

    .chart-x-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.68rem;
      font-weight: 700;
      color: #8e8e93;
    }

    .inspector-card {
      background: #f8f8fc;
      border-radius: 18px;
      padding: 14px 16px;
      border: 1px solid rgba(0, 0, 0, 0.04);
      display: flex;
      flex-direction: column;
      gap: 8px;
      animation: fadeIn 0.25s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .inspector-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .inspector-title {
      font-size: 0.85rem;
      font-weight: 800;
      color: #15172b;
    }

    .inspector-badge {
      font-size: 0.7rem;
      font-weight: 800;
      background: rgba(108, 76, 255, 0.1);
      color: #6c4cff;
      padding: 2px 8px;
      border-radius: 99px;
    }

    .formula-box {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      background: #ffffff;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(0, 0, 0, 0.04);
    }

    .formula-math {
      font-size: 0.75rem;
      font-weight: 600;
      color: #767a90;
    }

    .formula-equals {
      font-size: 0.9rem;
      font-weight: 800;
      color: #15172b;
    }

    .formula-result {
      font-size: 1.1rem;
      font-weight: 900;
      color: #ee4d6b;
    }

    .formula-caption {
      font-size: 0.72rem;
      color: #8e8e93;
      margin: 0;
    }
  `],
})
export class InterestAuditChartComponent {
  readonly auditSummary = input<SbiAuditSummary>();
  readonly auditData = computed<SbiAuditSummary>(() => this.auditSummary() ?? getSbiAuditSummary());
  readonly selectedRecord = signal<SbiMonthlyAuditRecord | null>(null);

  constructor() {
    const recs = this.auditData().records;
    if (recs && recs.length > 0) {
      this.selectedRecord.set(recs[recs.length - 1]);
    }
  }

  readonly formatPaise = formatPaise;
  readonly formatCompactPaise = formatCompactPaise;

  readonly activeDetails = computed(() => this.selectedRecord());

  selectRecord(rec: SbiMonthlyAuditRecord): void {
    triggerHaptic('light');
    this.selectedRecord.set(rec);
  }

  getY(interest: number): number {
    // Peak is ~100,000 paise * 100 = 10,000,000 paise
    // SVG height is 130 (with 10 padding at top)
    const maxVal = 10500000;
    const ratio = Math.min(1, Math.max(0, interest / maxVal));
    const h = ratio * 115;
    return 130 - h;
  }

  getHeight(interest: number): number {
    const maxVal = 10500000;
    const ratio = Math.min(1, Math.max(0, interest / maxVal));
    return Math.max(4, ratio * 115);
  }
}


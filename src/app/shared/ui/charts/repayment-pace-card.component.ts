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
  RepaymentPaceAnalysis,
  triggerHaptic,
} from '../../../core/engine';

@Component({
  selector: 'app-repayment-pace-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="pace-card" role="region" aria-label="Repayment Pace: Paid vs Supposed to Pay">
      <div class="card-iridescent-edge" aria-hidden="true"></div>

      <!-- Header: Title & Switcher -->
      <div class="pace-header">
        <div class="pace-tag-cluster">
          <span class="pace-badge">REPAYMENT PACE</span>
          <span class="pace-timeline-chip">{{ pace().monthsElapsed }} Months Elapsed (Jun '24 – Nov '26)</span>
        </div>

        <!-- Mode Toggle: vs Bank Mandatory EMI vs vs Family Target -->
        <div class="mode-toggle-group" role="tablist">
          <button
            type="button"
            class="toggle-btn"
            [class.active]="compareMode() === 'bank'"
            (click)="setMode('bank')"
            role="tab"
            [attr.aria-selected]="compareMode() === 'bank'"
          >
            vs Bank EMI
          </button>
          <button
            type="button"
            class="toggle-btn"
            [class.active]="compareMode() === 'family'"
            (click)="setMode('family')"
            role="tab"
            [attr.aria-selected]="compareMode() === 'family'"
          >
            vs Family Target
          </button>
        </div>
      </div>

      <!-- 2 Big WOW Numbers Side by Side -->
      <div class="big-numbers-grid">
        <!-- Number 1: Net Injected in OD (Default) or Gross -->
        <div class="big-num-card card-paid">
          <div class="num-top-row">
            <span class="num-label">
              {{ isNet() ? 'Net Injected in OD' : 'Gross Paid In' }}
            </span>
            <button
              type="button"
              class="net-toggle-btn"
              (click)="toggleNet()"
              title="Toggle between Net retained in OD and Gross total deposits"
            >
              {{ isNet() ? 'Show Gross' : 'Show Net' }}
            </button>
          </div>
          <div class="num-value text-emerald tabular-nums">
            {{ formatCompactPaise(currentPaidAmount()) }}
          </div>
          <span class="num-subtext tabular-nums">
            {{ formatPaise(currentPaidAmount()) }}
            {{ isNet() ? '(after ₹10.48L withdrawals)' : '(all cumulative deposits)' }}
          </span>
        </div>

        <!-- Number 2: Interest Added Till Now -->
        <div class="big-num-card card-supposed">
          <span class="num-label">Interest Added Till Now</span>
          <div class="num-value text-muted tabular-nums">
            {{ formatCompactPaise(pace().totalInterestAddedSoFar) }}
          </div>
          <span class="num-subtext tabular-nums">
            {{ formatPaise(pace().totalInterestAddedSoFar) }} (29 Mos SBI Debits)
          </span>
        </div>
      </div>

      <!-- Hero Expression / WOW Verdict Banner -->
      <div class="verdict-banner" [class.banner-ahead]="isAhead()" [class.banner-behind]="!isAhead()">
        <div class="verdict-icon">{{ isAhead() ? '🚀' : '🎯' }}</div>
        <div class="verdict-content">
          <div class="verdict-title">
            @if (compareMode() === 'bank') {
              <span class="tabular-nums font-bold">
                +{{ formatCompactPaise(varianceAmount()) }} Ahead of Bank Schedule
              </span>
              <span class="verdict-pct-pill">+{{ variancePercent() }}%</span>
            } @else {
              <span class="tabular-nums font-bold">
                {{ targetAttainmentPct() }}% of Family Goal Achieved
              </span>
            }
          </div>
          <div class="verdict-subtext">
            @if (compareMode() === 'bank') {
              @if (isNet()) {
                Net injected exceeds bank schedule by <strong>+{{ formatCompactPaise(varianceAmount()) }}</strong> — equivalent to <strong>~{{ pace().netEquivalentEmisPrepaid }} months</strong> of advance EMIs paid ahead of time!
              } @else {
                Gross deposits exceed bank schedule by <strong>+{{ formatCompactPaise(varianceAmount()) }}</strong> — equivalent to <strong>~{{ pace().grossEquivalentEmisPrepaid }} months</strong> of advance EMIs prepaid (total deposited: <strong>~{{ pace().totalEmisCount }} EMIs</strong>).
              }
            } @else {
              <strong>{{ formatCompactPaise(currentPaidAmount()) }}</strong> deposited toward accelerated ₹2.40L/month payoff goal.
            }
          </div>
        </div>
      </div>

      <!-- Visual Over-Pacing Bar -->
      <div class="progress-wrap">
        <div class="progress-labels">
          <span class="p-lbl">Schedule Baseline (100%)</span>
          <span class="p-val tabular-nums font-bold text-emerald">{{ pacingBarPercent() }}%</span>
        </div>
        <div class="bar-track">
          <!-- 100% Benchmark Marker -->
          <div class="benchmark-marker" title="100% Scheduled"></div>
          <!-- Animated Fill Bar -->
          <div
            class="bar-fill"
            [style.width.%]="clampedBarPercent()"
            [class.over-performing]="pacingBarPercent() > 100"
          ></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pace-card {
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
      background: linear-gradient(135deg, rgba(108, 76, 255, 0.25) 0%, rgba(15, 178, 124, 0.3) 100%);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }

    .pace-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    .pace-tag-cluster {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .pace-badge {
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      background: linear-gradient(135deg, #6c4cff 0%, #0fb27c 100%);
      color: #ffffff;
      padding: 3px 10px;
      border-radius: 99px;
    }

    .pace-timeline-chip {
      font-size: 0.75rem;
      font-weight: 700;
      color: #767a90;
    }

    .mode-toggle-group {
      display: flex;
      background: #f1f1f6;
      padding: 3px;
      border-radius: 99px;
      gap: 2px;
    }

    .toggle-btn {
      border: none;
      background: transparent;
      padding: 5px 12px;
      border-radius: 99px;
      font-size: 0.75rem;
      font-weight: 700;
      color: #767a90;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &.active {
        background: #ffffff;
        color: #15172b;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      }
    }

    .big-numbers-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .big-num-card {
      background: #f8f9fd;
      border-radius: 20px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border: 1px solid rgba(0, 0, 0, 0.03);

      &.card-paid {
        background: rgba(15, 178, 124, 0.04);
        border-color: rgba(15, 178, 124, 0.15);
      }
    }

    .num-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .num-label {
      font-size: 0.72rem;
      font-weight: 800;
      color: #767a90;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .net-toggle-btn {
      border: none;
      background: rgba(15, 178, 124, 0.1);
      color: #0fb27c;
      font-size: 0.65rem;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 99px;
      cursor: pointer;
    }

    .num-value {
      font-size: 1.75rem;
      font-weight: 900;
      letter-spacing: -0.03em;
      line-height: 1.1;

      &.text-emerald { color: #0fb27c; }
      &.text-muted { color: #15172b; }
    }

    .num-subtext {
      font-size: 0.75rem;
      font-weight: 600;
      color: #8e8e93;
    }

    .verdict-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(15, 178, 124, 0.08);
      border: 1px solid rgba(15, 178, 124, 0.2);

      &.banner-behind {
        background: rgba(108, 76, 255, 0.08);
        border-color: rgba(108, 76, 255, 0.2);
      }
    }

    .verdict-icon {
      font-size: 1.6rem;
      line-height: 1;
    }

    .verdict-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
    }

    .verdict-title {
      font-size: 0.95rem;
      font-weight: 800;
      color: #15172b;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .verdict-pct-pill {
      font-size: 0.72rem;
      font-weight: 800;
      color: #ffffff;
      background: #0fb27c;
      padding: 2px 8px;
      border-radius: 99px;
    }

    .verdict-subtext {
      font-size: 0.78rem;
      color: #767a90;
      line-height: 1.3;

      strong {
        color: #15172b;
        font-weight: 700;
      }
    }

    .progress-wrap {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .progress-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.72rem;
      font-weight: 700;
      color: #8e8e93;
    }

    .bar-track {
      position: relative;
      width: 100%;
      height: 12px;
      background: #ececf2;
      border-radius: 99px;
      overflow: visible;
    }

    .benchmark-marker {
      position: absolute;
      top: -3px;
      bottom: -3px;
      left: 70%; /* 100% scale marker placed at 70% so overfills fit */
      width: 2px;
      background: #15172b;
      border-radius: 1px;
      z-index: 2;
    }

    .benchmark-marker::after {
      content: '100% EMI';
      position: absolute;
      top: -16px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 9px;
      font-weight: 800;
      color: #8e8e93;
      white-space: nowrap;
    }

    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #6c4cff 0%, #0fb27c 100%);
      border-radius: 99px;
      transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 0 10px rgba(15, 178, 124, 0.4);
    }
  `],
})
export class RepaymentPaceCardComponent {
  readonly pace = input.required<RepaymentPaceAnalysis>();

  readonly compareMode = signal<'bank' | 'family'>('bank');
  readonly isNet = signal<boolean>(true); // Show net injected in OD by default

  readonly formatPaise = formatPaise;
  readonly formatCompactPaise = formatCompactPaise;

  setMode(mode: 'bank' | 'family'): void {
    triggerHaptic('light');
    this.compareMode.set(mode);
  }

  toggleNet(): void {
    triggerHaptic('light');
    this.isNet.update((v) => !v);
  }

  readonly currentPaidAmount = computed(() => {
    return this.isNet() ? this.pace().netPaid : this.pace().grossPaid;
  });

  readonly currentSupposedAmount = computed(() => {
    return this.compareMode() === 'bank'
      ? this.pace().bankSupposedToPay
      : this.pace().familySupposedToPay;
  });

  readonly varianceAmount = computed(() => {
    return this.isNet() ? this.pace().netAheadOfBank : this.pace().grossAheadOfBank;
  });

  readonly variancePercent = computed(() => {
    return this.isNet() ? this.pace().netAheadOfBankPct : this.pace().grossAheadOfBankPct;
  });

  readonly isAhead = computed(() => {
    return this.varianceAmount() >= 0;
  });

  readonly targetAttainmentPct = computed(() => {
    const paid = this.currentPaidAmount();
    const target = this.pace().familySupposedToPay;
    return target > 0 ? Number(((paid / target) * 100).toFixed(1)) : 0;
  });

  readonly pacingBarPercent = computed(() => {
    const paid = this.currentPaidAmount();
    const supposed = this.currentSupposedAmount();
    return supposed > 0 ? Math.round((paid / supposed) * 100) : 100;
  });

  readonly clampedBarPercent = computed(() => {
    // Relative to the 70% marker = 100% benchmark
    const pct = this.pacingBarPercent();
    const scaled = (pct / 100) * 70;
    return Math.min(100, Math.max(8, scaled));
  });
}


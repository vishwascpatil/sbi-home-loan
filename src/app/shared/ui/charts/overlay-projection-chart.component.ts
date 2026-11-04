import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { formatCompactPaise, Paise } from '../../../core/engine';

@Component({
  selector: 'app-overlay-projection-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overlay-chart-wrap">
      <div class="chart-legend">
        <span class="legend-item baseline">
          <span class="dot"></span> Baseline
        </span>
        <span class="legend-item scenario">
          <span class="dot"></span> Custom Scenario
        </span>
      </div>

      <svg
        class="overlay-svg"
        viewBox="0 0 400 160"
        preserveAspectRatio="none"
        role="img"
        aria-label="Loan payoff comparison projection chart"
      >
        <defs>
          <linearGradient id="grad-baseline" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#6c4cff" stop-opacity="0.25" />
            <stop offset="100%" stop-color="#6c4cff" stop-opacity="0.0" />
          </linearGradient>
          <linearGradient id="grad-scenario" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ff5f9e" stop-opacity="0.25" />
            <stop offset="100%" stop-color="#ff5f9e" stop-opacity="0.0" />
          </linearGradient>
        </defs>

        <!-- Grid Lines -->
        <line x1="0" y1="20" x2="400" y2="20" stroke="var(--color-line, rgba(0,0,0,0.06))" stroke-dasharray="4" />
        <line x1="0" y1="80" x2="400" y2="80" stroke="var(--color-line, rgba(0,0,0,0.06))" stroke-dasharray="4" />
        <line x1="0" y1="140" x2="400" y2="140" stroke="var(--color-line, rgba(0,0,0,0.06))" />

        <!-- Baseline Area & Line -->
        @if (baselinePath()) {
          <path [attr.d]="baselineAreaPath()" fill="url(#grad-baseline)" />
          <path
            [attr.d]="baselinePath()"
            fill="none"
            stroke="#6c4cff"
            stroke-width="2.5"
            stroke-linecap="round"
          />
        }

        <!-- Custom Scenario Area & Line -->
        @if (scenarioPath()) {
          <path [attr.d]="scenarioAreaPath()" fill="url(#grad-scenario)" />
          <path
            [attr.d]="scenarioPath()"
            fill="none"
            stroke="#ff5f9e"
            stroke-width="2.5"
            stroke-linecap="round"
          />
        }
      </svg>

      <div class="axis-labels">
        <span>Today ({{ formatCompactPaise(maxPrincipal()) }})</span>
        <span>Payoff (₹0)</span>
      </div>
    </div>
  `,
  styles: `
    .overlay-chart-wrap {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 12px 0 6px;
    }

    .chart-legend {
      display: flex;
      gap: 16px;
      justify-content: flex-end;
      font-size: 11px;
      font-weight: 700;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .legend-item .dot {
      width: 8px;
      height: 8px;
      border-radius: 99px;
    }

    .legend-item.baseline .dot {
      background: #6c4cff;
    }

    .legend-item.scenario .dot {
      background: #ff5f9e;
    }

    .overlay-svg {
      width: 100%;
      height: 140px;
      overflow: visible;
    }

    .axis-labels {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 600;
      color: var(--color-muted, #767a90);
    }
  `,
})
export class OverlayProjectionChartComponent {
  readonly baselineSchedule = input<Paise[]>([]);
  readonly scenarioSchedule = input<Paise[]>([]);

  readonly formatCompactPaise = formatCompactPaise;

  readonly maxPrincipal = computed<Paise>(() => {
    const b0 = this.baselineSchedule()[0] || (0 as Paise);
    const s0 = this.scenarioSchedule()[0] || (0 as Paise);
    return Math.max(b0, s0) as Paise;
  });

  readonly maxLen = computed<number>(() => {
    return Math.max(
      this.baselineSchedule().length,
      this.scenarioSchedule().length,
      2
    );
  });

  readonly baselinePath = computed<string>(() => {
    return this.buildPath(this.baselineSchedule(), false);
  });

  readonly baselineAreaPath = computed<string>(() => {
    return this.buildPath(this.baselineSchedule(), true);
  });

  readonly scenarioPath = computed<string>(() => {
    return this.buildPath(this.scenarioSchedule(), false);
  });

  readonly scenarioAreaPath = computed<string>(() => {
    return this.buildPath(this.scenarioSchedule(), true);
  });

  private buildPath(data: Paise[], isArea: boolean): string {
    if (!data || data.length === 0) return '';
    const maxVal = this.maxPrincipal();
    const totalSlots = this.maxLen();

    const w = 400;
    const h = 140;
    const paddingY = 16;
    const availH = h - paddingY * 2;

    const points = data.map((val, idx) => {
      const x = totalSlots > 1 ? (idx / (totalSlots - 1)) * w : 0;
      const ratio = maxVal > 0 ? val / maxVal : 0;
      const y = h - paddingY - ratio * availH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const linePath = `M ${points.join(' L ')}`;
    if (!isArea) return linePath;

    const lastX = points.length > 0 ? points[points.length - 1].split(',')[0] : w;
    return `${linePath} L ${lastX},${h - paddingY} L 0,${h - paddingY} Z`;
  }
}

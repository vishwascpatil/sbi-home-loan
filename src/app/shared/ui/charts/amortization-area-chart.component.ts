import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AmortizationPoint } from '../../../core/engine';
import { formatPaise } from '../../../core/engine/money';

@Component({
  selector: 'app-amortization-area-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="chart-wrapper">
      <div class="chart-legend">
        <span class="legend-item principal">
          <span class="color-dot principal-dot"></span> Principal Repaid
        </span>
        <span class="legend-item interest">
          <span class="color-dot interest-dot"></span> Interest Incurred
        </span>
      </div>

      <svg
        class="area-chart-svg"
        viewBox="0 0 600 240"
        preserveAspectRatio="none"
        (mouseleave)="hoveredIndex.set(null)"
      >
        <defs>
          <linearGradient id="principalGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0fb27c" stop-opacity="0.65" />
            <stop offset="100%" stop-color="#0fb27c" stop-opacity="0.05" />
          </linearGradient>

          <linearGradient id="interestGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ee4d6b" stop-opacity="0.65" />
            <stop offset="100%" stop-color="#ee4d6b" stop-opacity="0.05" />
          </linearGradient>
        </defs>

        <!-- Horizontal Guideline Grid -->
        <line x1="40" y1="30" x2="580" y2="30" stroke="rgba(0,0,0,0.06)" stroke-dasharray="4 4" />
        <line x1="40" y1="90" x2="580" y2="90" stroke="rgba(0,0,0,0.06)" stroke-dasharray="4 4" />
        <line x1="40" y1="150" x2="580" y2="150" stroke="rgba(0,0,0,0.06)" stroke-dasharray="4 4" />
        <line x1="40" y1="210" x2="580" y2="210" stroke="rgba(0,0,0,0.12)" />

        <!-- Stacked Area Paths -->
        <path [attr.d]="combinedAreaPath()" fill="url(#interestGradient)" />
        <path [attr.d]="principalAreaPath()" fill="url(#principalGradient)" />

        <!-- Stroke Outlines -->
        <path [attr.d]="combinedStrokePath()" fill="none" stroke="#ee4d6b" stroke-width="2.5" />
        <path [attr.d]="principalStrokePath()" fill="none" stroke="#0fb27c" stroke-width="2.5" />

        <!-- Interactive Hover Hit Columns -->
        @for (pt of chartPoints(); track pt.raw.period) {
          <rect
            [attr.x]="pt.x - 15"
            y="20"
            width="30"
            height="190"
            fill="transparent"
            (mouseenter)="hoveredIndex.set($index)"
            style="cursor: pointer;"
          />
        }

        <!-- Active Hover Line & Point Markers -->
        @if (hoveredPoint()) {
          <line
            [attr.x1]="hoveredPoint()!.x"
            y1="20"
            [attr.x2]="hoveredPoint()!.x"
            y2="210"
            stroke="#6c4cff"
            stroke-width="1.5"
            stroke-dasharray="3 3"
          />
          <circle
            [attr.cx]="hoveredPoint()!.x"
            [attr.cy]="hoveredPoint()!.combinedY"
            r="4.5"
            fill="#ee4d6b"
            stroke="#fff"
            stroke-width="2"
          />
          <circle
            [attr.cx]="hoveredPoint()!.x"
            [attr.cy]="hoveredPoint()!.principalY"
            r="4.5"
            fill="#0fb27c"
            stroke="#fff"
            stroke-width="2"
          />
        }
      </svg>

      <!-- Hover Tooltip Card -->
      @if (hoveredPoint()) {
        <div
          class="chart-tooltip"
          [style.left.%]="(hoveredPoint()!.x / 600) * 100"
        >
          <span class="tooltip-period">{{ hoveredPoint()!.raw.label }}</span>
          <div class="tooltip-row">
            <span class="dot green"></span> Principal:
            <strong>{{ formatPaise(hoveredPoint()!.raw.cumulativePrincipal) }}</strong>
          </div>
          <div class="tooltip-row">
            <span class="dot red"></span> Interest:
            <strong>{{ formatPaise(hoveredPoint()!.raw.cumulativeInterest) }}</strong>
          </div>
          <div class="tooltip-row sub">
            Balance: {{ formatPaise(hoveredPoint()!.raw.closingOutstanding) }}
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .chart-wrapper {
      position: relative;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .chart-legend {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .color-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .principal-dot { background: #0fb27c; }
    .interest-dot { background: #ee4d6b; }

    .area-chart-svg {
      width: 100%;
      height: 200px;
      overflow: visible;
    }

    .chart-tooltip {
      position: absolute;
      top: 10px;
      transform: translateX(-50%);
      background: rgba(21, 23, 43, 0.94);
      color: #ffffff;
      padding: 8px 12px;
      border-radius: 12px;
      font-size: 0.75rem;
      pointer-events: none;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
      z-index: 10;
      white-space: nowrap;
      backdrop-filter: blur(8px);
    }

    .tooltip-period {
      font-weight: 800;
      display: block;
      margin-bottom: 4px;
      color: #a5b4fc;
    }

    .tooltip-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-variant-numeric: tabular-nums;
      margin-bottom: 2px;

      &.sub {
        color: #9399b4;
        font-size: 0.7rem;
        margin-top: 4px;
      }
    }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      &.green { background: #0fb27c; }
      &.red { background: #ee4d6b; }
    }
  `],
})
export class AmortizationAreaChartComponent {
  readonly points = input.required<AmortizationPoint[]>();
  readonly hoveredIndex = signal<number | null>(null);

  readonly formatPaise = formatPaise;

  readonly chartPoints = computed(() => {
    const raw = this.points();
    if (raw.length === 0) return [];

    const maxVal = Math.max(
      ...raw.map((p) => p.cumulativePrincipal + p.cumulativeInterest),
      1
    );

    const width = 540;
    const startX = 40;
    const bottomY = 210;
    const topY = 30;
    const height = bottomY - topY;

    return raw.map((p, idx) => {
      const x = raw.length === 1 ? startX + width / 2 : startX + (idx / (raw.length - 1)) * width;
      const principalFraction = p.cumulativePrincipal / maxVal;
      const combinedFraction = (p.cumulativePrincipal + p.cumulativeInterest) / maxVal;

      const principalY = bottomY - principalFraction * height;
      const combinedY = bottomY - combinedFraction * height;

      return {
        raw: p,
        x,
        principalY,
        combinedY,
      };
    });
  });

  readonly principalAreaPath = computed(() => {
    const pts = this.chartPoints();
    if (pts.length === 0) return '';
    const bottomY = 210;
    let d = `M ${pts[0].x} ${bottomY} L ${pts[0].x} ${pts[0].principalY}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i].principalY}`;
    }
    d += ` L ${pts[pts.length - 1].x} ${bottomY} Z`;
    return d;
  });

  readonly combinedAreaPath = computed(() => {
    const pts = this.chartPoints();
    if (pts.length === 0) return '';
    const bottomY = 210;
    let d = `M ${pts[0].x} ${bottomY} L ${pts[0].x} ${pts[0].combinedY}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i].combinedY}`;
    }
    d += ` L ${pts[pts.length - 1].x} ${bottomY} Z`;
    return d;
  });

  readonly principalStrokePath = computed(() => {
    const pts = this.chartPoints();
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x} ${pts[0].principalY}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i].principalY}`;
    }
    return d;
  });

  readonly combinedStrokePath = computed(() => {
    const pts = this.chartPoints();
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x} ${pts[0].combinedY}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i].combinedY}`;
    }
    return d;
  });

  readonly hoveredPoint = computed(() => {
    const idx = this.hoveredIndex();
    if (idx === null) return null;
    return this.chartPoints()[idx] || null;
  });
}

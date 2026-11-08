import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatCompactPaise, formatPaise, Paise, toPaise } from '../../../core/engine';

export interface DualTrackPoint {
  month: string; // e.g. "Jun '24", "Dec '24"
  drawingPowerPaise: Paise;
  actualOutstandingPaise: Paise;
}

export interface YAxisTick {
  label: string;
  y: number;
}

export interface XAxisTick {
  label: string;
  x: number;
}

@Component({
  selector: 'app-dual-track-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dual-track-container" role="region" aria-label="Drawing Power vs Actual Balance Chart">
      <!-- Section Title & Badge -->
      <div class="chart-title-row">
        <div class="title-cluster">
          <span class="chart-eyebrow">Balance Trajectory</span>
          <h2 class="chart-headline">Drawing Power vs Current Debt</h2>
        </div>
        <div class="buffer-live-pill">
          <span class="pulse-dot"></span>
          <span>OD Shield Active</span>
        </div>
      </div>

      <!-- 3 Big Metric Telemetry Tiles -->
      <div class="dual-stats-header">
        <div class="stat-cluster stat-limit">
          <div class="stat-lbl-row">
            <span class="legend-swatch swatch-purple"></span>
            <span class="stat-lbl">Sanction Limit</span>
          </div>
          <span class="stat-num text-purple tabular-nums">
            {{ formatCompactPaise(currentDrawingPower()) }}
          </span>
          <span class="stat-sub tabular-nums">{{ formatPaise(currentDrawingPower()) }}</span>
        </div>

        <div class="stat-cluster stat-buffer center">
          <div class="stat-lbl-row">
            <span class="legend-swatch swatch-emerald"></span>
            <span class="stat-lbl">OD Shield Buffer</span>
          </div>
          <span class="stat-num text-emerald tabular-nums">
            +{{ formatCompactPaise(currentBuffer()) }}
          </span>
          <span class="stat-sub text-emerald tabular-nums">Surplus Headroom</span>
        </div>

        <div class="stat-cluster stat-debt right">
          <div class="stat-lbl-row">
            <span class="legend-swatch swatch-ink"></span>
            <span class="stat-lbl">Current Debt</span>
          </div>
          <span class="stat-num text-ink tabular-nums">
            {{ formatCompactPaise(currentOutstanding()) }}
          </span>
          <span class="stat-sub tabular-nums">{{ formatPaise(currentOutstanding()) }}</span>
        </div>
      </div>

      <!-- Custom SVG Graph with Distinct X and Y Axes -->
      <div class="svg-stage-wrap">
        <svg
          class="dual-svg"
          viewBox="0 0 550 230"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <!-- Emerald Cushion Gradient for OD Shield Buffer Zone -->
            <linearGradient id="odBufferGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#0fb27c" stop-opacity="0.35" />
              <stop offset="50%" stop-color="#0fb27c" stop-opacity="0.18" />
              <stop offset="100%" stop-color="#0fb27c" stop-opacity="0.05" />
            </linearGradient>

            <!-- Line Glow Filter -->
            <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0fb27c" flood-opacity="0.35" />
            </filter>
            <filter id="purpleGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#6c4cff" flood-opacity="0.3" />
            </filter>
          </defs>

          <!-- 1. Horizontal Grid Lines & Y-Axis Labels -->
          @for (tick of yTicks; track tick.label) {
            <line
              x1="55"
              [attr.y1]="tick.y"
              x2="530"
              [attr.y2]="tick.y"
              stroke="rgba(118, 122, 144, 0.15)"
              stroke-dasharray="3 3"
              stroke-width="1"
            />
            <text
              x="50"
              [attr.y]="tick.y + 3.5"
              text-anchor="end"
              class="axis-label y-axis-label tabular-nums"
            >
              {{ tick.label }}
            </text>
          }

          <!-- Y-Axis Vertical Line -->
          <line x1="55" y1="18" x2="55" y2="194" stroke="#dcdce6" stroke-width="1.5" />

          <!-- X-Axis Baseline -->
          <line x1="55" y1="194" x2="530" y2="194" stroke="#dcdce6" stroke-width="1.5" />

          <!-- 2. Vertical Ticks & X-Axis Labels -->
          @for (tick of xTicks; track tick.label) {
            <line
              [attr.x1]="tick.x"
              y1="194"
              [attr.x2]="tick.x"
              y2="199"
              stroke="#8e8e93"
              stroke-width="1.2"
            />
            <text
              [attr.x]="tick.x"
              y="214"
              text-anchor="middle"
              class="axis-label x-axis-label"
            >
              {{ tick.label }}
            </text>
          }

          <!-- 3. OD Shield Buffer Section: Shaded Area Between Sanction Limit & Debt -->
          <path [attr.d]="cushionAreaPath()" fill="url(#odBufferGradient)" />

          <!-- Floating Callout Badge in OD Shield Buffer Area -->
          <g transform="translate(415, 122)">
            <rect
              x="-60"
              y="-12"
              width="120"
              height="24"
              rx="12"
              fill="#0fb27c"
              opacity="0.92"
            />
            <text
              x="0"
              y="4"
              text-anchor="middle"
              fill="#ffffff"
              font-size="10"
              font-weight="800"
              letter-spacing="0.02em"
            >
              🛡️ Buffer: +{{ formatCompactPaise(currentBuffer()) }}
            </text>
          </g>

          <!-- 4. Sanction Limit Curve (Purple Dashed Line) -->
          <path
            [attr.d]="drawingPowerPath()"
            fill="none"
            stroke="#6c4cff"
            stroke-width="2.5"
            stroke-dasharray="5 3"
            filter="url(#purpleGlow)"
          />

          <!-- 5. Current Debt Curve (Solid Emerald Line) -->
          <path
            [attr.d]="actualOutstandingPath()"
            fill="none"
            stroke="#0fb27c"
            stroke-width="3.5"
            stroke-linecap="round"
            filter="url(#emeraldGlow)"
          />

          <!-- Milestone Data Nodes on the Curves -->
          @for (pt of nodePoints(); track pt.x) {
            <circle [attr.cx]="pt.x" [attr.cy]="pt.dpY" r="3" fill="#6c4cff" opacity="0.8" />
            <circle [attr.cx]="pt.x" [attr.cy]="pt.actY" r="3.5" fill="#0fb27c" />
          }

          <!-- Latest End Points with Pulse Markers at Nov '26 -->
          @if (endPoints(); as ep) {
            <!-- Drawing Power End Marker -->
            <circle [attr.cx]="ep.dpX" [attr.cy]="ep.dpY" r="5" fill="#6c4cff" />
            <circle [attr.cx]="ep.dpX" [attr.cy]="ep.dpY" r="9" fill="none" stroke="#6c4cff" stroke-width="1.5" opacity="0.5" />

            <!-- Actual Debt End Marker -->
            <circle [attr.cx]="ep.actX" [attr.cy]="ep.actY" r="6" fill="#0fb27c" />
            <circle [attr.cx]="ep.actX" [attr.cy]="ep.actY" r="10" fill="none" stroke="#0fb27c" stroke-width="1.8" opacity="0.6" />
          }
        </svg>
      </div>

      <!-- Distinct Section Legend with Explanations -->
      <div class="axis-legend-grid">
        <div class="legend-item">
          <span class="legend-bar bar-purple"></span>
          <div class="legend-text">
            <strong>Sanction Limit (Drawing Power)</strong>
            <span>SBI benchmark capacity (currently {{ formatCompactPaise(currentDrawingPower()) }})</span>
          </div>
        </div>

        <div class="legend-item">
          <span class="legend-bar bar-emerald"></span>
          <div class="legend-text">
            <strong>Current Debt (Actual Balance)</strong>
            <span>Active loan principal to clear ({{ formatCompactPaise(currentOutstanding()) }})</span>
          </div>
        </div>

        <div class="legend-item">
          <span class="legend-bar bar-cushion"></span>
          <div class="legend-text">
            <strong>OD Shield Buffer Zone</strong>
            <span>Interest-free surplus buffer saving daily interest (+{{ formatCompactPaise(currentBuffer()) }})</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .dual-track-container {
      background: #ffffff;
      border-radius: 26px;
      padding: 22px 20px;
      box-shadow: var(--shadow-card);
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(108, 76, 255, 0.08);
    }

    .chart-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      gap: 12px;
    }

    .title-cluster {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .chart-eyebrow {
      font-size: 11px;
      font-weight: 800;
      color: #6c4cff;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .chart-headline {
      font-size: clamp(16px, 4vw, 19px);
      font-weight: 800;
      color: #15172b;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .buffer-live-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(15, 178, 124, 0.1);
      color: #0fb27c;
      font-size: 11px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 99px;
      white-space: nowrap;
    }

    .pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #0fb27c;
      animation: pulseGlow 1.8s ease-in-out infinite;
    }

    @keyframes pulseGlow {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.3); }
    }

    .dual-stats-header {
      display: grid;
      grid-template-columns: 1fr 1.15fr 1fr;
      gap: 8px;
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }

    .stat-cluster {
      display: flex;
      flex-direction: column;
      gap: 2px;

      &.center {
        align-items: center;
        text-align: center;
      }

      &.right {
        align-items: flex-end;
        text-align: right;
      }
    }

    .stat-lbl-row {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .legend-swatch {
      width: 7px;
      height: 7px;
      border-radius: 50%;

      &.swatch-purple { background: #6c4cff; }
      &.swatch-emerald { background: #0fb27c; }
      &.swatch-ink { background: #15172b; }
    }

    .stat-lbl {
      font-size: 10.5px;
      font-weight: 700;
      color: #767a90;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .stat-num {
      font-size: clamp(16px, 4.2vw, 21px);
      font-weight: 900;
      letter-spacing: -0.025em;
      line-height: 1.15;

      &.text-purple { color: #6c4cff; }
      &.text-emerald { color: #0fb27c; }
      &.text-ink { color: #15172b; }
    }

    .stat-sub {
      font-size: 10px;
      font-weight: 600;
      color: #9399b4;
    }

    .svg-stage-wrap {
      width: 100%;
      height: 190px;
      position: relative;
    }

    .dual-svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .axis-label {
      font-size: 9.5px;
      font-weight: 700;
      fill: #767a90;
    }

    .axis-legend-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid rgba(0, 0, 0, 0.05);
    }

    .legend-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }

    .legend-bar {
      width: 16px;
      height: 4px;
      border-radius: 2px;
      margin-top: 6px;
      flex-shrink: 0;

      &.bar-purple {
        background: #6c4cff;
        border-bottom: 2px dashed #6c4cff;
      }
      &.bar-emerald {
        background: #0fb27c;
      }
      &.bar-cushion {
        background: rgba(15, 178, 124, 0.4);
        border: 1px solid #0fb27c;
      }
    }

    .legend-text {
      display: flex;
      flex-direction: column;
      gap: 1px;
      font-size: 11px;
      color: #767a90;

      strong {
        color: #15172b;
        font-weight: 700;
      }
    }
  `,
})
export class DualTrackChartComponent {
  readonly sanctionedLimit = input<Paise>(toPaise(12612930));
  readonly currentOutstanding = input<Paise>(toPaise(11886289));
  readonly initialDisbursed = input<Paise>(toPaise(13300000));

  readonly currentDrawingPower = computed(() => this.sanctionedLimit());
  readonly currentBuffer = computed(() =>
    Math.max(0, this.currentDrawingPower() - this.currentOutstanding()) as Paise
  );

  // Y-axis ticks across the ₹1.15 Cr to ₹1.35 Cr range
  readonly yTicks: YAxisTick[] = [
    { label: '₹1.35Cr', y: 18 },
    { label: '₹1.30Cr', y: 62 },
    { label: '₹1.25Cr', y: 106 },
    { label: '₹1.20Cr', y: 150 },
    { label: '₹1.15Cr', y: 194 },
  ];

  // X-axis ticks representing key milestone dates
  readonly xTicks: XAxisTick[] = [
    { label: "Jun '24", x: 55 },
    { label: "Dec '24", x: 158 },
    { label: "Jun '25", x: 262 },
    { label: "Dec '25", x: 365 },
    { label: "Jun '26", x: 468 },
    { label: "Nov '26", x: 520 },
  ];

  // Key monthly milestone points from authentic bank statement history
  readonly historyPoints: DualTrackPoint[] = [
    { month: "Jun '24", drawingPowerPaise: toPaise(13300000), actualOutstandingPaise: toPaise(13300000) },
    { month: "Sep '24", drawingPowerPaise: toPaise(13150000), actualOutstandingPaise: toPaise(12420482) }, // Sep ₹5.36L Prepayment
    { month: "Dec '24", drawingPowerPaise: toPaise(13000000), actualOutstandingPaise: toPaise(12537032) },
    { month: "Mar '25", drawingPowerPaise: toPaise(12880000), actualOutstandingPaise: toPaise(12568351) },
    { month: "Jun '25", drawingPowerPaise: toPaise(12760000), actualOutstandingPaise: toPaise(12701009) },
    { month: "Sep '25", drawingPowerPaise: toPaise(12690000), actualOutstandingPaise: toPaise(12754293) },
    { month: "Dec '25", drawingPowerPaise: toPaise(12650000), actualOutstandingPaise: toPaise(12615588) },
    { month: "Mar '26", drawingPowerPaise: toPaise(12630000), actualOutstandingPaise: toPaise(12457625) },
    { month: "Jun '26", drawingPowerPaise: toPaise(12620000), actualOutstandingPaise: toPaise(12369947) },
    { month: "Nov '26", drawingPowerPaise: toPaise(12612930), actualOutstandingPaise: toPaise(11886289) },
  ];

  // Map amount in Paise to SVG Y-coordinate (18 to 194)
  private scaleY(amountPaise: Paise): number {
    const minPaise = toPaise(11500000); // 1.15 Cr
    const maxPaise = toPaise(13500000); // 1.35 Cr
    const fraction = (amountPaise - minPaise) / (maxPaise - minPaise);
    const clamped = Math.max(0, Math.min(1, fraction));
    return 194 - clamped * 176;
  }

  // Map chronological point index to SVG X-coordinate (55 to 520)
  private scaleX(index: number, total: number): number {
    const padLeft = 55;
    const width = 465; // 55 to 520
    return padLeft + (index / (total - 1)) * width;
  }

  readonly drawingPowerPath = computed<string>(() => {
    const pts = this.historyPoints;
    let d = '';
    pts.forEach((p, i) => {
      const x = this.scaleX(i, pts.length);
      const y = this.scaleY(p.drawingPowerPaise);
      d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    });
    return d;
  });

  readonly actualOutstandingPath = computed<string>(() => {
    const pts = this.historyPoints;
    let d = '';
    pts.forEach((p, i) => {
      const x = this.scaleX(i, pts.length);
      const y = this.scaleY(p.actualOutstandingPaise);
      d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    });
    return d;
  });

  readonly cushionAreaPath = computed<string>(() => {
    const pts = this.historyPoints;
    let forward = '';
    let backward = '';
    pts.forEach((p, i) => {
      const x = this.scaleX(i, pts.length);
      const yDp = this.scaleY(p.drawingPowerPaise);
      const yAct = this.scaleY(p.actualOutstandingPaise);

      forward += i === 0 ? `M ${x} ${yDp}` : ` L ${x} ${yDp}`;
      backward = ` L ${x} ${yAct}` + backward;
    });
    return forward + backward + ' Z';
  });

  readonly nodePoints = computed(() => {
    const pts = this.historyPoints;
    return pts.map((p, i) => ({
      x: this.scaleX(i, pts.length),
      dpY: this.scaleY(p.drawingPowerPaise),
      actY: this.scaleY(p.actualOutstandingPaise),
    }));
  });

  readonly endPoints = computed(() => {
    const pts = this.historyPoints;
    const lastIdx = pts.length - 1;
    const lastPt = pts[lastIdx];
    if (!lastPt) return null;

    const x = this.scaleX(lastIdx, pts.length);
    const dpY = this.scaleY(lastPt.drawingPowerPaise);
    const actY = this.scaleY(lastPt.actualOutstandingPaise);

    return { dpX: x, dpY, actX: x, actY };
  });

  formatCompactPaise = formatCompactPaise;
  formatPaise = formatPaise;
}

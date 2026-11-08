import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatCompactPaise, formatPaise, Paise, toPaise } from '../../../core/engine';

export interface DualTrackPoint {
  month: string; // e.g. "Jun '24", "Jan '25"
  drawingPowerPaise: Paise;
  actualOutstandingPaise: Paise;
}

@Component({
  selector: 'app-dual-track-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dual-track-container" role="region" aria-label="Drawing Power vs Actual Balance Chart">
      <!-- 3 Big WOW Numbers Header (Zero clutter) -->
      <div class="dual-stats-header">
        <div class="stat-cluster">
          <span class="stat-lbl">Sanction Limit</span>
          <span class="stat-num text-purple tabular-nums">
            {{ formatCompactPaise(currentDrawingPower()) }}
          </span>
        </div>

        <div class="stat-cluster center">
          <span class="stat-lbl">OD Shield Buffer</span>
          <span class="stat-num text-emerald tabular-nums">
            +{{ formatCompactPaise(currentBuffer()) }}
          </span>
        </div>

        <div class="stat-cluster right">
          <span class="stat-lbl">Current Debt</span>
          <span class="stat-num text-ink tabular-nums">
            {{ formatCompactPaise(currentOutstanding()) }}
          </span>
        </div>
      </div>

      <!-- Custom Responsive SVG Dual-Track Curves with Shaded Cushion -->
      <div class="svg-stage-wrap">
        <svg
          class="dual-svg"
          viewBox="0 0 500 180"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <!-- Emerald Cushion Gradient for OD Surplus -->
            <linearGradient id="odCushionGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#0fb27c" stop-opacity="0.35" />
              <stop offset="100%" stop-color="#0fb27c" stop-opacity="0.05" />
            </linearGradient>

            <!-- Line Glow Filter -->
            <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0fb27c" flood-opacity="0.4" />
            </filter>
            <filter id="purpleGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#6c4cff" flood-opacity="0.3" />
            </filter>
          </defs>

          <!-- Shaded Area Between Drawing Power and Actual Outstanding (The OD Surplus Buffer!) -->
          <path [attr.d]="cushionAreaPath()" fill="url(#odCushionGrad)" />

          <!-- Upper Curve: Sanctioned Drawing Power (Decreases steadily) -->
          <path
            [attr.d]="drawingPowerPath()"
            fill="none"
            stroke="#6c4cff"
            stroke-width="2.5"
            stroke-dasharray="4 3"
            filter="url(#purpleGlow)"
          />

          <!-- Lower Curve: Actual Book Outstanding (Faster drop, active debt) -->
          <path
            [attr.d]="actualOutstandingPath()"
            fill="none"
            stroke="#0fb27c"
            stroke-width="3.5"
            stroke-linecap="round"
            filter="url(#emeraldGlow)"
          />

          <!-- Latest End Points with Pulse Markers -->
          @if (endPoints(); as ep) {
            <!-- Drawing Power End Marker -->
            <circle [attr.cx]="ep.dpX" [attr.cy]="ep.dpY" r="4.5" fill="#6c4cff" />

            <!-- Actual Outstanding End Marker -->
            <circle [attr.cx]="ep.actX" [attr.cy]="ep.actY" r="5.5" fill="#0fb27c" />
            <circle [attr.cx]="ep.actX" [attr.cy]="ep.actY" r="9" fill="none" stroke="#0fb27c" stroke-width="1.5" opacity="0.6" />
          }
        </svg>
      </div>

      <!-- Simple Timeline Axis Labels -->
      <div class="axis-legend-row">
        <span>Jun '24 (Disbursed)</span>
        <span class="legend-pill">
          <span class="dot-swatch swatch-green"></span> Debt
          <span class="dot-swatch swatch-purple" style="margin-left: 8px"></span> Limit
        </span>
        <span>Nov '26 (Today)</span>
      </div>
    </div>
  `,
  styles: `
    .dual-track-container {
      background: #ffffff;
      border-radius: 26px;
      padding: 20px;
      box-shadow: var(--shadow-card);
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(108, 76, 255, 0.08);
    }

    .dual-stats-header {
      display: grid;
      grid-template-columns: 1fr 1.2fr 1fr;
      gap: 8px;
      margin-bottom: 16px;
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

    .stat-lbl {
      font-size: 11px;
      font-weight: 700;
      color: #8e8e93;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .stat-num {
      font-size: clamp(17px, 4.4vw, 22px);
      font-weight: 900;
      letter-spacing: -0.025em;
      line-height: 1.1;

      &.text-purple { color: #6c4cff; }
      &.text-emerald { color: #0fb27c; }
      &.text-ink { color: #15172b; }
    }

    .svg-stage-wrap {
      width: 100%;
      height: 140px;
      position: relative;
    }

    .dual-svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .axis-legend-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      font-weight: 700;
      color: #8e8e93;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid rgba(0, 0, 0, 0.04);
    }

    .legend-pill {
      display: inline-flex;
      align-items: center;
      font-size: 11px;
      color: #555870;
    }

    .dot-swatch {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 4px;

      &.swatch-green { background: #0fb27c; }
      &.swatch-purple { background: #6c4cff; }
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

  // Key monthly milestone points from bank statement history:
  // Jun'24 (133L), Dec'24 (126.3L vs 125.5L), Jun'25 (125.8L vs 127L), Dec'25 (125L vs 126.1L), Jun'26 (124.2L vs 123.8L), Nov'26 (126.1L vs 118.8L)
  readonly historyPoints: DualTrackPoint[] = [
    { month: "Jun '24", drawingPowerPaise: toPaise(13300000), actualOutstandingPaise: toPaise(13300000) },
    { month: "Sep '24", drawingPowerPaise: toPaise(13150000), actualOutstandingPaise: toPaise(12420482) }, // Sep ₹5L deposit
    { month: "Dec '24", drawingPowerPaise: toPaise(13000000), actualOutstandingPaise: toPaise(12537032) },
    { month: "Mar '25", drawingPowerPaise: toPaise(12880000), actualOutstandingPaise: toPaise(12568351) },
    { month: "Jun '25", drawingPowerPaise: toPaise(12760000), actualOutstandingPaise: toPaise(12701009) },
    { month: "Sep '25", drawingPowerPaise: toPaise(12690000), actualOutstandingPaise: toPaise(12754293) },
    { month: "Dec '25", drawingPowerPaise: toPaise(12650000), actualOutstandingPaise: toPaise(12615588) },
    { month: "Mar '26", drawingPowerPaise: toPaise(12630000), actualOutstandingPaise: toPaise(12457625) },
    { month: "Jun '26", drawingPowerPaise: toPaise(12620000), actualOutstandingPaise: toPaise(12369947) },
    { month: "Nov '26", drawingPowerPaise: toPaise(12612930), actualOutstandingPaise: toPaise(11886289) },
  ];

  // Map points to SVG coordinates (Width 500, Height 180, Padding Top 20, Bottom 20)
  // Max scale: 1.35 Cr, Min scale: 1.15 Cr
  private scaleY(amountPaise: Paise): number {
    const minPaise = toPaise(11500000);
    const maxPaise = toPaise(13500000);
    const fraction = (amountPaise - minPaise) / (maxPaise - minPaise);
    const clamped = Math.max(0, Math.min(1, fraction));
    // SVG y=0 is top (maxPaise), y=140 is bottom (minPaise)
    return 160 - clamped * 135;
  }

  private scaleX(index: number, total: number): number {
    const padX = 20;
    const width = 500 - 2 * padX;
    return padX + (index / (total - 1)) * width;
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

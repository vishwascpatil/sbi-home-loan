import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

export interface BarDatum {
  label: string;
  value: number;
  monthKey?: string;
  fullLabel?: string;
  isCurrent?: boolean;
  target?: number;
  depositCount?: number;
}

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="bar-chart-container"
      role="region"
      aria-label="Monthly deposit trend chart"
      (mouseleave)="clearHover()"
    >
      <!-- 1. Interactive Floating Active Card -->
      <div class="active-detail-banner">
        <div class="banner-left">
          <div class="banner-title-row">
            <span class="banner-month-name">{{ activeItem().fullLabel || activeItem().label || 'This Month' }}</span>
            @if (activeItem().isCurrent) {
              <span class="banner-curr-badge">Current</span>
            }
          </div>
          <div class="banner-figure-row">
            <span class="banner-amount tabular-nums">
              {{ formatCurrency(activeItem().value) }}
            </span>
            <span class="banner-target-caption">
              @if (effectiveTarget() > 0) {
                {{ getTargetPercent(activeItem().value) }}% of goal
              } @else {
                Deposited
              }
            </span>
          </div>
        </div>

        <div class="banner-right-chip" [class.achieved]="isTargetMet(activeItem().value)">
          @if (isTargetMet(activeItem().value)) {
            <span class="chip-status-icon">✓</span>
            <span class="chip-status-text">Goal Met</span>
          } @else if (activeItem().value > 0) {
            <span class="chip-status-icon">⏳</span>
            <span class="chip-status-text">{{ formatCompact(Math.max(0, effectiveTarget() - activeItem().value)) }} to go</span>
          } @else {
            <span class="chip-status-icon">○</span>
            <span class="chip-status-text">No records</span>
          }
        </div>
      </div>

      <!-- 2. The Chart Canvas Stage -->
      <div class="chart-stage" [style.height.px]="height()">
        <!-- Target Reference Guideline -->
        @if (targetLinePercent() !== null) {
          <div
            class="target-guideline"
            [style.bottom.%]="targetLinePercent()!"
          >
            <span class="guideline-tag">
              Goal {{ formatCompact(effectiveTarget()) }}
            </span>
          </div>
        }

        <!-- Horizontal Bar Columns -->
        <div class="bar-columns-row">
          @for (item of enrichedItems(); track item.label) {
            <div
              class="bar-column-item"
              [class.is-selected]="activeLabel() === item.label"
              [class.is-current]="item.isCurrent"
              (click)="selectItem(item)"
              (mouseenter)="hoverItem(item)"
              role="button"
              tabindex="0"
              [attr.aria-label]="item.label + ': ' + formatCurrency(item.value)"
            >
              <!-- Bar Value On Top -->
              <div class="bar-cap-value">
                @if (item.value > 0) {
                  <span class="cap-text tabular-nums">{{ formatCompact(item.value) }}</span>
                } @else {
                  <span class="cap-zero">—</span>
                }
              </div>

              <!-- Pill Track & Fill -->
              <div class="bar-track-shell">
                <div
                  class="bar-pill-fill"
                  [class.brand-active]="activeLabel() === item.label"
                  [class.goal-met]="item.isTargetMet"
                  [style.height.%]="item.percent"
                ></div>
              </div>

              <!-- Month Label + Indicator Dot -->
              <div class="bar-bottom-label">
                <span class="month-label-text" [class.active-text]="activeLabel() === item.label">
                  {{ item.label }}
                </span>
                @if (item.isCurrent) {
                  <span class="current-indicator-dot" aria-hidden="true"></span>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .bar-chart-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      user-select: none;
    }

    /* 1. Interactive Floating Glass Header */
    .active-detail-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg-subtle, #f5f5f7);
      border: 1px solid var(--line, rgba(0, 0, 0, 0.04));
      border-radius: 18px;
      padding: 12px 14px;
      margin-bottom: 12px;
      transition: background 0.2s ease, border-color 0.2s ease;
    }

    .banner-left {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .banner-title-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .banner-month-name {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted, #8e8e93);
      letter-spacing: -0.01em;
    }

    .banner-curr-badge {
      font-size: 10px;
      font-weight: 800;
      color: #10b981;
      background: rgba(16, 185, 129, 0.12);
      padding: 1px 6px;
      border-radius: 99px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .banner-figure-row {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .banner-amount {
      font-size: 20px;
      font-weight: 800;
      color: var(--ink, #111216);
      letter-spacing: -0.03em;
    }

    .banner-target-caption {
      font-size: 12px;
      font-weight: 600;
      color: var(--muted, #8e8e93);
    }

    .banner-right-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      font-weight: 700;
      color: #4f46e5;
      background: rgba(79, 70, 229, 0.08);
      padding: 6px 12px;
      border-radius: 99px;
      letter-spacing: -0.01em;

      &.achieved {
        color: #10b981;
        background: rgba(16, 185, 129, 0.12);
      }
    }

    .chip-status-icon {
      font-size: 11px;
    }

    /* 2. The Chart Canvas Stage */
    .chart-stage {
      position: relative;
      width: 100%;
      display: flex;
      align-items: flex-end;
      padding-top: 20px;
      box-sizing: border-box;
    }

    /* Dotted Goal Guideline */
    .target-guideline {
      position: absolute;
      left: 0;
      right: 0;
      border-top: 1.5px dashed rgba(142, 142, 147, 0.35);
      display: flex;
      justify-content: flex-end;
      pointer-events: none;
      z-index: 1;
    }

    .guideline-tag {
      font-size: 9px;
      font-weight: 800;
      color: var(--muted, #8e8e93);
      background: var(--card, #ffffff);
      padding: 1px 6px;
      border-radius: 4px;
      transform: translateY(-50%);
      letter-spacing: 0.02em;
      border: 1px solid var(--line, rgba(0, 0, 0, 0.06));
    }

    /* Columns Row */
    .bar-columns-row {
      position: relative;
      z-index: 2;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 8px;
    }

    .bar-column-item {
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      cursor: pointer;
      border-radius: 14px;
      padding: 4px 2px;
      box-sizing: border-box;
      outline: none;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        transform: translateY(-2px);
      }

      &:active {
        transform: scale(0.96);
      }

      &.is-selected .bar-pill-fill {
        box-shadow: 0 6px 20px rgba(155, 77, 255, 0.4);
      }
    }

    .bar-cap-value {
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 6px;
    }

    .cap-text {
      font-size: 10px;
      font-weight: 800;
      color: var(--ink, #111216);
      letter-spacing: -0.02em;
    }

    .cap-zero {
      font-size: 10px;
      color: var(--muted, #c7c7cc);
    }

    .bar-track-shell {
      flex: 1;
      width: 100%;
      max-width: 34px;
      display: flex;
      align-items: flex-end;
      background: rgba(0, 0, 0, 0.04);
      border-radius: 12px;
      overflow: hidden;
      padding: 2px;
      box-sizing: border-box;
    }

    .bar-pill-fill {
      width: 100%;
      border-radius: 10px;
      background: linear-gradient(180deg, #818cf8 0%, #4f46e5 100%);
      transition: height 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s ease, opacity 0.2s ease;
      min-height: 4px;

      &.brand-active {
        background: linear-gradient(180deg, #ff5f9e 0%, #9b4dff 50%, #4f35ff 100%);
      }

      &.goal-met:not(.brand-active) {
        background: linear-gradient(180deg, #34d399 0%, #059669 100%);
      }
    }

    .bar-bottom-label {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 8px;
      gap: 3px;
    }

    .month-label-text {
      font-size: 11px;
      font-weight: 700;
      color: var(--muted, #8e8e93);
      letter-spacing: 0.02em;
      text-transform: uppercase;
      transition: color 0.15s ease;

      &.active-text {
        color: var(--ink, #111216);
        font-weight: 800;
      }
    }

    .current-indicator-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #4f35ff;
    }
  `,
})
export class BarChartComponent {
  readonly data = input.required<BarDatum[]>();
  readonly targetValue = input<number | undefined>(undefined);
  readonly height = input<number>(150);
  readonly barSelected = output<BarDatum>();

  readonly Math = Math;

  readonly hoveredLabel = signal<string | null>(null);
  readonly selectedLabel = signal<string | null>(null);

  readonly defaultLabel = computed(() => {
    const items = this.data();
    if (items.length === 0) return null;
    const current = items.find((i) => i.isCurrent);
    return current ? current.label : items[items.length - 1]!.label;
  });

  readonly activeLabel = computed(() => {
    return this.hoveredLabel() || this.selectedLabel() || this.defaultLabel();
  });

  readonly activeItem = computed<BarDatum>(() => {
    const items = this.data();
    const lbl = this.activeLabel();
    return items.find((i) => i.label === lbl) || items[items.length - 1] || { label: '', value: 0 };
  });

  readonly effectiveTarget = computed(() => {
    const explicit = this.targetValue();
    if (explicit && explicit > 0) return explicit;
    const active = this.activeItem();
    if (active.target && active.target > 0) return active.target;
    return 0;
  });

  readonly enrichedItems = computed(() => {
    const items = this.data();
    const target = this.effectiveTarget();
    const maxVal = Math.max(...items.map((i) => i.value), target, 1);

    return items.map((i) => {
      let pct = 0;
      if (i.value > 0) {
        pct = Math.min(100, Math.max(6, (i.value / maxVal) * 100));
      }
      return {
        ...i,
        percent: pct,
        isTargetMet: target > 0 && i.value >= target,
      };
    });
  });

  readonly targetLinePercent = computed(() => {
    const target = this.effectiveTarget();
    if (!target || target <= 0) return null;
    const items = this.data();
    const maxVal = Math.max(...items.map((i) => i.value), target, 1);
    const pct = Math.min(95, Math.max(10, (target / maxVal) * 100));
    return pct;
  });

  selectItem(item: BarDatum): void {
    this.selectedLabel.set(item.label);
    this.barSelected.emit(item);
  }

  hoverItem(item: BarDatum): void {
    this.hoveredLabel.set(item.label);
  }

  clearHover(): void {
    this.hoveredLabel.set(null);
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  }

  formatCompact(val: number): string {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(val % 100000 === 0 ? 0 : 2)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
    return `₹${val}`;
  }

  getTargetPercent(val: number): number {
    const t = this.effectiveTarget();
    if (t <= 0) return 100;
    return Math.round((val / t) * 100);
  }

  isTargetMet(val: number): boolean {
    const t = this.effectiveTarget();
    return t > 0 && val >= t;
  }
}


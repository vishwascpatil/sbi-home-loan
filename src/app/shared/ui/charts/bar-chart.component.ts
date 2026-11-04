import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarDatum {
  label: string;
  value: number;
}

@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar-chart-container" role="img" aria-label="Monthly contributions bar chart">
      @for (item of normalizedBars(); track item.label) {
        <div class="bar-column">
          <div class="bar-track">
            <div
              class="bar-fill"
              [style.height.%]="item.percent"
              [title]="item.label + ': ' + item.value"
            ></div>
          </div>
          <span class="bar-label">{{ item.label }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    .bar-chart-container {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      height: 140px;
      padding: 10px 0 4px;
      gap: 8px;
    }

    .bar-column {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
      min-width: 0;
    }

    .bar-track {
      flex: 1;
      width: 100%;
      max-width: 32px;
      display: flex;
      align-items: flex-end;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
    }

    .bar-fill {
      width: 100%;
      background: linear-gradient(180deg, #38bdf8 0%, #0071e3 100%);
      border-radius: 8px 8px 0 0;
      transition: height 1s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s ease, opacity 0.2s ease;
      min-height: 4px;
    }

    .bar-track:hover .bar-fill {
      opacity: 0.85;
      transform: scaleY(1.02);
    }

    .bar-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--muted);
      margin-top: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class BarChartComponent {
  readonly data = input.required<BarDatum[]>();

  readonly normalizedBars = computed(() => {
    const items = this.data();
    const max = Math.max(...items.map((i) => i.value), 1);
    return items.map((i) => ({
      label: i.label,
      value: i.value,
      percent: Math.min(100, Math.max(0, (i.value / max) * 100)),
    }));
  });
}


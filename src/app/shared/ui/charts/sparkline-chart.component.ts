import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Paise } from '../../../core/engine';

@Component({
  selector: 'app-sparkline-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
      class="sparkline-svg"
      role="img"
      aria-label="Balance trajectory projection"
    >
      <defs>
        <linearGradient [attr.id]="gradientId()" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--brand-a)" stop-opacity="0.35" />
          <stop offset="100%" stop-color="var(--brand-a)" stop-opacity="0.0" />
        </linearGradient>
      </defs>

      @if (areaPath()) {
        <path [attr.d]="areaPath()" [attr.fill]="'url(#' + gradientId() + ')'" />
      }

      @if (linePath()) {
        <path
          [attr.d]="linePath()"
          fill="none"
          stroke="var(--brand-a)"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="sparkline-line"
        />
      }
    </svg>
  `,
  styles: `
    .sparkline-svg {
      width: 100%;
      height: auto;
      display: block;
      overflow: visible;
    }

    .sparkline-line {
      stroke-dasharray: 1000;
      stroke-dashoffset: 1000;
      animation: drawLine 1.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
    }

    @keyframes drawLine {
      to {
        stroke-dashoffset: 0;
      }
    }
  `,
})
export class SparklineChartComponent {
  readonly data = input.required<Paise[] | number[]>();
  readonly width = input<number>(320);
  readonly height = input<number>(110);
  readonly gradientId = input<string>('spark-grad');

  readonly pathCoords = computed(() => {
    const raw = this.data();
    if (!raw || raw.length === 0) return '';

    const w = this.width();
    const h = this.height();
    const paddingY = 8;
    const innerH = h - paddingY * 2;

    // Subsample if length is large
    const step = Math.max(1, Math.ceil(raw.length / 40));
    const sampled = raw.filter((_, i) => i % step === 0 || i === raw.length - 1);
    const maxVal = Math.max(...sampled, 1);
    const minVal = 0;
    const range = maxVal - minVal || 1;

    const points = sampled.map((val, idx) => {
      const x = Math.round((idx / (sampled.length - 1 || 1)) * w);
      const y = Math.round(h - paddingY - ((val - minVal) / range) * innerH);
      return `${x} ${y}`;
    });

    return points.join(' L ');
  });

  readonly linePath = computed(() => {
    const coords = this.pathCoords();
    return coords ? `M ${coords}` : '';
  });

  readonly areaPath = computed(() => {
    const coords = this.pathCoords();
    if (!coords) return '';
    const w = this.width();
    const h = this.height();
    return `M ${coords} L ${w} ${h} L 0 ${h} Z`;
  });
}


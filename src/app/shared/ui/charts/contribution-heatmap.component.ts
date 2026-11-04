import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeatmapDay } from '../../../core/engine';
import { formatPaise } from '../../../core/engine/money';

@Component({
  selector: 'app-contribution-heatmap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="heatmap-wrapper">
      <div class="heatmap-scroll-container">
        <div class="heatmap-grid" role="grid" aria-label="Contribution Activity Calendar">
          @for (col of weeks(); track $index) {
            <div class="week-col" role="row">
              @for (day of col; track day.date) {
                <div
                  class="day-cell"
                  [class]="'level-' + day.level"
                  [title]="formatDayTooltip(day)"
                  (mouseenter)="hoveredDay.set(day)"
                  (mouseleave)="hoveredDay.set(null)"
                  role="gridcell"
                  [attr.aria-label]="formatDayTooltip(day)"
                ></div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Footer & Legend -->
      <footer class="heatmap-footer">
        <span class="active-summary">
          @if (hoveredDay()) {
            <strong>{{ hoveredDay()!.date }}:</strong> {{ formatPaise(hoveredDay()!.amount) }}
          } @else {
            365-Day Contribution Activity
          }
        </span>

        <div class="legend-scale">
          <span class="legend-label">Less</span>
          <span class="day-cell level-0"></span>
          <span class="day-cell level-1"></span>
          <span class="day-cell level-2"></span>
          <span class="day-cell level-3"></span>
          <span class="day-cell level-4"></span>
          <span class="legend-label">More</span>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .heatmap-wrapper {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 100%;
    }

    .heatmap-scroll-container {
      overflow-x: auto;
      padding-bottom: 6px;
      scrollbar-width: thin;
    }

    .heatmap-grid {
      display: flex;
      gap: 3px;
      width: fit-content;
    }

    .week-col {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .day-cell {
      width: 11px;
      height: 11px;
      border-radius: 2px;
      background: var(--heatmap-bg-0, #ebedf0);
      transition: transform 0.1s ease;
      cursor: pointer;

      &:hover {
        transform: scale(1.3);
        outline: 1px solid rgba(0, 0, 0, 0.4);
        z-index: 2;
      }

      &.level-0 { background: #e5e7eb; }
      &.level-1 { background: #bbf7d0; }
      &.level-2 { background: #86efac; }
      &.level-3 { background: #22c55e; }
      &.level-4 { background: #0fb27c; }
    }

    .heatmap-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.72rem;
      color: var(--color-muted, #767a90);
    }

    .active-summary {
      font-variant-numeric: tabular-nums;
      strong { color: var(--color-ink, #15172b); }
    }

    .legend-scale {
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .legend-label {
      font-size: 0.68rem;
      margin: 0 2px;
    }
  `],
})
export class ContributionHeatmapComponent {
  readonly days = input.required<HeatmapDay[]>();
  readonly hoveredDay = signal<HeatmapDay | null>(null);

  readonly formatPaise = formatPaise;

  readonly weeks = computed(() => {
    const all = this.days();
    const cols: HeatmapDay[][] = [];
    let currentWeek: HeatmapDay[] = [];

    for (let i = 0; i < all.length; i++) {
      currentWeek.push(all[i]);
      if (currentWeek.length === 7 || i === all.length - 1) {
        cols.push(currentWeek);
        currentWeek = [];
      }
    }

    return cols;
  });

  formatDayTooltip(day: HeatmapDay): string {
    return `${day.date}: ${formatPaise(day.amount)}`;
  }
}

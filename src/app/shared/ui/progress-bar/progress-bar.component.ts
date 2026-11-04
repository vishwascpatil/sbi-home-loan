import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="pb-track"
      [class.glass]="glass()"
      [style.height.px]="height()"
      role="progressbar"
      [attr.aria-valuenow]="clampedProgress()"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class="pb-fill"
        [class.solid-white]="glass()"
        [style.width.%]="clampedProgress()"
        [style.background]="fillColor()"
      >
        <div class="pb-shimmer"></div>
      </div>
    </div>
  `,
  styles: `
    .pb-track {
      width: 100%;
      border-radius: 9999px;
      background: rgba(0, 0, 0, 0.06);
      overflow: hidden;
      position: relative;
    }

    .pb-track.glass {
      background: rgba(0, 0, 0, 0.06);
    }

    .pb-fill {
      height: 100%;
      border-radius: 9999px;
      background: linear-gradient(90deg, #0071e3 0%, #38bdf8 100%);
      transition: width 1.2s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      overflow: hidden;
      box-shadow: 0 1px 4px rgba(0, 113, 227, 0.3);
    }

    .pb-fill.solid-white {
      background: linear-gradient(90deg, #0071e3 0%, #34c759 100%);
    }

    .pb-shimmer {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 50%;
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0.4) 50%,
        rgba(255, 255, 255, 0) 100%
      );
      animation: appleShimmer 2.2s infinite ease-in-out;
      pointer-events: none;
    }
  `,
})
export class ProgressBarComponent {
  readonly progressPercent = input.required<number>();
  readonly height = input<number>(10);
  readonly glass = input<boolean>(false);
  readonly color = input<string | undefined>(undefined);

  readonly clampedProgress = computed(() =>
    Math.min(100, Math.max(0, this.progressPercent()))
  );

  readonly fillColor = computed(() => this.color() || undefined);
}


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
      ></div>
    </div>
  `,
  styles: `
    .pb-track {
      width: 100%;
      border-radius: 99px;
      background: var(--line);
      overflow: hidden;
      position: relative;
    }

    .pb-track.glass {
      background: rgba(255, 255, 255, 0.22);
    }

    .pb-fill {
      height: 100%;
      border-radius: 99px;
      background: var(--brand-gradient);
      transition: width 1.2s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .pb-fill.solid-white {
      background: #ffffff;
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


import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface ShareSegment {
  name: string;
  percentage: number;
  color: string;
}

@Component({
  selector: 'app-share-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="share-track" role="img" aria-label="Member share of contributions">
      @for (seg of segments(); track seg.name) {
        @if (seg.percentage > 0) {
          <div
            class="share-fill"
            [style.width.%]="seg.percentage"
            [style.background]="seg.color"
            [title]="seg.name + ': ' + seg.percentage.toFixed(1) + '%'"
          ></div>
        }
      }
    </div>
  `,
  styles: `
    .share-track {
      display: flex;
      height: 10px;
      width: 100%;
      border-radius: 99px;
      overflow: hidden;
      background: var(--line);
      gap: 1px;
    }

    .share-fill {
      height: 100%;
      transition: width 1s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
  `,
})
export class ShareBarComponent {
  readonly segments = input.required<ShareSegment[]>();
}

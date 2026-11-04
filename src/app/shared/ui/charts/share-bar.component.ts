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
      border-radius: 9999px;
      overflow: hidden;
      background: rgba(0, 0, 0, 0.06);
      gap: 1.5px;
    }

    .share-fill {
      height: 100%;
      transition: width 1s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
      cursor: pointer;
    }

    .share-fill:hover {
      opacity: 0.85;
    }
  `,
})
export class ShareBarComponent {
  readonly segments = input.required<ShareSegment[]>();
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stat-tile" [class.glass]="glass()">
      <div class="stat-value tabular-nums">{{ value() }}</div>
      <div class="stat-label">{{ label() }}</div>
      @if (subtext()) {
        <div class="stat-sub">{{ subtext() }}</div>
      }
    </div>
  `,
  styles: `
    .stat-tile {
      background: var(--bg);
      border-radius: var(--radius-tile, 16px);
      padding: 12px 14px;
      min-width: 0;
      border: 1px solid var(--line);
    }

    .stat-tile.glass {
      background: rgba(255, 255, 255, 0.16);
      border: 1px solid rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: #ffffff;
    }

    .stat-value {
      font-size: 16px;
      font-weight: 800;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: -0.02em;
    }

    .stat-label {
      font-size: 11px;
      font-weight: 600;
      opacity: 0.8;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .stat-sub {
      font-size: 11px;
      margin-top: 4px;
      opacity: 0.7;
    }
  `,
})
export class StatTileComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly subtext = input<string | undefined>(undefined);
  readonly glass = input<boolean>(false);
}

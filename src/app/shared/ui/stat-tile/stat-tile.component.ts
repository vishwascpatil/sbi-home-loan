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
      background: var(--bg-subtle, #f5f5f7);
      border-radius: var(--radius-tile, 16px);
      padding: 12px 14px;
      min-width: 0;
      border: 1px solid var(--line);
      transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.28s ease, background 0.2s ease;
      cursor: default;
    }

    .stat-tile:hover {
      transform: translateY(-1.5px);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
    }

    .stat-tile.glass {
      background: rgba(255, 255, 255, 0.85);
      border: 1px solid rgba(0, 0, 0, 0.06);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      color: var(--ink);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
    }

    .stat-tile.glass:hover {
      background: #ffffff;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
    }

    .stat-value {
      font-size: 16px;
      font-weight: 800;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: -0.02em;
      color: var(--ink);
    }

    .stat-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--muted);
      margin-top: 3px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .stat-sub {
      font-size: 11px;
      margin-top: 4px;
      color: var(--muted);
    }
  `,
})
export class StatTileComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly subtext = input<string | undefined>(undefined);
  readonly glass = input<boolean>(false);
}


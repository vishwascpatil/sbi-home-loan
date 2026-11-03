import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="chip-button"
      [class.active]="selected()"
      [class.glass]="glass()"
      (click)="clicked.emit()"
    >
      <ng-content />
    </button>
  `,
  styles: `
    .chip-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: var(--radius-pill, 99px);
      border: 1px solid var(--line);
      background: var(--card);
      color: var(--ink);
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
      min-height: 44px;
    }

    .chip-button:hover {
      border-color: var(--brand-a);
      transform: translateY(-1px);
    }

    .chip-button.active {
      background: var(--ink);
      color: var(--bg);
      border-color: var(--ink);
      box-shadow: 0 4px 14px rgba(21, 23, 43, 0.2);
    }

    .chip-button.glass {
      background: rgba(255, 255, 255, 0.18);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.25);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      box-shadow: none;
    }

    .chip-button.glass:hover {
      background: rgba(255, 255, 255, 0.28);
    }

    .chip-button.glass.active {
      background: #ffffff;
      color: var(--brand-a);
    }
  `,
})
export class ChipComponent {
  readonly selected = input<boolean>(false);
  readonly glass = input<boolean>(false);
  readonly clicked = output<void>();
}


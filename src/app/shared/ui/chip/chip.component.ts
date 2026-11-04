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
      border-radius: var(--radius-pill, 9999px);
      border: 1px solid rgba(0, 0, 0, 0.07);
      background: #ffffff;
      color: var(--ink);
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      min-height: 40px;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }

    .chip-button:hover {
      border-color: rgba(0, 0, 0, 0.14);
      transform: translateY(-1.5px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    }

    .chip-button:active {
      transform: scale(0.95);
    }

    .chip-button.active {
      background: var(--ink);
      color: #ffffff;
      border-color: var(--ink);
      font-weight: 700;
      box-shadow: 0 4px 14px rgba(29, 29, 31, 0.22);
    }

    .chip-button.glass {
      background: rgba(255, 255, 255, 0.88);
      color: var(--ink);
      border: 1px solid rgba(0, 0, 0, 0.08);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
    }

    .chip-button.glass:hover {
      background: #ffffff;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
    }

    .chip-button.glass.active {
      background: var(--brand-a);
      color: #ffffff;
      border-color: var(--brand-a);
    }
  `,
})
export class ChipComponent {
  readonly selected = input<boolean>(false);
  readonly glass = input<boolean>(false);
  readonly clicked = output<void>();
}


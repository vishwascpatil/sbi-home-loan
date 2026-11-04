import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface SegmentOption<T = string> {
  label: string;
  value: T;
  icon?: string;
}

@Component({
  selector: 'app-segmented-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="segmented-track" role="radiogroup">
      @for (option of options(); track option.value) {
        <button
          type="button"
          role="radio"
          class="segment-item"
          [attr.aria-checked]="option.value === selectedValue()"
          [class.active]="option.value === selectedValue()"
          (click)="select(option.value)"
        >
          {{ option.label }}
        </button>
      }
    </div>
  `,
  styles: `
    .segmented-track {
      display: flex;
      background: rgba(0, 0, 0, 0.05);
      border: 1px solid rgba(0, 0, 0, 0.04);
      border-radius: var(--radius-pill, 9999px);
      padding: 3px;
      gap: 3px;
      position: relative;
    }

    .segment-item {
      flex: 1;
      border: none;
      background: transparent;
      color: var(--muted);
      font-size: 13px;
      font-weight: 600;
      padding: 8px 14px;
      border-radius: var(--radius-pill, 9999px);
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      min-height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }

    .segment-item:hover {
      color: var(--ink);
    }

    .segment-item:active {
      transform: scale(0.96);
    }

    .segment-item.active {
      background: #ffffff;
      color: var(--ink);
      font-weight: 700;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
    }
  `,
})
export class SegmentedControlComponent<T = string> {
  readonly options = input.required<SegmentOption<T>[]>();
  readonly selectedValue = input.required<T>();
  readonly changed = output<T>();

  select(value: T): void {
    if (value !== this.selectedValue()) {
      this.changed.emit(value);
    }
  }
}


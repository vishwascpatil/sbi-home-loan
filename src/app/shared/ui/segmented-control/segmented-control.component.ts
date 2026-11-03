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
      background: var(--bg);
      border: 1px solid var(--line);
      border-radius: var(--radius-pill, 99px);
      padding: 4px;
      gap: 4px;
      position: relative;
    }

    .segment-item {
      flex: 1;
      border: none;
      background: transparent;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
      padding: 8px 14px;
      border-radius: var(--radius-pill, 99px);
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
      min-height: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      user-select: none;
    }

    .segment-item:hover {
      color: var(--ink);
    }

    .segment-item.active {
      background: var(--card);
      color: var(--ink);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
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

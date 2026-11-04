import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BottomSheetComponent } from './bottom-sheet.component';

@Component({
  selector: 'app-confirm-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent],
  template: `
    <app-bottom-sheet [isOpen]="isOpen()" [title]="title()" (dismissed)="cancelled.emit()">
      <div class="confirm-body">
        <p class="confirm-message">{{ message() }}</p>

        <div class="confirm-actions">
          <button
            type="button"
            class="action-btn confirm-btn"
            [class.danger]="isDanger()"
            (click)="confirmed.emit()"
          >
            {{ confirmText() }}
          </button>
          <button
            type="button"
            class="action-btn cancel-btn"
            (click)="cancelled.emit()"
          >
            {{ cancelText() }}
          </button>
        </div>
      </div>
    </app-bottom-sheet>
  `,
  styles: `
    .confirm-body {
      padding-top: 8px;
    }

    .confirm-message {
      font-size: 14px;
      line-height: 1.5;
      color: var(--muted);
      margin-bottom: 22px;
    }

    .confirm-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .action-btn {
      width: 100%;
      height: 48px;
      border-radius: var(--radius-pill, 9999px);
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.01em;
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      border: 1px solid var(--line);
    }

    .action-btn:active {
      transform: scale(0.96);
    }

    .confirm-btn {
      background: var(--brand-a);
      color: #ffffff;
      border: none;
      box-shadow: 0 4px 14px rgba(0, 113, 227, 0.3);
    }

    .confirm-btn.danger {
      background: var(--danger);
      box-shadow: 0 4px 14px rgba(255, 59, 48, 0.3);
    }

    .confirm-btn:hover {
      opacity: 0.94;
      transform: translateY(-1px);
    }

    .cancel-btn {
      background: var(--bg-subtle, #f5f5f7);
      color: var(--ink);
    }

    .cancel-btn:hover {
      background: rgba(0, 0, 0, 0.08);
    }
  `,
})
export class ConfirmSheetComponent {
  readonly isOpen = input.required<boolean>();
  readonly title = input<string>('Confirm Action');
  readonly message = input.required<string>();
  readonly confirmText = input<string>('Confirm');
  readonly cancelText = input<string>('Cancel');
  readonly isDanger = input<boolean>(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}

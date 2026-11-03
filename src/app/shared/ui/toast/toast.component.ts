import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-wrapper" aria-live="polite">
      @for (t of toastService.toasts(); track t.id) {
        <div class="toast-item" [class.success]="t.type === 'success'" [class.danger]="t.type === 'danger'">
          <span class="toast-text">{{ t.message }}</span>
          <button type="button" class="toast-close" (click)="toastService.dismiss(t.id)" aria-label="Dismiss toast">
            ×
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toast-wrapper {
      position: fixed;
      bottom: calc(85px + env(safe-area-inset-bottom, 0px));
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: calc(100% - 32px);
      max-width: 440px;
      pointer-events: none;
    }

    .toast-item {
      pointer-events: auto;
      background: var(--card);
      color: var(--ink);
      border: 1px solid var(--line);
      border-radius: var(--radius-pill, 99px);
      padding: 12px 20px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-size: 13px;
      font-weight: 700;
      animation: slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .toast-item.success {
      border-left: 4px solid var(--success);
    }

    .toast-item.danger {
      border-left: 4px solid var(--danger);
    }

    .toast-close {
      border: none;
      background: transparent;
      color: var(--muted);
      font-size: 18px;
      cursor: pointer;
      min-width: 28px;
      min-height: 28px;
      display: grid;
      place-items: center;
      padding: 0;
    }

    .toast-close:hover {
      color: var(--ink);
    }
  `,
})
export class ToastComponent {
  readonly toastService = inject(ToastService);
}


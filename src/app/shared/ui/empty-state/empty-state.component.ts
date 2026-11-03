import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-container">
      <div class="empty-icon">{{ icon() }}</div>
      <h4 class="empty-title">{{ title() }}</h4>
      <p class="empty-sub">{{ description() }}</p>
      @if (actionLabel()) {
        <button type="button" class="empty-action" (click)="actionClicked.emit()">
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
  styles: `
    .empty-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 36px 20px;
    }

    .empty-icon {
      font-size: 38px;
      margin-bottom: 12px;
      opacity: 0.85;
    }

    .empty-title {
      font-size: 16px;
      font-weight: 800;
      color: var(--ink);
      margin-bottom: 6px;
    }

    .empty-sub {
      font-size: 13px;
      color: var(--muted);
      max-width: 280px;
      line-height: 1.45;
    }

    .empty-action {
      margin-top: 16px;
      padding: 8px 18px;
      border-radius: var(--radius-pill, 99px);
      background: var(--ink);
      color: var(--bg);
      border: none;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      min-height: 44px;
    }
  `,
})
export class EmptyStateComponent {
  readonly icon = input<string>('📭');
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly actionLabel = input<string | undefined>(undefined);
  readonly actionClicked = output<void>();
}


import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'app-bottom-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div
        class="sheet-backdrop"
        tabindex="-1"
        (click)="backdropClicked()"
        (keydown.escape)="backdropClicked()"
      >
        <div
          class="sheet-container"
          role="dialog"
          [attr.aria-modal]="true"
          [attr.aria-labelledby]="title() ? 'sheet-title' : null"
          (click)="$event.stopPropagation()"
          (keydown)="$event.stopPropagation()"
        >
          <div class="drag-handle" role="presentation"></div>

          @if (title()) {
            <div class="sheet-header">
              <h3 id="sheet-title" class="sheet-title">{{ title() }}</h3>
              <button
                type="button"
                class="close-btn"
                (click)="dismissed.emit()"
                aria-label="Close"
                title="Close"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          }

          <div class="sheet-content">
            <ng-content />
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .sheet-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.32);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .sheet-container {
      width: 100%;
      max-width: 560px;
      max-height: 88vh;
      max-height: 88dvh;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 28px 28px 0 0;
      box-shadow: 0 -12px 48px rgba(0, 0, 0, 0.16);
      display: flex;
      flex-direction: column;
      padding: 12px 22px calc(24px + env(safe-area-inset-bottom, 0px));
      animation: slideUp 0.38s cubic-bezier(0.16, 1, 0.3, 1);
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
    }

    .drag-handle {
      width: 38px;
      height: 5px;
      border-radius: 9999px;
      background: rgba(0, 0, 0, 0.14);
      margin: 4px auto 16px;
      flex-shrink: 0;
      transition: background 0.2s ease, width 0.2s ease;
    }

    .sheet-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
    }

    .sheet-title {
      font-size: 19px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.025em;
      color: var(--ink);
    }

    .close-btn {
      width: 30px;
      height: 30px;
      min-width: 30px;
      min-height: 30px;
      border-radius: 50%;
      border: none;
      background: #ededf2;
      color: #6a6a75;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      -webkit-tap-highlight-color: transparent;

      svg {
        width: 12px;
        height: 12px;
        display: block;
      }

      &:hover {
        background: #e2e2e8;
        color: #111216;
        transform: scale(1.06);
      }

      &:active {
        transform: scale(0.92);
        background: #d5d5dc;
      }
    }

    .sheet-content {
      flex: 1;
      overflow-y: auto;
    }
  `,
})
export class BottomSheetComponent {
  readonly isOpen = input<boolean>(false);
  readonly title = input<string | undefined>(undefined);
  readonly dismissed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.dismissed.emit();
    }
  }

  backdropClicked(): void {
    this.dismissed.emit();
  }
}

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
                aria-label="Close dialog"
              >
                ✕
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
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: rgba(0, 0, 0, 0.04);
      color: var(--muted);
      cursor: pointer;
      display: grid;
      place-items: center;
      font-size: 13px;
      font-weight: 700;
      transition: all 0.2s ease;
    }

    .close-btn:hover {
      color: var(--ink);
      background: rgba(0, 0, 0, 0.08);
    }

    .close-btn:active {
      transform: scale(0.9);
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

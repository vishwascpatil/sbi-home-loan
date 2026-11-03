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
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      animation: fadeIn 0.25s ease-out;
    }

    .sheet-container {
      width: 100%;
      max-width: 560px;
      max-height: 88vh;
      max-height: 88dvh;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 28px 28px 0 0;
      box-shadow: 0 -8px 36px rgba(0, 0, 0, 0.18);
      display: flex;
      flex-direction: column;
      padding: 12px 20px calc(24px + env(safe-area-inset-bottom, 0px));
      animation: slideUp 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);
      overflow-y: auto;
    }

    .drag-handle {
      width: 40px;
      height: 4px;
      border-radius: 99px;
      background: var(--line-strong);
      margin: 4px auto 14px;
      flex-shrink: 0;
    }

    .sheet-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .sheet-title {
      font-size: 18px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .close-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid var(--line);
      background: var(--bg);
      color: var(--muted);
      cursor: pointer;
      display: grid;
      place-items: center;
      font-size: 14px;
    }

    .close-btn:hover {
      color: var(--ink);
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

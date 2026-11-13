import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  output,
} from '@angular/core';
import { triggerHaptic } from '../../../core/engine';

@Component({
  selector: 'app-bottom-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div
        class="sheet-backdrop"
        [style.z-index]="zIndex()"
        tabindex="-1"
        (click)="backdropClicked($event)"
        (keydown.escape)="backdropClicked($event)"
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
                (pointerdown)="onButtonPointerDown($event)"
                (touchstart)="onButtonPointerDown($event)"
                (click)="onClose($event)"
                aria-label="Close"
                title="Close"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
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
      background: rgba(0, 0, 0, 0.36);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .sheet-container {
      position: relative;
      width: 100%;
      max-width: 560px;
      max-height: 88vh;
      max-height: 88dvh;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 28px 28px 0 0;
      box-shadow: 0 -12px 48px rgba(0, 0, 0, 0.18);
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
      margin: 4px auto 14px;
      flex-shrink: 0;
      transition: background 0.2s ease, width 0.2s ease;
    }

    .sheet-header {
      position: relative;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
      flex-shrink: 0;
    }

    .sheet-title {
      font-size: 19px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.025em;
      color: var(--ink);
    }

    .close-btn {
      position: relative;
      z-index: 60;
      width: 44px;
      height: 44px;
      min-width: 44px;
      min-height: 44px;
      border-radius: 50%;
      border: 1px solid rgba(0, 0, 0, 0.06);
      background: #ededf2;
      color: #3d3e4b;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      margin: -6px -6px -6px 0;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      /* Extended 56px touch target hitbox for thumb taps */
      &::after {
        content: '';
        position: absolute;
        inset: -6px;
        border-radius: 50%;
      }

      svg {
        width: 16px;
        height: 16px;
        display: block;
        pointer-events: none;
      }

      line {
        pointer-events: none;
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
      position: relative;
      z-index: 10;
      flex: 1;
      overflow-y: auto;
    }
  `,
})
export class BottomSheetComponent {
  readonly isOpen = input<boolean>(false);
  readonly title = input<string | undefined>(undefined);
  readonly zIndex = input<number>(1000);
  readonly dismissed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      triggerHaptic('light');
      this.dismissed.emit();
    }
  }

  onButtonPointerDown(event: Event): void {
    event.stopPropagation();
  }

  onClose(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    triggerHaptic('light');
    this.dismissed.emit();
  }

  backdropClicked(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    triggerHaptic('light');
    this.dismissed.emit();
  }
}

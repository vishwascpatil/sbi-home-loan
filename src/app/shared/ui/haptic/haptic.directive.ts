import { Directive, HostListener, input } from '@angular/core';
import { HapticType, triggerHaptic } from '../../../core/engine';

@Directive({
  selector: '[appHaptic]',
  standalone: true,
})
export class HapticDirective {
  readonly hapticType = input<HapticType>('light', { alias: 'appHaptic' });

  @HostListener('pointerdown')
  onPointerDown(): void {
    triggerHaptic(this.hapticType() || 'light');
  }

  @HostListener('keydown.enter')
  onEnter(): void {
    triggerHaptic(this.hapticType() || 'light');
  }
}


import {
  Directive,
  ElementRef,
  inject,
  input,
  NgZone,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';

@Directive({
  selector: '[appCountUp]',
})
export class CountUpDirective implements OnChanges, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly ngZone = inject(NgZone);

  readonly targetValue = input.required<number>({ alias: 'appCountUp' });
  readonly duration = input<number>(1000); // ms
  readonly prefix = input<string>('₹');
  readonly showDecimals = input<boolean>(false);

  private animationFrameId: number | null = null;
  private startValue = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['targetValue']) {
      const prev = changes['targetValue'].previousValue as number | undefined;
      this.startValue = prev !== undefined && Number.isFinite(prev) ? prev : 0;
      this.runAnimation();
    }
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private runAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Check if user prefers reduced motion
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      this.renderValue(this.targetValue());
      return;
    }

    const start = performance.now();
    const duration = this.duration();
    const startVal = this.startValue;
    const targetVal = this.targetValue();

    this.ngZone.runOutsideAngular(() => {
      const step = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(1, elapsed / duration);
        // Ease-out cubic: 1 - pow(1 - progress, 3)
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = startVal + (targetVal - startVal) * ease;

        this.renderValue(current);

        if (progress < 1) {
          this.animationFrameId = requestAnimationFrame(step);
        } else {
          this.animationFrameId = null;
          this.renderValue(targetVal);
        }
      };

      this.animationFrameId = requestAnimationFrame(step);
    });
  }

  private renderValue(val: number): void {
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    const rupees = Math.floor(absVal / 100);
    const paise = Math.round(absVal % 100);

    let text = rupees.toLocaleString('en-IN');
    if (this.showDecimals()) {
      text += '.' + paise.toString().padStart(2, '0');
    }

    const sign = isNegative ? '−' : '';
    this.el.nativeElement.textContent = `${sign}${this.prefix()}${text}`;
  }
}

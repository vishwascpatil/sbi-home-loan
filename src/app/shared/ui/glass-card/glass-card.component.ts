import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-glass-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="glass-card"
      [class.hero-variant]="variant() === 'hero'"
      [class.inset-variant]="variant() === 'inset'"
      [style.--stagger-index]="staggerIndex()"
      [class.stagger-in]="staggerIndex() !== undefined"
    >
      <ng-content />
    </div>
  `,
  styles: `
    .glass-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius-card, 26px);
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: var(--shadow-md);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .hero-variant {
      background: var(--hero-gradient);
      color: #ffffff;
      border: none;
      box-shadow: 0 16px 36px rgba(108, 76, 255, 0.28);
    }

    .inset-variant {
      background: var(--bg);
      border-radius: var(--radius-tile, 16px);
      box-shadow: none;
      border: 1px solid var(--line);
      padding: 14px;
      margin-bottom: 0;
    }
  `,
})
export class GlassCardComponent {
  readonly variant = input<'default' | 'hero' | 'inset'>('default');
  readonly staggerIndex = input<number | undefined>(undefined);
}

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
      border-radius: var(--radius-card, 24px);
      padding: 22px;
      margin-bottom: 18px;
      box-shadow: var(--shadow-md);
      transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      overflow: hidden;
    }

    .glass-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-tv-hover);
    }

    .hero-variant {
      background: linear-gradient(145deg, #ffffff 0%, #f7f9fc 60%, #eef3f9 100%);
      color: var(--ink);
      border: 1px solid var(--hero-border, rgba(0, 0, 0, 0.08));
      box-shadow: var(--shadow-lg);
    }

    .inset-variant {
      background: var(--bg-subtle, #f5f5f7);
      border-radius: var(--radius-tile, 16px);
      box-shadow: none;
      border: 1px solid var(--line);
      padding: 16px;
      margin-bottom: 0;
    }

    .inset-variant:hover {
      transform: none;
      box-shadow: none;
    }
  `,
})
export class GlassCardComponent {
  readonly variant = input<'default' | 'hero' | 'inset'>('default');
  readonly staggerIndex = input<number | undefined>(undefined);
}


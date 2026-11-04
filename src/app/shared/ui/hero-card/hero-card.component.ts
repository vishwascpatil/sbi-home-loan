import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CountUpDirective } from '../count-up/count-up.directive';
import { ProgressBarComponent } from '../progress-bar/progress-bar.component';
import { StatTileComponent } from '../stat-tile/stat-tile.component';
import { formatCompactPaise, formatPaise, Loan, Paise } from '../../../core/engine';

@Component({
  selector: 'app-hero-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CountUpDirective, ProgressBarComponent, StatTileComponent],
  template: `
    <div class="hero-container">
      <!-- Glow ambient background circles -->
      <div class="glow-circle glow-top-right"></div>
      <div class="glow-circle glow-bottom-left"></div>

      <!-- Top Row Badges -->
      <div class="top-row">
        <span class="badge-pill">Active {{ loan().type }}</span>
        <button
          type="button"
          class="badge-pill clickable"
          (click)="toggleReveal.emit()"
          [attr.aria-label]="isMasked() ? 'Show account number' : 'Hide account number'"
        >
          {{ displayAccountNumber() }} · {{ isMasked() ? 'Show' : 'Hide' }}
        </button>
      </div>

      <!-- Total Outstanding Balance -->
      <div class="balance-section">
        <div class="balance-label">Total outstanding</div>
        <div class="balance-amount tabular-nums" [appCountUp]="currentOutstanding()">
          {{ formattedOutstanding() }}
        </div>
      </div>

      <!-- Repayment Progress Bar -->
      <app-progress-bar
        [progressPercent]="repaidPercent()"
        [glass]="true"
        [height]="8"
      />

      <!-- Progress Details Row -->
      <div class="repaid-details-row">
        <span>Repaid {{ formattedRepaid() }} · {{ repaidPercent().toFixed(1) }}%</span>
        <span>Sanctioned {{ formattedLimit() }}</span>
      </div>

      <!-- 3 Glass Stat Tiles Grid -->
      <div class="stats-grid">
        <app-stat-tile
          label="Interest p.a."
          [value]="(loan().currentRateBps / 100).toFixed(2) + '%'"
          [glass]="true"
        />
        <app-stat-tile
          label="Monthly target"
          [value]="formattedTarget()"
          [glass]="true"
        />
        <app-stat-tile
          label="Est. closure"
          [value]="closureDate() || '—'"
          [glass]="true"
        />
      </div>
    </div>
  `,
  styles: `
    .hero-container {
      background: linear-gradient(145deg, #ffffff 0%, #f8f9fc 55%, #edf2f9 100%);
      color: var(--ink);
      border: 1px solid var(--hero-border, rgba(0, 0, 0, 0.07));
      border-radius: var(--radius-card, 24px);
      padding: 24px 22px 22px;
      margin-bottom: 18px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 16px 40px -8px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.02), inset 0 1px 1.5px #ffffff;
      transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.38s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .hero-container:hover {
      transform: translateY(-2px) scale(1.006);
      box-shadow: 0 24px 50px -10px rgba(0, 0, 0, 0.1), 0 4px 14px rgba(0, 0, 0, 0.03), inset 0 1px 2px #ffffff;
    }

    .glow-circle {
      position: absolute;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(0, 113, 227, 0.06) 0%, rgba(255, 255, 255, 0) 70%);
      pointer-events: none;
    }

    .glow-top-right {
      width: 280px;
      height: 280px;
      right: -80px;
      top: -100px;
    }

    .glow-bottom-left {
      width: 200px;
      height: 200px;
      left: -60px;
      bottom: -80px;
      background: radial-gradient(circle, rgba(67, 56, 202, 0.04) 0%, rgba(255, 255, 255, 0) 70%);
    }

    .top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;
      z-index: 1;
    }

    .badge-pill {
      display: inline-flex;
      align-items: center;
      padding: 6px 14px;
      border-radius: var(--radius-pill, 9999px);
      background: rgba(0, 0, 0, 0.04);
      border: 1px solid rgba(0, 0, 0, 0.07);
      color: var(--ink);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .badge-pill.clickable {
      cursor: pointer;
      min-height: 32px;
    }

    .badge-pill.clickable:hover {
      background: rgba(0, 0, 0, 0.07);
      transform: translateY(-1px);
    }

    .badge-pill.clickable:active {
      transform: scale(0.96);
    }

    .balance-section {
      margin-top: 20px;
      margin-bottom: 16px;
      position: relative;
      z-index: 1;
    }

    .balance-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .balance-amount {
      font-size: 40px;
      font-weight: 800;
      letter-spacing: -0.04em;
      line-height: 1.1;
      margin-top: 4px;
      color: var(--ink);
    }

    .repaid-details-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      margin-top: 8px;
      margin-bottom: 20px;
      position: relative;
      z-index: 1;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      position: relative;
      z-index: 1;
    }
  `,
})
export class HeroCardComponent {
  readonly loan = input.required<Loan>();
  readonly currentOutstanding = input.required<Paise>();
  readonly isMasked = input<boolean>(true);
  readonly closureDate = input<string | undefined>(undefined);

  readonly toggleReveal = output<void>();

  readonly displayAccountNumber = computed(() => {
    const raw = this.loan().accountNumber;
    if (!this.isMasked()) return raw;
    return `•••• ${raw.slice(-4)}`;
  });

  readonly formattedOutstanding = computed(() =>
    formatPaise(this.currentOutstanding())
  );

  readonly repaidAmount = computed<Paise>(() => {
    const lim = this.loan().sanctionedLimit;
    const out = this.currentOutstanding();
    return Math.max(0, lim - out) as Paise;
  });

  readonly repaidPercent = computed(() => {
    const lim = this.loan().sanctionedLimit;
    if (lim <= 0) return 0;
    return (this.repaidAmount() / lim) * 100;
  });

  readonly formattedRepaid = computed(() =>
    formatPaise(this.repaidAmount())
  );

  readonly formattedLimit = computed(() =>
    formatCompactPaise(this.loan().sanctionedLimit)
  );

  readonly formattedTarget = computed(() =>
    formatCompactPaise(this.loan().monthlyTarget)
  );
}


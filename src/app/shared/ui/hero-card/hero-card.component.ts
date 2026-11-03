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
      background: var(--hero-gradient);
      color: #ffffff;
      border-radius: var(--radius-card, 26px);
      padding: 22px 20px 20px;
      margin-bottom: 16px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 16px 36px rgba(108, 76, 255, 0.28);
    }

    .glow-circle {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.12);
      pointer-events: none;
    }

    .glow-top-right {
      width: 240px;
      height: 240px;
      right: -80px;
      top: -100px;
    }

    .glow-bottom-left {
      width: 160px;
      height: 160px;
      left: -60px;
      bottom: -80px;
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
      padding: 6px 13px;
      border-radius: var(--radius-pill, 99px);
      background: rgba(255, 255, 255, 0.18);
      border: 1px solid rgba(255, 255, 255, 0.22);
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    .badge-pill.clickable {
      cursor: pointer;
      transition: background 0.2s ease;
      min-height: 32px;
    }

    .badge-pill.clickable:hover {
      background: rgba(255, 255, 255, 0.28);
    }

    .balance-section {
      margin-top: 18px;
      margin-bottom: 14px;
      position: relative;
      z-index: 1;
    }

    .balance-label {
      font-size: 13px;
      font-weight: 600;
      opacity: 0.88;
    }

    .balance-amount {
      font-size: 38px;
      font-weight: 800;
      letter-spacing: -0.035em;
      line-height: 1.15;
      margin-top: 4px;
    }

    .repaid-details-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 600;
      opacity: 0.9;
      margin-top: 8px;
      margin-bottom: 18px;
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


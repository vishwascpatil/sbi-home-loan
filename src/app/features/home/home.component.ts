import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LedgerStore, SettingsStore } from '../../core/state';
import {
  AvatarComponent,
  ProgressBarComponent,
  SparklineChartComponent,
} from '../../shared/ui';
import { CountUpDirective } from '../../shared/ui/count-up/count-up.directive';
import {
  formatCompactPaise,
  formatPaise,
  getTransactionAmount,
  getTransactionMode,
  simulate,
  toRupees,
  Transaction,
} from '../../core/engine';
import { AmbientMotionHeroComponent } from './ambient-motion-hero.component';
import { AddEditTransactionSheetComponent } from '../transaction-sheet/add-edit-transaction-sheet.component';
import { DailyLedgerSheetComponent } from '../daily-ledger/daily-ledger-sheet.component';

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AmbientMotionHeroComponent,
    CountUpDirective,
    ProgressBarComponent,
    SparklineChartComponent,
    AvatarComponent,
    AddEditTransactionSheetComponent,
    DailyLedgerSheetComponent,
  ],
  template: `
    <div class="home-page">
      <!-- Calm Minimal Header -->
      <header class="home-header">
        <div class="header-left">
          <span class="header-eyebrow">{{ currentMonthFormatted() }}</span>
          <h1 class="header-title">Loan Overview</h1>
        </div>
        <div class="header-right">
          <button
            type="button"
            class="calm-icon-btn"
            (click)="router.navigate(['/settings'])"
            aria-label="Settings"
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      <!-- Ambient Generative Motion Hero with High-End Animated Numbers -->
      <app-ambient-motion-hero
        [loan]="ledgerStore.loan()"
        [currentOutstanding]="ledgerStore.currentOutstanding()"
        [isMasked]="settings.maskAccountNumber()"
        [closureDate]="simulationResult()?.closureDate"
        (toggleReveal)="settings.toggleMaskAccountNumber()"
        (quickAction)="handleQuickAction($event)"
      />

      <!-- Section 1: This Month Performance (Content-First & Calm Minimalism) -->
      <section class="calm-section" style="--stagger: 1">
        <div class="section-header">
          <div class="title-cluster">
            <h2 class="section-heading">This Month</h2>
            <span
              class="calm-badge"
              [class.reconciled]="isThisMonthReconciled()"
              [class.estimated]="!isThisMonthReconciled()"
            >
              {{ isThisMonthReconciled() ? '✓ Reconciled' : 'Estimated' }}
            </span>
          </div>

          <button
            type="button"
            class="calm-action-link"
            (click)="isDailyLedgerOpen.set(true)"
            aria-label="View daily interest breakdown"
          >
            {{ methodLabel() }} ↗
          </button>
        </div>

        <!-- Hero Metric Flow: Borderless, Large Elegant Numbers -->
        <div class="minimal-metric-grid">
          <div class="metric-block highlight">
            <span class="metric-caption">Principal Reduced</span>
            <span class="metric-num-hero tabular-nums" [appCountUp]="summary().principalReduced">
              {{ formatPaise(summary().principalReduced) }}
            </span>
            <span class="metric-sub positive">Direct debt reduction</span>
          </div>

          <div class="metric-block">
            <span class="metric-caption">Interest Incurred (Est.)</span>
            <span
              class="metric-num-hero tabular-nums"
              [appCountUp]="summary().interestIncurredEst"
              [showDecimals]="true"
            >
              {{ formatPaise(summary().interestIncurredEst, { showPaise: true, isEstimated: true }) }}
            </span>
            <span class="metric-sub">Daily accrual rate</span>
          </div>
        </div>

        <!-- Sleek Borderless Target Progress -->
        <div class="progress-block">
          <div class="progress-labels">
            <span class="p-sub-label">Monthly Target Progress</span>
            <span class="p-sub-val tabular-nums">{{ summary().targetProgressPercent.toFixed(0) }}%</span>
          </div>
          <app-progress-bar [progressPercent]="summary().targetProgressPercent" [height]="6" />
        </div>

        <!-- Airy Key-Value Flow -->
        <div class="airy-data-grid">
          <div class="airy-data-item">
            <span class="airy-label">Member Contributions</span>
            <span class="airy-val tabular-nums">{{ formatPaise(summary().memberContributions) }}</span>
          </div>
          <div class="airy-data-item">
            <span class="airy-label">Paid to Bank</span>
            <span class="airy-val tabular-nums">{{ formatPaise(summary().paidToBank) }}</span>
          </div>
          <div class="airy-data-item">
            <span class="airy-label">Remaining to Target</span>
            <span class="airy-val tabular-nums">{{ formatPaise(summary().remainingTarget) }}</span>
          </div>
        </div>
      </section>

      <!-- Section 2: Group Funds (Cash Pool) -->
      <section class="calm-section" style="--stagger: 2">
        <div class="section-header">
          <div class="title-cluster">
            <h2 class="section-heading">Group Funds</h2>
            <span class="calm-badge neutral">Cash Pool</span>
          </div>
        </div>

        <div class="funds-columns">
          <div class="fund-column">
            <span class="fund-label">Total Contributed</span>
            <span class="fund-val tabular-nums" [appCountUp]="funds().totalContributions">
              {{ formatCompactPaise(funds().totalContributions) }}
            </span>
            <span class="fund-desc">Member deposits</span>
          </div>
          <div class="fund-divider"></div>
          <div class="fund-column">
            <span class="fund-label">Disbursed to Bank</span>
            <span class="fund-val tabular-nums" [appCountUp]="funds().totalBankPayments">
              {{ formatCompactPaise(funds().totalBankPayments) }}
            </span>
            <span class="fund-desc">Recorded payments</span>
          </div>
          <div class="fund-divider"></div>
          <div class="fund-column highlight">
            <span class="fund-label">Liquid Unused</span>
            <span class="fund-val tabular-nums" [appCountUp]="funds().unusedFunds">
              {{ formatCompactPaise(funds().unusedFunds) }}
            </span>
            <span class="fund-desc">Ready cash pool</span>
          </div>
        </div>

        <p class="calm-note">
          Contributions accumulate in group funds. Only recorded bank payments reduce loan principal.
        </p>
      </section>

      <!-- Section 3: Payoff Trajectory & Projected Amortization -->
      <section class="calm-section" style="--stagger: 3">
        <div class="section-header">
          <div class="title-cluster">
            <h2 class="section-heading">Payoff Trajectory</h2>
            <span class="calm-badge neutral">{{ formatCompactPaise(ledgerStore.loan().monthlyTarget) }}/mo target</span>
          </div>
          <button type="button" class="calm-action-link" (click)="router.navigate(['/insights'])">
            Simulate ↗
          </button>
        </div>

        @if (simulationResult()) {
          <div class="chart-wrapper">
            <app-sparkline-chart [data]="simulationResult()!.schedule" />
          </div>
          <div class="trajectory-meta">
            <div class="traj-point">
              <span class="traj-caption">Today</span>
              <span class="traj-val tabular-nums">{{ formatPaise(ledgerStore.currentOutstanding()) }}</span>
            </div>
            <div class="traj-point right">
              <span class="traj-caption">Estimated Closure</span>
              <span class="traj-val highlight">{{ simulationResult()!.closureDate }}</span>
            </div>
          </div>
          <p class="calm-note">
            Estimated future interest until debt-free: <strong>{{ formatPaise(simulationResult()!.totalInterest) }}</strong>.
          </p>
        } @else {
          <p class="calm-note warning">
            Monthly target is below interest accrual. Debt is not amortizing.
          </p>
        }
      </section>

      <!-- Section 4: Members -->
      <section class="calm-section" style="--stagger: 4">
        <div class="section-header">
          <h2 class="section-heading">Members</h2>
          <button type="button" class="calm-action-link" (click)="router.navigate(['/members'])">
            Manage ↗
          </button>
        </div>

        <div class="calm-list">
          @for (m of ledgerStore.memberStats(); track m.memberId) {
            <div class="calm-list-row member-row">
              <app-avatar [name]="m.name" [colorIndex]="$index" [size]="40" />
              <div class="row-main">
                <span class="row-title">{{ m.name }}</span>
                <span class="row-subtitle">
                  This month {{ formatPaise(m.thisMonthContribution) }} · Lifetime {{ formatCompactPaise(m.lifetimeContribution) }}
                </span>
              </div>
              <div class="row-end">
                <span class="share-badge tabular-nums">{{ m.sharePercentage.toFixed(1) }}%</span>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- Section 5: Recent Activity -->
      <section class="calm-section" style="--stagger: 5">
        <div class="section-header">
          <h2 class="section-heading">Recent Activity</h2>
          <button type="button" class="calm-action-link" (click)="router.navigate(['/history'])">
            Complete Ledger ↗
          </button>
        </div>

        <div class="calm-list">
          @for (tx of ledgerStore.recentTransactions(); track tx.id) {
            <button
              type="button"
              class="calm-list-row tx-row clickable"
              (click)="editSelectedTx(tx)"
            >
              <div class="tx-badge" [class.payment]="tx.type === 'bankPayment'">
                {{ tx.type === 'bankPayment' ? '🏦' : '👤' }}
              </div>
              <div class="row-main">
                <span class="row-title">{{ getTxTitle(tx) }}</span>
                <span class="row-subtitle">
                  {{ tx.date }} · {{ getTransactionMode(tx) }}
                  @if (tx.type === 'bankPayment') {
                    · interest {{ formatPaise(tx.interestPortion, { showPaise: true }) }}
                  }
                </span>
              </div>
              <div class="row-end">
                <span
                  class="tx-val tabular-nums"
                  [class.positive]="tx.type === 'contribution'"
                  [class.negative]="tx.type === 'bankPayment'"
                >
                  {{ tx.type === 'contribution' ? '+' : '−' }}{{ formatPaise(getTransactionAmount(tx)) }}
                </span>
              </div>
            </button>
          } @empty {
            <p class="calm-note">No transactions recorded yet. Tap ＋ to record one.</p>
          }
        </div>
      </section>

      <!-- Add/Edit Transaction Bottom Sheet Instance -->
      <app-add-edit-transaction-sheet
        [isOpen]="isSheetOpen()"
        [editTransaction]="selectedTxForEdit()"
        [initialType]="initialSheetType()"
        (dismissed)="isSheetOpen.set(false); selectedTxForEdit.set(null)"
      />

      <!-- Daily Ledger Sheet Instance -->
      <app-daily-ledger-sheet
        [isOpen]="isDailyLedgerOpen()"
        (dismissed)="isDailyLedgerOpen.set(false)"
      />
    </div>
  `,
  styles: `
    .home-page {
      display: flex;
      flex-direction: column;
      padding: 4px 0 60px;
    }

    /* Calm Minimal Header */
    .home-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin: 4px 0 24px;
      padding: 0 4px;
    }

    .header-eyebrow {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: #86868b;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 2px;
    }

    .header-title {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #1d1d1f;
      margin: 0;
    }

    .calm-icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 9999px;
      border: none;
      background: rgba(0, 0, 0, 0.03);
      cursor: pointer;
      display: grid;
      place-items: center;
      font-size: 16px;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        background: rgba(0, 0, 0, 0.06);
        transform: scale(1.05);
      }

      &:active {
        transform: scale(0.95);
      }
    }

    /* Calm Section Container - Borderless, Content-First, Generous Whitespace */
    .calm-section {
      display: flex;
      flex-direction: column;
      margin-bottom: 48px;
      padding: 0 4px;
      animation: calmSectionEntrance 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
      animation-delay: calc(var(--stagger, 0) * 0.08s);
    }

    @keyframes calmSectionEntrance {
      0% {
        opacity: 0;
        transform: translateY(16px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }

    .title-cluster {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .section-heading {
      font-size: 19px;
      font-weight: 700;
      letter-spacing: -0.025em;
      color: #1d1d1f;
      margin: 0;
    }

    .calm-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 9999px;
      letter-spacing: 0.02em;

      &.reconciled {
        background: rgba(52, 199, 89, 0.12);
        color: #248a3d;
      }

      &.estimated {
        background: rgba(0, 113, 227, 0.08);
        color: #0071e3;
      }

      &.neutral {
        background: rgba(0, 0, 0, 0.04);
        color: #6e6e73;
      }
    }

    .calm-action-link {
      font-size: 13px;
      font-weight: 700;
      color: #0071e3;
      background: transparent;
      border: none;
      padding: 4px 6px;
      cursor: pointer;
      letter-spacing: -0.01em;
      transition: all 0.2s ease;

      &:hover {
        opacity: 0.75;
        transform: translateX(1px);
      }

      &:active {
        transform: scale(0.97);
      }
    }

    /* Minimal Metric Grid */
    .minimal-metric-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }

    .metric-block {
      display: flex;
      flex-direction: column;
      gap: 4px;

      &.highlight .metric-num-hero {
        color: #0fb27c;
      }
    }

    .metric-caption {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #86868b;
    }

    .metric-num-hero {
      font-size: clamp(22px, 5.5vw, 28px);
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #1d1d1f;
      line-height: 1.1;
    }

    .metric-sub {
      font-size: 11px;
      font-weight: 600;
      color: #86868b;

      &.positive {
        color: #248a3d;
      }
    }

    /* Progress Block */
    .progress-block {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 24px;
    }

    .progress-labels {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
    }

    .p-sub-label {
      font-weight: 600;
      color: #6e6e73;
    }

    .p-sub-val {
      font-weight: 800;
      color: #1d1d1f;
    }

    /* Airy Key-Value Flow */
    .airy-data-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      padding-top: 14px;
      border-top: 1px solid rgba(0, 0, 0, 0.05);
    }

    .airy-data-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .airy-label {
      font-size: 11px;
      font-weight: 600;
      color: #86868b;
      line-height: 1.25;
    }

    .airy-val {
      font-size: 14px;
      font-weight: 800;
      color: #1d1d1f;
    }

    /* Group Funds Columns */
    .funds-columns {
      display: flex;
      align-items: stretch;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 0;
    }

    .fund-column {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;

      &.highlight .fund-val {
        color: #0071e3;
      }
    }

    .fund-divider {
      width: 1px;
      background: rgba(0, 0, 0, 0.06);
    }

    .fund-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #86868b;
    }

    .fund-val {
      font-size: clamp(20px, 4.8vw, 24px);
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #1d1d1f;
      line-height: 1.15;
    }

    .fund-desc {
      font-size: 11px;
      font-weight: 500;
      color: #86868b;
    }

    .calm-note {
      font-size: 12px;
      font-weight: 500;
      color: #86868b;
      line-height: 1.5;
      margin: 8px 0 0;

      &.warning {
        color: #d9383a;
      }
    }

    /* Trajectory Sparkline & Metadata */
    .chart-wrapper {
      margin: 8px 0 16px;
    }

    .trajectory-meta {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-top: 10px;
      border-top: 1px solid rgba(0, 0, 0, 0.05);
    }

    .traj-point {
      display: flex;
      flex-direction: column;
      gap: 2px;

      &.right {
        align-items: flex-end;
        text-align: right;
      }
    }

    .traj-caption {
      font-size: 11px;
      font-weight: 600;
      color: #86868b;
    }

    .traj-val {
      font-size: 14px;
      font-weight: 800;
      color: #1d1d1f;

      &.highlight {
        color: #0071e3;
      }
    }

    /* Calm Minimal List */
    .calm-list {
      display: flex;
      flex-direction: column;
    }

    .calm-list-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 13px 4px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.04);
      background: transparent;
      border-left: none;
      border-right: none;
      border-top: none;
      width: 100%;
      text-align: left;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:last-child {
        border-bottom: none;
      }

      &.clickable {
        cursor: pointer;
        border-radius: 14px;
        margin: 0 -4px;
        padding: 12px 8px;
        width: calc(100% + 8px);

        &:hover {
          background: rgba(0, 0, 0, 0.02);
          transform: translateX(3px);
        }

        &:active {
          transform: scale(0.99);
        }
      }
    }

    .row-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .row-title {
      font-size: 14px;
      font-weight: 700;
      color: #1d1d1f;
      letter-spacing: -0.01em;
    }

    .row-subtitle {
      font-size: 11px;
      font-weight: 500;
      color: #86868b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .row-end {
      display: flex;
      align-items: center;
    }

    .share-badge {
      font-size: 12px;
      font-weight: 700;
      color: #6e6e73;
      background: rgba(0, 0, 0, 0.04);
      padding: 3px 8px;
      border-radius: 9999px;
    }

    .tx-badge {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: #f5f5f7;
      display: grid;
      place-items: center;
      font-size: 17px;
      flex-shrink: 0;
      transition: transform 0.2s ease;

      &.payment {
        background: rgba(0, 113, 227, 0.08);
      }
    }

    .clickable:hover .tx-badge {
      transform: scale(1.06);
    }

    .tx-val {
      font-size: 14px;
      font-weight: 800;

      &.positive {
        color: #248a3d;
      }

      &.negative {
        color: #1d1d1f;
      }
    }

    @media (max-width: 480px) {
      .airy-data-grid {
        grid-template-columns: 1fr;
        gap: 10px;
      }

      .funds-columns {
        flex-direction: column;
        gap: 14px;
      }

      .fund-divider {
        display: none;
      }
    }
  `,
})
export class HomeComponent {
  readonly ledgerStore = inject(LedgerStore);
  readonly settings = inject(SettingsStore);
  readonly router = inject(Router);

  readonly formatPaise = formatPaise;
  readonly formatCompactPaise = formatCompactPaise;
  readonly toRupees = toRupees;
  readonly getTransactionAmount = getTransactionAmount;
  readonly getTransactionMode = getTransactionMode;

  readonly isSheetOpen = signal<boolean>(false);
  readonly isDailyLedgerOpen = signal<boolean>(false);
  readonly selectedTxForEdit = signal<Transaction | null>(null);
  readonly initialSheetType = signal<'contribution' | 'bankPayment'>('contribution');

  readonly summary = this.ledgerStore.thisMonthSummary;
  readonly funds = this.ledgerStore.groupFunds;

  readonly currentMonthFormatted = computed(() => {
    return new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  });

  readonly isThisMonthReconciled = computed<boolean>(() => {
    const curMonth = new Date().toISOString().slice(0, 7);
    return this.ledgerStore.snapshots().some(
      (s) => !s.deletedAt && s.date.slice(0, 7) === curMonth && s.variance === 0
    );
  });

  readonly methodLabel = computed(() => {
    const loan = this.ledgerStore.loan();
    const basis = loan.bankRules?.dayCountBasis || 'actual/365';
    return loan.calculationMethod === 'daily'
      ? `Daily OD (${basis}) · est.`
      : 'Monthly reducing · est.';
  });

  readonly simulationResult = computed(() => {
    const loan = this.ledgerStore.loan();
    const out = this.ledgerStore.currentOutstanding();
    return simulate(out, loan.monthlyTarget, loan.currentRateBps);
  });

  handleQuickAction(action: 'contribution' | 'bankPayment' | 'history' | 'settings' | 'insights'): void {
    if (action === 'contribution' || action === 'bankPayment') {
      this.openAddWith(action);
    } else {
      this.router.navigate(['/' + action]);
    }
  }

  openAddWith(type: 'contribution' | 'bankPayment'): void {
    this.initialSheetType.set(type);
    this.selectedTxForEdit.set(null);
    this.isSheetOpen.set(true);
  }

  editSelectedTx(tx: Transaction): void {
    this.selectedTxForEdit.set(tx);
    this.isSheetOpen.set(true);
  }

  getTxTitle(tx: Transaction): string {
    if (tx.type === 'contribution') {
      const member = this.ledgerStore.members().find((m) => m.id === tx.memberId);
      return member ? member.name : 'Member';
    }
    if (tx.type === 'bankPayment') return 'Bank Payment';
    if (tx.type === 'withdrawal') return 'Withdrawal';
    if (tx.type === 'principalAdjustment') return 'Principal Adjustment';
    if (tx.type === 'manualCorrection') return 'Balance Reconciled';
    return 'Transaction';
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LedgerStore, SettingsStore } from '../../core/state';
import {
  AvatarComponent,
  ChipComponent,
  GlassCardComponent,
  HeroCardComponent,
  ProgressBarComponent,
  SparklineChartComponent,
  StatTileComponent,
} from '../../shared/ui';
import {
  formatCompactPaise,
  formatPaise,
  getTransactionAmount,
  getTransactionMode,
  simulate,
  toRupees,
  Transaction,
} from '../../core/engine';
import { AddEditTransactionSheetComponent } from '../transaction-sheet/add-edit-transaction-sheet.component';
import { DailyLedgerSheetComponent } from '../daily-ledger/daily-ledger-sheet.component';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeroCardComponent,
    GlassCardComponent,
    ChipComponent,
    ProgressBarComponent,
    StatTileComponent,
    SparklineChartComponent,
    AvatarComponent,
    AddEditTransactionSheetComponent,
    DailyLedgerSheetComponent,
  ],
  template: `
    <div class="home-page">
      <!-- Top Date Header -->
      <header class="home-header">
        <div>
          <small class="header-month">{{ currentMonthFormatted() }}</small>
          <h1 class="header-title">Loan Tracker</h1>
        </div>
        <button
          type="button"
          class="theme-icon-btn"
          (click)="settings.toggleTheme()"
          [attr.aria-label]="settings.isDark() ? 'Switch to light theme' : 'Switch to dark theme'"
        >
          {{ settings.isDark() ? '☀️' : '🌙' }}
        </button>
      </header>

      <!-- Hero Outstanding Balance Card -->
      <app-hero-card
        [loan]="ledgerStore.loan()"
        [currentOutstanding]="ledgerStore.currentOutstanding()"
        [isMasked]="settings.maskAccountNumber()"
        [closureDate]="simulationResult()?.closureDate"
        (toggleReveal)="settings.toggleMaskAccountNumber()"
      />

      <!-- Quick Actions Bar -->
      <div class="quick-actions-bar" role="toolbar" aria-label="Quick Actions">
        <app-chip (clicked)="openAddWith('contribution')">
          <span>＋ Contribution</span>
        </app-chip>
        <app-chip (clicked)="openAddWith('bankPayment')">
          <span>Bank Payment</span>
        </app-chip>
        <app-chip (clicked)="router.navigate(['/history'])">
          <span>History</span>
        </app-chip>
        <app-chip (clicked)="router.navigate(['/settings'])">
          <span>Update Rate</span>
        </app-chip>
        <app-chip (clicked)="router.navigate(['/insights'])">
          <span>Simulator</span>
        </app-chip>
      </div>

      <!-- This Month Card -->
      <app-glass-card [staggerIndex]="1">
        <div class="card-header-row">
          <h2 class="card-title">This Month</h2>
          <div class="header-badges-cluster">
            <span
              class="status-pill"
              [class.reconciled]="isThisMonthReconciled()"
              [class.estimated]="!isThisMonthReconciled()"
            >
              {{ isThisMonthReconciled() ? '✓ Reconciled' : 'Estimated' }}
            </span>
            <button
              type="button"
              class="method-tag clickable"
              (click)="isDailyLedgerOpen.set(true)"
              aria-label="View daily interest breakdown"
            >
              {{ methodLabel() }} 📊
            </button>
          </div>
        </div>

        <div class="key-value-list">
          <div class="kv-item">
            <span class="kv-label">Member contributions</span>
            <span class="kv-value tabular-nums">{{ formatPaise(summary().memberContributions) }}</span>
          </div>
          <div class="kv-item">
            <span class="kv-label">Paid to bank</span>
            <span class="kv-value tabular-nums">{{ formatPaise(summary().paidToBank) }}</span>
          </div>
          <div class="kv-item">
            <span class="kv-label">Interest incurred (est.)</span>
            <span class="kv-value tabular-nums">{{ formatPaise(summary().interestIncurredEst, { showPaise: true, isEstimated: true }) }}</span>
          </div>
          <div class="kv-item">
            <span class="kv-label">Principal reduced</span>
            <span class="kv-value highlight tabular-nums">{{ formatPaise(summary().principalReduced) }}</span>
          </div>
          <div class="kv-item">
            <span class="kv-label">Remaining target</span>
            <span class="kv-value tabular-nums">{{ formatPaise(summary().remainingTarget) }}</span>
          </div>
        </div>

        <div style="margin-top: 14px">
          <app-progress-bar [progressPercent]="summary().targetProgressPercent" [height]="8" />
        </div>
      </app-glass-card>

      <!-- Group Funds Card -->
      <app-glass-card [staggerIndex]="2">
        <div class="card-header-row">
          <h2 class="card-title">Group Funds</h2>
          <span class="tag-badge">Cash Pool</span>
        </div>

        <div class="group-funds-grid">
          <app-stat-tile label="Contributed" [value]="formatCompactPaise(funds().totalContributions)" />
          <app-stat-tile label="Paid to Bank" [value]="formatCompactPaise(funds().totalBankPayments)" />
          <app-stat-tile label="Unused Funds" [value]="formatCompactPaise(funds().unusedFunds)" />
        </div>

        <p class="footnote-text">
          Contributions never reduce the loan principal by themselves — only recorded bank payments do.
        </p>
      </app-glass-card>

      <!-- Projected Balance Sparkline -->
      <app-glass-card [staggerIndex]="3">
        <div class="card-header-row">
          <h2 class="card-title">Projected Balance</h2>
          <span class="method-tag">{{ formatCompactPaise(ledgerStore.loan().monthlyTarget) }}/mo · est.</span>
        </div>

        @if (simulationResult()) {
          <app-sparkline-chart [data]="simulationResult()!.schedule" />
          <div class="sparkline-footer">
            <span>Today</span>
            <span>{{ simulationResult()!.closureDate }}</span>
          </div>
          <p class="footnote-text" style="margin-top: 6px">
            Estimated future interest until payoff ≈ {{ formatPaise(simulationResult()!.totalInterest) }}
          </p>
        } @else {
          <p class="footnote-text">
            Monthly target is below monthly interest. Principal will not fall.
          </p>
        }
      </app-glass-card>

      <!-- Members Snapshot Card -->
      <app-glass-card [staggerIndex]="4">
        <div class="card-header-row">
          <h2 class="card-title">Members</h2>
          <button type="button" class="link-btn" (click)="router.navigate(['/members'])">
            See All →
          </button>
        </div>

        <div class="members-snapshot-list">
          @for (m of ledgerStore.memberStats(); track m.memberId) {
            <div class="member-snapshot-row">
              <app-avatar [name]="m.name" [colorIndex]="$index" [size]="38" />
              <div class="member-info">
                <span class="member-name">{{ m.name }}</span>
                <span class="member-sub">
                  This month {{ formatPaise(m.thisMonthContribution) }} · Lifetime {{ formatCompactPaise(m.lifetimeContribution) }}
                </span>
              </div>
              <span class="member-share tabular-nums">{{ m.sharePercentage.toFixed(1) }}%</span>
            </div>
          }
        </div>
      </app-glass-card>

      <!-- Recent Activity Card -->
      <app-glass-card [staggerIndex]="5">
        <div class="card-header-row">
          <h2 class="card-title">Recent Activity</h2>
          <button type="button" class="link-btn" (click)="router.navigate(['/history'])">
            View All →
          </button>
        </div>

        <div class="recent-tx-list">
          @for (tx of ledgerStore.recentTransactions(); track tx.id) {
            <button
              type="button"
              class="tx-row-btn"
              (click)="editSelectedTx(tx)"
            >
              <div class="tx-icon-wrap" [class.payment]="tx.type === 'bankPayment'">
                {{ tx.type === 'bankPayment' ? '🏦' : '👤' }}
              </div>
              <div class="tx-details">
                <span class="tx-title">{{ getTxTitle(tx) }}</span>
                <span class="tx-subtitle">
                  {{ tx.date }} · {{ getTransactionMode(tx) }}
                  @if (tx.type === 'bankPayment') {
                    · interest {{ formatPaise(tx.interestPortion, { showPaise: true }) }}
                  }
                </span>
              </div>
              <span
                class="tx-amount tabular-nums"
                [class.positive]="tx.type === 'contribution'"
                [class.negative]="tx.type === 'bankPayment'"
              >
                {{ tx.type === 'contribution' ? '+' : '−' }}{{ formatPaise(getTransactionAmount(tx)) }}
              </span>
            </button>
          } @empty {
            <p class="footnote-text">Nothing yet — tap ＋ to record activity.</p>
          }
        </div>
      </app-glass-card>

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
    }

    .home-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 8px 4px 18px;
    }

    .header-month {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .header-title {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.025em;
      margin: 2px 0 0;
    }

    .theme-icon-btn {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: var(--card);
      box-shadow: var(--shadow-sm);
      display: grid;
      place-items: center;
      cursor: pointer;
      font-size: 18px;
    }

    .quick-actions-bar {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      margin: 0 -16px 18px;
      padding: 4px 16px 8px;
      scrollbar-width: none;
    }

    .quick-actions-bar::-webkit-scrollbar {
      display: none;
    }

    .card-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }

    .card-title {
      font-size: 16px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.015em;
    }

    .header-badges-cluster {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: var(--radius-pill, 99px);
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .status-pill.reconciled {
      background: rgba(15, 178, 124, 0.15);
      color: var(--success);
      border: 1px solid var(--success);
    }

    .status-pill.estimated {
      background: rgba(108, 76, 255, 0.12);
      color: var(--brand-a);
      border: 1px solid rgba(108, 76, 255, 0.25);
    }

    .method-tag, .tag-badge {
      font-size: 11px;
      font-weight: 700;
      color: var(--muted);
    }

    .method-tag.clickable {
      background: rgba(108, 76, 255, 0.1);
      color: var(--brand-a);
      border: 1px solid rgba(108, 76, 255, 0.2);
      border-radius: var(--radius-pill, 99px);
      padding: 4px 10px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.2s ease;
    }

    .method-tag.clickable:hover {
      background: rgba(108, 76, 255, 0.18);
      transform: translateY(-1px);
    }

    .key-value-list {
      display: flex;
      flex-direction: column;
    }

    .kv-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-top: 1px solid var(--line);
      font-size: 13px;
    }

    .kv-item:first-child {
      border-top: none;
      padding-top: 2px;
    }

    .kv-label {
      color: var(--muted);
      font-weight: 600;
    }

    .kv-value {
      font-weight: 800;
      color: var(--ink);
    }

    .kv-value.highlight {
      color: var(--success);
    }

    .group-funds-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .footnote-text {
      font-size: 12px;
      color: var(--muted);
      margin: 12px 0 0;
      line-height: 1.45;
    }

    .sparkline-footer {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--muted);
      font-weight: 600;
      margin-top: 6px;
    }

    .link-btn {
      background: transparent;
      border: none;
      color: var(--brand-a);
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      padding: 4px 8px;
    }

    .members-snapshot-list {
      display: flex;
      flex-direction: column;
    }

    .member-snapshot-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-top: 1px solid var(--line);
    }

    .member-snapshot-row:first-child {
      border-top: none;
    }

    .member-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .member-name {
      font-size: 14px;
      font-weight: 800;
    }

    .member-sub {
      font-size: 11px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .member-share {
      font-size: 13px;
      font-weight: 800;
      color: var(--muted);
    }

    .recent-tx-list {
      display: flex;
      flex-direction: column;
    }

    .tx-row-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border: none;
      border-top: 1px solid var(--line);
      background: transparent;
      text-align: left;
      cursor: pointer;
      width: 100%;
    }

    .tx-row-btn:first-child {
      border-top: none;
    }

    .tx-icon-wrap {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: var(--bg);
      display: grid;
      place-items: center;
      font-size: 18px;
      flex-shrink: 0;
    }

    .tx-icon-wrap.payment {
      background: rgba(108, 76, 255, 0.1);
    }

    .tx-details {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .tx-title {
      font-size: 14px;
      font-weight: 800;
      color: var(--ink);
    }

    .tx-subtitle {
      font-size: 11px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tx-amount {
      font-size: 14px;
      font-weight: 800;
    }

    .tx-amount.positive {
      color: var(--success);
    }

    .tx-amount.negative {
      color: var(--ink);
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

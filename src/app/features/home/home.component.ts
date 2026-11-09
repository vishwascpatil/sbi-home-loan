import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LedgerStore, SettingsStore, UserProfileStore } from '../../core/state';
import {
  AvatarComponent,
  BottomSheetComponent,
  ConfirmSheetComponent,
  DualTrackChartComponent,
  InterestAuditChartComponent,
  MonthlyPaymentsAuditChartComponent,
  RepaymentPaceCardComponent,
} from '../../shared/ui';
import { CountUpDirective } from '../../shared/ui/count-up/count-up.directive';
import {
  divideHalfUp,
  formatCompactPaise,
  formatPaise,
  getTransactionAmount,
  getTransactionMode,
  Paise,
  paise,
  SimulationResult,
  simulateV2,
  toPaise,
  toRupees,
  Transaction,
  triggerHaptic,
} from '../../core/engine';
import { AddEditTransactionSheetComponent } from '../transaction-sheet/add-edit-transaction-sheet.component';
import { DailyLedgerSheetComponent } from '../daily-ledger/daily-ledger-sheet.component';

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CountUpDirective,
    AvatarComponent,
    BottomSheetComponent,
    ConfirmSheetComponent,
    AddEditTransactionSheetComponent,
    DailyLedgerSheetComponent,
    DualTrackChartComponent,
    RepaymentPaceCardComponent,
    InterestAuditChartComponent,
    MonthlyPaymentsAuditChartComponent,
  ],
  template: `
    <div class="home-page-container">
      <!-- Minimalist Ambient Glow -->
      <div class="ambient-backdrop" aria-hidden="true">
        <div class="ambient-orb orb-1"></div>
        <div class="ambient-orb orb-2"></div>
      </div>

      <!-- 1. Top User Profile Bar -->
      <header class="app-top-bar">
        <div
          class="user-profile-cluster"
          (click)="userProfile.openProfilePicker()"
          (keydown.enter)="userProfile.openProfilePicker()"
          role="button"
          tabindex="0"
          aria-label="Switch User Profile"
          title="Click to switch member profile"
        >
          <app-avatar [name]="userProfile.currentMemberName()" [avatarUrl]="userProfile.currentMemberAvatar()" [size]="40" [circular]="true" />
          <div class="profile-name-row">
            <h1 class="profile-user-name">{{ userProfile.currentMemberName() }}</h1>
            <span class="profile-switch-indicator">▾</span>
          </div>
        </div>

        <!-- Date Simulation Controls -->
        <div class="date-sim-ribbon" role="group" aria-label="Statement Date Simulator">
          <button
            type="button"
            class="sim-pill-btn"
            [class.active]="ledgerStore.simulatedDate() === null"
            (click)="setSimDate(null)"
            title="Real Time Clock"
          >
            Today
          </button>
          <button
            type="button"
            class="sim-pill-btn"
            [class.active]="ledgerStore.simulatedDate() === '2026-11-30'"
            (click)="setSimDate('2026-11-30')"
            title="Simulate Nov 30 (Month End Interest Added)"
          >
            Nov 30
          </button>
          <button
            type="button"
            class="sim-pill-btn"
            [class.active]="ledgerStore.simulatedDate() === '2026-12-01'"
            (click)="setSimDate('2026-12-01')"
            title="Simulate Dec 1 (Payment Due Date)"
          >
            Dec 1
          </button>
        </div>
      </header>

      <!-- Cloud Sync Warning (if unconfigured) -->
      @if (ledgerStore.storageWarning()) {
        <div class="cloud-status-banner" role="alert">
          <span class="cloud-status-icon">⚠️</span>
          <div class="cloud-status-text">
            <strong>Cloud Sync Setup Required</strong>
            <p>{{ ledgerStore.storageWarning() }}</p>
          </div>
        </div>
      }

      <!-- 2. Minimalist Obsidian Hero Card (Current Loan Balance) -->
      <div class="minimal-hero-card" role="region" aria-label="Current Loan Balance">
        <div class="hero-top-row">
          <div class="hero-rate-pill">
            <span class="lightning-bolt">⚡</span>
            <span>{{ (ledgerStore.loan().currentRateBps / 100).toFixed(2) }}% p.a. · Overdraft</span>
          </div>
          @if (ledgerStore.upcomingPayment().isSimulated) {
            <span class="hero-preview-badge">Preview: {{ ledgerStore.currentDate() }}</span>
          }
        </div>

        <div class="hero-main-stat">
          <span class="hero-stat-label">Loan Left to Pay</span>
          <div class="hero-balance-headline tabular-nums" [appCountUp]="ledgerStore.currentOutstanding()">
            {{ formatPaise(ledgerStore.currentOutstanding()) }}
          </div>
        </div>

        <div class="hero-pills-row">
          <button
            type="button"
            class="hero-glass-pill"
            (click)="isDailyLedgerOpen.set(true)"
            title="Open Daily Ledger breakdown"
          >
            <span class="pill-main tabular-nums">{{ repaidPercent().toFixed(1) }}% Cleared</span>
          </button>

          <button
            type="button"
            class="hero-glass-pill"
            (click)="scrollToDualTrack()"
            title="View OD Surplus Buffer on Chart"
          >
            <span class="pill-main tabular-nums text-emerald">{{ formatCompactPaise(odAvailableBuffer()) }} Buffer</span>
          </button>
        </div>
      </div>

      <!-- Upcoming Payment Due Card -->
      <section class="home-section upcoming-payment-section">
        <div class="upcoming-payment-card" [class.month-end-active]="ledgerStore.upcomingPayment().isMonthEnd">
          <div class="card-head-row">
            <div class="due-date-cluster">
              <span class="due-pulse-dot" [class.due-alert]="ledgerStore.upcomingPayment().isMonthEnd"></span>
              <span class="due-badge-text">
                {{ ledgerStore.upcomingPayment().daysUntilDue === 0 ? 'Payment Due Today' : 'Due ' + ledgerStore.upcomingPayment().nextDueLabel }}
              </span>
              @if (ledgerStore.upcomingPayment().isSimulated) {
                <span class="sim-badge">Simulated</span>
              }
            </div>
            <div class="interest-added-tag" title="Closing interest for {{ ledgerStore.upcomingPayment().closedMonthName }}">
              +{{ formatPaise(ledgerStore.upcomingPayment().calculatedInterest) }} Interest
            </div>
          </div>

          <div class="payment-options-toggle" role="tablist">
            <button
              type="button"
              class="pay-mode-btn"
              [class.active]="paymentPlanMode() === 'emi'"
              (click)="setPaymentPlanMode('emi')"
            >
              Bank EMI (₹1.19L)
            </button>
            <button
              type="button"
              class="pay-mode-btn"
              [class.active]="paymentPlanMode() === 'target'"
              (click)="setPaymentPlanMode('target')"
            >
              Family Target (₹2.40L)
            </button>
          </div>

          <div class="due-hero-amount">
            <span class="amount-lbl">Amount to Pay</span>
            <div class="due-amount-num tabular-nums">
              {{ formatPaise(selectedPaymentAmount()) }}
            </div>
          </div>

          <div class="payment-breakdown-row">
            <div class="breakdown-item">
              <span class="b-lbl">Interest Paid</span>
              <span class="b-val text-danger tabular-nums">
                {{ formatPaise(ledgerStore.upcomingPayment().calculatedInterest) }}
              </span>
            </div>
            <div class="breakdown-divider"></div>
            <div class="breakdown-item">
              <span class="b-lbl">Principal Reduced</span>
              <span class="b-val text-success tabular-nums">
                {{ formatPaise(selectedPrincipalReduction()) }}
              </span>
            </div>
            <div class="breakdown-divider"></div>
            <div class="breakdown-item">
              <span class="b-lbl">Balance After</span>
              <span class="b-val text-cyan tabular-nums">
                {{ formatPaise(selectedBalanceAfterPayment()) }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. Section: OD Telemetry (OD Shield & Interest Bleed) -->
      <section class="home-section">
        <div class="dual-metric-grid">
          <!-- Card 1: OD Shield -->
          <div
            class="clean-metric-card"
            (click)="isDailyLedgerOpen.set(true)"
            (keydown.enter)="isDailyLedgerOpen.set(true)"
            role="button"
            tabindex="0"
            aria-label="OD Shield Daily Interest Savings"
          >
            <div class="card-header-line">
              <span class="card-tag tag-emerald">🛡️ OD Shield</span>
              <span class="card-chevron">›</span>
            </div>
            <div class="card-metric-val tabular-nums text-emerald">
              +{{ formatCompactPaise(odDailyInterestSaved()) }}<span class="unit-sub">/day</span>
            </div>
            <span class="card-metric-sub">
              +{{ formatCompactPaise(odMonthlyInterestSaved()) }}/mo interest saved
            </span>
          </div>

          <!-- Card 2: Interest Bleed -->
          <div
            class="clean-metric-card"
            (click)="isWithdrawalSheetOpen.set(true)"
            (keydown.enter)="isWithdrawalSheetOpen.set(true)"
            role="button"
            tabindex="0"
            aria-label="OD Interest Bleed on Withdrawals"
          >
            <div class="card-header-line">
              <span class="card-tag tag-coral">Interest Bleed</span>
              <span class="card-chevron">›</span>
            </div>
            <div class="card-metric-val tabular-nums text-coral">
              −{{ formatCompactPaise(odWithdrawalSummary().currentMonthlyBleed) }}<span class="unit-sub">/mo</span>
            </div>
            <span class="card-metric-sub">
              {{ formatCompactPaise(odWithdrawalSummary().totalInterestLost) }} total penalty
            </span>
          </div>
        </div>
      </section>

      <!-- 4. Section: Repayment Pace Tracker -->
      <section class="home-section">
        <app-repayment-pace-card [pace]="ledgerStore.repaymentPace()" />
      </section>

      <!-- 5. Section: Monthly Payment Payoff Simulator -->
      <section class="home-section">
        <div class="minimal-panel-card payoff-sim-card">
          <div class="panel-header-row">
            <div class="panel-header-left">
              <span class="card-tag tag-amber">⚡ Real-Time Payoff</span>
              <h2 class="panel-title">Monthly Payoff Simulator</h2>
            </div>
            <span class="panel-amount-badge tabular-nums">
              {{ formatPaise(monthlyPayoffSliderPaise()) }}<small>/mo</small>
            </span>
          </div>

          <!-- Slider (₹50,000 to ₹5,00,000) -->
          <div class="slider-wrapper">
            <input
              type="range"
              class="minimal-slider"
              min="5000000"
              max="50000000"
              step="500000"
              [value]="monthlyPayoffSliderPaise()"
              (input)="onMonthlyPayoffSliderInput($event)"
              aria-label="Monthly Payment Amount"
            />
            <div class="slider-ends-labels">
              <span>₹50,000/mo</span>
              <span>₹2.40L (Target)</span>
              <span>₹5,00,000/mo</span>
            </div>
          </div>

          @if (payoffSimulation().isValid) {
            <!-- Real-time Results Grid -->
            <div class="sim-stats-grid four-col">
              <!-- Box 1: Time to Debt-Free -->
              <div class="sim-stat-box">
                <span class="sim-stat-number tabular-nums text-purple">
                  {{ payoffSimulation().years }} <small>yrs</small>
                </span>
                <span class="sim-stat-lbl">{{ payoffSimulation().months }} mos · {{ payoffSimulation().closureDate }}</span>
                @if (payoffSimulation().monthsSavedVsBankEmi && payoffSimulation().monthsSavedVsBankEmi! > 0) {
                  <span class="sim-stat-badge text-emerald">−{{ (payoffSimulation().monthsSavedVsBankEmi! / 12).toFixed(1) }} yrs vs EMI</span>
                }
              </div>

              <!-- Box 2: Total Interest -->
              <div class="sim-stat-box">
                <span class="sim-stat-number tabular-nums text-coral">
                  {{ formatCompactPaise(payoffSimulation().totalInterest!) }}
                </span>
                <span class="sim-stat-lbl">Total Interest</span>
                @if (payoffSimulation().interestSavedVsBankEmi && payoffSimulation().interestSavedVsBankEmi! > 0) {
                  <span class="sim-stat-badge text-emerald">Save +{{ formatCompactPaise(payoffSimulation().interestSavedVsBankEmi!) }}</span>
                }
              </div>

              <!-- Box 3: Total Principal -->
              <div class="sim-stat-box">
                <span class="sim-stat-number tabular-nums text-cyan">
                  {{ formatPaise(payoffSimulation().principal) }}
                </span>
                <span class="sim-stat-lbl">Loan Principal</span>
                <span class="sim-stat-badge text-muted">100% Cleared</span>
              </div>

              <!-- Box 4: Total Outflow -->
              <div class="sim-stat-box">
                <span class="sim-stat-number tabular-nums text-dark">
                  {{ formatCompactPaise(payoffSimulation().totalPaid!) }}
                </span>
                <span class="sim-stat-lbl">Total Outflow</span>
                <span class="sim-stat-badge text-muted">Principal + Interest</span>
              </div>
            </div>

            <!-- First Month Breakdown Pill -->
            <div class="sim-split-pill">
              <span class="split-dot"></span>
              <span class="split-text">
                Monthly Split: <strong>{{ formatPaise(payoffSimulation().firstMonthInterest) }}</strong> interest · <strong>{{ formatPaise(payoffSimulation().firstMonthPrincipalCut) }}</strong> principal reduction
              </span>
            </div>
          } @else {
            <!-- Below interest warning -->
            <div class="sim-warning-card">
              <div class="warning-icon">⚠️</div>
              <div class="warning-content">
                <strong>Payment Below Interest Bleed</strong>
                <p>
                  {{ formatPaise(monthlyPayoffSliderPaise()) }}/mo does not cover the ~{{ formatPaise(payoffSimulation().minRequired) }}/mo monthly interest charge. The loan cannot amortize at this rate.
                </p>
                <button
                  type="button"
                  class="btn-recover"
                  (click)="resetMonthlyPayoffToTarget()"
                >
                  Reset to Family Target (₹2.40L/mo)
                </button>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- 6. Section: Dual-Track Visualizer Chart -->
      <section class="home-section" id="dual-track-section">
        <app-dual-track-chart
          [sanctionedLimit]="ledgerStore.loan().sanctionedLimit"
          [currentOutstanding]="ledgerStore.currentOutstanding()"
          [initialDisbursed]="initialDisbursedAmount()"
          [points]="ledgerStore.balanceTrajectory()"
        />
      </section>

      <!-- 7. Section: Interest Audit Chart (SBI Interest Debited Each Month) -->
      <section class="home-section">
        <app-interest-audit-chart [auditSummary]="ledgerStore.sbiAuditSummary()" />
      </section>

      <!-- 8. Section: Monthly Impact & Payoff Target -->
      <section class="home-section">
        <div class="dual-metric-grid">
          <!-- Card 1: This Month -->
          <button
            type="button"
            class="clean-metric-card text-left"
            (click)="isDailyLedgerOpen.set(true)"
            aria-label="View This Month Breakdown"
          >
            <div class="card-header-line">
              <span class="card-tag tag-violet">This Month</span>
              <span class="card-chevron">›</span>
            </div>
            <div class="card-metric-val tabular-nums text-emerald" [appCountUp]="monthlyCutCalculation().totalCut">
              {{ formatCompactPaise(monthlyCutCalculation().totalCut) }}
            </div>
            <span class="card-metric-sub">
              {{ monthlyCutCalculation().isRecorded ? 'Paid to SBI this month' : 'Target monthly cut' }}
            </span>
            <div class="metric-split-row">
              <div class="split-side">
                <span class="split-val tabular-nums text-emerald">
                  {{ formatCompactPaise(monthlyCutCalculation().principalCut) }}
                </span>
                <span class="split-lbl">Principal</span>
              </div>
              <div class="split-side text-right">
                <span class="split-val tabular-nums">
                  {{ formatCompactPaise(monthlyCutCalculation().interestCut) }}
                </span>
                <span class="split-lbl">Interest</span>
              </div>
            </div>
          </button>

          <!-- Card 2: Debt Free -->
          <div class="clean-metric-card" aria-label="Loan Payoff Target">
            <div class="card-header-line">
              <span class="card-tag tag-neutral">Debt Free</span>
              <span class="badge-mini">{{ ledgerStore.currentOutstanding() === 0 ? 'Debt Free!' : (baselineSimResult()?.closureDate || 'Active') }}</span>
            </div>
            <div class="card-metric-val tabular-nums">
              {{ ledgerStore.currentOutstanding() === 0 ? '0.0 yrs' : (((baselineSimResult()?.months ?? 61)) / 12).toFixed(1) + ' yrs' }}
            </div>
            <span class="card-metric-sub">
              {{ ledgerStore.currentOutstanding() === 0 ? 'Loan 100% Cleared!' : ((baselineSimResult()?.months ?? 61) + ' mos remaining') }}
            </span>
            <div class="metric-split-row">
              <div class="split-side">
                <span class="split-val tabular-nums">
                  {{ baselineSimResult() ? formatCompactPaise(baselineSimResult()!.totalInterest) : '—' }}
                </span>
                <span class="split-lbl">Est. Interest</span>
              </div>
              <div class="split-side text-right">
                <span class="split-val tabular-nums">
                  {{ baselineSimResult() ? formatCompactPaise(baselineSimResult()!.totalPaid) : '—' }}
                </span>
                <span class="split-lbl">Outflow</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 9. Section: Monthly Payments Audit Chart -->
      <section class="home-section">
        <app-monthly-payments-audit-chart [paymentsSummary]="ledgerStore.sbiPaymentsSummary()" />
      </section>

      <!-- 10. Direct Link to Statements & Passbook -->
      <section class="home-section">
        <div
          class="statements-nav-card"
          (click)="router.navigate(['/statements'])"
          (keydown.enter)="router.navigate(['/statements'])"
          role="button"
          tabindex="0"
          aria-label="Open Account Statements"
        >
          <div class="stmt-nav-left">
            <div class="stmt-icon-box">📄</div>
            <div class="stmt-text-box">
              <h3 class="stmt-heading">Account Statements & Passbook</h3>
              <span class="badge-mini">Passbook · Monthly · Tax ›</span>
            </div>
          </div>
          <span class="stmt-arrow">›</span>
        </div>
      </section>

      <!-- 11. Section: Recent Payments -->
      <section class="home-section">
        <div class="section-title-bar">
          <h2 class="section-heading">Recent Payments</h2>
          <button type="button" class="section-link-btn" (click)="router.navigate(['/members/history'])">
            History ›
          </button>
        </div>

        <div class="activity-list">
          @for (tx of ledgerStore.recentTransactions(); track tx.id) {
            <div class="activity-row">
              <button
                type="button"
                class="activity-tap-target"
                (click)="editSelectedTx(tx)"
                [attr.aria-label]="'Edit payment ' + getTxTitle(tx)"
              >
                <div class="activity-left">
                  <div class="activity-icon-bubble" [class.payment]="tx.type === 'bankPayment'">
                    {{ tx.type === 'bankPayment' ? '🏦' : '👤' }}
                  </div>
                  <div class="activity-meta">
                    <span class="activity-title">{{ getTxTitle(tx) }}</span>
                    <span class="activity-sub">{{ tx.date }} · {{ getTransactionMode(tx) }}</span>
                  </div>
                </div>
                <div class="activity-right">
                  <span
                    class="activity-amt tabular-nums"
                    [class.text-emerald]="tx.type === 'contribution'"
                    [class.text-dark]="tx.type === 'bankPayment'"
                  >
                    {{ tx.type === 'contribution' ? '+' : '−' }}{{ formatPaise(getTransactionAmount(tx)) }}
                  </span>
                  <span class="activity-chevron">›</span>
                </div>
              </button>

              <button
                type="button"
                class="activity-del-btn"
                (click)="promptDeleteTx(tx, $event)"
                aria-label="Delete this payment"
                title="Delete payment"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          } @empty {
            <div class="empty-state-card">
              <p class="empty-hint">No payments recorded yet.</p>
            </div>
          }
        </div>
      </section>

      <!-- Modals and Bottom Sheets -->
      <app-confirm-sheet
        [isOpen]="isDeleteModalOpen()"
        title="Delete Payment"
        [message]="deleteModalMessage()"
        confirmText="Yes, Delete Payment"
        [isDanger]="true"
        (confirmed)="executeDeleteTx()"
        (cancelled)="isDeleteModalOpen.set(false); txToDelete.set(null)"
      />

      <app-add-edit-transaction-sheet
        [isOpen]="isSheetOpen()"
        [editTransaction]="selectedTxForEdit()"
        [initialType]="initialSheetType()"
        (dismissed)="isSheetOpen.set(false); selectedTxForEdit.set(null)"
      />

      <app-daily-ledger-sheet
        [isOpen]="isDailyLedgerOpen()"
        (dismissed)="isDailyLedgerOpen.set(false)"
      />

      <!-- OD Forensic Breakdown Sheet -->
      <app-bottom-sheet
        [isOpen]="isWithdrawalSheetOpen()"
        title="OD Withdrawals & Interest Lost"
        (dismissed)="isWithdrawalSheetOpen.set(false)"
      >
        <div class="sheet-forensic-container">
          <div class="forensic-top-chips">
            <div class="forensic-chip">
              <span class="f-chip-val tabular-nums">−{{ formatCompactPaise(odWithdrawalSummary().netWithdrawn) }}</span>
              <span class="f-chip-lbl">Total Withdrawn</span>
            </div>
            <div class="forensic-chip chip-danger">
              <span class="f-chip-val tabular-nums text-coral">₹1.29L</span>
              <span class="f-chip-lbl">Interest Lost</span>
            </div>
            <div class="forensic-chip chip-amber">
              <span class="f-chip-val tabular-nums text-amber">−₹6,893</span>
              <span class="f-chip-lbl">Bleed / Month</span>
            </div>
          </div>

          <div class="forensic-items-list">
            @for (rec of odWithdrawalSummary().records; track rec.id) {
              <div class="forensic-row">
                <div class="f-row-left">
                  <div class="f-icon-bubble">{{ rec.categoryIcon }}</div>
                  <div class="f-meta">
                    <span class="f-title">{{ rec.categoryLabel }}</span>
                    <span class="f-dest">{{ rec.date }} · {{ rec.destination }}</span>
                  </div>
                </div>
                <div class="f-row-right">
                  <span class="f-amount tabular-nums">−{{ formatPaise(rec.amount) }}</span>
                  <span class="f-penalty tabular-nums">+{{ formatPaise(rec.cumulativeInterestLost) }} lost</span>
                </div>
              </div>
            }
          </div>
        </div>
      </app-bottom-sheet>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: var(--bg, #f4f1ec);
      color: var(--ink, #15172b);
    }

    .home-page-container {
      position: relative;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow-x: hidden;
      padding: 0 0 114px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Ambient Canvas */
    .ambient-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 380px;
      overflow: hidden;
      pointer-events: none;
      z-index: 0;
    }

    .ambient-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.12;
    }

    .orb-1 {
      width: 280px;
      height: 280px;
      background: #6c4cff;
      top: -60px;
      right: -40px;
    }

    .orb-2 {
      width: 220px;
      height: 220px;
      background: #0fb27c;
      top: 40px;
      left: -50px;
    }

    /* 1. Header Bar */
    .app-top-bar {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 4px;
      flex-wrap: wrap;
      gap: 10px;
    }

    .date-sim-ribbon {
      display: flex;
      align-items: center;
      gap: 3px;
      background: var(--card, #ffffff);
      padding: 3px;
      border-radius: 99px;
      border: 1px solid var(--line, rgba(0, 0, 0, 0.08));
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
    }

    .sim-pill-btn {
      background: transparent;
      border: none;
      padding: 4px 10px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
      color: var(--muted, #767a90);
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        color: var(--ink, #15172b);
      }

      &.active {
        background: var(--ink, #15172b);
        color: #ffffff;
        box-shadow: 0 2px 6px rgba(21, 23, 43, 0.18);
      }
    }

    .user-profile-cluster {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 99px;
      transition: background 0.15s ease;
      background: transparent;
    }

    .user-profile-cluster:hover {
      background: rgba(0, 0, 0, 0.04);
    }

    .profile-text-wrap {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .profile-greeting {
      font-size: 11.5px;
      color: var(--muted, #767a90);
      font-weight: 500;
      letter-spacing: 0.02em;
    }

    .profile-name-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .profile-user-name {
      font-size: 15.5px;
      font-weight: 700;
      color: var(--ink, #15172b);
      margin: 0;
    }

    .profile-switch-indicator {
      font-size: 10px;
      color: var(--muted, #767a90);
    }

    /* Cloud Banner */
    .cloud-status-banner {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #fff8e6;
      border: 1px solid #ffd591;
      border-radius: 14px;
      padding: 10px 14px;
      font-size: 12px;
      color: #873800;
    }

    /* 2. Hero Card */
    .minimal-hero-card {
      position: relative;
      z-index: 1;
      background: linear-gradient(145deg, #10121a 0%, #171b28 100%);
      border-radius: 24px;
      padding: 22px 20px 20px;
      color: #ffffff;
      box-shadow: 0 10px 28px rgba(10, 12, 21, 0.18);
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: 100%;
      box-sizing: border-box;
    }

    .hero-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .hero-preview-badge {
      font-size: 10.5px;
      font-weight: 700;
      color: #ffd591;
      background: rgba(212, 107, 8, 0.25);
      border: 1px solid rgba(255, 179, 102, 0.4);
      padding: 3px 8px;
      border-radius: 99px;
      letter-spacing: 0.02em;
    }

    .hero-rate-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.14);
      padding: 4px 11px;
      border-radius: 99px;
      font-size: 11.5px;
      font-weight: 600;
      color: #e2e8f0;
      backdrop-filter: blur(10px);
    }

    .lightning-bolt {
      color: #f59e0b;
      font-size: 11px;
    }

    /* Upcoming Payment Card */
    .upcoming-payment-section {
      margin-top: -4px;
    }

    .upcoming-payment-card {
      background: var(--card, #ffffff);
      border-radius: 22px;
      padding: 16px 18px;
      border: 1px solid var(--line, rgba(0, 0, 0, 0.08));
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.04);
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;

      &.month-end-active {
        border: 1px solid rgba(108, 76, 255, 0.35);
        background: linear-gradient(180deg, rgba(108, 76, 255, 0.03) 0%, var(--card, #ffffff) 100%);
        box-shadow: 0 6px 22px rgba(108, 76, 255, 0.12);
      }
    }

    .card-head-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .due-date-cluster {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .due-pulse-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #0fb27c;

      &.due-alert {
        background: #6c4cff;
        box-shadow: 0 0 8px rgba(108, 76, 255, 0.8);
        animation: pulseDot 2s infinite ease-in-out;
      }
    }

    @keyframes pulseDot {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.3); opacity: 0.7; }
    }

    .due-badge-text {
      font-size: 12px;
      font-weight: 700;
      color: var(--ink, #15172b);
    }

    .sim-badge {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 99px;
      background: #fff3d6;
      color: #946200;
      border: 1px solid #ffd591;
    }

    .interest-added-tag {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 99px;
      background: rgba(238, 77, 107, 0.1);
      color: #ee4d6b;
    }

    .payment-options-toggle {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      background: var(--bg, #f4f1ec);
      padding: 3px;
      border-radius: 12px;
    }

    .pay-mode-btn {
      background: transparent;
      border: none;
      padding: 6px 10px;
      border-radius: 9px;
      font-size: 11.5px;
      font-weight: 600;
      color: var(--muted, #767a90);
      cursor: pointer;
      transition: all 0.15s ease;

      &.active {
        background: var(--card, #ffffff);
        color: var(--ink, #15172b);
        font-weight: 700;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
      }
    }

    .due-hero-amount {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 2px 0;
    }

    .amount-lbl {
      font-size: 11px;
      font-weight: 600;
      color: var(--muted, #767a90);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .due-amount-num {
      font-size: 26px;
      font-weight: 800;
      color: var(--ink, #15172b);
      letter-spacing: -0.02em;
    }

    .payment-breakdown-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 10px;
      border-top: 1px solid var(--line, rgba(0, 0, 0, 0.06));
      gap: 6px;
    }

    .breakdown-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;

      .b-lbl {
        font-size: 10.5px;
        color: var(--muted, #767a90);
        font-weight: 500;
      }

      .b-val {
        font-size: 12px;
        font-weight: 700;
      }
    }

    .breakdown-divider {
      width: 1px;
      height: 24px;
      background: var(--line, rgba(0, 0, 0, 0.08));
    }

    .hero-main-stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .hero-stat-label {
      font-size: 12.5px;
      color: rgba(255, 255, 255, 0.65);
      font-weight: 500;
      letter-spacing: 0.01em;
    }

    .hero-balance-headline {
      font-size: 34px;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.1;
      color: #ffffff;
    }

    .hero-pills-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .hero-glass-pill {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      text-align: left;
      cursor: pointer;
      color: #ffffff;
      transition: background 0.15s ease, transform 0.1s ease;
    }

    .hero-glass-pill:hover {
      background: rgba(255, 255, 255, 0.13);
    }

    .hero-glass-pill:active {
      transform: scale(0.98);
    }

    .pill-main {
      font-size: 13.5px;
      font-weight: 700;
    }

    .pill-sub {
      font-size: 10.5px;
      color: rgba(255, 255, 255, 0.65);
      margin-top: 1px;
    }

    /* Section Wrapper */
    .home-section {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
    }

    /* Dual Metric Grid (Used for OD Telemetry & This Month/Debt Free) */
    .dual-metric-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .clean-metric-card {
      background: var(--card, #ffffff);
      border: 1px solid rgba(0, 0, 0, 0.05);
      border-radius: 20px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      text-align: left;
      font-family: inherit;
    }

    .clean-metric-card:hover {
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
    }

    .clean-metric-card:active {
      transform: scale(0.985);
    }

    .card-header-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2px;
    }

    .card-tag {
      font-size: 11.5px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 8px;
    }

    .tag-emerald { background: rgba(15, 178, 124, 0.1); color: #0fb27c; }
    .tag-coral { background: rgba(238, 77, 107, 0.1); color: #ee4d6b; }
    .tag-amber { background: rgba(245, 158, 11, 0.1); color: #d97706; }
    .tag-violet { background: rgba(108, 76, 255, 0.1); color: #6c4cff; }
    .tag-neutral { background: rgba(118, 122, 144, 0.1); color: #767a90; }

    .card-chevron {
      color: var(--muted, #767a90);
      font-size: 16px;
      line-height: 1;
    }

    .badge-mini {
      font-size: 10px;
      font-weight: 700;
      background: rgba(0, 0, 0, 0.04);
      padding: 2px 7px;
      border-radius: 99px;
      color: var(--muted, #767a90);
    }

    .card-metric-val {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--ink, #15172b);
    }

    .unit-sub {
      font-size: 12px;
      font-weight: 600;
      color: var(--muted, #767a90);
      margin-left: 2px;
    }

    .card-metric-sub {
      font-size: 11px;
      color: var(--muted, #767a90);
      line-height: 1.3;
    }

    .metric-split-row {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid rgba(0, 0, 0, 0.04);
      padding-top: 8px;
      margin-top: 4px;
    }

    .split-side {
      display: flex;
      flex-direction: column;
    }

    .split-val {
      font-size: 12.5px;
      font-weight: 700;
      color: var(--ink, #15172b);
    }

    .split-lbl {
      font-size: 10px;
      color: var(--muted, #767a90);
    }

    /* Payback Panel Card */
    .minimal-panel-card {
      background: var(--card, #ffffff);
      border: 1px solid rgba(0, 0, 0, 0.05);
      border-radius: 22px;
      padding: 18px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
      display: flex;
      flex-direction: column;
      gap: 14px;
      width: 100%;
      box-sizing: border-box;
    }

    .panel-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }

    .panel-header-left {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .panel-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--ink, #15172b);
      margin: 0;
    }

    .panel-amount-badge {
      background: #f8f9fc;
      border: 1px solid rgba(0, 0, 0, 0.06);
      padding: 6px 12px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 800;
      color: var(--ink, #15172b);
      white-space: nowrap;
    }

    .slider-wrapper {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .minimal-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 99px;
      background: #e2e8f0;
      outline: none;
    }

    .minimal-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #6c4cff;
      border: 3px solid #ffffff;
      box-shadow: 0 2px 6px rgba(108, 76, 255, 0.4);
      cursor: pointer;
    }

    .minimal-slider::-moz-range-thumb {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #6c4cff;
      border: 3px solid #ffffff;
      box-shadow: 0 2px 6px rgba(108, 76, 255, 0.4);
      cursor: pointer;
    }

    .slider-ends-labels {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      color: var(--muted, #767a90);
      font-weight: 500;
    }

    .sim-stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;

      @media (min-width: 480px) {
        grid-template-columns: repeat(4, 1fr);
      }
    }

    .sim-stat-box {
      background: var(--bg, #f8f9fc);
      border: 1px solid var(--line, rgba(0, 0, 0, 0.05));
      border-radius: 16px;
      padding: 12px 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 3px;
    }

    .sim-stat-number {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: -0.01em;

      small {
        font-size: 11px;
        font-weight: 600;
      }
    }

    .sim-stat-lbl {
      font-size: 9.5px;
      color: var(--muted, #767a90);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .sim-stat-badge {
      font-size: 9px;
      font-weight: 700;
      margin-top: 2px;
      padding: 1px 6px;
      border-radius: 99px;
      background: rgba(0, 0, 0, 0.04);
      white-space: nowrap;

      &.text-emerald {
        background: rgba(15, 178, 124, 0.1);
        color: #0fb27c;
      }

      &.text-muted {
        color: var(--muted, #767a90);
      }
    }

    .sim-split-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(108, 76, 255, 0.05);
      border: 1px solid rgba(108, 76, 255, 0.15);
      border-radius: 12px;
      padding: 8px 12px;
      font-size: 11px;
      color: var(--ink, #15172b);

      .split-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #6c4cff;
        flex-shrink: 0;
      }

      .split-text strong {
        font-weight: 700;
      }
    }

    .sim-warning-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: #fff8e6;
      border: 1px solid #ffd591;
      border-radius: 16px;
      padding: 14px;
      color: #873800;

      .warning-icon {
        font-size: 18px;
        line-height: 1;
      }

      .warning-content {
        display: flex;
        flex-direction: column;
        gap: 6px;

        strong {
          font-size: 13px;
          font-weight: 700;
        }

        p {
          font-size: 11.5px;
          line-height: 1.4;
          margin: 0;
        }

        .btn-recover {
          align-self: flex-start;
          background: #873800;
          color: #ffffff;
          border: none;
          padding: 5px 12px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 4px;
        }
      }
    }

    /* Statements Nav Card */
    .statements-nav-card {
      background: var(--card, #ffffff);
      border: 1px solid rgba(0, 0, 0, 0.05);
      border-radius: 20px;
      padding: 14px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .statements-nav-card:hover {
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
    }

    .statements-nav-card:active {
      transform: scale(0.985);
    }

    .stmt-nav-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .stmt-icon-box {
      font-size: 22px;
      width: 42px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f4f1ec;
      border-radius: 14px;
    }

    .stmt-text-box {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .stmt-heading {
      font-size: 14px;
      font-weight: 700;
      color: var(--ink, #15172b);
      margin: 0;
    }

    .stmt-sub {
      font-size: 11px;
      color: var(--muted, #767a90);
      margin: 0;
    }

    .stmt-arrow {
      font-size: 18px;
      color: var(--muted, #767a90);
    }

    /* Recent Payments Feed */
    .section-title-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 2px;
    }

    .section-heading {
      font-size: 16px;
      font-weight: 700;
      color: var(--ink, #15172b);
      margin: 0;
    }

    .section-link-btn {
      background: none;
      border: none;
      color: var(--muted, #767a90);
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      padding: 4px;
    }

    .section-link-btn:hover {
      color: var(--ink, #15172b);
    }

    .activity-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .activity-row {
      display: flex;
      align-items: center;
      background: var(--card, #ffffff);
      border: 1px solid rgba(0, 0, 0, 0.05);
      border-radius: 18px;
      padding: 10px 14px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
      transition: transform 0.1s ease;
      content-visibility: auto;
      contain-intrinsic-size: 0 64px;
    }

    .activity-tap-target {
      flex: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
    }

    .activity-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .activity-icon-bubble {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      background: rgba(15, 178, 124, 0.1);
    }

    .activity-icon-bubble.payment {
      background: rgba(108, 76, 255, 0.1);
    }

    .activity-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .activity-title {
      font-size: 13.5px;
      font-weight: 700;
      color: var(--ink, #15172b);
    }

    .activity-sub {
      font-size: 11px;
      color: var(--muted, #767a90);
    }

    .activity-right {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .activity-amt {
      font-size: 14px;
      font-weight: 800;
    }

    .activity-chevron {
      color: var(--muted, #767a90);
      font-size: 16px;
    }

    .activity-del-btn {
      background: none;
      border: none;
      color: var(--muted, #767a90);
      cursor: pointer;
      padding: 8px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.6;
      transition: opacity 0.15s ease, color 0.15s ease;
    }

    .activity-del-btn:hover {
      opacity: 1;
      color: #ee4d6b;
    }

    .empty-state-card {
      background: var(--card, #ffffff);
      border-radius: 18px;
      padding: 24px;
      text-align: center;
      color: var(--muted, #767a90);
      font-size: 13px;
    }

    /* Forensic Sheet Inside */
    .sheet-forensic-container {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 6px 4px 24px;
    }

    .forensic-top-chips {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .forensic-chip {
      background: #f8f8fc;
      border-radius: 14px;
      padding: 10px 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 2px;
    }

    .f-chip-val {
      font-size: 13px;
      font-weight: 800;
      color: var(--ink, #15172b);
    }

    .f-chip-lbl {
      font-size: 9.5px;
      color: var(--muted, #767a90);
      font-weight: 600;
      text-transform: uppercase;
    }

    .forensic-items-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 420px;
      overflow-y: auto;
    }

    .forensic-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      background: #f8f8fc;
      border-radius: 14px;
    }

    .f-row-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .f-icon-bubble {
      font-size: 18px;
    }

    .f-meta {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .f-title {
      font-size: 12.5px;
      font-weight: 700;
      color: var(--ink, #15172b);
    }

    .f-dest {
      font-size: 10.5px;
      color: var(--muted, #767a90);
    }

    .f-row-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 1px;
    }

    .f-amount {
      font-size: 13px;
      font-weight: 800;
      color: #ee4d6b;
    }

    .f-penalty {
      font-size: 10px;
      font-weight: 700;
      color: #d97706;
    }

    /* Common Utilities */
    .text-emerald { color: #0fb27c !important; }
    .text-coral { color: #ee4d6b !important; }
    .text-cyan { color: #06b6d4 !important; }
    .text-purple { color: #6c4cff !important; }
    .text-amber { color: #f59e0b !important; }
    .text-dark { color: var(--ink, #15172b) !important; }
    .tabular-nums { font-variant-numeric: tabular-nums; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
  `,
})
export class HomeComponent {
  readonly ledgerStore = inject(LedgerStore);
  readonly userProfile = inject(UserProfileStore);
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

  readonly paymentPlanMode = signal<'emi' | 'target'>('target');

  setPaymentPlanMode(mode: 'emi' | 'target'): void {
    triggerHaptic('light');
    this.paymentPlanMode.set(mode);
  }

  setSimDate(date: string | null): void {
    triggerHaptic('medium');
    this.ledgerStore.setSimulatedDate(date);
  }

  readonly selectedPaymentAmount = computed<Paise>(() =>
    this.paymentPlanMode() === 'emi'
      ? this.ledgerStore.upcomingPayment().bankRegularEmi
      : this.ledgerStore.upcomingPayment().familyTarget
  );

  readonly selectedPrincipalReduction = computed<Paise>(() =>
    this.paymentPlanMode() === 'emi'
      ? this.ledgerStore.upcomingPayment().bankEmiPrincipalReduction
      : this.ledgerStore.upcomingPayment().targetPrincipalReduction
  );

  readonly selectedBalanceAfterPayment = computed<Paise>(() =>
    this.paymentPlanMode() === 'emi'
      ? this.ledgerStore.upcomingPayment().balanceAfterBankEmi
      : this.ledgerStore.upcomingPayment().balanceAfterTarget
  );

  scrollToDualTrack(): void {
    triggerHaptic('light');
    document.getElementById('dual-track-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  readonly isDeleteModalOpen = signal<boolean>(false);
  readonly txToDelete = signal<Transaction | null>(null);

  readonly deleteModalMessage = computed(() => {
    const tx = this.txToDelete();
    if (!tx) return '';
    return `Are you sure you want to delete this payment of ${formatPaise(getTransactionAmount(tx))} (${this.getTxTitle(tx)})? All loan balances will automatically recalculate.`;
  });

  readonly summary = this.ledgerStore.thisMonthSummary;

  readonly initialDisbursedAmount = computed<Paise>(() => this.ledgerStore.loan().initialDisbursed || toPaise(13300000));

  readonly monthlyTargetPaise = computed<Paise>(() => this.ledgerStore.loan().monthlyTarget || toPaise(240000));

  readonly monthlyCutCalculation = computed(() => {
    const sum = this.summary();
    const loan = this.ledgerStore.loan();
    const principal = this.ledgerStore.currentOutstanding();
    const rateBps = loan.currentRateBps;

    let estInterest = sum.interestIncurredEst;
    if (estInterest <= 0 && principal > 0 && rateBps > 0) {
      estInterest = paise(Math.round((principal * rateBps) / (12 * 10000)));
    }

    const target = this.monthlyTargetPaise();
    const hasRecordedPayment = sum.paidToBank > 0;

    const totalCut = hasRecordedPayment ? sum.paidToBank : target;
    let interestCut: Paise;
    let principalCut: Paise;

    if (hasRecordedPayment) {
      interestCut = paise(Math.min(sum.paidToBank, estInterest));
      principalCut = paise(Math.max(0, sum.paidToBank - interestCut));
    } else {
      interestCut = paise(Math.min(target, estInterest));
      principalCut = paise(Math.max(0, target - interestCut));
    }

    return {
      isRecorded: hasRecordedPayment,
      totalCut,
      principalCut,
      interestCut,
    };
  });

  readonly dailyInterestCalculation = computed(() => {
    const loan = this.ledgerStore.loan();
    const principal = this.ledgerStore.currentPrincipal();
    const rateBps = loan.currentRateBps;
    const basisDays = loan.bankRules?.dayCountBasis === '360' ? 360 : 365;

    let dailyInterest = paise(0);
    if (principal > 0 && rateBps > 0) {
      const numerator = BigInt(principal) * BigInt(rateBps) * 1_000_000n;
      const denominator = BigInt(basisDays) * 10_000n;
      const scaled = numerator / denominator;
      dailyInterest = paise(Number(divideHalfUp(scaled, 1_000_000n)));
    }

    const sum = this.summary();
    let monthlyEstimate = sum.interestIncurredEst;
    if (monthlyEstimate <= 0 && principal > 0 && rateBps > 0) {
      const numMonth = BigInt(principal) * BigInt(rateBps) * 1_000_000n;
      const denMonth = 12n * 10_000n * 1_000_000n;
      monthlyEstimate = paise(Number(divideHalfUp(numMonth, denMonth)));
    }

    return {
      dailyInterest,
      monthlyEstimate,
      rateBps,
    };
  });

  readonly isWithdrawalSheetOpen = signal<boolean>(false);
  readonly odWithdrawalSummary = this.ledgerStore.odWithdrawalsSummary;

  readonly monthlyPayoffSliderPaise = signal<Paise>(toPaise(240000));

  onMonthlyPayoffSliderInput(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    this.monthlyPayoffSliderPaise.set(paise(val));
    triggerHaptic('light');
  }

  resetMonthlyPayoffToTarget(): void {
    this.monthlyPayoffSliderPaise.set(toPaise(240000));
    triggerHaptic('medium');
  }

  /**
   * Minimum required monthly payment to cover current interest bleed.
   */
  readonly minimumRequiredMonthlyPayment = computed<Paise>(() => {
    const principal = this.ledgerStore.currentOutstanding();
    const rateBps = this.ledgerStore.loan().currentRateBps;
    if (principal <= 0 || rateBps <= 0) return paise(0);
    const monthlyRate = rateBps / (12 * 10000);
    return paise(Math.ceil(principal * monthlyRate));
  });

  /**
   * Baseline bank regular EMI simulation for comparison.
   */
  readonly bankEmiSimResult = computed<SimulationResult | null>(() => {
    const principal = this.ledgerStore.currentOutstanding();
    const rateBps = this.ledgerStore.loan().currentRateBps;
    const regularEmi = this.ledgerStore.loan().regularEmi || toPaise(118900);
    return simulateV2({
      principal,
      monthlyPayment: regularEmi,
      rateBps,
      paymentDayOfMonth: 5,
      rateShiftBps: 0,
      prepayments: [],
      drawdowns: [],
      dayCountBasis: this.ledgerStore.loan().bankRules?.dayCountBasis || 'actual/365',
    });
  });

  /**
   * Real-time payoff simulation for the chosen monthly payment (₹50k to ₹5L/mo).
   */
  readonly payoffSimulation = computed(() => {
    const principal = this.ledgerStore.currentOutstanding();
    const rateBps = this.ledgerStore.loan().currentRateBps;
    const monthlyPayment = this.monthlyPayoffSliderPaise();
    const minRequired = this.minimumRequiredMonthlyPayment();

    if (monthlyPayment <= minRequired) {
      return {
        isValid: false,
        monthlyPayment,
        minRequired,
        firstMonthInterest: minRequired,
        principal,
        months: null,
        years: null,
        closureDate: null,
        totalInterest: null,
        totalPaid: null,
        interestSavedVsBankEmi: null,
        monthsSavedVsBankEmi: null,
        firstMonthPrincipalCut: paise(0),
      };
    }

    const sim = simulateV2({
      principal,
      monthlyPayment,
      rateBps,
      paymentDayOfMonth: 5,
      rateShiftBps: 0,
      prepayments: [],
      drawdowns: [],
      dayCountBasis: this.ledgerStore.loan().bankRules?.dayCountBasis || 'actual/365',
    });

    if (!sim) {
      return {
        isValid: false,
        monthlyPayment,
        minRequired,
        firstMonthInterest: minRequired,
        principal,
        months: null,
        years: null,
        closureDate: null,
        totalInterest: null,
        totalPaid: null,
        interestSavedVsBankEmi: null,
        monthsSavedVsBankEmi: null,
        firstMonthPrincipalCut: paise(0),
      };
    }

    const bankSim = this.bankEmiSimResult();
    let interestSavedVsBankEmi: Paise | null = null;
    let monthsSavedVsBankEmi: number | null = null;

    if (bankSim) {
      const diffInterest = bankSim.totalInterest - sim.totalInterest;
      interestSavedVsBankEmi = paise(diffInterest);
      monthsSavedVsBankEmi = Math.max(0, bankSim.months - sim.months);
    }

    const firstMonthPrincipalCut = paise(Math.max(0, monthlyPayment - minRequired));

    return {
      isValid: true,
      monthlyPayment,
      minRequired,
      firstMonthInterest: minRequired,
      principal,
      months: sim.months,
      years: (sim.months / 12).toFixed(1),
      closureDate: sim.closureDate,
      totalInterest: sim.totalInterest,
      totalPaid: sim.totalPaid,
      interestSavedVsBankEmi,
      monthsSavedVsBankEmi,
      firstMonthPrincipalCut,
    };
  });

  readonly odAvailableBuffer = computed<Paise>(() => {
    const lim = this.ledgerStore.loan().sanctionedLimit;
    const out = this.ledgerStore.currentOutstanding();
    return Math.max(0, lim - out) as Paise;
  });

  readonly odDailyInterestSaved = computed<Paise>(() => {
    const buffer = this.odAvailableBuffer();
    const rateBps = this.ledgerStore.loan().currentRateBps;
    return paise(Math.round((buffer * rateBps) / (10000 * 365)));
  });

  readonly odMonthlyInterestSaved = computed<Paise>(() => {
    const buffer = this.odAvailableBuffer();
    const rateBps = this.ledgerStore.loan().currentRateBps;
    return paise(Math.round((buffer * rateBps) / (10000 * 12)));
  });

  readonly repaidAmount = computed<Paise>(() => {
    const initial = this.ledgerStore.loan().initialDisbursed || toPaise(13300000);
    const out = this.ledgerStore.currentOutstanding();
    return Math.max(0, initial - out) as Paise;
  });

  readonly repaidPercent = computed(() => {
    const initial = this.ledgerStore.loan().initialDisbursed || toPaise(13300000);
    if (initial <= 0) return 0;
    return (this.repaidAmount() / initial) * 100;
  });

  readonly targetValueRupees = computed(() => {
    return this.monthlyTargetPaise() / 100;
  });

  readonly thisMonthPacingPercent = computed(() => {
    const target = this.monthlyTargetPaise();
    if (target <= 0) return 0;
    const paid = this.summary().paidToBank;
    return Math.min(100, (paid / target) * 100);
  });

  readonly baselineSimResult = computed(() => {
    const principal = this.ledgerStore.currentOutstanding();
    const rateBps = this.ledgerStore.loan().currentRateBps;
    const monthlyTarget = this.ledgerStore.loan().monthlyTarget || toPaise(240000);
    return simulateV2({
      principal,
      monthlyPayment: monthlyTarget,
      rateBps,
      paymentDayOfMonth: 5,
      rateShiftBps: 0,
      prepayments: [],
      drawdowns: [],
      dayCountBasis: this.ledgerStore.loan().bankRules?.dayCountBasis || 'actual/365',
    });
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

  promptDeleteTx(tx: Transaction, event: Event): void {
    event.stopPropagation();
    this.txToDelete.set(tx);
    this.isDeleteModalOpen.set(true);
  }

  async executeDeleteTx(): Promise<void> {
    const tx = this.txToDelete();
    if (!tx) return;
    try {
      await this.ledgerStore.deleteTransaction(tx.id);
      this.isDeleteModalOpen.set(false);
      this.txToDelete.set(null);
    } catch {
      this.isDeleteModalOpen.set(false);
      this.txToDelete.set(null);
    }
  }

  getTxTitle(tx: Transaction): string {
    if (tx.type === 'contribution') {
      const member = this.ledgerStore.members().find((m) => m.id === tx.memberId);
      return member ? `${member.name} (Deposit)` : 'Member Deposit';
    }
    if (tx.type === 'bankPayment') {
      if (tx.notes && tx.notes.includes('Direct Statement')) return 'Direct Statement Deposit';
      return 'Payment to Bank (EMI)';
    }
    if (tx.type === 'withdrawal') return 'Money Withdrawn';
    if (tx.type === 'principalAdjustment') return 'Balance Adjustment';
    if (tx.type === 'manualCorrection') return 'Bank Passbook Match';
    return 'Payment';
  }
}

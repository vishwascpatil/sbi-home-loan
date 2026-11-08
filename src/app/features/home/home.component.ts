import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LedgerStore, SettingsStore, UserProfileStore } from '../../core/state';
import {
  AvatarComponent,
  BarChartComponent,
  BottomSheetComponent,
  ConfirmSheetComponent,
  DualTrackChartComponent,
  InterestAuditChartComponent,
  RepaymentPaceCardComponent,
} from '../../shared/ui';
import { CountUpDirective } from '../../shared/ui/count-up/count-up.directive';
import {
  ContributionTransaction,
  divideHalfUp,
  formatCompactPaise,
  formatPaise,
  getOdWithdrawalsSummary,
  getTransactionAmount,
  getTransactionMode,
  Paise,
  paise,
  simulatePayback,
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
    RouterLink,
    CountUpDirective,
    BarChartComponent,
    AvatarComponent,
    BottomSheetComponent,
    ConfirmSheetComponent,
    AddEditTransactionSheetComponent,
    DailyLedgerSheetComponent,
    DualTrackChartComponent,
    RepaymentPaceCardComponent,
    InterestAuditChartComponent,
  ],
  template: `
    <div class="home-page-container">
      <!-- Living Video-feel Background Ambient Mesh -->
      <div class="video-ambient-mesh" aria-hidden="true">
        <div class="mesh-orb orb-violet"></div>
        <div class="mesh-orb orb-pink"></div>
        <div class="mesh-orb orb-emerald"></div>
        <div class="mesh-orb orb-cyan"></div>
        <svg class="mesh-wave-svg" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path class="wave-path wave-path-1" d="M0,192L48,197.3C96,203,192,213,288,192C384,171,480,117,576,112C672,107,768,149,864,165.3C960,181,1056,171,1152,149.3C1248,128,1344,96,1392,80L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          <path class="wave-path wave-path-2" d="M0,96L48,128C96,160,192,224,288,213.3C384,203,480,117,576,101.3C672,85,768,139,864,165.3C960,192,1056,192,1152,176C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
      </div>

      <!-- 1. Top User Profile Bar (Screenshot Matched) -->
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
          <app-avatar [name]="userProfile.currentMemberName()" [avatarUrl]="userProfile.currentMemberAvatar()" [size]="44" [circular]="true" />
          <div class="profile-text-wrap">
            <span class="profile-greeting">Welcome back</span>
            <div class="profile-name-row">
              <h1 class="profile-user-name">{{ userProfile.currentMemberName() }}</h1>
              <span class="profile-switch-indicator">▾</span>
            </div>
          </div>
        </div>

        <div class="top-action-cluster">
          <a
            routerLink="/statements"
            class="top-statement-badge-btn"
            aria-label="View SBI Statements"
            title="SBI Passbook Statements (101 txns)"
            (click)="triggerNavHaptic()"
          >
            <span class="btn-icon">📋</span>
            <span class="btn-text">Statements</span>
          </a>

          <a
            routerLink="/settings"
            class="top-circle-action-btn"
            aria-label="Settings"
            title="Settings"
            (click)="triggerNavHaptic()"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </a>
        </div>
      </header>

      <!-- Storage / Cloud Sync Warning Banner -->
      @if (ledgerStore.storageWarning()) {
        <div class="cloud-status-banner" role="alert">
          <span class="cloud-status-icon">⚠️</span>
          <div class="cloud-status-text">
            <strong>Cloud Sync Setup Required</strong>
            <p>{{ ledgerStore.storageWarning() }}</p>
          </div>
        </div>
      }

      <!-- 2. Matte Black Hero Card (Current Loan Balance) -->
      <div class="matte-hero-banner" role="region" aria-label="Current Loan Balance">
        <!-- Living Laser Trace Border (Conic Rotation) -->
        <div class="hero-laser-border" aria-hidden="true"></div>

        <!-- Internal Living Nebula Blooms -->
        <div class="hero-nebula-glow nebula-1" aria-hidden="true"></div>
        <div class="hero-nebula-glow nebula-2" aria-hidden="true"></div>

        <!-- Floating Digital Particle Embers -->
        <div class="hero-particles-field" aria-hidden="true">
          <span class="particle p-1"></span>
          <span class="particle p-2"></span>
          <span class="particle p-3"></span>
          <span class="particle p-4"></span>
          <span class="particle p-5"></span>
        </div>

        <!-- Dynamic Shimmer Ray -->
        <div class="hero-shimmer-sweep" aria-hidden="true"></div>

        <div class="hero-top-row">
          <div class="hero-rate-pill">
            <span class="lightning-bolt">⚡</span>
            <span>{{ (ledgerStore.loan().currentRateBps / 100).toFixed(2) }}% p.a. · Overdraft</span>
          </div>

          <a
            routerLink="/statements"
            class="hero-statement-pill"
            (click)="$event.stopPropagation(); triggerNavHaptic()"
            title="View full passbook statement (101 txns)"
          >
            <span>Passbook (101)</span>
            <span class="chevron-micro">›</span>
          </a>
        </div>

        <div class="hero-main-stat">
          <span class="hero-stat-label">Loan Left to Pay</span>
          <div class="hero-balance-headline tabular-nums" [appCountUp]="ledgerStore.currentOutstanding()">
            {{ formatPaise(ledgerStore.currentOutstanding()) }}
          </div>
        </div>

        <!-- Hero Highlights Row: Loan Cleared + OD Surplus Buffer -->
        <div class="hero-pulse-strip">
          <div class="hero-glass-pill" (click)="isDailyLedgerOpen.set(true)" role="button" tabindex="0">
            <span class="pill-main tabular-nums">{{ repaidPercent().toFixed(1) }}%</span>
            <span class="pill-sub">Cleared ({{ formatCompactPaise(repaidAmount()) }})</span>
          </div>

          <div class="hero-glass-pill" (click)="isWithdrawalSheetOpen.set(true)" role="button" tabindex="0">
            <span class="pill-main tabular-nums text-emerald">{{ formatCompactPaise(odAvailableBuffer()) }}</span>
            <span class="pill-sub">OD Surplus Buffer</span>
          </div>
        </div>
      </div>

      <!-- 3. Section: High-Impact OD Telemetry (Big Numbers, Minimal Words) -->
      <section class="home-section">
        <div class="dual-squircle-grid">
          <!-- Card 1: OD Shield (Savings) -->
          <div
            class="squircle-metric-card od-shield-card"
            (click)="isDailyLedgerOpen.set(true)"
            role="button"
            tabindex="0"
            aria-label="OD Shield Daily Interest Savings"
          >
            <div class="card-iridescent-edge edge-green" aria-hidden="true"></div>
            <div class="card-top-header">
              <span class="card-caption-title text-green-glow">🛡️ OD Shield</span>
              <span class="card-chevron-icon">›</span>
            </div>

            <div class="card-metric-body">
              <div class="metric-hero-wrap">
                <div class="metric-giant-num tabular-nums text-green">
                  +{{ formatCompactPaise(odDailyInterestSaved()) }}
                  <span class="metric-unit-tag">/day</span>
                </div>
                <span class="metric-label-sub">
                  +{{ formatCompactPaise(odMonthlyInterestSaved()) }}/mo saved by buffer
                </span>
              </div>
            </div>
          </div>

          <!-- Card 2: Interest Bleed (Penalties on Withdrawals) -->
          <div
            class="squircle-metric-card od-bleed-card"
            (click)="isWithdrawalSheetOpen.set(true)"
            role="button"
            tabindex="0"
            aria-label="OD Interest Bleed on Withdrawals"
          >
            <div class="card-iridescent-edge edge-coral" aria-hidden="true"></div>
            <div class="card-top-header">
              <span class="card-caption-title text-coral-glow">⚠️ Interest Bleed</span>
              <span class="card-badge-pill">21 Draws ›</span>
            </div>

            <div class="card-metric-body">
              <div class="metric-hero-wrap">
                <div class="metric-giant-num tabular-nums text-coral">
                  −{{ formatCompactPaise(odWithdrawalSummary().currentMonthlyBleed) }}
                  <span class="metric-unit-tag">/mo</span>
                </div>
                <span class="metric-label-sub">
                  {{ formatCompactPaise(odWithdrawalSummary().totalInterestLost) }} lost on {{ formatCompactPaise(odWithdrawalSummary().netWithdrawn) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. Section: Repayment Pace Tracker (Paid vs Supposed to Pay) -->
      <section class="home-section">
        <app-repayment-pace-card [pace]="ledgerStore.repaymentPace()" />
      </section>

      <!-- 5. Section: Interactive Payback Accelerator (WOW Feature) -->
      <section class="home-section">
        <div class="payback-feature-card">
          <div class="payback-header">
            <div>
              <span class="trend-eyebrow-pill eyebrow-amber">
                <span class="live-pulse-dot dot-amber" aria-hidden="true"></span>
                <span>Payback Accelerator</span>
              </span>
              <h2 class="payback-heading">What if we return money to OD?</h2>
            </div>
            <span class="payback-current-amount tabular-nums">
              {{ formatPaise(paybackSliderPaise()) }}
            </span>
          </div>

          <!-- Modern Glass Range Slider -->
          <div class="payback-slider-wrap">
            <input
              type="range"
              min="0"
              [max]="odWithdrawalSummary().netWithdrawn"
              step="2500000"
              [value]="paybackSliderPaise()"
              (input)="onPaybackSliderInput($event)"
              class="payback-slider-input"
              aria-label="Simulate Payback Amount"
            />
            <div class="slider-ticks">
              <span>₹0</span>
              <span>₹5L</span>
              <span>₹10.48L (Full)</span>
            </div>
          </div>

          <!-- 3 Reactive Big Number Tiles -->
          <div class="payback-results-grid">
            <div class="payback-stat-tile">
              <span class="payback-stat-big text-green tabular-nums">
                +{{ formatCompactPaise(paybackSim().monthlySavingsPaise) }}
              </span>
              <span class="payback-stat-lbl">Monthly Relief</span>
            </div>

            <div class="payback-stat-tile">
              <span class="payback-stat-big text-cyan tabular-nums">
                {{ formatCompactPaise(paybackSim().lifetimeInterestSavedPaise) }}
              </span>
              <span class="payback-stat-lbl">Lifetime Saved</span>
            </div>

            <div class="payback-stat-tile">
              <span class="payback-stat-big text-purple tabular-nums">
                −{{ paybackSim().monthsTenureReduced }} mo
              </span>
              <span class="payback-stat-lbl">Debt-Free Sooner</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 5. Section: Dual-Track Balance Visualizer (Drawing Power vs Debt) -->
      <section class="home-section">
        <app-dual-track-chart
          [sanctionedLimit]="ledgerStore.loan().sanctionedLimit"
          [currentOutstanding]="ledgerStore.currentOutstanding()"
          [initialDisbursed]="initialDisbursedAmount()"
        />
      </section>

      <!-- 6. Section: How Interest Got Added So Far (29-Month Passbook Audit) -->
      <section class="home-section">
        <app-interest-audit-chart />
      </section>

      <!-- 7. Section: This Month & Payoff Baseline -->
      <section class="home-section">
        <div class="dual-squircle-grid">
          <!-- Card 1: This Month -->
          <button
            type="button"
            class="squircle-metric-card"
            (click)="isDailyLedgerOpen.set(true)"
            aria-label="View This Month Breakdown"
          >
            <div class="card-iridescent-edge" aria-hidden="true"></div>
            <div class="card-top-header">
              <span class="card-caption-title">This Month</span>
              <span class="card-chevron-icon">›</span>
            </div>

            <div class="card-metric-body">
              <div>
                <div class="metric-big-num tabular-nums text-green" [appCountUp]="monthlyCutCalculation().totalCut">
                  {{ formatPaise(monthlyCutCalculation().totalCut) }}
                </div>
                <span class="metric-label-sub">
                  {{ (thisMonthPacingPercent()).toFixed(0) }}% of {{ formatCompactPaise(monthlyTargetPaise()) }} target
                </span>
              </div>

              <div class="metric-split-row">
                <div class="metric-split-item">
                  <span class="metric-split-val tabular-nums text-green">
                    {{ formatCompactPaise(monthlyCutCalculation().principalCut) }}
                  </span>
                  <span class="metric-split-lbl">Principal</span>
                </div>
                <div class="metric-split-item text-right">
                  <span class="metric-split-val tabular-nums">
                    {{ formatCompactPaise(monthlyCutCalculation().interestCut) }}
                  </span>
                  <span class="metric-split-lbl">Interest</span>
                </div>
              </div>
            </div>
          </button>

          <!-- Card 2: Payoff Target -->
          <div
            class="squircle-metric-card"
            aria-label="Loan Payoff Target"
          >
            <div class="card-iridescent-edge" aria-hidden="true"></div>
            <div class="card-top-header">
              <span class="card-caption-title">Debt Free</span>
              <span class="card-badge-chip">{{ baselineSimResult()?.closureDate || 'Active' }}</span>
            </div>

            <div class="card-metric-body">
              <div>
                <div class="metric-big-num tabular-nums">
                  {{ ((baselineSimResult()?.months || 62) / 12).toFixed(1) }} yrs
                </div>
                <span class="metric-label-sub">
                  {{ baselineSimResult()?.months || 62 }} months left
                </span>
              </div>

              <div class="metric-split-row">
                <div class="metric-split-item">
                  <span class="metric-split-val tabular-nums">
                    {{ baselineSimResult() ? formatCompactPaise(baselineSimResult()!.totalInterest) : '—' }}
                  </span>
                  <span class="metric-split-lbl">Est. Interest</span>
                </div>
                <div class="metric-split-item text-right">
                  <span class="metric-split-val tabular-nums">
                    {{ baselineSimResult() ? formatCompactPaise(baselineSimResult()!.totalPaid) : '—' }}
                  </span>
                  <span class="metric-split-lbl">Outflow</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. Section: Monthly Deposit Trend -->
      <section class="home-section">
        <div class="trend-feature-card">
          <div class="trend-card-header">
            <div>
              <span class="trend-eyebrow-pill">
                <span class="live-pulse-dot" aria-hidden="true"></span>
                <span>Deposit Trend</span>
              </span>
              <h2 class="trend-main-heading" style="margin-top: 4px">Past 6 Months</h2>
            </div>
            <div class="trend-header-stats">
              <span class="trend-stat-val tabular-nums">{{ formatCompactPaise(totalDepositedPast6Months()) }}</span>
              <span class="trend-stat-lbl">Total Deposited</span>
            </div>
          </div>

          <div class="trend-chart-embed">
            <app-bar-chart
              [data]="monthlyBarData()"
              [targetValue]="targetValueRupees()"
            />
          </div>
        </div>
      </section>

      <!-- 5. Section: Recent Payments -->
      <section class="home-section">
        <div class="section-title-bar">
          <h2 class="section-main-heading">Recent Payments</h2>
          <div class="title-action-group">
            <a routerLink="/statements" class="section-statement-pill" (click)="triggerNavHaptic()">
              📋 Full Statement ›
            </a>
            <button type="button" class="section-see-all-btn" (click)="router.navigate(['/members/history'])">
              History ›
            </button>
          </div>
        </div>

        <div class="squircle-items-list">
          @for (tx of ledgerStore.recentTransactions(); track tx.id) {
            <div class="squircle-item-row">
              <button
                type="button"
                class="item-main-tap-target"
                (click)="editSelectedTx(tx)"
                [attr.aria-label]="'Edit payment ' + getTxTitle(tx)"
              >
                <div class="item-left-cluster">
                  <div class="activity-icon-bubble" [class.payment]="tx.type === 'bankPayment'">
                    {{ tx.type === 'bankPayment' ? '🏦' : '👤' }}
                  </div>
                  <div class="item-text-info">
                    <span class="item-primary-name">{{ getTxTitle(tx) }}</span>
                    <span class="item-secondary-sub">
                      {{ tx.date }} · {{ getTransactionMode(tx) }}
                    </span>
                  </div>
                </div>
                <div class="item-right-cluster">
                  <span
                    class="item-amount-val tabular-nums"
                    [class.positive]="tx.type === 'contribution'"
                    [class.negative]="tx.type === 'bankPayment'"
                  >
                    {{ tx.type === 'contribution' ? '+' : '−' }}{{ formatPaise(getTransactionAmount(tx)) }}
                  </span>
                  <span class="item-chevron">›</span>
                </div>
              </button>

              <button
                type="button"
                class="item-delete-btn"
                (click)="promptDeleteTx(tx, $event)"
                aria-label="Delete this payment"
                title="Delete payment"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          } @empty {
            <div class="squircle-empty-card">
              <p class="empty-hint">No payments recorded yet.</p>
            </div>
          }
        </div>
      </section>

      <!-- Delete Payment Confirmation Sheet -->
      <app-confirm-sheet
        [isOpen]="isDeleteModalOpen()"
        title="Delete Payment"
        [message]="deleteModalMessage()"
        confirmText="Yes, Delete Payment"
        [isDanger]="true"
        (confirmed)="executeDeleteTx()"
        (cancelled)="isDeleteModalOpen.set(false); txToDelete.set(null)"
      />

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

      <!-- OD Withdrawals Forensic Bottom Sheet -->
      <app-bottom-sheet
        [isOpen]="isWithdrawalSheetOpen()"
        title="OD Withdrawals & Interest Lost"
        (dismissed)="isWithdrawalSheetOpen.set(false)"
      >
        <div class="sheet-forensic-container">
          <!-- Top 3 Big Stat Chips -->
          <div class="forensic-top-chips">
            <div class="forensic-chip">
              <span class="f-chip-val tabular-nums">−{{ formatCompactPaise(odWithdrawalSummary().netWithdrawn) }}</span>
              <span class="f-chip-lbl">21 Draws Total</span>
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

          <!-- Itemized List -->
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
    .home-page-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow-x: hidden;
      padding: 0 0 114px;
      position: relative;
    }

    /* Living Video-feel Background Ambient Mesh */
    .video-ambient-mesh {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
    }

    .mesh-orb {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      opacity: 0.35;
      will-change: transform;
    }

    .orb-violet {
      width: 320px;
      height: 320px;
      background: radial-gradient(circle, rgba(108, 76, 255, 0.4) 0%, rgba(79, 53, 255, 0.12) 50%, transparent 70%);
      top: -40px;
      left: -60px;
      animation: orbDrift1 20s ease-in-out infinite alternate;
    }

    .orb-pink {
      width: 340px;
      height: 340px;
      background: radial-gradient(circle, rgba(255, 95, 158, 0.35) 0%, rgba(255, 140, 185, 0.1) 50%, transparent 70%);
      top: 25%;
      right: -80px;
      animation: orbDrift2 24s ease-in-out infinite alternate;
    }

    .orb-emerald {
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(15, 178, 124, 0.3) 0%, rgba(52, 211, 153, 0.08) 50%, transparent 70%);
      bottom: 12%;
      left: -40px;
      animation: orbDrift3 22s ease-in-out infinite alternate;
    }

    .orb-cyan {
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(56, 189, 248, 0.3) 0%, rgba(129, 140, 248, 0.08) 50%, transparent 70%);
      top: 62%;
      right: -50px;
      animation: orbDrift4 26s ease-in-out infinite alternate;
    }

    .mesh-wave-svg {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 200%;
      height: 280px;
      opacity: 0.07;
      animation: waveFloat 16s linear infinite alternate;
    }

    .wave-path-1 {
      fill: #6c4cff;
    }

    .wave-path-2 {
      fill: #ff5f9e;
    }

    /* 1. Top User Profile Bar */
    .app-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 8px 0 20px;
      padding: 0 4px;
      position: relative;
      z-index: 2;
      animation: cinematicSlideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .cloud-status-banner {
      background: rgba(238, 77, 107, 0.12);
      border: 1px solid rgba(238, 77, 107, 0.35);
      border-radius: 16px;
      padding: 12px 16px;
      margin-bottom: 20px;
      display: flex;
      gap: 12px;
      align-items: flex-start;
      color: var(--ink);

      .cloud-status-icon {
        font-size: 20px;
        flex-shrink: 0;
      }

      .cloud-status-text {
        font-size: 13px;
        line-height: 1.4;

        strong {
          display: block;
          font-weight: 700;
          margin-bottom: 2px;
          color: #ee4d6b;
        }

        p {
          margin: 0;
          color: var(--muted);
        }
      }
    }

    .user-profile-cluster {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      user-select: none;
      padding: 4px 8px 4px 4px;
      margin: -4px -8px -4px -4px;
      border-radius: 99px;
      transition: background 0.15s ease, transform 0.15s ease;
    }

    .user-profile-cluster:hover {
      background: rgba(0, 0, 0, 0.04);
      transform: translateY(-1px);
    }

    .profile-name-row {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .profile-switch-indicator {
      font-size: 11px;
      color: #8e8e93;
      transition: transform 0.15s ease;
    }

    .user-profile-cluster:hover .profile-switch-indicator {
      color: #6c4cff;
      transform: translateY(1px);
    }

    .profile-avatar-circle {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #111216;
      color: #ffffff;
      display: grid;
      place-items: center;
      font-size: 16px;
      font-weight: 800;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    }

    .profile-text-wrap {
      display: flex;
      flex-direction: column;
    }

    .profile-greeting {
      font-size: 11px;
      font-weight: 500;
      color: #8e8e93;
      letter-spacing: -0.01em;
    }

    .profile-user-name {
      font-size: 18px;
      font-weight: 800;
      color: #111216;
      letter-spacing: -0.02em;
      margin: 0;
    }

    .top-circle-action-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.06);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
      cursor: pointer;
      display: grid;
      place-items: center;
      color: #111216;
      text-decoration: none;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        background: #f7f8fa;
        transform: scale(1.06);
        color: #111216;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
      }

      &:active {
        transform: scale(0.94);
      }
    }

    .top-action-cluster {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .top-statement-badge-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 40px;
      padding: 0 14px;
      border-radius: 99px;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.08);
      color: #111216;
      text-decoration: none;
      font-size: 13px;
      font-weight: 800;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        background: #6c4cff;
        color: #ffffff;
        border-color: #6c4cff;
        transform: translateY(-1px);
        box-shadow: 0 4px 14px rgba(108, 76, 255, 0.25);
      }
    }

    .hero-statement-pill {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 800;
      color: #ffffff;
      background: rgba(255, 255, 255, 0.14);
      border: 1px solid rgba(255, 255, 255, 0.22);
      padding: 5px 12px;
      border-radius: 99px;
      text-decoration: none;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.25);
        transform: translateY(-1px);
      }
    }

    .title-action-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-statement-pill {
      font-size: 12px;
      font-weight: 800;
      color: #6c4cff;
      background: rgba(108, 76, 255, 0.08);
      border: 1px solid rgba(108, 76, 255, 0.18);
      padding: 4px 12px;
      border-radius: 99px;
      text-decoration: none;
      transition: all 0.2s ease;

      &:hover {
        background: #6c4cff;
        color: #ffffff;
      }
    }

    /* 2. Matte Black Hero Card (Living Cyber-Card / Video UI) */
    .matte-hero-banner {
      background: #0f1118;
      color: #ffffff;
      border-radius: 28px;
      padding: 24px 22px 22px;
      margin-bottom: 22px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      box-shadow: 0 20px 48px -10px rgba(10, 12, 20, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08);
      position: relative;
      overflow: hidden;
      animation: heroCardEntrance 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;

      &::after {
        content: '';
        position: absolute;
        inset: 1.5px;
        border-radius: 26.5px;
        background: linear-gradient(150deg, #10121a 0%, #171a26 60%, #0d0f17 100%);
        z-index: 1;
        pointer-events: none;
      }
    }

    /* Living Conic Laser Border Sweep */
    .hero-laser-border {
      position: absolute;
      top: -60%;
      left: -60%;
      width: 220%;
      height: 220%;
      background: conic-gradient(
        from 0deg,
        transparent 0deg,
        transparent 70deg,
        rgba(108, 76, 255, 0.95) 110deg,
        rgba(255, 95, 158, 0.95) 140deg,
        rgba(15, 178, 124, 0.95) 170deg,
        transparent 210deg,
        transparent 360deg
      );
      animation: laserSpin 7.5s linear infinite;
      pointer-events: none;
      z-index: 0;
      will-change: transform;
    }

    /* Internal Living Nebula Blooms */
    .hero-nebula-glow {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      z-index: 2;
      opacity: 0.36;
    }

    .nebula-1 {
      width: 220px;
      height: 220px;
      background: radial-gradient(circle, rgba(108, 76, 255, 0.6) 0%, transparent 70%);
      top: -40px;
      right: -30px;
      animation: nebulaMorph1 9s ease-in-out infinite alternate;
    }

    .nebula-2 {
      width: 240px;
      height: 240px;
      background: radial-gradient(circle, rgba(255, 95, 158, 0.5) 0%, transparent 70%);
      bottom: -60px;
      left: 15%;
      animation: nebulaMorph2 11s ease-in-out infinite alternate;
    }

    /* Floating Digital Particle Embers */
    .hero-particles-field {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 2;
      overflow: hidden;
    }

    .particle {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 0 6px #6c4cff;
      bottom: -10px;
      animation: particleRise 6s ease-in infinite;
    }

    .p-1 { left: 15%; animation-duration: 5.5s; animation-delay: 0s; width: 3px; height: 3px; }
    .p-2 { left: 38%; animation-duration: 7.5s; animation-delay: 1.5s; width: 4px; height: 4px; }
    .p-3 { left: 62%; animation-duration: 6.2s; animation-delay: 3s; width: 2.5px; height: 2.5px; }
    .p-4 { left: 82%; animation-duration: 8.2s; animation-delay: 0.8s; width: 3.5px; height: 3.5px; }
    .p-5 { left: 93%; animation-duration: 6.8s; animation-delay: 2.2s; width: 3px; height: 3px; }

    /* Dynamic Shimmer Ray */
    .hero-shimmer-sweep {
      position: absolute;
      top: -100%;
      left: -100%;
      width: 300%;
      height: 300%;
      background: linear-gradient(
        115deg,
        transparent 35%,
        rgba(255, 255, 255, 0.12) 50%,
        transparent 65%
      );
      pointer-events: none;
      z-index: 2;
      animation: shimmerSweep 5.5s ease-in-out infinite;
    }

    .hero-top-row,
    .hero-main-stat,
    .hero-pulse-strip {
      position: relative;
      z-index: 3;
    }

    .hero-top-row {
      display: flex;
      align-items: center;
      width: 100%;
    }

    .hero-rate-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.08);
      padding: 5px 12px;
      border-radius: 99px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      letter-spacing: -0.01em;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    .lightning-bolt {
      color: #f59e0b;
      font-size: 13px;
      animation: liveBlink 2s ease-in-out infinite;
    }

    .hero-main-stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .hero-stat-label {
      font-size: 11px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.55);
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .hero-balance-headline {
      font-size: clamp(30px, 7.5vw, 42px);
      font-weight: 800;
      letter-spacing: -0.035em;
      line-height: 1.05;
      color: #ffffff;
      text-shadow: 0 0 35px rgba(255, 255, 255, 0.25);
      animation: headlineBreathe 4s ease-in-out infinite alternate;
    }

    .hero-pulse-strip {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      width: 100%;
    }

    .hero-glass-pill {
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 18px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      position: relative;
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      cursor: pointer;
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        background: rgba(255, 255, 255, 0.13);
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
      }

      &:active {
        transform: scale(0.98);
      }
    }

    .pill-dot {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 8px;
      height: 8px;
      border-radius: 50%;

      &.glow-amber {
        background: #f59e0b;
        color: #f59e0b;
        box-shadow: 0 0 10px rgba(245, 158, 11, 0.9);
      }

      &.glow-green {
        background: #10b981;
        color: #10b981;
        box-shadow: 0 0 10px rgba(16, 185, 129, 0.9);
      }
    }

    .dot-radar {
      position: absolute;
      inset: -5px;
      border-radius: 50%;
      border: 1.5px solid currentColor;
      opacity: 0;
      animation: radarRing 2.2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
    }

    .pill-main {
      font-size: 15px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.015em;
      line-height: 1.2;
    }

    .pill-sub {
      font-size: 11px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.6);
      letter-spacing: -0.01em;
    }

    /* 3. Section Containers */
    .home-section {
      display: flex;
      flex-direction: column;
      margin-bottom: 22px;
      position: relative;
      z-index: 2;
    }

    .section-main-heading {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #111216;
      margin: 0;
    }

    .section-title-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 0 4px 12px;
    }

    .section-see-all-btn {
      background: transparent;
      border: none;
      color: #8e8e93;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      padding: 4px 6px;
      transition: color 0.15s ease, transform 0.15s ease;

      &:hover {
        color: #111216;
        transform: translateX(2px);
      }
    }

    /* Dual Squircle Grid */
    .dual-squircle-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .squircle-metric-card {
      background: #ffffff;
      border: none;
      width: 100%;
      text-align: left;
      font-family: inherit;
      border-radius: 24px;
      padding: 18px;
      box-shadow: var(--shadow-card);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 150px;
      position: relative;
      overflow: hidden;
      animation: cardQuickEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;

      &:hover {
        transform: translateY(-4px) scale(1.015);
        box-shadow: 0 16px 36px rgba(108, 76, 255, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04);
      }

      &:active {
        transform: scale(0.98);
      }
    }

    .card-iridescent-edge {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #6c4cff 0%, #ff5f9e 50%, #0fb27c 100%);
      border-radius: 24px 24px 0 0;
      opacity: 0.9;
    }

    .card-top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card-caption-title {
      font-size: 13px;
      font-weight: 700;
      color: #8e8e93;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .card-chevron-icon {
      font-size: 16px;
      color: #9ca3af;
      font-weight: 700;
    }

    .card-metric-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 6px;
    }

    .metric-big-num {
      font-size: clamp(20px, 4.8vw, 24px);
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #111216;
      line-height: 1.1;

      &.text-green {
        color: #0fb27c;
      }
    }

    .metric-label-sub {
      font-size: 11px;
      font-weight: 600;
      color: #8e8e93;
      display: block;
      margin-top: 3px;
      letter-spacing: -0.01em;
    }

    .metric-split-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      margin-top: 2px;
      padding-top: 8px;
      border-top: 1px solid var(--line, rgba(0, 0, 0, 0.06));
    }

    .metric-split-item {
      display: flex;
      flex-direction: column;
      gap: 1px;

      &.text-right {
        text-align: right;
        align-items: flex-end;
      }
    }

    .metric-split-val {
      font-size: 13px;
      font-weight: 800;
      color: #111216;
      line-height: 1.2;

      &.text-green {
        color: #0fb27c;
      }
    }

    /* OD Shield & Bleed Cards */
    .edge-green {
      background: linear-gradient(90deg, #0fb27c 0%, #34d399 100%) !important;
    }

    .edge-coral {
      background: linear-gradient(90deg, #ff5f9e 0%, #ee4d6b 100%) !important;
    }

    .text-green-glow {
      color: #0fb27c !important;
    }

    .text-coral-glow {
      color: #ee4d6b !important;
    }

    .card-badge-pill {
      font-size: 11px;
      font-weight: 700;
      color: #ee4d6b;
      background: rgba(238, 77, 107, 0.1);
      padding: 3px 8px;
      border-radius: 99px;
    }

    .metric-hero-wrap {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .metric-giant-num {
      font-size: clamp(24px, 5.8vw, 30px);
      font-weight: 900;
      letter-spacing: -0.035em;
      line-height: 1.1;

      &.text-green {
        color: #0fb27c;
      }
      &.text-coral {
        color: #ee4d6b;
      }
    }

    .metric-unit-tag {
      font-size: 13px;
      font-weight: 700;
      opacity: 0.7;
      letter-spacing: normal;
    }

    /* Payback Accelerator Card */
    .payback-feature-card {
      background: #ffffff;
      border-radius: 26px;
      padding: 20px;
      box-shadow: var(--shadow-card);
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(108, 76, 255, 0.08);
    }

    .payback-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 14px;
    }

    .eyebrow-amber {
      background: rgba(245, 158, 11, 0.1);
      color: #d97706;
      border: 1px solid rgba(245, 158, 11, 0.2);
    }

    .dot-amber {
      background: #f59e0b;
      box-shadow: 0 0 8px rgba(245, 158, 11, 0.8);
    }

    .payback-heading {
      font-size: 16px;
      font-weight: 800;
      color: #15172b;
      margin: 4px 0 0;
      letter-spacing: -0.02em;
    }

    .payback-current-amount {
      font-size: 16px;
      font-weight: 900;
      color: #6c4cff;
      background: rgba(108, 76, 255, 0.08);
      padding: 6px 12px;
      border-radius: 99px;
    }

    .payback-slider-wrap {
      margin: 12px 0 16px;
    }

    .payback-slider-input {
      width: 100%;
      height: 8px;
      -webkit-appearance: none;
      appearance: none;
      background: linear-gradient(90deg, #6c4cff 0%, #ff5f9e 50%, #0fb27c 100%);
      border-radius: 99px;
      outline: none;
      cursor: pointer;

      &::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #ffffff;
        border: 3px solid #6c4cff;
        box-shadow: 0 4px 12px rgba(108, 76, 255, 0.4);
        cursor: pointer;
        transition: transform 0.15s ease;

        &:hover {
          transform: scale(1.15);
        }
      }
    }

    .slider-ticks {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 700;
      color: #8e8e93;
      margin-top: 6px;
    }

    .payback-results-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      background: rgba(244, 241, 236, 0.6);
      border-radius: 18px;
      padding: 12px;
    }

    .payback-stat-tile {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 2px;
    }

    .payback-stat-big {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: -0.02em;

      &.text-green { color: #0fb27c; }
      &.text-cyan { color: #0284c7; }
      &.text-purple { color: #7c3aed; }
    }

    .payback-stat-lbl {
      font-size: 10px;
      font-weight: 700;
      color: #8e8e93;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    /* Colors */
    .text-coral { color: #ee4d6b !important; }
    .text-emerald { color: #10b981 !important; }
    .text-amber { color: #f59e0b !important; }

    /* Forensic Bottom Sheet */
    .sheet-forensic-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-bottom: 24px;
    }

    .forensic-top-chips {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
    }

    .forensic-chip {
      background: #f4f1ec;
      border-radius: 16px;
      padding: 10px 8px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 2px;

      &.chip-danger {
        background: rgba(238, 77, 107, 0.08);
      }
      &.chip-amber {
        background: rgba(245, 158, 11, 0.08);
      }
    }

    .f-chip-val {
      font-size: 14px;
      font-weight: 800;
      color: #15172b;
    }

    .f-chip-lbl {
      font-size: 10px;
      font-weight: 700;
      color: #8e8e93;
      text-transform: uppercase;
    }

    .forensic-items-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 420px;
      overflow-y: auto;
      padding-right: 4px;
    }

    .forensic-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid rgba(0, 0, 0, 0.04);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
    }

    .f-row-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .f-icon-bubble {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: #f4f1ec;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }

    .f-meta {
      display: flex;
      flex-direction: column;
    }

    .f-title {
      font-size: 13px;
      font-weight: 700;
      color: #15172b;
    }

    .f-dest {
      font-size: 11px;
      font-weight: 600;
      color: #8e8e93;
    }

    .f-row-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .f-amount {
      font-size: 14px;
      font-weight: 800;
      color: #ee4d6b;
    }

    .f-penalty {
      font-size: 10px;
      font-weight: 700;
      color: #d97706;
    }

    .metric-split-lbl {
      font-size: 10px;
      font-weight: 600;
      color: #8e8e93;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    /* 5. Squircle Items List (Members & Activity) */
    .squircle-items-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .squircle-item-row {
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.04);
      width: 100%;
      border-radius: 22px;
      padding: 4px 6px 4px 4px;
      box-shadow: var(--shadow-card);
      display: flex;
      align-items: center;
      animation: cardQuickEnter 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.22s ease, border-color 0.2s ease;

      &:hover {
        transform: translateY(-2px) translateX(3px);
        border-color: rgba(108, 76, 255, 0.2);
        box-shadow: 0 8px 24px rgba(108, 76, 255, 0.08);
      }
    }

    .item-main-tap-target {
      flex: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: transparent;
      border: none;
      text-align: left;
      font-family: inherit;
      padding: 10px 14px;
      cursor: pointer;
      min-width: 0;
      border-radius: 18px;
      transition: background 0.15s ease;

      &:hover {
        background: rgba(0, 0, 0, 0.015);
      }

      &:active {
        transform: scale(0.99);
      }
    }

    .item-delete-btn {
      width: 38px;
      height: 38px;
      min-width: 38px;
      border-radius: 50%;
      border: none;
      background: transparent;
      color: #8e8e93;
      display: grid;
      place-items: center;
      cursor: pointer;
      margin-right: 6px;
      flex-shrink: 0;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        background: rgba(238, 77, 107, 0.12);
        color: #ee4d6b;
        transform: scale(1.08);
      }

      &:active {
        transform: scale(0.92);
      }
    }

    .item-left-cluster {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
      flex: 1;
    }

    .item-text-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .item-primary-name {
      font-size: 14px;
      font-weight: 700;
      color: #111216;
      letter-spacing: -0.01em;
    }

    .item-secondary-sub {
      font-size: 11px;
      font-weight: 500;
      color: #8e8e93;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-right-cluster {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .item-share-pill {
      font-size: 12px;
      font-weight: 700;
      color: #111216;
      background: #f3f4f7;
      padding: 4px 10px;
      border-radius: 99px;
    }

    .item-chevron {
      font-size: 16px;
      color: #9ca3af;
      font-weight: 700;
    }

    .activity-icon-bubble {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: #f3f4f7;
      display: grid;
      place-items: center;
      font-size: 18px;
      flex-shrink: 0;

      &.payment {
        background: #eaecee;
      }
    }

    .item-amount-val {
      font-size: 14px;
      font-weight: 800;

      &.positive {
        color: #10b981;
      }

      &.negative {
        color: #111216;
      }
    }

    .squircle-empty-card {
      background: #ffffff;
      border-radius: 22px;
      padding: 24px;
      text-align: center;
      box-shadow: var(--shadow-card);
    }

    .empty-hint {
      font-size: 13px;
      font-weight: 500;
      color: #8e8e93;
      margin: 0;
    }

    /* Luxury Trend Feature Card on Home */
    .trend-feature-card {
      background: #ffffff;
      border-radius: 26px;
      padding: 22px 20px 18px;
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      gap: 16px;
      animation: cardQuickEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 32px -4px rgba(108, 76, 255, 0.08);
      }
    }

    .trend-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }

    .trend-eyebrow-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .trend-eyebrow-pill {
      font-size: 11px;
      font-weight: 800;
      color: #6366f1;
      background: rgba(99, 102, 241, 0.1);
      padding: 3px 9px;
      border-radius: 99px;
      letter-spacing: 0.02em;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .live-pulse-dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #0fb27c;
      box-shadow: 0 0 8px #0fb27c;
      animation: liveBlink 1.8s ease-in-out infinite;
    }

    .trend-eyebrow-target {
      font-size: 11px;
      font-weight: 600;
      color: #8e8e93;
    }

    .trend-main-heading {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #111216;
      margin: 0;
    }

    .trend-header-stats {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      text-align: right;
    }

    .trend-stat-val {
      font-size: 18px;
      font-weight: 800;
      color: #111216;
      letter-spacing: -0.02em;
    }

    .trend-stat-lbl {
      font-size: 11px;
      font-weight: 600;
      color: #8e8e93;
      margin-top: 1px;
    }

    .trend-chart-embed {
      margin: 2px 0;
    }

    .card-badge-chip {
      font-size: 11px;
      font-weight: 800;
      color: #10b981;
      background: rgba(16, 185, 129, 0.12);
      padding: 3px 8px;
      border-radius: var(--radius-pill, 99px);
    }

    /* Keyframe Animations for Living UI / Video Feel */
    @keyframes laserSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes nebulaMorph1 {
      0% { transform: scale(1) translate(0, 0); opacity: 0.28; }
      50% { transform: scale(1.25) translate(-20px, 15px); opacity: 0.44; }
      100% { transform: scale(1) translate(0, 0); opacity: 0.28; }
    }

    @keyframes nebulaMorph2 {
      0% { transform: scale(1.2) translate(0, 0); opacity: 0.22; }
      50% { transform: scale(0.9) translate(25px, -15px); opacity: 0.38; }
      100% { transform: scale(1.2) translate(0, 0); opacity: 0.22; }
    }

    @keyframes particleRise {
      0% { transform: translateY(0) scale(0.6); opacity: 0; }
      20% { opacity: 0.85; }
      80% { opacity: 0.85; }
      100% { transform: translateY(-160px) scale(1.2); opacity: 0; }
    }

    @keyframes shimmerSweep {
      0% { transform: translate(-50%, -50%) rotate(0deg); opacity: 0; }
      20% { opacity: 1; }
      50% { transform: translate(50%, 50%) rotate(0deg); opacity: 0; }
      100% { transform: translate(50%, 50%) rotate(0deg); opacity: 0; }
    }

    @keyframes radarRing {
      0% { transform: scale(0.8); opacity: 0.9; }
      100% { transform: scale(2.8); opacity: 0; }
    }

    @keyframes headlineBreathe {
      0% { text-shadow: 0 0 25px rgba(255, 255, 255, 0.2); }
      100% { text-shadow: 0 0 45px rgba(255, 255, 255, 0.45), 0 0 15px rgba(108, 76, 255, 0.3); }
    }

    @keyframes orbDrift1 {
      0% { transform: translate(0, 0) scale(1); }
      100% { transform: translate(60px, 40px) scale(1.18); }
    }

    @keyframes orbDrift2 {
      0% { transform: translate(0, 0) scale(1); }
      100% { transform: translate(-50px, -60px) scale(1.22); }
    }

    @keyframes orbDrift3 {
      0% { transform: translate(0, 0) scale(1.1); }
      100% { transform: translate(40px, -30px) scale(0.9); }
    }

    @keyframes orbDrift4 {
      0% { transform: translate(0, 0) scale(0.95); }
      100% { transform: translate(-45px, 35px) scale(1.15); }
    }

    @keyframes waveFloat {
      0% { transform: translateX(0) scaleY(1); }
      100% { transform: translateX(-25%) scaleY(1.15); }
    }

    @keyframes cinematicSlideDown {
      from { opacity: 0.85; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes heroCardEntrance {
      from { opacity: 0.85; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes cardQuickEnter {
      from { opacity: 0.85; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes liveBlink {
      0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 6px #0fb27c; }
      50% { opacity: 0.4; transform: scale(0.7); box-shadow: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .video-ambient-mesh,
      .hero-laser-border,
      .hero-nebula-glow,
      .hero-particles-field,
      .hero-shimmer-sweep,
      .dot-radar,
      .card-iridescent-edge,
      .live-pulse-dot {
        animation: none !important;
        display: none !important;
      }

      .app-top-bar,
      .matte-hero-banner,
      .squircle-metric-card,
      .trend-feature-card,
      .section-main-heading,
      .section-title-bar,
      .squircle-item-row {
        animation: none !important;
        transform: none !important;
      }
    }
  `,
})
export class HomeComponent {
  readonly ledgerStore = inject(LedgerStore);
  readonly userProfile = inject(UserProfileStore);
  readonly settings = inject(SettingsStore);
  readonly router = inject(Router);

  private lastHapticTime = 0;

  triggerNavHaptic(): void {
    const now = Date.now();
    if (now - this.lastHapticTime > 60) {
      this.lastHapticTime = now;
      triggerHaptic('light');
    }
  }

  readonly formatPaise = formatPaise;
  readonly formatCompactPaise = formatCompactPaise;
  readonly toRupees = toRupees;
  readonly getTransactionAmount = getTransactionAmount;
  readonly getTransactionMode = getTransactionMode;

  readonly isSheetOpen = signal<boolean>(false);
  readonly isDailyLedgerOpen = signal<boolean>(false);
  readonly selectedTxForEdit = signal<Transaction | null>(null);
  readonly initialSheetType = signal<'contribution' | 'bankPayment'>('contribution');

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
  readonly odWithdrawalSummary = computed(() => getOdWithdrawalsSummary());
  readonly paybackSliderPaise = signal<Paise>(toPaise(500000)); // Default ₹5 Lakhs simulation
  readonly paybackSim = computed(() =>
    simulatePayback(this.paybackSliderPaise(), this.ledgerStore.loan().currentRateBps)
  );

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

  onPaybackSliderInput(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    this.paybackSliderPaise.set(paise(val));
    triggerHaptic('light');
  }

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

  readonly totalDepositedPast6Months = computed<Paise>(() => {
    const data = this.monthlyBarData();
    const sumRupees = data.reduce((acc, item) => acc + item.value, 0);
    return toPaise(sumRupees);
  });

  readonly thisMonthPacingPercent = computed(() => {
    const target = this.monthlyTargetPaise();
    if (target <= 0) return 0;
    const paid = this.summary().memberContributions;
    return Math.min(100, (paid / target) * 100);
  });

  readonly monthlyBarData = computed(() => {
    const txs = this.ledgerStore
      .transactions()
      .filter((t): t is ContributionTransaction => t.type === 'contribution' && !t.deletedAt);
    const monthsMap = new Map<string, { value: number; count: number }>();

    const now = new Date();
    for (let k = 5; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsMap.set(key, { value: 0, count: 0 });
    }

    for (const t of txs) {
      if (monthsMap.has(t.forMonth)) {
        const entry = monthsMap.get(t.forMonth)!;
        entry.value += t.amount / 100;
        entry.count += 1;
      }
    }

    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetRupees = this.targetValueRupees();

    return Array.from(monthsMap.entries()).map(([monthKey, entry]) => {
      const parts = monthKey.split('-');
      const y = parseInt(parts[0]!, 10);
      const m = parseInt(parts[1]!, 10);
      const d = new Date(y, m - 1, 1);
      const label = d.toLocaleDateString('en-IN', { month: 'short' });
      const fullLabel = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      return {
        label,
        value: Math.round(entry.value),
        monthKey,
        fullLabel,
        isCurrent: monthKey === curMonthKey,
        target: targetRupees,
        depositCount: entry.count,
      };
    });
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
    if (tx.type === 'bankPayment') return 'Payment to Bank (EMI)';
    if (tx.type === 'withdrawal') return 'Money Withdrawn';
    if (tx.type === 'principalAdjustment') return 'Balance Adjustment';
    if (tx.type === 'manualCorrection') return 'Bank Passbook Match';
    return 'Payment';
  }
}

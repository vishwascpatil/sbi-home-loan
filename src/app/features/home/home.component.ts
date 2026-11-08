import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LedgerStore, SettingsStore, UserProfileStore } from '../../core/state';
import {
  AvatarComponent,
  BottomSheetComponent,
  ConfirmSheetComponent,
  DualTrackChartComponent,
  RepaymentPaceCardComponent,
} from '../../shared/ui';
import { CountUpDirective } from '../../shared/ui/count-up/count-up.directive';
import {
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
    CountUpDirective,
    AvatarComponent,
    BottomSheetComponent,
    ConfirmSheetComponent,
    AddEditTransactionSheetComponent,
    DailyLedgerSheetComponent,
    DualTrackChartComponent,
    RepaymentPaceCardComponent,
  ],
  template: `
    <div class="home-page-container">
      <!-- Subtle Ambient Glow Canvas -->
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
          <div class="profile-text-wrap">
            <span class="profile-greeting">Welcome back</span>
            <div class="profile-name-row">
              <h1 class="profile-user-name">{{ userProfile.currentMemberName() }}</h1>
              <span class="profile-switch-indicator">▾</span>
            </div>
          </div>
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

      <!-- 2. Clean Obsidian Hero Card (Current Loan Balance) -->
      <div class="matte-hero-banner" role="region" aria-label="Current Loan Balance">
        <div class="hero-top-row">
          <div class="hero-rate-pill">
            <span class="lightning-bolt">⚡</span>
            <span>{{ (ledgerStore.loan().currentRateBps / 100).toFixed(2) }}% p.a. · Overdraft</span>
          </div>
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

          <div class="hero-glass-pill" (click)="scrollToDualTrack()" role="button" tabindex="0" title="View OD Surplus Buffer on Chart">
            <span class="pill-main tabular-nums text-emerald">{{ formatCompactPaise(odAvailableBuffer()) }}</span>
            <span class="pill-sub">OD Surplus Buffer</span>
          </div>
        </div>
      </div>

      <!-- 3. Section: High-Impact OD Telemetry (Clean Minimalist Cards) -->
      <section class="home-section">
        <div class="dual-squircle-grid">
          <!-- Card 1: OD Shield -->
          <div
            class="squircle-metric-card"
            (click)="isDailyLedgerOpen.set(true)"
            (keydown.enter)="isDailyLedgerOpen.set(true)"
            role="button"
            tabindex="0"
            aria-label="OD Shield Daily Interest Savings"
          >
            <div class="card-top-header">
              <span class="card-caption-title text-green">🛡️ OD Shield</span>
              <span class="card-chevron-icon">›</span>
            </div>

            <div class="card-metric-body">
              <div class="metric-giant-num tabular-nums text-green">
                +{{ formatCompactPaise(odDailyInterestSaved()) }}<span class="metric-unit-tag">/day</span>
              </div>
              <span class="metric-label-sub">
                +{{ formatCompactPaise(odMonthlyInterestSaved()) }}/mo saved by buffer
              </span>
            </div>
          </div>

          <!-- Card 2: Interest Bleed -->
          <div
            class="squircle-metric-card"
            (click)="isWithdrawalSheetOpen.set(true)"
            (keydown.enter)="isWithdrawalSheetOpen.set(true)"
            role="button"
            tabindex="0"
            aria-label="OD Interest Bleed on Withdrawals"
          >
            <div class="card-top-header">
              <span class="card-caption-title text-coral">⚠️ Interest Bleed</span>
              <span class="card-badge-pill">21 Draws ›</span>
            </div>

            <div class="card-metric-body">
              <div class="metric-giant-num tabular-nums text-coral">
                −{{ formatCompactPaise(odWithdrawalSummary().currentMonthlyBleed) }}<span class="metric-unit-tag">/mo</span>
              </div>
              <span class="metric-label-sub">
                {{ formatCompactPaise(odWithdrawalSummary().totalInterestLost) }} lost across 21 draws
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. Section: Repayment Pace Tracker -->
      <section class="home-section">
        <app-repayment-pace-card [pace]="ledgerStore.repaymentPace()" />
      </section>

      <!-- 5. Section: Dual-Track Balance Visualizer (Drawing Power vs Debt) -->
      <section class="home-section" id="dual-track-section">
        <app-dual-track-chart
          [sanctionedLimit]="ledgerStore.loan().sanctionedLimit"
          [currentOutstanding]="ledgerStore.currentOutstanding()"
          [initialDisbursed]="initialDisbursedAmount()"
        />
      </section>

      <!-- 6. Section: Interactive Payback Accelerator -->
      <section class="home-section">
        <div class="payback-feature-card">
          <div class="payback-header">
            <div>
              <span class="trend-eyebrow-pill eyebrow-amber">
                Payback Accelerator
              </span>
              <h2 class="payback-heading">What if we return money to OD?</h2>
            </div>
            <span class="payback-current-amount tabular-nums">
              {{ formatPaise(paybackSliderPaise()) }}
            </span>
          </div>

          <!-- Modern Clean Range Slider -->
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

          <!-- 3 Reactive Stat Tiles -->
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

      <!-- 7. Section: This Month & Payoff Target -->
      <section class="home-section">
        <div class="dual-squircle-grid">
          <!-- Card 1: This Month -->
          <button
            type="button"
            class="squircle-metric-card"
            (click)="isDailyLedgerOpen.set(true)"
            aria-label="View This Month Breakdown"
          >
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

      <!-- 8. Section: Direct Link to Full Statements -->
      <section class="home-section">
        <div
          class="statements-nav-card"
          (click)="router.navigate(['/statements'])"
          (keydown.enter)="router.navigate(['/statements'])"
          role="button"
          tabindex="0"
          aria-label="View Full Statements & Passbook"
        >
          <div class="s-nav-left">
            <span class="s-nav-icon">📑</span>
            <div class="s-nav-text">
              <strong class="s-nav-title">Statements & Passbook</strong>
              <span class="s-nav-sub">101 reconciled transactions, daily interest & tax reports</span>
            </div>
          </div>
          <span class="s-nav-chevron">›</span>
        </div>
      </section>

      <!-- 9. Section: Recent Payments (Sleek Minimal Feed) -->
      <section class="home-section">
        <div class="section-title-bar">
          <h2 class="section-main-heading">Recent Payments</h2>
          <button type="button" class="section-see-all-btn" (click)="router.navigate(['/members/history'])">
            History ›
          </button>
        </div>

        <div class="recent-tx-feed">
          @for (tx of ledgerStore.recentTransactions(); track tx.id) {
            <div class="recent-tx-card">
              <button
                type="button"
                class="recent-tx-main"
                (click)="editSelectedTx(tx)"
                [attr.aria-label]="'Edit payment ' + getTxTitle(tx)"
              >
                <div class="recent-tx-left">
                  <span class="recent-tx-title">{{ getTxTitle(tx) }}</span>
                  <span class="recent-tx-meta">{{ tx.date }} · {{ getTransactionMode(tx) }}</span>
                </div>
                <span
                  class="recent-tx-amount tabular-nums"
                  [class.text-success]="tx.type === 'contribution'"
                  [class.text-neutral]="tx.type === 'bankPayment'"
                >
                  {{ tx.type === 'contribution' ? '+' : '−' }}{{ formatPaise(getTransactionAmount(tx)) }}
                </span>
              </button>

              <button
                type="button"
                class="recent-tx-del"
                (click)="promptDeleteTx(tx, $event)"
                aria-label="Delete this payment"
                title="Delete payment"
              >
                ✕
              </button>
            </div>
          } @empty {
            <div class="recent-empty-card">
              <p>No payments recorded yet.</p>
            </div>
          }
        </div>
      </section>

      <!-- Modals & Sheets -->
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

      <app-bottom-sheet
        [isOpen]="isWithdrawalSheetOpen()"
        title="OD Withdrawals & Interest Lost"
        (dismissed)="isWithdrawalSheetOpen.set(false)"
      >
        <div class="sheet-forensic-container">
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

    /* Subtle Ambient Backdrop */
    .ambient-backdrop {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
    }

    .ambient-orb {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      opacity: 0.25;
    }

    .orb-1 {
      width: 320px;
      height: 320px;
      background: radial-gradient(circle, rgba(108, 76, 255, 0.3) 0%, transparent 70%);
      top: -60px;
      left: -60px;
    }

    .orb-2 {
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(255, 95, 158, 0.2) 0%, transparent 70%);
      top: 35%;
      right: -60px;
    }

    /* 1. Top User Profile Bar */
    .app-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 8px 0 18px;
      padding: 0 4px;
      position: relative;
      z-index: 2;
    }

    .user-profile-cluster {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      user-select: none;
      padding: 4px 8px 4px 4px;
      border-radius: 99px;
      transition: background 0.15s ease;

      &:hover {
        background: rgba(0, 0, 0, 0.04);
      }
    }

    .profile-text-wrap {
      display: flex;
      flex-direction: column;
    }

    .profile-greeting {
      font-size: 11px;
      font-weight: 500;
      color: var(--muted, #767a90);
      letter-spacing: -0.01em;
    }

    .profile-name-row {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .profile-user-name {
      font-size: 17px;
      font-weight: 800;
      color: var(--ink, #15172b);
      letter-spacing: -0.02em;
      margin: 0;
    }

    .profile-switch-indicator {
      font-size: 11px;
      color: var(--muted, #767a90);
    }

    .cloud-status-banner {
      background: rgba(238, 77, 107, 0.1);
      border: 1px solid rgba(238, 77, 107, 0.3);
      border-radius: 16px;
      padding: 12px 16px;
      margin-bottom: 18px;
      display: flex;
      gap: 12px;
      align-items: flex-start;
      color: var(--ink, #15172b);

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
          color: #ee4d6b;
        }

        p {
          margin: 0;
          color: var(--muted, #767a90);
        }
      }
    }

    /* 2. Clean Obsidian Hero Card */
    .matte-hero-banner {
      background: linear-gradient(150deg, #10121a 0%, #171b28 60%, #0d0f17 100%);
      color: #ffffff;
      border-radius: 26px;
      padding: 22px 20px 20px;
      margin-bottom: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 12px 36px -8px rgba(10, 12, 20, 0.4);
      position: relative;
      z-index: 2;
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
      font-size: 11.5px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.08);
      padding: 4px 12px;
      border-radius: 99px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .lightning-bolt {
      color: #f59e0b;
      font-size: 12px;
    }

    .hero-main-stat {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .hero-stat-label {
      font-size: 11px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.55);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .hero-balance-headline {
      font-size: clamp(30px, 7.5vw, 40px);
      font-weight: 900;
      letter-spacing: -0.035em;
      line-height: 1.05;
      color: #ffffff;
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
      border-radius: 16px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      cursor: pointer;
      transition: all 0.2s ease;

      &:active {
        transform: scale(0.97);
      }
    }

    .pill-main {
      font-size: 14px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.2;
    }

    .pill-sub {
      font-size: 11px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.6);
    }

    /* 3. Section Containers */
    .home-section {
      display: flex;
      flex-direction: column;
      margin-bottom: 18px;
      position: relative;
      z-index: 2;
    }

    .section-main-heading {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--ink, #15172b);
      margin: 0;
    }

    .section-title-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 0 4px 10px;
    }

    .section-see-all-btn {
      background: transparent;
      border: none;
      color: var(--muted, #767a90);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      padding: 4px 6px;
      transition: color 0.15s ease;

      &:hover {
        color: var(--ink, #15172b);
      }
    }

    /* Dual Squircle Grid */
    .dual-squircle-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .squircle-metric-card {
      background: var(--card, #ffffff);
      border: 1px solid var(--line, rgba(0, 0, 0, 0.06));
      border-radius: 20px;
      padding: 16px;
      width: 100%;
      text-align: left;
      font-family: inherit;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 135px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
      transition: all 0.2s ease;

      &:active {
        transform: scale(0.98);
      }
    }

    .card-top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card-caption-title {
      font-size: 12px;
      font-weight: 800;
      color: var(--muted, #767a90);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .card-chevron-icon {
      font-size: 15px;
      color: #9ca3af;
      font-weight: 700;
    }

    .card-badge-pill {
      font-size: 10.5px;
      font-weight: 700;
      color: #ee4d6b;
      background: rgba(238, 77, 107, 0.1);
      padding: 2px 8px;
      border-radius: 99px;
    }

    .card-metric-body {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 6px;
    }

    .metric-big-num {
      font-size: clamp(19px, 4.5vw, 22px);
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--ink, #15172b);
      line-height: 1.1;
    }

    .metric-giant-num {
      font-size: clamp(22px, 5.2vw, 26px);
      font-weight: 900;
      letter-spacing: -0.03em;
      line-height: 1.1;
    }

    .metric-unit-tag {
      font-size: 12px;
      font-weight: 700;
      opacity: 0.65;
    }

    .metric-label-sub {
      font-size: 11px;
      font-weight: 600;
      color: var(--muted, #767a90);
      display: block;
      margin-top: 2px;
      line-height: 1.3;
    }

    .metric-split-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      margin-top: 4px;
      padding-top: 6px;
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
      font-size: 12.5px;
      font-weight: 800;
      color: var(--ink, #15172b);
      line-height: 1.2;
    }

    .metric-split-lbl {
      font-size: 9.5px;
      font-weight: 700;
      color: var(--muted, #767a90);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .card-badge-chip {
      font-size: 10.5px;
      font-weight: 800;
      color: #0fb27c;
      background: rgba(15, 178, 124, 0.1);
      padding: 2px 7px;
      border-radius: 99px;
    }

    /* Payback Accelerator Card */
    .payback-feature-card {
      background: var(--card, #ffffff);
      border-radius: 22px;
      padding: 18px;
      border: 1px solid var(--line, rgba(0, 0, 0, 0.06));
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
    }

    .payback-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .trend-eyebrow-pill {
      font-size: 11px;
      font-weight: 800;
      padding: 3px 9px;
      border-radius: 99px;
      display: inline-flex;
    }

    .eyebrow-amber {
      background: rgba(245, 158, 11, 0.1);
      color: #d97706;
    }

    .payback-heading {
      font-size: 15px;
      font-weight: 800;
      color: var(--ink, #15172b);
      margin: 4px 0 0;
      letter-spacing: -0.015em;
    }

    .payback-current-amount {
      font-size: 15px;
      font-weight: 900;
      color: #6c4cff;
      background: rgba(108, 76, 255, 0.08);
      padding: 5px 12px;
      border-radius: 99px;
    }

    .payback-slider-wrap {
      margin: 12px 0 14px;
    }

    .payback-slider-input {
      width: 100%;
      height: 6px;
      -webkit-appearance: none;
      appearance: none;
      background: linear-gradient(90deg, #6c4cff 0%, #0fb27c 100%);
      border-radius: 99px;
      outline: none;
      cursor: pointer;

      &::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #ffffff;
        border: 2.5px solid #6c4cff;
        box-shadow: 0 2px 8px rgba(108, 76, 255, 0.35);
        cursor: pointer;
      }
    }

    .slider-ticks {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      font-weight: 600;
      color: var(--muted, #767a90);
      margin-top: 6px;
    }

    .payback-results-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .payback-stat-tile {
      background: #f8f8fc;
      border-radius: 14px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .payback-stat-big {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: -0.01em;
    }

    .payback-stat-lbl {
      font-size: 10px;
      font-weight: 600;
      color: var(--muted, #767a90);
    }

    /* Statements Link Card */
    .statements-nav-card {
      background: var(--card, #ffffff);
      border: 1px solid var(--line, rgba(0, 0, 0, 0.06));
      border-radius: 18px;
      padding: 14px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
      transition: all 0.2s ease;

      &:hover {
        border-color: rgba(108, 76, 255, 0.2);
        transform: translateY(-1px);
      }

      &:active {
        transform: scale(0.99);
      }
    }

    .s-nav-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .s-nav-icon {
      font-size: 22px;
      flex-shrink: 0;
    }

    .s-nav-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .s-nav-title {
      font-size: 13.5px;
      font-weight: 800;
      color: var(--ink, #15172b);
    }

    .s-nav-sub {
      font-size: 11px;
      color: var(--muted, #767a90);
    }

    .s-nav-chevron {
      font-size: 18px;
      color: #9ca3af;
      font-weight: 700;
    }

    /* Recent Payments Feed (Minimalist) */
    .recent-tx-feed {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .recent-tx-card {
      background: var(--card, #ffffff);
      border: 1px solid var(--line, rgba(0, 0, 0, 0.05));
      border-radius: 16px;
      display: flex;
      align-items: center;
      padding: 2px 4px 2px 2px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
      transition: all 0.15s ease;

      &:hover {
        border-color: rgba(108, 76, 255, 0.2);
      }
    }

    .recent-tx-main {
      flex: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: transparent;
      border: none;
      padding: 10px 12px;
      font-family: inherit;
      cursor: pointer;
      text-align: left;
    }

    .recent-tx-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .recent-tx-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--ink, #15172b);
    }

    .recent-tx-meta {
      font-size: 11px;
      color: var(--muted, #767a90);
    }

    .recent-tx-amount {
      font-size: 13.5px;
      font-weight: 800;
      white-space: nowrap;

      &.text-success { color: #0fb27c; }
      &.text-neutral { color: var(--ink, #15172b); }
    }

    .recent-tx-del {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: none;
      background: transparent;
      color: var(--muted, #767a90);
      font-size: 11px;
      display: grid;
      place-items: center;
      cursor: pointer;
      margin-right: 4px;
      transition: all 0.15s ease;

      &:hover {
        background: rgba(238, 77, 107, 0.1);
        color: #ee4d6b;
      }
    }

    .recent-empty-card {
      background: var(--card, #ffffff);
      border-radius: 16px;
      padding: 24px;
      text-align: center;
      border: 1px dashed var(--line, rgba(0, 0, 0, 0.08));
      color: var(--muted, #767a90);
      font-size: 13px;

      p { margin: 0; }
    }

    /* Forensic Bottom Sheet Styles */
    .sheet-forensic-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-bottom: 20px;
    }

    .forensic-top-chips {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .forensic-chip {
      background: #f8f8fc;
      border-radius: 14px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;

      &.chip-danger { background: rgba(238, 77, 107, 0.08); }
      &.chip-amber { background: rgba(245, 158, 11, 0.08); }
    }

    .f-chip-val {
      font-size: 14px;
      font-weight: 800;
    }

    .f-chip-lbl {
      font-size: 10px;
      font-weight: 600;
      color: var(--muted, #767a90);
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

    /* Common utilities */
    .text-green { color: #0fb27c !important; }
    .text-coral { color: #ee4d6b !important; }
    .text-emerald { color: #0fb27c !important; }
    .text-cyan { color: #06b6d4 !important; }
    .text-purple { color: #6c4cff !important; }
    .text-amber { color: #f59e0b !important; }
    .tabular-nums { font-variant-numeric: tabular-nums; }
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
  readonly odWithdrawalSummary = computed(() => getOdWithdrawalsSummary());
  readonly paybackSliderPaise = signal<Paise>(toPaise(500000));
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
      return member ? `${member.name}` : 'Family Contribution';
    }
    if (tx.type === 'bankPayment') {
      if (tx.notes && tx.notes.includes('Direct Statement')) return 'Direct Statement Deposit';
      return 'Payment to Bank (EMI)';
    }
    if (tx.type === 'withdrawal') return 'OD Withdrawal';
    if (tx.type === 'principalAdjustment') return 'Balance Adjustment';
    if (tx.type === 'manualCorrection') return 'Bank Passbook Match';
    return 'Payment';
  }
}

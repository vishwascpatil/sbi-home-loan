import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LedgerStore, SettingsStore } from '../../core/state';
import {
  AvatarComponent,
  BarChartComponent,
  ConfirmSheetComponent,
} from '../../shared/ui';
import { CountUpDirective } from '../../shared/ui/count-up/count-up.directive';
import {
  ContributionTransaction,
  divideHalfUp,
  formatCompactPaise,
  formatPaise,
  getTransactionAmount,
  getTransactionMode,
  Paise,
  paise,
  simulateV2,
  toPaise,
  toRupees,
  Transaction,
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
    ConfirmSheetComponent,
    AddEditTransactionSheetComponent,
    DailyLedgerSheetComponent,
  ],
  template: `
    <div class="home-page-container">
      <!-- 1. Top User Profile Bar (Screenshot Matched) -->
      <header class="app-top-bar">
        <div class="user-profile-cluster">
          <app-avatar name="Vishwas" [size]="44" [circular]="true" />
          <div class="profile-text-wrap">
            <span class="profile-greeting">Welcome back</span>
            <h1 class="profile-user-name">Vishwas</h1>
          </div>
        </div>

        <a
          routerLink="/settings"
          class="top-circle-action-btn"
          aria-label="Settings"
          title="Settings"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </a>
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

        <!-- Hero Highlights Row: Today's Interest + Loan Cleared -->
        <div class="hero-pulse-strip">
          <div class="hero-glass-pill" (click)="isDailyLedgerOpen.set(true)" role="button" tabindex="0">
            <span class="pill-dot glow-amber"></span>
            <span class="pill-main tabular-nums">+{{ formatPaise(dailyInterestCalculation().dailyInterest) }}</span>
            <span class="pill-sub">Today</span>
          </div>

          <div class="hero-glass-pill">
            <span class="pill-dot glow-green"></span>
            <span class="pill-main tabular-nums">{{ repaidPercent().toFixed(1) }}%</span>
            <span class="pill-sub">Cleared ({{ formatCompactPaise(repaidAmount()) }})</span>
          </div>
        </div>
      </div>

      <!-- 3. Section: This Month & Payoff -->
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

      <!-- 4. Section: Monthly Deposit Trend -->
      <section class="home-section">
        <div class="trend-feature-card">
          <div class="trend-card-header">
            <div>
              <span class="trend-eyebrow-pill">Deposit Trend</span>
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
          <button type="button" class="section-see-all-btn" (click)="router.navigate(['/members/history'])">
            View all ›
          </button>
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
      padding: 0 0 96px;
    }

    /* 1. Top User Profile Bar */
    .app-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 8px 0 20px;
      padding: 0 4px;
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

    /* 2. Matte Black Hero Card (Bold, Minimal, High Contrast) */
    .matte-hero-banner {
      background: #111216;
      color: #ffffff;
      border-radius: 28px;
      padding: 22px 22px 20px;
      margin-bottom: 22px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.28);
      position: relative;
      overflow: hidden;
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
    }

    .lightning-bolt {
      color: #f59e0b;
      font-size: 13px;
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
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        background: rgba(255, 255, 255, 0.12);
        transform: translateY(-1.5px);
      }

      &:active {
        transform: scale(0.98);
      }
    }

    .pill-dot {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 7px;
      height: 7px;
      border-radius: 50%;

      &.glow-amber {
        background: #f59e0b;
        box-shadow: 0 0 10px rgba(245, 158, 11, 0.8);
      }

      &.glow-green {
        background: #10b981;
        box-shadow: 0 0 10px rgba(16, 185, 129, 0.8);
      }
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
      transition: color 0.15s ease;

      &:hover {
        color: #111216;
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
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.06);
      }

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
      border: none;
      width: 100%;
      border-radius: 22px;
      padding: 4px 6px 4px 4px;
      box-shadow: var(--shadow-card);
      display: flex;
      align-items: center;
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.22s ease;

      &:hover {
        transform: translateY(-1.5px);
        box-shadow: 0 6px 20px -2px rgba(0, 0, 0, 0.04);
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
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;

      &:hover {
        box-shadow: 0 10px 28px -4px rgba(0, 0, 0, 0.06);
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

  readonly isDeleteModalOpen = signal<boolean>(false);
  readonly txToDelete = signal<Transaction | null>(null);

  readonly deleteModalMessage = computed(() => {
    const tx = this.txToDelete();
    if (!tx) return '';
    return `Are you sure you want to delete this payment of ${formatPaise(getTransactionAmount(tx))} (${this.getTxTitle(tx)})? All loan balances will automatically recalculate.`;
  });

  readonly summary = this.ledgerStore.thisMonthSummary;

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

  readonly repaidAmount = computed<Paise>(() => {
    const lim = this.ledgerStore.loan().sanctionedLimit;
    const out = this.ledgerStore.currentOutstanding();
    return Math.max(0, lim - out) as Paise;
  });

  readonly repaidPercent = computed(() => {
    const lim = this.ledgerStore.loan().sanctionedLimit;
    if (lim <= 0) return 0;
    return (this.repaidAmount() / lim) * 100;
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

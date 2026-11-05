import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LedgerStore } from '../../core/state';
import {
  AmortizationAreaChartComponent,
  AvatarComponent,
  BarChartComponent,
  ContributionHeatmapComponent,
  CountUpDirective,
  OverlayProjectionChartComponent,
  ProgressBarComponent,
  ToastService,
} from '../../shared/ui';
import {
  computeAmortizationHistory,
  computeContributionHeatmap,
  computeMemberConsistencyScores,
  computeRupeeSplit,
  ContributionTransaction,
  DrawdownEvent,
  formatCompactPaise,
  formatPaise,
  Paise,
  paise,
  PrepaymentEvent,
  SavedScenario,
  simulateV2,
  subPaise,
  toPaise,
  toRupees,
  ZERO_PAISE,
} from '../../core/engine';

const MEMBER_COLORS = ['#111216', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'];

@Component({
  selector: 'app-insights',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    CountUpDirective,
    BarChartComponent,
    AvatarComponent,
    ProgressBarComponent,
    OverlayProjectionChartComponent,
    AmortizationAreaChartComponent,
    ContributionHeatmapComponent,
  ],
  template: `
    <div class="insights-page-container">
      <!-- 1. Top Bar (Matching Screenshot, Home & Members) -->
      <header class="app-top-bar">
        <div class="user-profile-cluster">
          <div class="profile-avatar-circle" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 3v18h18"></path>
              <path d="m19 9-5 5-4-4-3 3"></path>
            </svg>
          </div>
          <div class="profile-text-wrap">
            <span class="profile-greeting">Loan Forecast & Stats</span>
            <h1 class="profile-user-name">Loan Insights</h1>
          </div>
        </div>

        <button
          type="button"
          class="top-circle-action-btn"
          (click)="promptSaveScenario()"
          aria-label="Save this calculation plan"
          title="Save Plan"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#111216" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
        </button>
      </header>

      <!-- 2. Matte Black Hero Banner ("Go Premium" style in screenshot) -->
      <div class="matte-hero-banner" role="region" aria-label="Debt Free Target Overview">
        <div class="hero-left-content">
          <div class="hero-badge-pill">
            <span class="lightning-bolt">⚡</span>
            <span>Debt-Free Target · Daily Interest</span>
          </div>
          <div class="hero-number-wrap">
            @if (customSimResult()) {
              <div class="hero-balance-headline tabular-nums">
                {{ customSimResult()!.closureDate }}
              </div>
              <span class="hero-balance-sub">
                Takes {{ customSimResult()!.months }} months ·
                {{ interestDifference().isSaved ? 'Saves ' : 'Costs ' }}
                {{ formatCompactPaise(interestDifference().interestSaved) }} in interest
              </span>
            } @else {
              <div class="hero-balance-headline">Increase Monthly Payment</div>
              <span class="hero-balance-sub">Monthly payment is too small to cover bank interest</span>
            }
          </div>
        </div>

        <button
          type="button"
          class="hero-circle-cta"
          (click)="scrollToSimulator()"
          aria-label="Change Monthly Payment"
          title="Try Different Monthly Payment"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#111216" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      <!-- 3. Section: Overview Dual Squircle Grid ("Wellness" style in screenshot) -->
      <section class="page-section">
        <h2 class="section-main-heading">Quick Summary</h2>

        <div class="dual-squircle-grid">
          <!-- Card 1: Monthly Deposit Average -->
          <div class="squircle-metric-card">
            <div class="card-top-header">
              <span class="card-caption-title">Average Monthly Deposit</span>
              <span class="card-chevron-icon">›</span>
            </div>
            <div class="card-metric-body">
              <div class="metric-pair">
                <span class="metric-big-num tabular-nums" [appCountUp]="monthlyAverage()">
                  {{ formatPaise(monthlyAverage()) }}
                </span>
                <span class="metric-label-sub">Average collected per month</span>
              </div>
              <div class="metric-pair secondary">
                <span class="metric-small-num">
                  Top Contributor: {{ highestContributor().name }}
                </span>
                <span class="metric-label-sub">{{ formatCompactPaise(highestContributor().lifetimeContribution) }} total paid</span>
              </div>
            </div>
          </div>

          <!-- Card 2: Rupee Equity Ratio -->
          <div class="squircle-metric-card">
            <div class="card-top-header">
              <span class="card-caption-title">Where Your Money Goes</span>
              <span class="card-chevron-icon">›</span>
            </div>
            <div class="card-metric-body">
              <div class="metric-stat-row">
                <div>
                  <span class="metric-big-num">{{ rupeeSplit().principalPercent.toFixed(0) }}%</span>
                  <span class="metric-label-sub">Loan Reduced</span>
                </div>
                <div>
                  <span class="metric-big-num">{{ rupeeSplit().interestPercent.toFixed(0) }}%</span>
                  <span class="metric-label-sub">Bank Interest</span>
                </div>
              </div>
              <!-- Mini Dual Split Track -->
              <div class="mini-split-track">
                <div class="split-fill principal" [style.width.%]="rupeeSplit().principalPercent"></div>
                <div class="split-fill interest" [style.width.%]="rupeeSplit().interestPercent"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. Section: Repayment Simulator v2 -->
      <section class="page-section" id="simulator-section">
        <div class="insight-squircle-card">
          <div class="card-header-action-row">
            <div>
              <h2 class="card-main-title">What-If Calculator</h2>
              <span class="card-sub-caption">See how paying extra or changing interest rates helps you finish faster</span>
            </div>
            <button type="button" class="action-pill-black" (click)="promptSaveScenario()">
              💾 Save Plan
            </button>
          </div>

          <!-- Saved Scenarios Chips -->
          @if (savedScenarios().length > 0) {
            <div class="saved-scenarios-bar">
              <span class="saved-label">Saved Plans:</span>
              <div class="saved-chips-scroll">
                @for (sc of savedScenarios(); track sc.id) {
                  <button type="button" class="saved-chip" (click)="loadSavedScenario(sc)">
                    <span>{{ sc.name }}</span>
                    <button
                      type="button"
                      class="del-scenario-icon"
                      (click)="deleteSavedScenario(sc.id, $event)"
                      aria-label="Delete saved plan"
                    >
                      ✕
                    </button>
                  </button>
                }
              </div>
            </div>
          }

          <!-- Interactive Controls Grid -->
          <div class="sim-controls-grid">
            <div class="sim-field">
              <label class="custom-label" for="custom-payment">Monthly Amount You Pay (₹)</label>
              <input
                id="custom-payment"
                type="number"
                class="sim-input tabular-nums"
                [ngModel]="customPaymentInput()"
                (ngModelChange)="onCustomPaymentChange($event)"
                min="1000"
                step="5000"
              />
            </div>

            <div class="sim-field">
              <label class="custom-label" for="pay-day">Day You Pay Each Month</label>
              <select
                id="pay-day"
                class="sim-select"
                [ngModel]="paymentDayOfMonth()"
                (ngModelChange)="paymentDayOfMonth.set(+$event)"
              >
                <option [value]="1">1st of month</option>
                <option [value]="5">5th of month (Standard Due Date)</option>
                <option [value]="10">10th of month</option>
                <option [value]="15">15th of month</option>
                <option [value]="20">20th of month</option>
                <option [value]="25">25th of month</option>
                <option [value]="28">28th of month</option>
              </select>
            </div>
          </div>

          <!-- Rate Shift Selector -->
          <div class="rate-shift-row">
            <span class="custom-label">If Bank Changes Interest Rate:</span>
            <div class="rate-shift-chips">
              @for (shift of rateShiftOptions; track shift.value) {
                <button
                  type="button"
                  class="shift-chip"
                  [class.active]="rateShiftBps() === shift.value"
                  (click)="rateShiftBps.set(shift.value)"
                >
                  {{ shift.label }}
                </button>
              }
            </div>
          </div>

          <!-- Prepayments & Drawdowns Management -->
          <div class="events-management-row">
            <div class="event-col">
              <div class="event-col-header">
                <span class="custom-label">Extra Lump-Sum Payments</span>
                <button type="button" class="add-event-mini-btn" (click)="addPrepaymentPrompt()">
                  ＋ Add Extra Payment
                </button>
              </div>
              @if (prepayments().length > 0) {
                <div class="event-chips-list">
                  @for (p of prepayments(); track $index) {
                    <span class="event-pill prepay">
                      {{ p.date }}: +{{ formatCompactPaise(p.amount) }}
                      <button type="button" (click)="removePrepayment($index)" aria-label="Remove extra payment">✕</button>
                    </span>
                  }
                </div>
              } @else {
                <span class="empty-subtext">No extra payments added</span>
              }
            </div>

            <div class="event-col">
              <div class="event-col-header">
                <span class="custom-label">Extra Money Taken (Withdrawals)</span>
                <button type="button" class="add-event-mini-btn" (click)="addDrawdownPrompt()">
                  ＋ Add Withdrawal
                </button>
              </div>
              @if (drawdowns().length > 0) {
                <div class="event-chips-list">
                  @for (d of drawdowns(); track $index) {
                    <span class="event-pill draw">
                      {{ d.date }}: −{{ formatCompactPaise(d.amount) }}
                      <button type="button" (click)="removeDrawdown($index)" aria-label="Remove withdrawal">✕</button>
                    </span>
                  }
                </div>
              } @else {
                <span class="empty-subtext">No extra money taken</span>
              }
            </div>
          </div>

          <!-- Overlay Trajectory Chart -->
          @if (customSimResult() && baselineSimResult()) {
            <div class="chart-embed-wrapper">
              <app-overlay-projection-chart
                [baselineSchedule]="baselineSimResult()!.schedule"
                [scenarioSchedule]="customSimResult()!.schedule"
              />
            </div>
          }

          <!-- Side-by-Side Comparison Metrics Card -->
          @if (customSimResult()) {
            <div class="sim-summary-tile">
              <div class="sim-stat-box">
                <span class="sim-stat-label">Debt-Free Date</span>
                <span class="sim-stat-val">{{ customSimResult()!.closureDate }}</span>
                <span class="sim-stat-sub">{{ customSimResult()!.months }} months</span>
              </div>
              <div class="sim-stat-box">
                <span class="sim-stat-label">Future Bank Interest</span>
                <span class="sim-stat-val tabular-nums">{{ formatPaise(customSimResult()!.totalInterest) }}</span>
                <span class="sim-stat-sub highlight">
                  {{ interestDifference().isSaved ? 'Saves ' : 'Costs ' }}
                  {{ formatCompactPaise(interestDifference().interestSaved) }} in interest
                </span>
              </div>
              <div class="sim-stat-box">
                <span class="sim-stat-label">Total Money You Will Pay</span>
                <span class="sim-stat-val tabular-nums">{{ formatCompactPaise(customSimResult()!.totalPaid) }}</span>
                <span class="sim-stat-sub">Loan Balance + Bank Interest</span>
              </div>
            </div>
          } @else {
            <div class="alert-fail-card">
              ⚠️ The loan will never finish with this payment: the amount is too small to cover the bank's monthly interest.
            </div>
          }
        </div>
      </section>

      <!-- 5. Section: Contribution Analytics & Trend -->
      <section class="page-section">
        <div class="insight-squircle-card">
          <h2 class="card-main-title">Monthly Deposit Trend</h2>
          <span class="card-sub-caption">Total money the family deposited each month over past 6 months</span>

          <div class="stats-3-grid">
            <div class="stat-mini-card">
              <span class="stat-mini-label">Average / Month</span>
              <strong class="stat-mini-val tabular-nums">{{ formatPaise(monthlyAverage()) }}</strong>
              <small class="stat-mini-sub">6 month average</small>
            </div>
            <div class="stat-mini-card">
              <span class="stat-mini-label">Highest Contributor</span>
              <strong class="stat-mini-val">{{ highestContributor().name || '—' }}</strong>
              <small class="stat-mini-sub tabular-nums">{{ formatCompactPaise(highestContributor().lifetimeContribution) }} total</small>
            </div>
            <div class="stat-mini-card">
              <span class="stat-mini-label">Lowest Contributor</span>
              <strong class="stat-mini-val">{{ lowestContributor().name || '—' }}</strong>
              <small class="stat-mini-sub tabular-nums">{{ formatCompactPaise(lowestContributor().lifetimeContribution) }} total</small>
            </div>
          </div>

          <div class="chart-embed-wrapper" style="margin-top: 20px">
            <span class="custom-label" style="margin-bottom: 8px; display: block">Total Deposited Each Month (₹)</span>
            <app-bar-chart [data]="monthlyBarData()" />
          </div>
        </div>
      </section>

      <!-- 6. Section: Share of Contributions -->
      <section class="page-section">
        <div class="insight-squircle-card">
          <h2 class="card-main-title">Who Contributed What (Total Ever)</h2>
          <span class="card-sub-caption">Percentage of all money paid by each family member since start</span>

          <div class="share-breakdown-list">
            @for (m of ledgerStore.memberStats(); track m.memberId) {
              <div class="share-row">
                <div class="share-row-top">
                  <div class="member-pill">
                    <app-avatar [name]="m.name" [colorIndex]="$index" [size]="28" [avatarUrl]="m.avatarUrl" />
                    <span class="m-name">{{ m.name }}</span>
                  </div>
                  <span class="m-percent tabular-nums">{{ m.sharePercentage.toFixed(1) }}%</span>
                </div>
                <app-progress-bar
                  [progressPercent]="m.sharePercentage"
                  [height]="6"
                  [color]="getColor($index)"
                />
              </div>
            }
          </div>
        </div>
      </section>

      <!-- 7. Section: Where Each Rupee Went -->
      <section class="page-section">
        <div class="insight-squircle-card">
          <h2 class="card-main-title">Where Did All Your Money Go?</h2>
          <span class="card-sub-caption">How much of your money actually reduced the loan vs went to bank interest</span>

          <div class="rupee-split-container">
            <div class="split-bar-track">
              <div
                class="split-segment principal"
                [style.width.%]="rupeeSplit().principalPercent"
                [title]="'Reduced Loan: ' + rupeeSplit().principalPercent.toFixed(1) + '%'"
              ></div>
              <div
                class="split-segment interest"
                [style.width.%]="rupeeSplit().interestPercent"
                [title]="'Bank Interest: ' + rupeeSplit().interestPercent.toFixed(1) + '%'"
              ></div>
            </div>

            <div class="split-stats-grid">
              <div class="split-stat-card principal">
                <span class="stat-badge green">Reduced Your Loan</span>
                <strong class="stat-amount tabular-nums">{{ formatPaise(rupeeSplit().totalPrincipalReduced) }}</strong>
                <small class="stat-percent">{{ rupeeSplit().principalPercent.toFixed(1) }}% of total paid</small>
              </div>
              <div class="split-stat-card interest">
                <span class="stat-badge dark">Bank Interest Charges</span>
                <strong class="stat-amount tabular-nums">{{ formatPaise(rupeeSplit().totalInterestPaid) }}</strong>
                <small class="stat-percent">{{ rupeeSplit().interestPercent.toFixed(1) }}% of total paid</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 8. Section: Historical Amortization -->
      <section class="page-section">
        <div class="insight-squircle-card">
          <h2 class="card-main-title">Loan Reduction vs Interest Over Time</h2>
          <span class="card-sub-caption">Track how the loan goes down as you keep paying interest</span>
          <div class="chart-embed-wrapper">
            <app-amortization-area-chart [points]="amortizationHistory()" />
          </div>
        </div>
      </section>

      <!-- 9. Section: 365-Day Contribution Activity -->
      <section class="page-section">
        <div class="insight-squircle-card">
          <h2 class="card-main-title">Yearly Payment Calendar</h2>
          <span class="card-sub-caption">Days when family members deposited money over the last year</span>
          <div class="chart-embed-wrapper">
            <app-contribution-heatmap [days]="contributionHeatmapDays()" />
          </div>
        </div>
      </section>

      <!-- 10. Section: Member Consistency & Streaks -->
      <section class="page-section">
        <div class="insight-squircle-card">
          <h2 class="card-main-title">On-Time Payment Streaks</h2>
          <span class="card-sub-caption">Who pays regularly on or before the 5th of each month</span>

          <div class="consistency-list">
            @for (c of memberConsistency(); track c.memberId) {
              <div class="consistency-row">
                <div class="member-info-col">
                  <app-avatar [name]="c.name" [colorIndex]="$index" [size]="32" />
                  <div>
                    <strong class="c-name">{{ c.name }}</strong>
                    <small class="c-streak">🔥 {{ c.currentStreakMonths }} month streak</small>
                  </div>
                </div>

                <div class="metrics-col">
                  <div class="metric-pill">
                    <span class="pill-label">On-Time</span>
                    <span class="pill-val" [class.high]="c.onTimePercent >= 80">{{ c.onTimePercent }}%</span>
                  </div>
                  <div class="metric-pill">
                    <span class="pill-label">Target Met</span>
                    <span class="pill-val" [class.high]="c.targetAdherencePercent >= 80">{{ c.targetAdherencePercent }}%</span>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      </section>
    </div>
  `,
  styles: `
    .insights-page-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow-x: hidden;
      padding: 0 0 96px;
    }

    /* 1. Top Bar */
    .app-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 8px 0 20px;
      padding: 0 4px;
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
      border: 1px solid rgba(0, 0, 0, 0.04);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        background: #f7f8fa;
        transform: scale(1.05);
      }

      &:active {
        transform: scale(0.95);
      }
    }

    /* 2. Matte Black Hero Card */
    .matte-hero-banner {
      background: #111216;
      color: #ffffff;
      border-radius: 28px;
      padding: 22px 24px;
      margin-bottom: 26px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 12px 32px -6px rgba(0, 0, 0, 0.22);
      cursor: pointer;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        transform: translateY(-2px);
      }

      &:active {
        transform: scale(0.99);
      }
    }

    .hero-left-content {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .hero-badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
      letter-spacing: -0.01em;
    }

    .lightning-bolt {
      color: #f59e0b;
      font-size: 14px;
    }

    .hero-number-wrap {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .hero-balance-headline {
      font-size: clamp(24px, 6vw, 32px);
      font-weight: 800;
      letter-spacing: -0.035em;
      line-height: 1.1;
      color: #ffffff;
    }

    .hero-balance-sub {
      font-size: 12px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.6);
    }

    .hero-circle-cta {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #ffffff;
      border: none;
      display: grid;
      place-items: center;
      cursor: pointer;
      flex-shrink: 0;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        transform: scale(1.08);
      }

      &:active {
        transform: scale(0.92);
      }
    }

    /* 3. Section Containers */
    .page-section {
      display: flex;
      flex-direction: column;
      margin-bottom: 24px;
    }

    .section-main-heading {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #111216;
      margin: 0 0 14px 4px;
    }

    /* Dual Squircle Grid */
    .dual-squircle-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .squircle-metric-card {
      background: #ffffff;
      border-radius: 26px;
      padding: 18px 20px;
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 140px;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.05);
      }
    }

    .card-top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card-caption-title {
      font-size: 14px;
      font-weight: 700;
      color: #111216;
      letter-spacing: -0.01em;
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
    }

    .metric-pair {
      display: flex;
      flex-direction: column;
      gap: 2px;
      &.secondary { margin-top: 4px; }
    }

    .metric-big-num {
      font-size: clamp(18px, 4.5vw, 22px);
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #111216;
      line-height: 1.15;
    }

    .metric-small-num {
      font-size: 13px;
      font-weight: 700;
      color: #4b4c52;
    }

    .metric-label-sub, .stat-mini-sub, .stat-percent, .empty-subtext, .c-streak {
      font-size: 11px;
      font-weight: 500;
      color: #8e8e93;
    }

    .metric-stat-row {
      display: flex;
      gap: 16px;
    }

    .mini-split-track {
      height: 6px;
      border-radius: 99px;
      background: #f2f3f6;
      display: flex;
      overflow: hidden;
      margin-top: 4px;
    }

    .split-fill {
      height: 100%;
      &.principal { background: #0fb27c; }
      &.interest { background: #111216; }
    }

    /* 4. Luxury Squircle Card Component */
    .insight-squircle-card {
      background: #ffffff;
      border-radius: 26px;
      padding: 22px 24px;
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .card-main-title {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #111216;
      margin: 0;
    }

    .card-sub-caption {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #8e8e93;
      margin-top: 2px;
    }

    .card-header-action-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }

    .action-pill-black {
      background: #111216;
      color: #ffffff;
      border-radius: 9999px;
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        background: #2a2b32;
        transform: translateY(-1px);
      }

      &:active {
        transform: scale(0.96);
      }
    }

    /* Saved Scenarios Bar */
    .saved-scenarios-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: #f8f9fb;
      border-radius: 18px;
    }

    .saved-label {
      font-size: 11px;
      font-weight: 700;
      color: #8e8e93;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .saved-chips-scroll {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .saved-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 9999px;
      background: #ffffff;
      border: none;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
      font-size: 12px;
      font-weight: 700;
      color: #111216;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;

      &:hover {
        transform: translateY(-1px);
      }
    }

    .del-scenario-icon {
      background: transparent;
      border: none;
      color: #8e8e93;
      font-size: 11px;
      cursor: pointer;
      padding: 0 2px;
      &:hover { color: #ee4d6b; }
    }

    /* Controls & Inputs */
    .sim-controls-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-top: 4px;
    }

    .sim-field, .rate-shift-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .custom-label, .sim-stat-label, .stat-mini-label, .pill-label {
      font-size: 10px;
      font-weight: 700;
      color: #8e8e93;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .sim-input, .sim-select {
      width: 100%;
      height: 44px;
      border-radius: 16px;
      border: none;
      background: #f8f9fb;
      color: #111216;
      padding: 0 14px;
      font-size: 14px;
      font-weight: 700;
      font-family: inherit;
      outline: none;
      transition: box-shadow 0.2s ease;

      &:focus {
        box-shadow: 0 0 0 2px #111216;
        background: #ffffff;
      }
    }

    .rate-shift-chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .shift-chip {
      padding: 6px 14px;
      border-radius: 9999px;
      border: none;
      background: #f2f3f6;
      color: #111216;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover { background: #e5e7eb; }
      &.active {
        background: #111216;
        color: #ffffff;
      }
    }

    /* Prepayments & Drawdowns */
    .events-management-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .event-col {
      background: #f8f9fb;
      border-radius: 18px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .event-col-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .add-event-mini-btn {
      background: transparent;
      border: none;
      color: #111216;
      font-size: 11px;
      font-weight: 800;
      cursor: pointer;
      padding: 2px 4px;
      &:hover { text-decoration: underline; }
    }

    .event-chips-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .event-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;

      button {
        background: transparent;
        border: none;
        font-size: 9px;
        cursor: pointer;
        color: inherit;
      }

      &.prepay {
        background: rgba(15, 178, 124, 0.15);
        color: #0fb27c;
      }

      &.draw {
        background: rgba(238, 77, 107, 0.15);
        color: #ee4d6b;
      }
    }

    /* Summary & Stats Tiles */
    .sim-summary-tile, .stats-3-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .sim-summary-tile {
      background: #f8f9fb;
      border-radius: 18px;
      padding: 14px 16px;
    }

    .sim-stat-box, .stat-mini-card {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .stat-mini-card {
      background: #f8f9fb;
      border-radius: 18px;
      padding: 12px 14px;
    }

    .sim-stat-val, .stat-mini-val {
      font-size: 14px;
      font-weight: 800;
      color: #111216;
      letter-spacing: -0.02em;
    }

    .sim-stat-sub {
      font-size: 11px;
      color: #8e8e93;
      font-weight: 500;
      &.highlight {
        color: #0fb27c;
        font-weight: 700;
      }
    }

    .alert-fail-card {
      padding: 12px 14px;
      border-radius: 18px;
      background: rgba(238, 77, 107, 0.12);
      color: #ee4d6b;
      font-size: 12px;
      font-weight: 700;
      text-align: center;
    }

    .chart-embed-wrapper {
      margin-top: 4px;
    }

    /* Share Breakdown */
    .share-breakdown-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 4px;
    }

    .share-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .share-row-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .member-pill {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .m-name {
      font-size: 14px;
      font-weight: 800;
      color: #111216;
    }

    .m-percent {
      font-size: 13px;
      font-weight: 800;
      color: #8e8e93;
    }

    /* Rupee Split */
    .rupee-split-container {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .split-bar-track {
      height: 18px;
      border-radius: 99px;
      background: #f2f3f6;
      display: flex;
      overflow: hidden;
    }

    .split-segment {
      height: 100%;
      transition: width 0.3s ease;
      &.principal { background: #0fb27c; }
      &.interest { background: #111216; }
    }

    .split-stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .split-stat-card {
      background: #f8f9fb;
      border-radius: 18px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .stat-badge {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 9999px;
      width: fit-content;

      &.green {
        background: rgba(15, 178, 124, 0.15);
        color: #0fb27c;
      }

      &.dark {
        background: #111216;
        color: #ffffff;
      }
    }

    .stat-amount {
      font-size: 16px;
      font-weight: 800;
      color: #111216;
      letter-spacing: -0.02em;
    }

    /* Consistency List */
    .consistency-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .consistency-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 14px;
      background: #f8f9fb;
      border-radius: 18px;
    }

    .member-info-col {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .c-name {
      display: block;
      font-size: 14px;
      font-weight: 800;
      color: #111216;
    }

    .metrics-col {
      display: flex;
      gap: 8px;
    }

    .metric-pill {
      background: #ffffff;
      padding: 4px 10px;
      border-radius: 12px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .pill-val {
      font-size: 12px;
      font-weight: 800;
      color: #111216;
      &.high { color: #0fb27c; }
    }
  `,
})
export class InsightsComponent {
  readonly ledgerStore = inject(LedgerStore);
  readonly toast = inject(ToastService);

  readonly amortizationHistory = computed(() => {
    return computeAmortizationHistory(this.ledgerStore.ledgerState());
  });

  readonly rupeeSplit = computed(() => {
    return computeRupeeSplit(this.ledgerStore.ledgerState());
  });

  readonly contributionHeatmapDays = computed(() => {
    return computeContributionHeatmap(this.ledgerStore.ledgerState());
  });

  readonly memberConsistency = computed(() => {
    return computeMemberConsistencyScores(this.ledgerStore.ledgerState());
  });

  readonly formatPaise = formatPaise;
  readonly formatCompactPaise = formatCompactPaise;

  readonly customPaymentInput = signal<number>(240000);
  readonly paymentDayOfMonth = signal<number>(5);
  readonly rateShiftBps = signal<number>(0);
  readonly prepayments = signal<PrepaymentEvent[]>([]);
  readonly drawdowns = signal<DrawdownEvent[]>([]);

  readonly rateShiftOptions = [
    { label: '−0.50%', value: -50 },
    { label: '−0.25%', value: -25 },
    { label: 'Current Rate', value: 0 },
    { label: '+0.25%', value: 25 },
    { label: '+0.50%', value: 50 },
  ];

  readonly savedScenarios = computed<SavedScenario[]>(() => {
    return this.ledgerStore.loan().savedScenarios || [];
  });

  readonly methodLabel = computed(() => {
    return this.ledgerStore.loan().calculationMethod === 'daily'
      ? 'Daily OD (Day-Accurate)'
      : 'Monthly reducing balance';
  });

  readonly monthlyBarData = computed(() => {
    const txs = this.ledgerStore
      .transactions()
      .filter((t): t is ContributionTransaction => t.type === 'contribution' && !t.deletedAt);
    const monthsMap = new Map<string, number>();

    const now = new Date();
    for (let k = 5; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsMap.set(key, 0);
    }

    for (const t of txs) {
      if (monthsMap.has(t.forMonth)) {
        monthsMap.set(t.forMonth, (monthsMap.get(t.forMonth) || 0) + t.amount / 100);
      }
    }

    return Array.from(monthsMap.entries()).map(([monthKey, val]) => {
      const d = new Date(`${monthKey}-01T12:00:00`);
      const label = d.toLocaleDateString('en-IN', { month: 'short' });
      return { label, value: Math.round(val) };
    });
  });

  readonly monthlyAverage = computed<Paise>(() => {
    const bars = this.monthlyBarData();
    const sum = bars.reduce((s, b) => s + b.value, 0);
    const avg = bars.length > 0 ? Math.round(sum / bars.length) : 0;
    return toPaise(avg);
  });

  readonly highestContributor = computed(() => {
    const list = [...this.ledgerStore.memberStats()].sort(
      (a, b) => b.lifetimeContribution - a.lifetimeContribution
    );
    return list[0] ?? { name: '—', lifetimeContribution: ZERO_PAISE };
  });

  readonly lowestContributor = computed(() => {
    const list = [...this.ledgerStore.memberStats()].sort(
      (a, b) => a.lifetimeContribution - b.lifetimeContribution
    );
    return list[0] ?? { name: '—', lifetimeContribution: ZERO_PAISE };
  });

  readonly baselineSimResult = computed(() => {
    const principal = this.ledgerStore.currentOutstanding();
    const rateBps = this.ledgerStore.loan().currentRateBps;
    return simulateV2({
      principal,
      monthlyPayment: toPaise(240000),
      rateBps,
      paymentDayOfMonth: 5,
      rateShiftBps: 0,
      prepayments: [],
      drawdowns: [],
      dayCountBasis: this.ledgerStore.loan().bankRules?.dayCountBasis || 'actual/365',
    });
  });

  readonly customSimResult = computed(() => {
    const principal = this.ledgerStore.currentOutstanding();
    const rateBps = this.ledgerStore.loan().currentRateBps;
    const payment = toPaise(this.customPaymentInput() || 0);

    return simulateV2({
      principal,
      monthlyPayment: payment,
      rateBps,
      paymentDayOfMonth: this.paymentDayOfMonth(),
      rateShiftBps: this.rateShiftBps(),
      prepayments: this.prepayments(),
      drawdowns: this.drawdowns(),
      dayCountBasis: this.ledgerStore.loan().bankRules?.dayCountBasis || 'actual/365',
    });
  });

  readonly interestDifference = computed(() => {
    const base = this.baselineSimResult();
    const custom = this.customSimResult();
    if (!base || !custom) {
      return { interestSaved: paise(0), isSaved: false };
    }
    const diff = subPaise(base.totalInterest, custom.totalInterest);
    return {
      interestSaved: paise(Math.abs(diff)),
      isSaved: diff >= 0,
    };
  });

  onCustomPaymentChange(val: number): void {
    this.customPaymentInput.set(val || 0);
  }

  getColor(index: number): string {
    return MEMBER_COLORS[index % MEMBER_COLORS.length]!;
  }

  scrollToSimulator(): void {
    const el = document.getElementById('simulator-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  addPrepaymentPrompt(): void {
    const today = new Date().toISOString().slice(0, 10);
    const dateStr = window.prompt('Enter prepayment date (YYYY-MM-DD):', today);
    if (!dateStr) return;
    const amountStr = window.prompt('Enter prepayment amount (₹):', '100000');
    if (!amountStr) return;
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) return;

    this.prepayments.update((prev) => [
      ...prev,
      { date: dateStr.trim(), amount: toPaise(amt) },
    ]);
    this.toast.show(`Prepayment of ₹${amt.toLocaleString('en-IN')} added`, 'success');
  }

  removePrepayment(index: number): void {
    this.prepayments.update((prev) => prev.filter((_, i) => i !== index));
  }

  addDrawdownPrompt(): void {
    const today = new Date().toISOString().slice(0, 10);
    const dateStr = window.prompt('Enter drawdown date (YYYY-MM-DD):', today);
    if (!dateStr) return;
    const amountStr = window.prompt('Enter drawdown amount (₹):', '50000');
    if (!amountStr) return;
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) return;

    this.drawdowns.update((prev) => [
      ...prev,
      { date: dateStr.trim(), amount: toPaise(amt) },
    ]);
    this.toast.show(`Drawdown of ₹${amt.toLocaleString('en-IN')} added`, 'info');
  }

  removeDrawdown(index: number): void {
    this.drawdowns.update((prev) => prev.filter((_, i) => i !== index));
  }

  async promptSaveScenario(): Promise<void> {
    const name = window.prompt('Enter a name for this scenario:', 'Aggressive Payoff');
    if (!name || !name.trim()) return;

    await this.ledgerStore.saveScenario({
      name: name.trim(),
      monthlyPayment: toPaise(this.customPaymentInput()),
      paymentDayOfMonth: this.paymentDayOfMonth(),
      rateShiftBps: this.rateShiftBps(),
      prepayments: this.prepayments(),
      drawdowns: this.drawdowns(),
    });

    this.toast.show(`Scenario "${name.trim()}" saved`, 'success');
  }

  loadSavedScenario(sc: SavedScenario): void {
    this.customPaymentInput.set(toRupees(sc.monthlyPayment));
    this.paymentDayOfMonth.set(sc.paymentDayOfMonth);
    this.rateShiftBps.set(sc.rateShiftBps);
    this.prepayments.set([...sc.prepayments]);
    this.drawdowns.set([...sc.drawdowns]);
    this.toast.show(`Loaded scenario "${sc.name}"`, 'info');
  }

  async deleteSavedScenario(id: string, event: Event): Promise<void> {
    event.stopPropagation();
    await this.ledgerStore.deleteScenario(id);
    this.toast.show('Scenario deleted', 'danger');
  }
}

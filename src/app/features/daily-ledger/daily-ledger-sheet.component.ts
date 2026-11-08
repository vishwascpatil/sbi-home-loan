import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BottomSheetComponent } from '../../shared/ui';
import { LedgerStore } from '../../core/state';
import {
  formatCompactPaise,
  formatPaise,
  getSbiAvailableMonths,
  Paise,
  paise,
  SbiAvailableMonth,
  SbiDailyMonthSummary,
  SbiDailyRecord,
  triggerHaptic,
} from '../../core/engine';

@Component({
  selector: 'app-daily-ledger-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, BottomSheetComponent],
  template: `
    <app-bottom-sheet
      [isOpen]="isOpen()"
      [title]="'Daily Interest Breakdown'"
      (dismissed)="dismissed.emit()"
    >
      <div class="daily-ledger-body">
        <!-- 1. Sleek Month Navigator Bar (From June 2024 to Nov 2026) -->
        <div class="month-nav-bar">
          <button
            type="button"
            class="nav-step-btn"
            [disabled]="!canGoPrevious()"
            (click)="goToPreviousMonth()"
            aria-label="Previous Month"
          >
            ‹ Prev
          </button>

          <div class="month-capsule-wrap">
            <select
              id="ledger-period-input"
              class="month-capsule-select"
              [ngModel]="selectedPeriod()"
              (ngModelChange)="setPeriod($event)"
              aria-label="Select month"
            >
              @for (m of availableMonths; track m.period) {
                <option [value]="m.period">
                  {{ m.label }} {{ m.period === '2024-06' ? '🏛️ Loan Disbursal' : (m.period === '2024-09' ? '⭐ Peak Deposit' : (m.isCurrent ? '⚡ Current' : '')) }}
                </option>
              }
            </select>
            <span class="dropdown-arrow-icon" aria-hidden="true">▾</span>
          </div>

          <button
            type="button"
            class="nav-step-btn"
            [disabled]="!canGoNext()"
            (click)="goToNextMonth()"
            aria-label="Next Month"
          >
            Next ›
          </button>
        </div>

        <!-- 2. Fast Era Jump Pills -->
        <div class="fast-jump-track">
          <button
            type="button"
            class="jump-pill"
            [class.active]="selectedPeriod() === '2026-11'"
            (click)="setPeriod('2026-11')"
          >
            Nov '26 (Current)
          </button>
          <button
            type="button"
            class="jump-pill"
            [class.active]="selectedPeriod() === '2026-01'"
            (click)="setPeriod('2026-01')"
          >
            Jan '26 (7.65% Cut)
          </button>
          <button
            type="button"
            class="jump-pill"
            [class.active]="selectedPeriod() === '2025-07'"
            (click)="setPeriod('2025-07')"
          >
            Jul '25 (7.90% Era)
          </button>
          <button
            type="button"
            class="jump-pill"
            [class.active]="selectedPeriod() === '2024-09'"
            (click)="setPeriod('2024-09')"
          >
            Sep '24 (₹6.55L Peak)
          </button>
          <button
            type="button"
            class="jump-pill"
            [class.active]="selectedPeriod() === '2024-06'"
            (click)="setPeriod('2024-06')"
          >
            Jun '24 (Disbursed)
          </button>
        </div>

        <!-- 3. Summary WOW Telemetry Grid -->
        <div class="summary-cards-row">
          <div class="sum-card tile-danger">
            <span class="sum-label">Interest Debited</span>
            <span class="sum-value text-danger tabular-nums">{{ formatPaise(monthSummary().totalInterestAccrued) }}</span>
            <span class="sum-sub">{{ monthSummary().effectiveRate.toFixed(2) }}% rate · {{ monthSummary().daysCount }} days</span>
          </div>

          <div class="sum-card tile-success">
            <span class="sum-label">Deposits / Credits</span>
            <span class="sum-value text-success tabular-nums">
              {{ monthSummary().totalCredited > 0 ? '−' + formatPaise(monthSummary().totalCredited) : '₹0.00' }}
            </span>
            <span class="sum-sub">{{ monthSummary().transactionsCount }} passbook credits</span>
          </div>

          <div class="sum-card tile-ink">
            <span class="sum-label">Month-End Balance</span>
            <span class="sum-value tabular-nums">{{ formatPaise(monthSummary().closingBalance) }}</span>
            <span class="sum-sub">SBI Maxgain OD</span>
          </div>
        </div>

        <!-- 4. Interactive Day-by-Day Table -->
        <div class="ledger-table-wrap">
          <table class="daily-table" aria-label="Daily Interest Breakdown">
            <thead>
              <tr>
                <th>Date</th>
                <th>Opening Debt</th>
                <th>Payments / Movements</th>
                <th>Closing Debt</th>
                <th class="text-center">Rate</th>
                <th class="text-right">Daily Accrual</th>
                <th class="text-right">Total Accrued</th>
              </tr>
            </thead>
            <tbody>
              @for (row of dailyRecords(); track row.date) {
                <tr [class.has-tx]="row.txDetails && row.txDetails!.length > 0">
                  <td class="date-cell">
                    <span class="day-num">{{ row.date.slice(8) }}</span>
                    <span class="month-txt">{{ getMonthShort(row.date) }}</span>
                  </td>

                  <td class="tabular-nums">{{ formatPaise(row.opening) }}</td>

                  <td class="tabular-nums movement-cell" [class.negative]="row.movements < 0" [class.positive]="row.movements > 0">
                    @if (row.movements !== 0) {
                      <div class="movement-cluster">
                        <span class="move-amt">{{ formatMovement(row.movements) }}</span>
                        @if (row.txDetails && row.txDetails![0]; as tx) {
                          <span class="tx-badge cat-{{ tx.category }}">
                            {{ getCategoryBadge(tx.category) }}
                          </span>
                        }
                      </div>
                    } @else {
                      <span class="no-movement">—</span>
                    }
                  </td>

                  <td class="tabular-nums closing-cell font-bold">{{ formatPaise(row.closing) }}</td>
                  <td class="tabular-nums text-center text-purple font-bold">{{ (row.rateBps / 100).toFixed(2) }}%</td>
                  <td class="tabular-nums text-right accrued-cell font-bold">{{ formatPaise(row.dailyAccruedPaise) }}</td>
                  <td class="tabular-nums text-right cumulative-cell font-bold">{{ formatPaise(row.cumulativeAccruedPaise) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="sheet-footnote">
          <span>* Daily reducing balance evaluated using exact actual/365 convention on authentic SBI passbook records.</span>
        </div>
      </div>
    </app-bottom-sheet>
  `,
  styles: `
    .daily-ledger-body {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* Month Navigator */
    .month-nav-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: space-between;
    }

    .nav-step-btn {
      height: 38px;
      padding: 0 14px;
      border-radius: 99px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: #ffffff;
      color: #15172b;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
      transition: all 0.2s ease;

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      &:active:not(:disabled) {
        transform: scale(0.96);
      }
    }

    .month-capsule-wrap {
      flex: 1;
      position: relative;
      display: flex;
      align-items: center;
    }

    .month-capsule-select {
      width: 100%;
      height: 38px;
      appearance: none;
      -webkit-appearance: none;
      padding: 0 32px 0 16px;
      border-radius: 99px;
      border: 1px solid rgba(108, 76, 255, 0.25);
      background: rgba(108, 76, 255, 0.04);
      color: #15172b;
      font-size: 0.86rem;
      font-weight: 800;
      font-family: inherit;
      outline: none;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;

      &:focus {
        border-color: #6c4cff;
        box-shadow: 0 0 0 3px rgba(108, 76, 255, 0.12);
      }
    }

    .dropdown-arrow-icon {
      position: absolute;
      right: 14px;
      font-size: 0.72rem;
      color: #6c4cff;
      pointer-events: none;
    }

    /* Fast Era Jumps */
    .fast-jump-track {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 2px;
      &::-webkit-scrollbar { display: none; }
    }

    .jump-pill {
      height: 30px;
      padding: 0 12px;
      border-radius: 99px;
      border: 1px solid rgba(0, 0, 0, 0.07);
      background: #ffffff;
      color: #767a90;
      font-size: 0.74rem;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transition: all 0.2s ease;

      &:active {
        transform: scale(0.96);
      }

      &.active {
        background: #15172b;
        color: #ffffff;
        border-color: #15172b;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
      }
    }

    /* Summary Grid */
    .summary-cards-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    @media (max-width: 500px) {
      .summary-cards-row {
        grid-template-columns: 1fr;
      }
    }

    .sum-card {
      background: #f8f8fc;
      border: 1px solid rgba(0, 0, 0, 0.05);
      border-radius: 16px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 2px;

      &.tile-danger { background: rgba(238, 77, 107, 0.05); border-color: rgba(238, 77, 107, 0.15); }
      &.tile-success { background: rgba(15, 178, 124, 0.05); border-color: rgba(15, 178, 124, 0.15); }
      &.tile-ink { background: rgba(108, 76, 255, 0.05); border-color: rgba(108, 76, 255, 0.15); }
    }

    .sum-label {
      font-size: 0.68rem;
      color: #8e8e93;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .sum-value {
      font-size: 1.15rem;
      font-weight: 900;
      letter-spacing: -0.02em;

      &.text-danger { color: #ee4d6b; }
      &.text-success { color: #0fb27c; }
    }

    .sum-sub {
      font-size: 0.7rem;
      font-weight: 600;
      color: #767a90;
    }

    /* Table Wrap */
    .ledger-table-wrap {
      max-height: 52vh;
      overflow-y: auto;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 18px;
      border: 1px solid rgba(0, 0, 0, 0.06);
      background: #ffffff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
    }

    .daily-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;
      text-align: left;
    }

    .daily-table th {
      position: sticky;
      top: 0;
      background: #f4f4f8;
      z-index: 2;
      padding: 10px 12px;
      color: #555b72;
      font-weight: 800;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      white-space: nowrap;
    }

    .daily-table td {
      padding: 9px 12px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.04);
      white-space: nowrap;
    }

    .daily-table tr:hover {
      background: rgba(108, 76, 255, 0.02);
    }

    .daily-table tr.has-tx {
      background: rgba(15, 178, 124, 0.03);
    }

    .date-cell {
      font-weight: 800;
      color: #15172b;
      display: flex;
      align-items: baseline;
      gap: 4px;
    }

    .day-num { font-size: 0.85rem; font-weight: 800; }
    .month-txt { font-size: 0.72rem; color: #8e8e93; font-weight: 600; }

    .closing-cell {
      color: #15172b;
    }

    .movement-cell {
      &.negative .move-amt { color: #0fb27c; font-weight: 800; }
      &.positive .move-amt { color: #ee4d6b; font-weight: 800; }
    }

    .movement-cluster {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .tx-badge {
      font-size: 0.65rem;
      font-weight: 800;
      padding: 1px 6px;
      border-radius: 99px;
      white-space: nowrap;

      &.cat-emi_credit { background: rgba(0, 113, 227, 0.1); color: #0071e3; }
      &.cat-prepayment { background: rgba(15, 178, 124, 0.1); color: #0fb27c; }
      &.cat-interest_debit { background: rgba(238, 77, 107, 0.1); color: #ee4d6b; }
      &.cat-withdrawal { background: rgba(245, 158, 11, 0.1); color: #d97706; }
      &.cat-disbursement { background: rgba(108, 76, 255, 0.1); color: #6c4cff; }
    }

    .no-movement {
      color: #b0b4c3;
    }

    .accrued-cell {
      color: #0071e3;
    }

    .cumulative-cell {
      color: #15172b;
    }

    .tabular-nums {
      font-variant-numeric: tabular-nums;
    }

    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-purple { color: #6c4cff; }
    .font-bold { font-weight: 700; }

    .sheet-footnote {
      font-size: 0.7rem;
      color: #8e8e93;
      line-height: 1.4;
      padding-top: 2px;
    }
  `,
})
export class DailyLedgerSheetComponent {
  readonly isOpen = input<boolean>(false);
  readonly dismissed = output<void>();

  readonly ledgerStore = inject(LedgerStore);
  readonly availableMonths: SbiAvailableMonth[] = getSbiAvailableMonths();
  readonly selectedPeriod = signal<string>('2026-11');

  readonly monthSummary = computed<SbiDailyMonthSummary>(() => {
    return this.ledgerStore.getSbiDailyMonthSummary(this.selectedPeriod());
  });

  readonly dailyRecords = computed<SbiDailyRecord[]>(() => {
    return this.monthSummary().records;
  });

  readonly formatPaise = formatPaise;
  readonly formatCompactPaise = formatCompactPaise;

  goToPreviousMonth(): void {
    triggerHaptic('light');
    const idx = this.availableMonths.findIndex((m) => m.period === this.selectedPeriod());
    if (idx < this.availableMonths.length - 1) {
      this.selectedPeriod.set(this.availableMonths[idx + 1].period);
    }
  }

  goToNextMonth(): void {
    triggerHaptic('light');
    const idx = this.availableMonths.findIndex((m) => m.period === this.selectedPeriod());
    if (idx > 0) {
      this.selectedPeriod.set(this.availableMonths[idx - 1].period);
    }
  }

  canGoPrevious(): boolean {
    const idx = this.availableMonths.findIndex((m) => m.period === this.selectedPeriod());
    return idx < this.availableMonths.length - 1;
  }

  canGoNext(): boolean {
    const idx = this.availableMonths.findIndex((m) => m.period === this.selectedPeriod());
    return idx > 0;
  }

  setPeriod(period: string): void {
    triggerHaptic('selection');
    this.selectedPeriod.set(period);
  }

  getMonthShort(dateStr: string): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const m = parseInt(dateStr.slice(5, 7), 10) - 1;
    return months[m] || '';
  }

  getCategoryBadge(category: string): string {
    switch (category) {
      case 'emi_credit': return '🏦 EMI';
      case 'prepayment': return '⚡ Prepay';
      case 'interest_debit': return '🔴 Interest';
      case 'withdrawal': return '⚠️ WDL';
      case 'disbursement': return '🏛️ Disbursed';
      default: return '📄 Tx';
    }
  }

  formatMovement(movements: Paise): string {
    if (movements === 0) return '—';
    const sign = movements < 0 ? '−' : '+';
    const absPaise = paise(Math.abs(movements));
    return `${sign}${formatPaise(absPaise)}`;
  }
}

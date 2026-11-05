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
import { DailyLedgerRecord, formatPaise, Paise, paise } from '../../core/engine';

@Component({
  selector: 'app-daily-ledger-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, BottomSheetComponent],
  template: `
    <app-bottom-sheet [isOpen]="isOpen()" [title]="'Daily Interest Breakdown'" (dismissed)="dismissed.emit()">
      <div class="daily-ledger-body">
        <div class="month-selector-bar">
          <label for="ledger-period-input" class="period-label">Month</label>
          <input
            id="ledger-period-input"
            type="month"
            class="period-input"
            [ngModel]="selectedPeriod()"
            (ngModelChange)="selectedPeriod.set($event)"
          />
          <div class="method-badge">
            Daily Reducing Balance
          </div>
        </div>

        @if (dailyRecords().length > 0) {
          <div class="summary-cards-row">
            <div class="sum-card">
              <span class="sum-label">Interest This Month</span>
              <span class="sum-value">{{ formatPaise(totalAccrued()) }}</span>
            </div>
            <div class="sum-card">
              <span class="sum-label">Days In Month</span>
              <span class="sum-value">{{ dailyRecords().length }} days</span>
            </div>
            <div class="sum-card">
              <span class="sum-label">Remaining Balance</span>
              <span class="sum-value">{{ formatPaise(finalClosing()) }}</span>
            </div>
          </div>

          <div class="ledger-table-wrap">
            <table class="daily-table" aria-label="Daily Interest Breakdown">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Start Balance</th>
                  <th>Payments / Debits</th>
                  <th>End Balance</th>
                  <th>Rate</th>
                  <th>Today's Interest</th>
                  <th>Total Interest</th>
                </tr>
              </thead>
              <tbody>
                @for (row of dailyRecords(); track row.date) {
                  <tr>
                    <td class="date-cell">{{ row.date.slice(8) }} {{ getMonthShort(row.date) }}</td>
                    <td class="tabular-nums">{{ formatPaise(row.opening) }}</td>
                    <td class="tabular-nums movement-cell" [class.negative]="row.movements < 0" [class.positive]="row.movements > 0">
                      {{ row.movements !== 0 ? (row.movements > 0 ? '+' : '') + formatPaise(row.movements) : '—' }}
                    </td>
                    <td class="tabular-nums closing-cell">{{ formatPaise(row.closing) }}</td>
                    <td class="tabular-nums">{{ (row.rateBps / 100).toFixed(2) }}%</td>
                    <td class="tabular-nums accrued-cell">{{ formatPaise(row.dailyAccruedPaise) }}</td>
                    <td class="tabular-nums cumulative-cell">{{ formatPaise(row.cumulativeAccruedPaise) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="empty-message">No daily ledger entries available for this period.</div>
        }
      </div>
    </app-bottom-sheet>
  `,
  styles: `
    .daily-ledger-body {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .month-selector-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      justify-content: space-between;
    }

    .period-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-ink);
    }

    .period-input {
      padding: 6px 12px;
      border-radius: 99px;
      border: 1px solid var(--color-line);
      background: var(--color-card);
      color: var(--color-ink);
      font-size: 14px;
      font-family: inherit;
    }

    .method-badge {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: var(--radius-pill, 9999px);
      background: rgba(0, 113, 227, 0.08);
      color: var(--brand-a);
      border: 1px solid rgba(0, 113, 227, 0.2);
    }

    .summary-cards-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .sum-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 10px 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: transform 0.2s ease;
    }

    .sum-card:hover {
      transform: translateY(-1px);
    }

    .sum-label {
      font-size: 11px;
      color: var(--muted);
      font-weight: 600;
    }

    .sum-value {
      font-size: 14px;
      font-weight: 800;
      color: var(--ink);
      font-variant-numeric: tabular-nums;
    }

    .ledger-table-wrap {
      max-height: 55vh;
      overflow-y: auto;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 16px;
      border: 1px solid var(--line);
      background: var(--card);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
    }

    .daily-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      text-align: left;
    }

    .daily-table th {
      position: sticky;
      top: 0;
      background: var(--bg-subtle, #f5f5f7);
      z-index: 2;
      padding: 8px 10px;
      color: var(--muted);
      font-weight: 700;
      border-bottom: 1px solid var(--line);
      white-space: nowrap;
    }

    .daily-table td {
      padding: 7px 10px;
      border-bottom: 1px solid var(--line);
      white-space: nowrap;
    }

    .date-cell {
      font-weight: 700;
      color: var(--ink);
    }

    .closing-cell {
      font-weight: 700;
      color: var(--ink);
    }

    .movement-cell.negative {
      color: var(--success);
    }

    .movement-cell.positive {
      color: var(--danger);
    }

    .accrued-cell {
      color: var(--brand-a);
      font-weight: 700;
    }

    .cumulative-cell {
      color: var(--color-ink);
      font-weight: 700;
    }

    .tabular-nums {
      font-variant-numeric: tabular-nums;
    }

    .empty-message {
      padding: 24px;
      text-align: center;
      color: var(--color-muted);
      font-size: 14px;
    }
  `,
})
export class DailyLedgerSheetComponent {
  readonly isOpen = input<boolean>(false);
  readonly dismissed = output<void>();

  readonly ledgerStore = inject(LedgerStore);
  readonly selectedPeriod = signal<string>(new Date().toISOString().slice(0, 7));

  readonly dailyRecords = computed<DailyLedgerRecord[]>(() => {
    return this.ledgerStore.getDailyBreakdown(this.selectedPeriod());
  });

  readonly totalAccrued = computed<Paise>(() => {
    const records = this.dailyRecords();
    if (records.length === 0) return paise(0);
    return records[records.length - 1].cumulativeAccruedPaise;
  });

  readonly finalClosing = computed<Paise>(() => {
    const records = this.dailyRecords();
    if (records.length === 0) return paise(0);
    return records[records.length - 1].closing;
  });

  formatPaise(amount: Paise): string {
    return formatPaise(amount);
  }

  getMonthShort(dateStr: string): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const m = parseInt(dateStr.slice(5, 7), 10) - 1;
    return months[m] || '';
  }
}


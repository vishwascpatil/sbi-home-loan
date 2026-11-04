import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LedgerStore } from '../../core/state';
import {
  AvatarComponent,
  ChipComponent,
  GlassCardComponent,
} from '../../shared/ui';
import {
  formatPaise,
  getTransactionAmount,
  getTransactionMode,
  getTransactionReference,
  Transaction,
} from '../../core/engine';
import { AddEditTransactionSheetComponent } from '../transaction-sheet/add-edit-transaction-sheet.component';
import { BankImportSheetComponent } from '../bank-import/bank-import-sheet.component';

@Component({
  selector: 'app-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    GlassCardComponent,
    ChipComponent,
    AvatarComponent,
    AddEditTransactionSheetComponent,
    BankImportSheetComponent,
  ],
  template: `
    <div class="history-page">
      <header class="history-header">
        <div>
          <small class="header-count">{{ filteredTransactions().length }} records</small>
          <h1 class="header-title">History</h1>
        </div>

        <div class="header-actions">
          <button
            type="button"
            class="statements-link-btn"
            (click)="showImportSheet.set(true)"
            aria-label="Import Bank Statement CSV"
          >
            📥 Import Bank CSV
          </button>
          <a routerLink="/statements" class="statements-link-btn" aria-label="View Statements & Tax Reports">
            📄 Statements
          </a>
          <button type="button" class="csv-export-btn" (click)="exportCsv()" aria-label="Export CSV">
            Export CSV
          </button>
        </div>
      </header>

      <!-- Filter Controls Section -->
      <section class="filters-card">
        <!-- Type Filter Chips -->
        <div class="filter-chips-scroll" role="toolbar" aria-label="Transaction Type Filter">
          <app-chip [selected]="selectedType() === 'all'" (clicked)="selectedType.set('all')">
            All
          </app-chip>
          <app-chip [selected]="selectedType() === 'contribution'" (clicked)="selectedType.set('contribution')">
            Contributions
          </app-chip>
          <app-chip [selected]="selectedType() === 'bankPayment'" (clicked)="selectedType.set('bankPayment')">
            Bank Payments
          </app-chip>
          <app-chip [selected]="selectedType() === 'withdrawal'" (clicked)="selectedType.set('withdrawal')">
            Withdrawals
          </app-chip>
        </div>

        <!-- Member & Month Dropdowns -->
        <div class="filters-dropdown-row">
          <select class="filter-select" [ngModel]="selectedMember()" (ngModelChange)="selectedMember.set($event)" aria-label="Filter by member">
            <option value="">All Members</option>
            @for (m of ledgerStore.members(); track m.id) {
              <option [value]="m.id">{{ m.name }}</option>
            }
          </select>

          <input
            type="month"
            class="filter-month-input"
            [ngModel]="selectedMonth()"
            (ngModelChange)="selectedMonth.set($event)"
            aria-label="Filter by month"
          />

          @if (hasActiveFilters()) {
            <button type="button" class="reset-filter-btn" (click)="clearFilters()">
              Clear
            </button>
          }
        </div>
      </section>

      <!-- Transaction Timeline List -->
      <app-glass-card style="margin-top: 14px">
        <div class="tx-timeline-list">
          @for (tx of filteredTransactions(); track tx.id) {
            <button
              type="button"
              class="tx-history-item"
              (click)="openEdit(tx)"
            >
              @if (tx.type === 'contribution') {
                <app-avatar [name]="getMemberName(tx.memberId)" [colorIndex]="getMemberColor(tx.memberId)" [size]="40" />
              } @else {
                <div class="tx-icon-badge" [class.payment]="tx.type === 'bankPayment'">
                  {{ tx.type === 'bankPayment' ? '🏦' : '✎' }}
                </div>
              }

              <div class="tx-item-info">
                <span class="tx-item-title">{{ getTitle(tx) }}</span>
                <span class="tx-item-meta">
                  {{ tx.date }} · {{ getTransactionMode(tx) }}
                  @if (getTransactionReference(tx)) {
                    · {{ getTransactionReference(tx) }}
                  }
                  @if (tx.type === 'bankPayment') {
                    · interest {{ formatPaise(tx.interestPortion, { showPaise: true }) }}
                  }
                </span>
                @if (tx.notes) {
                  <span class="tx-item-notes">{{ tx.notes }}</span>
                }
              </div>

              <span
                class="tx-item-amount tabular-nums"
                [class.positive]="tx.type === 'contribution'"
                [class.negative]="tx.type === 'bankPayment'"
              >
                {{ tx.type === 'contribution' ? '+' : '−' }}{{ formatPaise(getTransactionAmount(tx)) }}
              </span>
            </button>
          } @empty {
            <div class="empty-filter-state">
              <span class="empty-icon">🔍</span>
              <p>No transactions match your selected filters.</p>
              <button type="button" class="clear-empty-btn" (click)="clearFilters()">
                Reset Filters
              </button>
            </div>
          }
        </div>
      </app-glass-card>

      <!-- Add/Edit Transaction Bottom Sheet Instance -->
      <app-add-edit-transaction-sheet
        [isOpen]="isSheetOpen()"
        [editTransaction]="selectedTxForEdit()"
        (dismissed)="isSheetOpen.set(false); selectedTxForEdit.set(null)"
      />

      <!-- Bank Statement Import Sheet -->
      @if (showImportSheet()) {
        <app-bank-import-sheet (closed)="showImportSheet.set(false)" />
      }
    </div>
  `,
  styles: `
    .history-page {
      display: flex;
      flex-direction: column;
    }

    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 8px 4px 18px;
    }

    .header-count {
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

    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .statements-link-btn {
      padding: 8px 16px;
      border-radius: var(--radius-pill, 99px);
      border: 1px solid var(--line);
      background: var(--card);
      color: var(--ink);
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      box-shadow: var(--shadow-sm);
      min-height: 40px;
      transition: all 0.2s ease;
    }

    .statements-link-btn:hover {
      border-color: var(--brand-a);
      color: var(--brand-a);
    }

    .csv-export-btn {
      padding: 8px 16px;
      border-radius: var(--radius-pill, 99px);
      border: 1px solid var(--line);
      background: var(--card);
      color: var(--ink);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      min-height: 40px;
    }

    .csv-export-btn:hover {
      border-color: var(--brand-a);
      color: var(--brand-a);
    }

    .filters-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius-card, 26px);
      padding: 14px;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .filter-chips-scroll {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .filter-chips-scroll::-webkit-scrollbar {
      display: none;
    }

    .filters-dropdown-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .filter-select, .filter-month-input {
      flex: 1;
      height: 40px;
      border-radius: var(--radius-tile, 16px);
      border: 1px solid var(--line);
      background: var(--bg);
      color: var(--ink);
      padding: 0 12px;
      font-size: 13px;
      font-weight: 600;
      outline: none;
    }

    .reset-filter-btn {
      border: none;
      background: transparent;
      color: var(--danger);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      padding: 4px 8px;
    }

    .tx-timeline-list {
      display: flex;
      flex-direction: column;
    }

    .tx-history-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 0;
      border: none;
      border-top: 1px solid var(--line);
      background: transparent;
      text-align: left;
      cursor: pointer;
      width: 100%;
    }

    .tx-history-item:first-child {
      border-top: none;
      padding-top: 2px;
    }

    .tx-icon-badge {
      width: 40px;
      height: 40px;
      border-radius: 32%;
      background: var(--bg);
      color: var(--muted);
      display: grid;
      place-items: center;
      font-size: 18px;
      flex-shrink: 0;
    }

    .tx-icon-badge.payment {
      background: rgba(108, 76, 255, 0.1);
      color: var(--brand-a);
    }

    .tx-item-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .tx-item-title {
      font-size: 14px;
      font-weight: 800;
      color: var(--ink);
    }

    .tx-item-meta {
      font-size: 11px;
      color: var(--muted);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tx-item-notes {
      font-size: 11px;
      color: var(--muted);
      opacity: 0.85;
      font-style: italic;
      margin-top: 2px;
    }

    .tx-item-amount {
      font-size: 14px;
      font-weight: 800;
    }

    .tx-item-amount.positive {
      color: var(--success);
    }

    .tx-item-amount.negative {
      color: var(--ink);
    }

    .empty-filter-state {
      padding: 32px 16px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .empty-icon {
      font-size: 32px;
      margin-bottom: 8px;
      opacity: 0.8;
    }

    .empty-filter-state p {
      font-size: 13px;
      color: var(--muted);
      margin: 0 0 12px;
    }

    .clear-empty-btn {
      padding: 6px 14px;
      border-radius: var(--radius-pill, 99px);
      background: var(--brand-a);
      color: #ffffff;
      border: none;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
  `,
})
export class HistoryComponent implements OnInit {
  readonly ledgerStore = inject(LedgerStore);
  private readonly route = inject(ActivatedRoute);

  readonly formatPaise = formatPaise;
  readonly getTransactionAmount = getTransactionAmount;
  readonly getTransactionMode = getTransactionMode;
  readonly getTransactionReference = getTransactionReference;

  readonly selectedType = signal<string>('all');
  readonly selectedMember = signal<string>('');
  readonly selectedMonth = signal<string>('');

  readonly isSheetOpen = signal<boolean>(false);
  readonly showImportSheet = signal<boolean>(false);
  readonly selectedTxForEdit = signal<Transaction | null>(null);

  ngOnInit(): void {
    const memberParam = this.route.snapshot.queryParamMap.get('member');
    if (memberParam) {
      this.selectedMember.set(memberParam);
    }
  }

  readonly hasActiveFilters = computed(() => {
    return (
      this.selectedType() !== 'all' ||
      this.selectedMember() !== '' ||
      this.selectedMonth() !== ''
    );
  });

  readonly filteredTransactions = computed(() => {
    const type = this.selectedType();
    const memberId = this.selectedMember();
    const month = this.selectedMonth();

    return [...this.ledgerStore.transactions()]
      .filter((tx) => !tx.deletedAt)
      .filter((tx) => {
        if (type !== 'all' && tx.type !== type) return false;
        if (memberId && tx.type === 'contribution' && tx.memberId !== memberId) {
          return false;
        }
        if (month && tx.forMonth !== month) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  });

  openEdit(tx: Transaction): void {
    this.selectedTxForEdit.set(tx);
    this.isSheetOpen.set(true);
  }

  clearFilters(): void {
    this.selectedType.set('all');
    this.selectedMember.set('');
    this.selectedMonth.set('');
  }

  getTitle(tx: Transaction): string {
    if (tx.type === 'contribution') {
      return this.getMemberName(tx.memberId);
    }
    if (tx.type === 'bankPayment') return 'Bank Payment';
    if (tx.type === 'withdrawal') return 'Withdrawal';
    if (tx.type === 'principalAdjustment') return 'Principal Adjustment';
    if (tx.type === 'manualCorrection') return 'Manual Correction';
    return 'Transaction';
  }

  getMemberName(memberId: string): string {
    const m = this.ledgerStore.members().find((mem) => mem.id === memberId);
    return m ? m.name : 'Member';
  }

  getMemberColor(memberId: string): number {
    const m = this.ledgerStore.members().find((mem) => mem.id === memberId);
    return m ? m.colorIndex : 0;
  }

  async exportCsv(): Promise<void> {
    const csv = await this.ledgerStore.exportCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loan-tracker-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

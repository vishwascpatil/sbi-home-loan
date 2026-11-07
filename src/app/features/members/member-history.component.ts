import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LedgerStore } from '../../core/state';
import {
  addPaise,
  ContributionTransaction,
  formatCompactPaise,
  formatPaise,
  Paise,
  Transaction,
  ZERO_PAISE,
} from '../../core/engine';
import {
  AvatarComponent,
  ConfirmSheetComponent,
  CountUpDirective,
} from '../../shared/ui';
import { AddEditTransactionSheetComponent } from '../transaction-sheet/add-edit-transaction-sheet.component';

@Component({
  selector: 'app-member-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    CountUpDirective,
    ConfirmSheetComponent,
    AddEditTransactionSheetComponent,
  ],
  template: `
    <div class="member-history-page">
      <!-- 1. Top Bar with Back Button -->
      <header class="app-top-bar">
        <button
          type="button"
          class="back-circle-btn"
          (click)="goBack()"
          aria-label="Back"
          title="Back"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#111216" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>

        <div class="top-title-wrap">
          <span class="top-pretitle">Family Members</span>
          <h1 class="top-main-title">Payment History</h1>
        </div>

        <div class="top-count-pill tabular-nums">
          {{ filteredPayments().length }}
        </div>
      </header>

      <!-- 2. Member Filter Strip -->
      <div class="member-filter-strip" role="tablist" aria-label="Filter payments by member">
        <button
          type="button"
          class="member-chip-btn"
          [class.active]="selectedMemberId() === null"
          (click)="selectMember(null)"
        >
          <span class="chip-avatar-all">👥</span>
          <span class="chip-label">All</span>
        </button>

        @for (m of members(); track m.id) {
          <button
            type="button"
            class="member-chip-btn"
            [class.active]="selectedMemberId() === m.id"
            (click)="selectMember(m.id)"
          >
            <app-avatar [name]="m.name" [size]="24" [circular]="true" [avatarUrl]="m.avatarUrl" />
            <span class="chip-label">{{ m.name }}</span>
          </button>
        }
      </div>

      <!-- 3. Matte Black Summary Hero Card -->
      <div class="matte-hero-banner" role="region" aria-label="Total Money Paid">
        <div class="hero-left-content">
          <div class="hero-badge-pill">
            <span class="lightning-bolt">⚡</span>
            <span>Total Paid · {{ selectedMemberName() }}</span>
          </div>
          <div class="hero-number-wrap">
            <div class="hero-balance-headline tabular-nums" [appCountUp]="totalFilteredPaid()">
              {{ formatPaise(totalFilteredPaid()) }}
            </div>
            <span class="hero-balance-sub">
              {{ filteredPayments().length }} {{ filteredPayments().length === 1 ? 'payment made' : 'payments made' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 4. Pure Payment List: Who Paid How Much -->
      <section class="payments-list-section">
        <div class="section-title-row">
          <h2 class="section-heading">Who Paid What</h2>
          <span class="section-meta-count">
            {{ filteredPayments().length }} {{ filteredPayments().length === 1 ? 'record' : 'records' }}
          </span>
        </div>

        @if (filteredPayments().length === 0) {
          <div class="empty-payments-card">
            <span class="empty-icon">💸</span>
            <h3 class="empty-headline">No payments recorded</h3>
            <p class="empty-desc">
              No payments found for {{ selectedMemberName() }}.
            </p>
          </div>
        } @else {
          <div class="payments-cards-stack">
            @for (tx of filteredPayments(); track tx.id) {
              <div
                class="payment-squircle-card clickable"
                (click)="editPayment(tx)"
                role="button"
                tabindex="0"
                [attr.aria-label]="'Edit payment of ' + formatPaise(tx.amount) + ' for ' + tx.memberName"
              >
                <!-- Left: Avatar + Name + Date -->
                <div class="payment-left-group">
                  <app-avatar
                    [name]="tx.memberName"
                    [size]="46"
                    [circular]="true"
                    [avatarUrl]="tx.memberAvatar"
                    [colorIndex]="tx.colorIndex"
                  />
                  <div class="payment-info-text">
                    <span class="payment-person-name">{{ tx.memberName }}</span>
                    <span class="payment-date-text">{{ formatDisplayDate(tx.date) }}</span>
                    @if (tx.notes) {
                      <span class="payment-notes-text">{{ tx.notes }}</span>
                    }
                  </div>
                </div>

                <!-- Right: Big Amount + Paid Badge + Delete Action -->
                <div class="payment-right-group">
                  <span class="payment-amount tabular-nums">
                    + {{ formatPaise(tx.amount) }}
                  </span>
                  <div class="payment-badge-actions">
                    <span class="payment-status-tag">
                      Paid ✓
                    </span>
                    <button
                      type="button"
                      class="card-delete-icon-btn"
                      (click)="promptDeletePayment(tx, $event)"
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
                </div>
              </div>
            }
          </div>
        }
      </section>

      <!-- Delete Payment Confirmation Sheet -->
      <app-confirm-sheet
        [isOpen]="isDeleteConfirmOpen()"
        title="Delete Payment"
        [message]="deleteConfirmMessage()"
        confirmText="Yes, Delete Payment"
        [isDanger]="true"
        (confirmed)="executeDeletePayment()"
        (cancelled)="isDeleteConfirmOpen.set(false); txToDelete.set(null)"
      />

      <!-- Add/Edit Payment Bottom Sheet -->
      <app-add-edit-transaction-sheet
        [isOpen]="isEditSheetOpen()"
        [editTransaction]="selectedTxForEdit()"
        (dismissed)="isEditSheetOpen.set(false); selectedTxForEdit.set(null)"
      />
    </div>
  `,
  styles: `
    .member-history-page {
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
      align-items: center;
      gap: 14px;
      margin: 8px 0 20px;
      padding: 0 4px;
      width: 100%;
      box-sizing: border-box;
    }

    .back-circle-btn {
      width: 44px;
      height: 44px;
      min-width: 44px;
      min-height: 44px;
      border-radius: 50%;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.04);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
      cursor: pointer;
      display: grid;
      place-items: center;
      padding: 0;
      flex-shrink: 0;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        background: #f7f8fa;
        transform: scale(1.05);
      }

      &:active {
        transform: scale(0.95);
      }
    }

    .top-title-wrap {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }

    .top-pretitle {
      font-size: 11px;
      font-weight: 500;
      color: #8e8e93;
      letter-spacing: -0.01em;
    }

    .top-main-title {
      font-size: 19px;
      font-weight: 800;
      color: #111216;
      letter-spacing: -0.02em;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .top-count-pill {
      font-size: 12px;
      font-weight: 700;
      background: #ffffff;
      color: #111216;
      padding: 6px 12px;
      border-radius: 9999px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
      flex-shrink: 0;
    }

    /* 2. Member Filter Strip */
    .member-filter-strip {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow-x: auto;
      padding: 2px 4px 18px;
      margin: 0 0 4px;
      width: 100%;
      box-sizing: border-box;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    .member-chip-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px 6px 8px;
      border-radius: 9999px;
      background: #ffffff;
      border: 1.5px solid transparent;
      box-shadow: var(--shadow-card);
      font-family: inherit;
      font-size: 13px;
      font-weight: 700;
      color: #111216;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      min-height: 40px;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        background: #f8f9fb;
        transform: translateY(-1px);
      }

      &.active {
        background: #111216;
        color: #ffffff;
        box-shadow: 0 6px 18px -2px rgba(17, 18, 22, 0.35);
      }
    }

    .chip-avatar-all {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #f2f3f6;
      display: grid;
      place-items: center;
      font-size: 12px;
    }

    .member-chip-btn.active .chip-avatar-all {
      background: rgba(255, 255, 255, 0.2);
    }

    .chip-label {
      line-height: 1;
    }

    /* 3. Matte Black Hero Card */
    .matte-hero-banner {
      background: #111216;
      color: #ffffff;
      border-radius: 28px;
      padding: 22px 24px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 12px 32px -6px rgba(0, 0, 0, 0.22);
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }

    .hero-left-content {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
      overflow: hidden;
    }

    .hero-badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .lightning-bolt {
      color: #f59e0b;
      font-size: 14px;
      flex-shrink: 0;
    }

    .hero-number-wrap {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }

    .hero-balance-headline {
      font-size: clamp(26px, 6.5vw, 34px);
      font-weight: 800;
      letter-spacing: -0.035em;
      line-height: 1.1;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .hero-balance-sub {
      font-size: 12px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.6);
    }

    /* 4. Payments List Section */
    .payments-list-section {
      display: flex;
      flex-direction: column;
      width: 100%;
      box-sizing: border-box;
    }

    .section-title-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin: 0 0 14px;
      padding: 0 4px;
    }

    .section-heading {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #111216;
      margin: 0;
    }

    .section-meta-count {
      font-size: 12px;
      font-weight: 600;
      color: #8e8e93;
    }

    .payments-cards-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
    }

    .payment-squircle-card {
      background: #ffffff;
      border-radius: 24px;
      padding: 16px 18px;
      box-shadow: var(--shadow-card);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;

      &.clickable {
        cursor: pointer;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.05);
        }

        &:active {
          transform: scale(0.985);
        }
      }
    }

    .payment-left-group {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1;
    }

    .payment-info-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .payment-person-name {
      font-size: 16px;
      font-weight: 800;
      color: #111216;
      letter-spacing: -0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .payment-date-text {
      font-size: 12px;
      font-weight: 500;
      color: #8e8e93;
    }

    .payment-notes-text {
      font-size: 11px;
      font-weight: 500;
      color: #6b7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .payment-right-group {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 3px;
      flex-shrink: 0;
    }

    .payment-amount {
      font-size: 16px;
      font-weight: 800;
      color: #10b981;
      letter-spacing: -0.02em;
    }

    .payment-status-tag {
      font-size: 11px;
      font-weight: 700;
      color: #0fb27c;
      background: rgba(16, 185, 129, 0.1);
      padding: 2px 8px;
      border-radius: 9999px;
    }

    .payment-badge-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .card-delete-icon-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: none;
      background: rgba(142, 142, 147, 0.12);
      color: #8e8e93;
      display: grid;
      place-items: center;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        background: rgba(238, 77, 107, 0.14);
        color: #ee4d6b;
        transform: scale(1.1);
      }

      &:active {
        transform: scale(0.9);
      }
    }

    /* Empty State */
    .empty-payments-card {
      background: #ffffff;
      border-radius: 24px;
      padding: 40px 24px;
      text-align: center;
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      width: 100%;
      box-sizing: border-box;
    }

    .empty-icon {
      font-size: 36px;
      margin-bottom: 4px;
    }

    .empty-headline {
      font-size: 17px;
      font-weight: 800;
      color: #111216;
      margin: 0;
    }

    .empty-desc {
      font-size: 13px;
      font-weight: 500;
      color: #8e8e93;
      margin: 0;
    }
  `,
})
export class MemberHistoryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly ledgerStore = inject(LedgerStore);

  readonly selectedMemberId = signal<string | null>(null);

  readonly formatPaise = formatPaise;
  readonly formatCompactPaise = formatCompactPaise;

  readonly isEditSheetOpen = signal<boolean>(false);
  readonly selectedTxForEdit = signal<Transaction | null>(null);

  readonly isDeleteConfirmOpen = signal<boolean>(false);
  readonly txToDelete = signal<{ id: string; amount: Paise; memberName: string } | null>(null);

  readonly deleteConfirmMessage = computed(() => {
    const tx = this.txToDelete();
    if (!tx) return '';
    return `Are you sure you want to delete this payment of ${formatPaise(tx.amount)} by ${tx.memberName}? All member totals and loan balances will automatically recalculate.`;
  });

  readonly members = computed(() =>
    this.ledgerStore.members().filter((m) => !m.deletedAt)
  );

  readonly selectedMember = computed(() => {
    const id = this.selectedMemberId();
    if (!id) return null;
    return this.members().find((m) => m.id === id) ?? null;
  });

  readonly selectedMemberName = computed(() => {
    return this.selectedMember()?.name ?? 'All Members';
  });

  readonly allContributions = computed(() => {
    const txs = this.ledgerStore.transactions();
    const membersMap = new Map(this.ledgerStore.members().map((m) => [m.id, m]));
    return txs
      .filter(
        (tx): tx is ContributionTransaction =>
          tx.type === 'contribution' && !tx.deletedAt
      )
      .map((tx) => {
        const m = membersMap.get(tx.memberId);
        return {
          ...tx,
          memberName: m?.name ?? 'Member',
          memberAvatar: m?.avatarUrl,
          colorIndex: m?.colorIndex ?? 0,
        };
      })
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
      );
  });

  readonly filteredPayments = computed(() => {
    const sel = this.selectedMemberId();
    const list = this.allContributions();
    if (!sel) return list;
    return list.filter((tx) => tx.memberId === sel);
  });

  readonly totalFilteredPaid = computed<Paise>(() => {
    return this.filteredPayments().reduce(
      (sum, tx) => addPaise(sum, tx.amount),
      ZERO_PAISE
    );
  });

  ngOnInit(): void {
    const memberParam = this.route.snapshot.queryParamMap.get('member');
    if (memberParam) {
      this.selectedMemberId.set(memberParam);
    }
  }

  selectMember(id: string | null): void {
    this.selectedMemberId.set(id);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { member: id || null },
      queryParamsHandling: 'merge',
    });
  }

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      void this.router.navigate(['/members']);
    }
  }

  editPayment(tx: ContributionTransaction): void {
    this.selectedTxForEdit.set(tx);
    this.isEditSheetOpen.set(true);
  }

  promptDeletePayment(tx: { id: string; amount: Paise; memberName: string }, event: Event): void {
    event.stopPropagation();
    this.txToDelete.set(tx);
    this.isDeleteConfirmOpen.set(true);
  }

  async executeDeletePayment(): Promise<void> {
    const tx = this.txToDelete();
    if (!tx) return;
    try {
      await this.ledgerStore.deleteTransaction(tx.id);
      this.isDeleteConfirmOpen.set(false);
      this.txToDelete.set(null);
    } catch {
      this.isDeleteConfirmOpen.set(false);
      this.txToDelete.set(null);
    }
  }

  formatDisplayDate(isoDate: string): string {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length < 3) return isoDate;
    const y = parts[0]!;
    const m = parts[1]!;
    const d = parts[2]!;
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const monthName = months[parseInt(m, 10) - 1] || m;
    return `${parseInt(d, 10)} ${monthName} ${y}`;
  }
}


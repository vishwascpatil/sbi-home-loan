import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnChanges,
  output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AvatarComponent,
  BottomSheetComponent,
  ChipComponent,
  ConfirmSheetComponent,
  SegmentedControlComponent,
  SegmentOption,
  ToastService,
} from '../../shared/ui';
import { LedgerStore } from '../../core/state';
import {
  bankPaymentSplit,
  formatPaise,
  Paise,
  PaymentMode,
  toPaise,
  Transaction,
} from '../../core/engine';

type FormType = 'contribution' | 'bankPayment' | 'withdrawal' | 'principalAdjustment';

const PAYMENT_MODES: PaymentMode[] = [
  'UPI',
  'Bank transfer',
  'Cash',
  'Cheque',
  'NEFT/RTGS',
];

@Component({
  selector: 'app-add-edit-transaction-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    BottomSheetComponent,
    ConfirmSheetComponent,
    SegmentedControlComponent,
    ChipComponent,
    AvatarComponent,
  ],
  template: `
    <app-bottom-sheet
      [isOpen]="isOpen()"
      [title]="sheetTitle()"
      (dismissed)="cancelSheet()"
    >
      <form class="tx-form" (ngSubmit)="saveTransaction()">
        <!-- Locked Period Alert Banner -->
        @if (isLocked()) {
          <div class="locked-period-alert" role="alert">
            <span class="lock-icon">🔒</span>
            <div class="lock-content">
              <strong>Period {{ forMonthInput }} is Locked</strong>
              <p>Accounting period is closed. Edits require an audited unlock.</p>
            </div>
            <button
              type="button"
              class="unlock-pill-btn"
              (click)="isUnlockPromptOpen.set(true)"
            >
              Unlock
            </button>
          </div>
        }

        <!-- Segmented Type Selector -->
        <app-segmented-control
          [options]="typeOptions"
          [selectedValue]="selectedType()"
          (changed)="onTypeChanged($event)"
        />

        <!-- Member Selector for Contributions / Withdrawals -->
        @if (selectedType() === 'contribution' || selectedType() === 'withdrawal') {
          <div class="form-group member-picker-group">
            <span class="field-label" id="member-select-label">Select Member</span>
            <div class="member-chips-scroll" role="group" aria-labelledby="member-select-label">
              @for (m of ledgerStore.activeMembers(); track m.id) {
                <app-chip
                  [selected]="selectedMemberId() === m.id"
                  (clicked)="selectedMemberId.set(m.id)"
                >
                  <app-avatar [name]="m.name" [colorIndex]="m.colorIndex" [size]="20" />
                  <span>{{ m.name }}</span>
                </app-chip>
              }
            </div>
          </div>
        }

        <!-- Amount Field -->
        <div class="form-group">
          <label class="field-label" for="amount-input">Amount (₹)</label>
          <div class="amount-input-wrap">
            <span class="currency-prefix">₹</span>
            <input
              id="amount-input"
              type="text"
              inputmode="decimal"
              class="large-amount-input tabular-nums"
              placeholder="0.00"
              [ngModel]="amountInput()"
              (ngModelChange)="onAmountChange($event)"
              name="amount"
              required
            />
          </div>
        </div>

        <!-- Live Split Preview for Bank Payments -->
        @if (selectedType() === 'bankPayment' && numericAmount() > 0) {
          <div class="split-preview-card">
            <div class="split-row">
              <span class="split-label">Estimated Interest:</span>
              <span class="split-value tabular-nums">{{ formattedInterest() }}</span>
            </div>
            <div class="split-row highlight">
              <span class="split-label">Principal Reduction:</span>
              <span class="split-value tabular-nums">{{ formattedPrincipal() }}</span>
            </div>
            <div class="form-group" style="margin-top: 10px; margin-bottom: 0;">
              <label class="field-label" for="custom-interest">Actual Bank Interest (optional)</label>
              <input
                id="custom-interest"
                type="text"
                inputmode="decimal"
                class="form-input"
                placeholder="Leave blank to use estimate"
                [ngModel]="customInterestInput()"
                (ngModelChange)="customInterestInput.set($event)"
                name="customInterest"
              />
            </div>
          </div>
        }

        <!-- Date & For Month -->
        <div class="form-row">
          <div class="form-group">
            <label class="field-label" for="tx-date">Date</label>
            <input
              id="tx-date"
              type="date"
              class="form-input"
              [(ngModel)]="dateInput"
              name="date"
              (ngModelChange)="onDateChange($event)"
              required
            />
          </div>

          <div class="form-group">
            <label class="field-label" for="tx-month">For Month</label>
            <input
              id="tx-month"
              type="month"
              class="form-input"
              [(ngModel)]="forMonthInput"
              name="forMonth"
              required
            />
          </div>
        </div>

        <!-- Optional Value Date -->
        <div class="form-group">
          <label class="field-label" for="tx-value-date">Value Date (Optional, defaults to transaction date)</label>
          <input
            id="tx-value-date"
            type="date"
            class="form-input"
            [(ngModel)]="valueDateInput"
            name="valueDate"
          />
        </div>

        <!-- Payment Mode -->
        <div class="form-group">
          <label class="field-label" for="tx-mode">Payment Mode</label>
          <select id="tx-mode" class="form-select" [(ngModel)]="modeInput" name="mode">
            @for (mode of paymentModes; track mode) {
              <option [value]="mode">{{ mode }}</option>
            }
          </select>
        </div>

        <!-- Reference & Notes -->
        <div class="form-group">
          <label class="field-label" for="tx-ref">Reference No. (optional)</label>
          <input
            id="tx-ref"
            type="text"
            class="form-input"
            placeholder="UPI Ref, Cheque No, Transaction ID"
            [(ngModel)]="referenceInput"
            name="reference"
          />
        </div>

        <div class="form-group">
          <label class="field-label" for="tx-notes">Notes (optional)</label>
          <input
            id="tx-notes"
            type="text"
            class="form-input"
            placeholder="Additional details"
            [(ngModel)]="notesInput"
            name="notes"
          />
        </div>

        <!-- Action Buttons -->
        <div class="sheet-actions">
          <button type="submit" class="submit-btn" [disabled]="numericAmount() <= 0 || isLocked()">
            {{ isEdit() ? 'Save Changes' : submitActionLabel() }}
          </button>

          @if (isEdit()) {
            <button
              type="button"
              class="delete-btn"
              [disabled]="isLocked()"
              (click)="isConfirmDeleteOpen.set(true)"
            >
              Delete Entry
            </button>
          }
        </div>
      </form>
    </app-bottom-sheet>

    <!-- Delete Confirmation Sheet -->
    <app-confirm-sheet
      [isOpen]="isConfirmDeleteOpen()"
      title="Delete Entry"
      message="Are you sure you want to delete this record? The entire ledger and all historical balances will automatically recalculate."
      confirmText="Delete Entry"
      [isDanger]="true"
      (confirmed)="confirmDelete()"
      (cancelled)="isConfirmDeleteOpen.set(false)"
    />

    <!-- Unlock Period Bottom Sheet -->
    <app-bottom-sheet
      [isOpen]="isUnlockPromptOpen()"
      title="Unlock Accounting Period"
      (dismissed)="isUnlockPromptOpen.set(false)"
    >
      <div class="unlock-body">
        <p class="unlock-desc">
          Unlocking period <strong>{{ forMonthInput }}</strong> will allow modifications.
          Historical edits will trigger ledger recalculations and an audit entry will be logged.
        </p>
        <div class="form-group" style="margin-top: 12px">
          <label class="field-label" for="unlock-reason">Reason for Unlocking</label>
          <input
            id="unlock-reason"
            type="text"
            class="form-input"
            placeholder="e.g. Bank statement retroactive correction"
            [(ngModel)]="unlockReasonInput"
          />
        </div>
        <button
          type="button"
          class="submit-btn"
          style="margin-top: 14px"
          [disabled]="!unlockReasonInput.trim()"
          (click)="confirmUnlockPeriod()"
        >
          Confirm Audited Unlock
        </button>
      </div>
    </app-bottom-sheet>
  `,
  styles: `
    .tx-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-top: 6px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .field-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .member-chips-scroll {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding: 4px 0 8px;
      scrollbar-width: none;
    }

    .member-chips-scroll::-webkit-scrollbar {
      display: none;
    }

    .amount-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .currency-prefix {
      position: absolute;
      left: 14px;
      font-size: 26px;
      font-weight: 800;
      color: var(--brand-a);
      pointer-events: none;
    }

    .large-amount-input {
      width: 100%;
      height: 60px;
      padding-left: 38px;
      padding-right: 16px;
      border-radius: var(--radius-tile, 18px);
      border: 1.5px solid var(--line);
      background: var(--bg-subtle, #f5f5f7);
      color: var(--ink);
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      outline: none;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .large-amount-input:focus {
      border-color: var(--brand-a);
      box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.15);
      background: #ffffff;
    }

    .form-input, .form-select {
      width: 100%;
      height: 46px;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: var(--bg-subtle, #f5f5f7);
      color: var(--ink);
      padding: 0 14px;
      font-size: 14px;
      font-weight: 600;
      outline: none;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .form-input:focus, .form-select:focus {
      border-color: var(--brand-a);
      box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.15);
      background: #ffffff;
    }

    .split-preview-card {
      background: var(--bg-subtle, #f5f5f7);
      border: 1px solid var(--line);
      border-radius: var(--radius-tile, 16px);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .split-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 600;
    }

    .split-row.highlight {
      color: var(--success);
      font-size: 14px;
      font-weight: 800;
      padding-top: 4px;
      border-top: 1px solid var(--line);
    }

    .sheet-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 8px;
    }

    .submit-btn {
      width: 100%;
      height: 50px;
      border-radius: var(--radius-pill, 9999px);
      background: linear-gradient(135deg, #0071e3 0%, #0056b3 100%);
      color: #ffffff;
      border: none;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: -0.01em;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0, 113, 227, 0.35);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .submit-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 8px 22px rgba(0, 113, 227, 0.45);
    }

    .submit-btn:active:not(:disabled) {
      transform: scale(0.96);
    }

    .submit-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      box-shadow: none;
    }

    .delete-btn {
      width: 100%;
      height: 44px;
      border-radius: var(--radius-pill, 9999px);
      background: transparent;
      color: var(--danger);
      border: 1px solid rgba(255, 59, 48, 0.3);
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .delete-btn:hover:not(:disabled) {
      background: var(--danger-bg, rgba(255, 59, 48, 0.08));
    }

    .delete-btn:active:not(:disabled) {
      transform: scale(0.96);
    }

    .delete-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .locked-period-alert {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: var(--radius-tile, 16px);
      background: rgba(238, 77, 107, 0.1);
      border: 1px solid rgba(238, 77, 107, 0.3);
      color: var(--ink);
    }

    .lock-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    .lock-content {
      flex: 1;
      min-width: 0;
    }

    .lock-content strong {
      display: block;
      font-size: 13px;
      color: var(--danger);
    }

    .lock-content p {
      margin: 2px 0 0;
      font-size: 11px;
      color: var(--muted);
      line-height: 1.35;
    }

    .unlock-pill-btn {
      padding: 6px 14px;
      border-radius: var(--radius-pill, 99px);
      border: 1px solid var(--danger);
      background: transparent;
      color: var(--danger);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }

    .unlock-body {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .unlock-desc {
      font-size: 13px;
      color: var(--muted);
      line-height: 1.45;
      margin: 0;
    }
  `,
})
export class AddEditTransactionSheetComponent implements OnChanges {
  readonly ledgerStore = inject(LedgerStore);
  readonly toast = inject(ToastService);

  readonly isOpen = input<boolean>(false);
  readonly editTransaction = input<Transaction | null>(null);
  readonly initialType = input<FormType>('contribution');

  readonly dismissed = output<void>();

  readonly paymentModes = PAYMENT_MODES;
  readonly isConfirmDeleteOpen = signal<boolean>(false);
  readonly isUnlockPromptOpen = signal<boolean>(false);
  unlockReasonInput = '';

  readonly typeOptions: SegmentOption<FormType>[] = [
    { label: 'Contribution', value: 'contribution' },
    { label: 'Bank Payment', value: 'bankPayment' },
    { label: 'Withdrawal', value: 'withdrawal' },
    { label: 'Adjustment', value: 'principalAdjustment' },
  ];

  readonly selectedType = signal<FormType>('contribution');
  readonly selectedMemberId = signal<string>('');
  readonly amountInput = signal<string>('');
  readonly customInterestInput = signal<string>('');

  dateInput = new Date().toISOString().slice(0, 10);
  forMonthInput = new Date().toISOString().slice(0, 7);
  valueDateInput = '';
  modeInput: PaymentMode = 'UPI';
  referenceInput = '';
  notesInput = '';

  readonly isEdit = computed(() => !!this.editTransaction());

  readonly isLocked = computed<boolean>(() => {
    return this.ledgerStore.isPeriodLocked(this.forMonthInput);
  });

  readonly sheetTitle = computed(() => {
    if (this.isEdit()) return 'Edit Transaction';
    switch (this.selectedType()) {
      case 'contribution':
        return 'Record Contribution';
      case 'bankPayment':
        return 'Record Bank Payment';
      case 'withdrawal':
        return 'Record Withdrawal';
      case 'principalAdjustment':
        return 'Principal Adjustment';
    }
  });

  readonly submitActionLabel = computed(() => {
    switch (this.selectedType()) {
      case 'contribution':
        return 'Add Contribution';
      case 'bankPayment':
        return 'Record Payment';
      case 'withdrawal':
        return 'Record Withdrawal';
      case 'principalAdjustment':
        return 'Save Adjustment';
    }
  });

  readonly numericAmount = computed<Paise>(() => {
    const raw = this.amountInput();
    return toPaise(raw || '0');
  });

  readonly splitPreview = computed(() => {
    const amount = this.numericAmount();
    const estInterest = this.ledgerStore.thisMonthSummary().interestIncurredEst;
    const custom = this.customInterestInput().trim();
    const actualInterest = custom ? toPaise(custom) : undefined;

    return bankPaymentSplit(amount, estInterest, actualInterest);
  });

  readonly formattedInterest = computed(() =>
    formatPaise(this.splitPreview().interestPortion, { showPaise: true, isEstimated: this.splitPreview().isEstimatedSplit })
  );

  readonly formattedPrincipal = computed(() =>
    formatPaise(this.splitPreview().principalPortion, { showPaise: true })
  );

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editTransaction'] && this.editTransaction()) {
      this.populateForEdit(this.editTransaction()!);
    } else if (changes['isOpen'] && this.isOpen() && !this.editTransaction()) {
      this.resetForm();
    }
  }

  onTypeChanged(type: FormType): void {
    this.selectedType.set(type);
    if (type === 'bankPayment' && this.modeInput === 'UPI') {
      this.modeInput = 'Bank transfer';
    }
  }

  onAmountChange(val: string): void {
    this.amountInput.set(val);
  }

  onDateChange(newDate: string): void {
    if (newDate && newDate.length >= 7) {
      this.forMonthInput = newDate.slice(0, 7);
    }
  }

  async saveTransaction(): Promise<void> {
    if (this.isLocked()) {
      this.toast.show('Period is locked. Please unlock it to make changes.', 'danger');
      return;
    }

    const amt = this.numericAmount();
    if (amt <= 0) {
      this.toast.show('Please enter a valid amount', 'danger');
      return;
    }

    const type = this.selectedType();
    const date = this.dateInput;
    const valueDate = this.valueDateInput.trim() || undefined;
    const forMonth = this.forMonthInput;
    const mode = this.modeInput;
    const ref = this.referenceInput.trim();
    const notes = this.notesInput.trim();

    try {
      if (this.isEdit()) {
        const txId = this.editTransaction()!.id;
        const updates: Partial<Transaction> = {
          date,
          valueDate,
          forMonth,
          mode,
          reference: ref || undefined,
          notes: notes || undefined,
        };

        if (type === 'contribution') {
          Object.assign(updates, {
            amount: amt,
            memberId: this.selectedMemberId(),
          });
        } else if (type === 'bankPayment') {
          const split = this.splitPreview();
          Object.assign(updates, {
            amount: amt,
            interestPortion: split.interestPortion,
            principalPortion: split.principalPortion,
            isEstimatedSplit: split.isEstimatedSplit,
          });
        }

        await this.ledgerStore.updateTransaction(txId, updates);
        this.toast.show('Transaction updated successfully', 'success');
      } else {
        if (type === 'contribution') {
          const memberId =
            this.selectedMemberId() || this.ledgerStore.activeMembers()[0]?.id;
          if (!memberId) {
            this.toast.show('Please select a member', 'danger');
            return;
          }
          await this.ledgerStore.addContribution({
            memberId,
            amount: amt,
            date,
            forMonth,
            mode,
            reference: ref || undefined,
            notes: notes || undefined,
          });
          this.toast.show('Contribution added', 'success');
        } else if (type === 'bankPayment') {
          const custom = this.customInterestInput().trim();
          const actualInterest = custom ? toPaise(custom) : undefined;
          await this.ledgerStore.recordBankPayment({
            amount: amt,
            interestPortion: actualInterest,
            date,
            forMonth,
            mode,
            reference: ref || undefined,
            notes: notes || undefined,
          });
          this.toast.show('Bank payment recorded', 'success');
        }
      }

      this.dismissed.emit();
    } catch {
      this.toast.show('Failed to save transaction', 'danger');
    }
  }

  async confirmUnlockPeriod(): Promise<void> {
    const reason = this.unlockReasonInput.trim();
    if (!reason) {
      this.toast.show('Please provide a reason for unlocking', 'danger');
      return;
    }
    await this.ledgerStore.unlockPeriod(this.forMonthInput, reason);
    this.toast.show(`Period ${this.forMonthInput} unlocked (Audited)`, 'info');
    this.isUnlockPromptOpen.set(false);
    this.unlockReasonInput = '';
  }

  async confirmDelete(): Promise<void> {
    if (!this.editTransaction() || this.isLocked()) return;
    await this.ledgerStore.deleteTransaction(this.editTransaction()!.id);
    this.isConfirmDeleteOpen.set(false);
    this.toast.show('Transaction deleted', 'danger');
    this.dismissed.emit();
  }

  cancelSheet(): void {
    this.dismissed.emit();
  }

  private resetForm(): void {
    this.selectedType.set(this.initialType() || 'contribution');
    const firstMember = this.ledgerStore.activeMembers()[0];
    this.selectedMemberId.set(firstMember ? firstMember.id : '');
    this.amountInput.set('');
    this.customInterestInput.set('');
    this.dateInput = new Date().toISOString().slice(0, 10);
    this.forMonthInput = new Date().toISOString().slice(0, 7);
    this.valueDateInput = '';
    this.modeInput = this.initialType() === 'bankPayment' ? 'Bank transfer' : 'UPI';
    this.referenceInput = '';
    this.notesInput = '';
  }

  private populateForEdit(tx: Transaction): void {
    this.selectedType.set(tx.type as FormType);
    this.dateInput = tx.date;
    this.valueDateInput = tx.valueDate || '';
    this.forMonthInput = tx.forMonth;
    this.modeInput = 'mode' in tx ? tx.mode : 'UPI';
    this.referenceInput = 'reference' in tx ? (tx.reference || '') : '';
    this.notesInput = tx.notes || '';

    if (tx.type === 'contribution') {
      this.selectedMemberId.set(tx.memberId);
      this.amountInput.set((tx.amount / 100).toFixed(2));
    } else if (tx.type === 'bankPayment') {
      this.amountInput.set((tx.amount / 100).toFixed(2));
      this.customInterestInput.set(
        tx.isEstimatedSplit ? '' : (tx.interestPortion / 100).toFixed(2)
      );
    }
  }
}

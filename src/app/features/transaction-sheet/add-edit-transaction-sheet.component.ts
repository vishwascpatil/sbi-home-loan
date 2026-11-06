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
  ConfirmSheetComponent,
  ToastService,
} from '../../shared/ui';
import { LedgerStore } from '../../core/state';
import {
  getTransactionAmount,
  Member,
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
              <strong>Month {{ forMonthInput }} is Locked</strong>
              <p>This month was finalized. Unlock to make any changes.</p>
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

        <!-- 1. Who Paid? (Only for member contributions) -->
        @if (selectedType() === 'contribution') {
          <div class="form-group member-picker-group">
            <span class="field-label" id="member-select-label">Who Paid?</span>
            <div class="members-grid-row" role="group" aria-labelledby="member-select-label">
              @for (m of ledgerStore.activeMembers(); track m.id) {
                <button
                  type="button"
                  class="member-select-card"
                  [class.selected]="selectedMemberId() === m.id"
                  (click)="selectMember(m)"
                  [attr.aria-label]="m.name"
                >
                  <div class="avatar-ring-container">
                    <app-avatar
                      [name]="m.name"
                      [colorIndex]="m.colorIndex"
                      [size]="50"
                      [avatarUrl]="m.avatarUrl"
                      [circular]="true"
                    />
                    @if (selectedMemberId() === m.id) {
                      <span class="selected-check-badge" aria-hidden="true">✓</span>
                    }
                  </div>
                  <span class="member-name-label">{{ m.name }}</span>
                </button>
              }
            </div>
          </div>
        }

        <!-- 2. Amount -->
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

        <!-- 3. When Paid? -->
        <div class="form-group">
          <label class="field-label" for="tx-date">When Paid?</label>
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

        <!-- Action Buttons -->
        <div class="sheet-actions">
          <button type="submit" class="submit-btn" [disabled]="numericAmount() <= 0 || isLocked()">
            {{ isEdit() ? 'Save Changes' : 'Save Payment' }}
          </button>

          @if (isEdit()) {
            <button
              type="button"
              class="delete-btn"
              [disabled]="isLocked()"
              (click)="isConfirmDeleteOpen.set(true)"
            >
              Delete Payment
            </button>
          }
        </div>
      </form>
    </app-bottom-sheet>

    <!-- Delete Confirmation Sheet -->
    <app-confirm-sheet
      [isOpen]="isConfirmDeleteOpen()"
      title="Delete Payment"
      message="Are you sure you want to delete this payment? All loan balances will automatically recalculate."
      confirmText="Yes, Delete Payment"
      [isDanger]="true"
      (confirmed)="confirmDelete()"
      (cancelled)="isConfirmDeleteOpen.set(false)"
    />

    <!-- Unlock Period Bottom Sheet -->
    <app-bottom-sheet
      [isOpen]="isUnlockPromptOpen()"
      title="Unlock Month"
      (dismissed)="isUnlockPromptOpen.set(false)"
    >
      <div class="unlock-body">
        <p class="unlock-desc">
          Unlocking month <strong>{{ forMonthInput }}</strong> allows you to edit or delete payments.
          All balances will automatically update.
        </p>
        <div class="form-group" style="margin-top: 12px">
          <label class="field-label" for="unlock-reason">Reason for Unlocking</label>
          <input
            id="unlock-reason"
            type="text"
            class="form-input"
            placeholder="e.g. Mistyped payment date or amount"
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
          Confirm Unlock
        </button>
      </div>
    </app-bottom-sheet>
  `,
  styles: `
    .tx-form {
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding-top: 4px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .field-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted, #8e8e93);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .members-grid-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
      padding: 6px 0 8px;
    }

    .member-select-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      background: transparent;
      border: none;
      padding: 4px 2px;
      cursor: pointer;
      border-radius: 18px;
      outline: none;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        transform: translateY(-2px);
      }

      &:active {
        transform: scale(0.92);
      }
    }

    .avatar-ring-container {
      position: relative;
      display: inline-flex;
      border-radius: 50%;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .member-select-card.selected .avatar-ring-container {
      transform: scale(1.08);
      box-shadow: 0 0 0 3px #ffffff, 0 0 0 5.5px #111216, 0 8px 20px rgba(17, 18, 22, 0.25);
    }

    .selected-check-badge {
      position: absolute;
      bottom: -2px;
      right: -2px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #111216;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      display: grid;
      place-items: center;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
      animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes popIn {
      from { transform: scale(0.5); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .member-name-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--muted, #767a90);
      text-align: center;
      letter-spacing: -0.01em;
      transition: all 0.2s ease;
      max-width: 100%;
      overflow: visible;
      word-break: break-word;
    }

    .member-select-card.selected .member-name-label {
      color: #111216;
      font-weight: 800;
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
      color: var(--brand-a, #111216);
      pointer-events: none;
    }

    .large-amount-input {
      width: 100%;
      height: 60px;
      padding-left: 38px;
      padding-right: 16px;
      border-radius: var(--radius-tile, 18px);
      border: 1.5px solid var(--line, #e5e5ea);
      background: var(--bg-subtle, #f5f5f7);
      color: var(--ink, #111216);
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      outline: none;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .large-amount-input:focus {
      border-color: #111216;
      box-shadow: 0 0 0 4px rgba(17, 18, 22, 0.1);
      background: #ffffff;
    }

    .form-input {
      width: 100%;
      height: 48px;
      border-radius: 14px;
      border: 1.5px solid var(--line, #e5e5ea);
      background: var(--bg-subtle, #f5f5f7);
      color: var(--ink, #111216);
      padding: 0 14px;
      font-size: 16px;
      font-weight: 600;
      outline: none;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .form-input:focus {
      border-color: #111216;
      background: #ffffff;
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
      background: #111216;
      color: #ffffff;
      border: none;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: -0.01em;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(17, 18, 22, 0.25);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .submit-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 8px 22px rgba(17, 18, 22, 0.35);
    }

    .submit-btn:active:not(:disabled) {
      transform: scale(0.97);
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
      color: var(--danger, #ff3b30);
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
      color: var(--danger, #ff3b30);
    }

    .lock-content p {
      margin: 2px 0 0;
      font-size: 11px;
      color: var(--muted, #8e8e93);
      line-height: 1.35;
    }

    .unlock-pill-btn {
      padding: 6px 14px;
      border-radius: var(--radius-pill, 99px);
      border: 1px solid var(--danger, #ff3b30);
      background: transparent;
      color: var(--danger, #ff3b30);
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
      color: var(--muted, #8e8e93);
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
  readonly initialMemberId = input<string | undefined>(undefined);

  readonly dismissed = output<void>();

  readonly paymentModes = PAYMENT_MODES;
  readonly isConfirmDeleteOpen = signal<boolean>(false);
  readonly isUnlockPromptOpen = signal<boolean>(false);
  unlockReasonInput = '';

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
    return this.isEdit() ? 'Edit Payment' : 'Add Payment';
  });

  readonly numericAmount = computed<Paise>(() => {
    const raw = this.amountInput();
    return toPaise(raw || '0');
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editTransaction'] && this.editTransaction()) {
      this.populateForEdit(this.editTransaction()!);
    } else if (changes['isOpen'] && this.isOpen() && !this.editTransaction()) {
      this.resetForm();
    }
  }

  selectMember(m: Member): void {
    this.selectedMemberId.set(m.id);
    const stats = this.ledgerStore.memberStats().find((s) => s.memberId === m.id);
    if (stats?.target) {
      this.amountInput.set((stats.target / 100).toString());
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
      this.toast.show('This month is locked. Please unlock it to make changes.', 'danger');
      return;
    }

    const amt = this.numericAmount();
    if (amt <= 0) {
      this.toast.show('Please enter a valid amount', 'danger');
      return;
    }

    if (this.selectedType() === 'contribution') {
      const memberId =
        this.selectedMemberId() || this.ledgerStore.activeMembers()[0]?.id;
      if (!memberId) {
        this.toast.show('Please select who paid', 'danger');
        return;
      }
    }

    const memberId =
      this.selectedMemberId() || this.ledgerStore.activeMembers()[0]?.id;
    const date = this.dateInput;
    const forMonth = this.dateInput.slice(0, 7);
    const mode = this.modeInput || 'UPI';

    try {
      if (this.isEdit()) {
        const txId = this.editTransaction()!.id;
        const currentTx = this.editTransaction()!;
        if (currentTx.type === 'bankPayment') {
          await this.ledgerStore.updateTransaction(txId, {
            amount: amt,
            principalPortion: amt,
            interestPortion: toPaise(0),
            date,
            forMonth,
            mode,
            notes: this.notesInput,
          });
        } else {
          await this.ledgerStore.updateTransaction(txId, {
            memberId,
            amount: amt,
            date,
            forMonth,
            mode,
            notes: this.notesInput,
          });
        }
        this.toast.show('Payment updated successfully', 'success');
      } else if (this.selectedType() === 'bankPayment') {
        const actualInterest = this.customInterestInput() ? toPaise(this.customInterestInput()) : undefined;
        await this.ledgerStore.recordBankPayment({
          amount: amt,
          interestPortion: actualInterest,
          date,
          forMonth,
          mode,
          reference: this.referenceInput,
          notes: this.notesInput,
        });
        this.toast.show('Bank payment recorded', 'success');
      } else {
        await this.ledgerStore.addContribution({
          memberId,
          amount: amt,
          date,
          forMonth,
          mode,
        });
        this.toast.show('Payment saved', 'success');
      }

      this.dismissed.emit();
    } catch {
      this.toast.show('Failed to save payment', 'danger');
    }
  }

  async confirmUnlockPeriod(): Promise<void> {
    const reason = this.unlockReasonInput.trim();
    if (!reason) {
      this.toast.show('Please provide a reason for unlocking', 'danger');
      return;
    }
    await this.ledgerStore.unlockPeriod(this.forMonthInput, reason);
    this.toast.show(`Month ${this.forMonthInput} unlocked`, 'info');
    this.isUnlockPromptOpen.set(false);
    this.unlockReasonInput = '';
  }

  async confirmDelete(): Promise<void> {
    if (!this.editTransaction() || this.isLocked()) return;
    await this.ledgerStore.deleteTransaction(this.editTransaction()!.id);
    this.isConfirmDeleteOpen.set(false);
    this.toast.show('Payment deleted', 'danger');
    this.dismissed.emit();
  }

  cancelSheet(): void {
    this.dismissed.emit();
  }

  private resetForm(): void {
    this.selectedType.set(this.initialType() || 'contribution');
    const firstMember = this.ledgerStore.activeMembers()[0];
    const targetMemberId = this.initialMemberId() || (firstMember ? firstMember.id : '');
    this.selectedMemberId.set(targetMemberId);

    if (targetMemberId) {
      const stats = this.ledgerStore.memberStats().find((s) => s.memberId === targetMemberId);
      if (stats?.target) {
        this.amountInput.set((stats.target / 100).toString());
      } else {
        this.amountInput.set('');
      }
    } else {
      this.amountInput.set('');
    }

    this.customInterestInput.set('');
    this.dateInput = new Date().toISOString().slice(0, 10);
    this.forMonthInput = new Date().toISOString().slice(0, 7);
    this.valueDateInput = '';
    this.modeInput = 'UPI';
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
    }
    this.amountInput.set((getTransactionAmount(tx) / 100).toString());
  }
}

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
} from '../../shared/ui';
import { LedgerStore, UserProfileStore } from '../../core/state';
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
      <!-- Ambient Shifting Top Edge & Glow Blobs -->
      <div class="sheet-ambient-edge" aria-hidden="true"></div>
      <div class="sheet-ambient-orb orb-sheet-1" aria-hidden="true"></div>
      <div class="sheet-ambient-orb orb-sheet-2" aria-hidden="true"></div>

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
            <span class="btn-laser-halo" aria-hidden="true"></span>
            <span class="btn-shimmer" aria-hidden="true"></span>
            <span class="btn-text">{{ isEdit() ? 'Save Changes' : 'Save Payment' }}</span>
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
    .sheet-ambient-edge {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      border-radius: 24px 24px 0 0;
      background: linear-gradient(90deg, #6c4cff 0%, #ff5f9e 50%, #0fb27c 100%);
      opacity: 0.9;
      z-index: 10;
      pointer-events: none;
    }

    .sheet-ambient-orb {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      z-index: 0;
      opacity: 0.3;
    }

    .orb-sheet-1 {
      top: -30px;
      right: -20px;
      width: 140px;
      height: 140px;
      background: radial-gradient(circle, rgba(255, 95, 158, 0.45) 0%, rgba(108, 76, 255, 0.15) 50%, transparent 70%);
      animation: orbDrift1 8s ease-in-out infinite alternate;
    }

    .orb-sheet-2 {
      bottom: 60px;
      left: -20px;
      width: 130px;
      height: 130px;
      background: radial-gradient(circle, rgba(15, 178, 124, 0.4) 0%, rgba(108, 76, 255, 0.12) 50%, transparent 70%);
      animation: orbDrift2 10s ease-in-out infinite alternate;
    }

    .tx-form {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding-top: 4px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
      box-sizing: border-box;
      animation: fieldCascade 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
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
      animation: avatarBouncyIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;

      &:nth-child(1) { animation-delay: 0.05s; }
      &:nth-child(2) { animation-delay: 0.09s; }
      &:nth-child(3) { animation-delay: 0.13s; }
      &:nth-child(4) { animation-delay: 0.17s; }
      &:nth-child(5) { animation-delay: 0.21s; }

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
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .member-select-card.selected .avatar-ring-container {
      transform: scale(1.1);

      &::before {
        content: '';
        position: absolute;
        inset: -4px;
        border-radius: 50%;
        background: conic-gradient(from 0deg, #6c4cff, #ff5f9e, #0fb27c, #6c4cff);
        animation: laserSpin 2.5s linear infinite;
        z-index: 0;
        box-shadow: 0 0 14px rgba(108, 76, 255, 0.45);
      }

      &::after {
        content: '';
        position: absolute;
        inset: -1.5px;
        border-radius: 50%;
        background: var(--bg-card, #ffffff);
        z-index: 1;
      }

      app-avatar {
        position: relative;
        z-index: 2;
      }
    }

    .selected-check-badge {
      position: absolute;
      bottom: -2px;
      right: -2px;
      width: 19px;
      height: 19px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0fb27c 0%, #059669 100%);
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      display: grid;
      place-items: center;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 8px rgba(15, 178, 124, 0.4);
      z-index: 3;
      animation: checkPopIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
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
      background: linear-gradient(135deg, #6c4cff, #ff5f9e);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
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
      color: #0fb27c;
      text-shadow: 0 0 12px rgba(15, 178, 124, 0.35);
      pointer-events: none;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .amount-input-wrap:focus-within .currency-prefix {
      transform: scale(1.1);
    }

    .large-amount-input {
      box-sizing: border-box;
      width: 100%;
      max-width: 100%;
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
      font-family: inherit;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .large-amount-input:focus {
      border-color: #6c4cff;
      box-shadow: 0 0 0 4px rgba(108, 76, 255, 0.18), 0 8px 24px rgba(108, 76, 255, 0.12);
      background: #ffffff;
      transform: translateY(-1px);
    }

    .form-input {
      box-sizing: border-box;
      width: 100%;
      max-width: 100%;
      height: 48px;
      border-radius: 14px;
      border: 1.5px solid var(--line, #e5e5ea);
      background: var(--bg-subtle, #f5f5f7);
      color: var(--ink, #111216);
      padding: 0 14px;
      font-size: 16px;
      font-weight: 600;
      outline: none;
      display: block;
      -webkit-appearance: none;
      appearance: none;
      font-family: inherit;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    input[type='date'].form-input {
      box-sizing: border-box;
      width: 100%;
      max-width: 100%;
      display: block;
      -webkit-appearance: none;
      appearance: none;
      min-height: 48px;
      line-height: 48px;
    }

    input[type='date']::-webkit-date-and-time-value {
      text-align: left;
    }

    .form-input:focus {
      border-color: #6c4cff;
      box-shadow: 0 0 0 3px rgba(108, 76, 255, 0.15);
      background: #ffffff;
    }

    .sheet-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 10px;
      animation: fieldCascade 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .submit-btn {
      position: relative;
      overflow: hidden;
      width: 100%;
      height: 52px;
      border-radius: var(--radius-pill, 9999px);
      background: linear-gradient(135deg, #4f35ff 0%, #8743ff 50%, #ff5f9e 100%);
      background-size: 200% 200%;
      animation: btnGradientShift 6s ease infinite;
      color: #ffffff;
      border: none;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: -0.01em;
      cursor: pointer;
      box-shadow: 0 6px 20px rgba(108, 76, 255, 0.38), 0 2px 8px rgba(255, 95, 158, 0.25);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-laser-halo {
      position: absolute;
      inset: -2px;
      border-radius: inherit;
      background: radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.4), transparent 70%);
      pointer-events: none;
      opacity: 0.6;
    }

    .btn-shimmer {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 45%;
      background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.32) 50%, transparent 100%);
      transform: skewX(-22deg) translateX(-180%);
      animation: btnShimmerSweep 3.2s infinite cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: none;
    }

    .btn-text {
      position: relative;
      z-index: 2;
    }

    .submit-btn:hover:not(:disabled) {
      transform: translateY(-2px) scale(1.01);
      box-shadow: 0 10px 28px rgba(108, 76, 255, 0.48), 0 4px 12px rgba(255, 95, 158, 0.35);
    }

    .submit-btn:active:not(:disabled) {
      transform: scale(0.98);
    }

    .submit-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      box-shadow: none;
      animation: none;
      background: #8e8e93;

      .btn-shimmer {
        display: none;
      }
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

    @keyframes edgeGradientFlow {
      0% { background-position: 0% 50%; }
      100% { background-position: 200% 50%; }
    }

    @keyframes orbDrift1 {
      0% { transform: translate(0, 0) scale(1); }
      100% { transform: translate(-14px, 14px) scale(1.15); }
    }

    @keyframes orbDrift2 {
      0% { transform: translate(0, 0) scale(1); }
      100% { transform: translate(16px, -12px) scale(1.2); }
    }

    @keyframes fieldCascade {
      from { opacity: 0.85; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes avatarBouncyIn {
      0% { opacity: 0; transform: scale(0.7) translateY(8px); }
      70% { transform: scale(1.05) translateY(-2px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }

    @keyframes laserSpin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    @keyframes checkPopIn {
      0% { opacity: 0; transform: scale(0.2) rotate(-45deg); }
      70% { transform: scale(1.2) rotate(10deg); }
      100% { opacity: 1; transform: scale(1) rotate(0deg); }
    }

    @keyframes btnGradientShift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    @keyframes btnShimmerSweep {
      0% { transform: skewX(-22deg) translateX(-180%); }
      40%, 100% { transform: skewX(-22deg) translateX(360%); }
    }

    @media (prefers-reduced-motion: reduce) {
      .sheet-ambient-edge,
      .sheet-ambient-orb,
      .submit-btn,
      .btn-shimmer,
      .member-select-card.selected .avatar-ring-container::before {
        animation: none !important;
      }
      .form-group,
      .member-select-card,
      .selected-check-badge,
      .sheet-actions {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
      }
    }
  `,
})
export class AddEditTransactionSheetComponent implements OnChanges {
  readonly ledgerStore = inject(LedgerStore);
  readonly userProfile = inject(UserProfileStore);

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
      return;
    }

    const amt = this.numericAmount();
    if (amt <= 0) {
      return;
    }

    if (this.selectedType() === 'contribution') {
      const memberId =
        this.selectedMemberId() || this.ledgerStore.activeMembers()[0]?.id;
      if (!memberId) {
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
      } else {
        await this.ledgerStore.addContribution({
          memberId,
          amount: amt,
          date,
          forMonth,
          mode,
        });
      }

      this.dismissed.emit();
    } catch {
      // Ignore or log error silently
    }
  }

  async confirmUnlockPeriod(): Promise<void> {
    const reason = this.unlockReasonInput.trim();
    if (!reason) {
      return;
    }
    await this.ledgerStore.unlockPeriod(this.forMonthInput, reason);
    this.isUnlockPromptOpen.set(false);
    this.unlockReasonInput = '';
  }

  async confirmDelete(): Promise<void> {
    if (!this.editTransaction() || this.isLocked()) return;
    await this.ledgerStore.deleteTransaction(this.editTransaction()!.id);
    this.isConfirmDeleteOpen.set(false);
    this.dismissed.emit();
  }

  cancelSheet(): void {
    this.dismissed.emit();
  }

  private resetForm(): void {
    this.selectedType.set(this.initialType() || 'contribution');
    const firstMember = this.ledgerStore.activeMembers()[0];
    const targetMemberId =
      this.initialMemberId() ||
      this.userProfile.currentMemberId() ||
      (firstMember ? firstMember.id : '');
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

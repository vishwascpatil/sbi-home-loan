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
  formatPaise,
  monthlySummary,
  outstandingAt,
  Paise,
  paise,
  subPaise,
  toPaise,
} from '../../core/engine';

type ResolutionType = 'snapshot' | 'correction' | 'investigate';

@Component({
  selector: 'app-reconciliation-wizard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, BottomSheetComponent],
  template: `
    <app-bottom-sheet
      [isOpen]="isOpen()"
      title="Bank Reconciliation Wizard"
      (dismissed)="dismissed.emit()"
    >
      <div class="wizard-container">
        <!-- Step 1: Input bank statement figures -->
        <div class="wizard-inputs">
          <div class="form-row">
            <div class="form-group">
              <label class="field-label" for="rec-date">Statement Date</label>
              <input
                id="rec-date"
                type="date"
                class="form-input"
                [ngModel]="statementDate()"
                (ngModelChange)="statementDate.set($event)"
              />
            </div>
            <div class="form-group">
              <label class="field-label" for="rec-period">Accounting Period</label>
              <input
                id="rec-period"
                type="month"
                class="form-input"
                [ngModel]="statementPeriod()"
                (ngModelChange)="statementPeriod.set($event)"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="field-label" for="bank-actual-out">
              Bank Actual Outstanding Principal (₹)
            </label>
            <div class="input-wrap">
              <span class="currency-prefix">₹</span>
              <input
                id="bank-actual-out"
                type="number"
                step="0.01"
                class="form-input prefix-padding tabular-nums"
                placeholder="e.g. 12105189"
                [ngModel]="actualOutstandingInput()"
                (ngModelChange)="actualOutstandingInput.set($event)"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="field-label" for="bank-actual-int">
              Bank Actual Interest Charged (₹, optional)
            </label>
            <div class="input-wrap">
              <span class="currency-prefix">₹</span>
              <input
                id="bank-actual-int"
                type="number"
                step="0.01"
                class="form-input prefix-padding tabular-nums"
                placeholder="e.g. 79692.49"
                [ngModel]="actualInterestInput()"
                (ngModelChange)="actualInterestInput.set($event)"
              />
            </div>
          </div>
        </div>

        <!-- Step 2: Variance Analysis -->
        <div class="variance-card">
          <div class="variance-header">
            <span class="var-title">Comparison vs Ledger</span>
            <span
              class="status-badge"
              [class.reconciled]="isExactMatch()"
              [class.estimated]="!isExactMatch()"
            >
              {{ isExactMatch() ? '✓ Reconciled' : 'Estimated / Variance' }}
            </span>
          </div>

          <div class="comparison-grid">
            <div class="comp-col">
              <span class="comp-label">Ledger Outstanding</span>
              <span class="comp-val tabular-nums">{{ formatPaise(ledgerOutstanding()) }}</span>
            </div>
            <div class="comp-col">
              <span class="comp-label">Bank Outstanding</span>
              <span class="comp-val tabular-nums">
                {{ actualOutstandingPaise() > 0 ? formatPaise(actualOutstandingPaise()) : '—' }}
              </span>
            </div>
            <div class="comp-col highlight">
              <span class="comp-label">Principal Variance</span>
              <span
                class="comp-val tabular-nums"
                [class.variance-zero]="principalVariance() === 0"
                [class.variance-diff]="principalVariance() !== 0"
              >
                {{ formatPaise(principalVariance()) }}
              </span>
            </div>
          </div>

          @if (actualInterestPaise() > 0) {
            <div class="interest-comp-row">
              <div class="comp-col">
                <span class="comp-label">Estimated Interest</span>
                <span class="comp-val tabular-nums">{{ formatPaise(computedInterest()) }}</span>
              </div>
              <div class="comp-col">
                <span class="comp-label">Bank Interest</span>
                <span class="comp-val tabular-nums">{{ formatPaise(actualInterestPaise()) }}</span>
              </div>
              <div class="comp-col highlight">
                <span class="comp-label">Interest Variance</span>
                <span
                  class="comp-val tabular-nums"
                  [class.variance-zero]="interestVariance() === 0"
                  [class.variance-diff]="interestVariance() !== 0"
                >
                  {{ formatPaise(interestVariance()) }}
                </span>
              </div>
            </div>
          }
        </div>

        <!-- Step 3: Resolution Path Selector -->
        <div class="resolution-section">
          <span class="field-label">Choose Reconciliation Action</span>

          <div class="resolution-options">
            <label class="res-card" [class.selected]="selectedAction() === 'snapshot'">
              <input
                type="radio"
                name="resAction"
                value="snapshot"
                [ngModel]="selectedAction()"
                (ngModelChange)="selectedAction.set($event)"
              />
              <div class="res-info">
                <strong>Record Balance Snapshot</strong>
                <p>Audits statement balance & variance without modifying ledger entries.</p>
              </div>
            </label>

            <label class="res-card" [class.selected]="selectedAction() === 'correction'">
              <input
                type="radio"
                name="resAction"
                value="correction"
                [ngModel]="selectedAction()"
                (ngModelChange)="selectedAction.set($event)"
              />
              <div class="res-info">
                <strong>Record Manual Correction</strong>
                <p>Posts an adjusting transaction to bring ledger into exact match with bank.</p>
              </div>
            </label>

            <label class="res-card" [class.selected]="selectedAction() === 'investigate'">
              <input
                type="radio"
                name="resAction"
                value="investigate"
                [ngModel]="selectedAction()"
                (ngModelChange)="selectedAction.set($event)"
              />
              <div class="res-info">
                <strong>Flag for Investigation</strong>
                <p>Marks variance for audit and saves notes for member group review.</p>
              </div>
            </label>
          </div>

          <div class="form-group" style="margin-top: 12px">
            <label class="field-label" for="notes-input">Reconciliation Notes / Reason</label>
            <input
              id="notes-input"
              type="text"
              class="form-input"
              placeholder="e.g. Month-end bank statement verification"
              [(ngModel)]="notesInput"
            />
          </div>

          <div class="lock-option-row">
            <label class="checkbox-label" for="close-period-cb">
              <input
                id="close-period-cb"
                type="checkbox"
                [(ngModel)]="closeAndLockPeriod"
              />
              <span>Close month and lock accounting period (<strong>{{ statementPeriod() }}</strong>)</span>
            </label>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="wizard-actions">
          <button
            type="button"
            class="action-btn primary"
            [disabled]="actualOutstandingPaise() <= 0"
            (click)="applyReconciliationAction()"
          >
            Confirm & Save Reconciliation
          </button>
        </div>
      </div>
    </app-bottom-sheet>
  `,
  styles: `
    .wizard-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 8px;
    }

    .field-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--color-muted, #767a90);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .form-input {
      width: 100%;
      height: 44px;
      border-radius: 14px;
      border: 1px solid var(--color-line, rgba(0, 0, 0, 0.1));
      background: var(--color-bg, #f4f1ec);
      color: var(--color-ink, #15172b);
      padding: 0 14px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
    }

    .input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .currency-prefix {
      position: absolute;
      left: 14px;
      font-weight: 700;
      color: #6c4cff;
    }

    .prefix-padding {
      padding-left: 32px;
    }

    .tabular-nums {
      font-variant-numeric: tabular-nums;
    }

    .variance-card {
      background: var(--color-card, #ffffff);
      border: 1px solid var(--color-line, rgba(0, 0, 0, 0.1));
      border-radius: 16px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .variance-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .var-title {
      font-size: 13px;
      font-weight: 800;
      color: var(--color-ink, #15172b);
    }

    .status-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 99px;
      text-transform: uppercase;
    }

    .status-badge.reconciled {
      background: rgba(15, 178, 124, 0.15);
      color: #0fb27c;
      border: 1px solid rgba(15, 178, 124, 0.3);
    }

    .status-badge.estimated {
      background: rgba(108, 76, 255, 0.12);
      color: #6c4cff;
      border: 1px solid rgba(108, 76, 255, 0.25);
    }

    .comparison-grid, .interest-comp-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .interest-comp-row {
      border-top: 1px solid var(--color-line, rgba(0, 0, 0, 0.1));
      padding-top: 10px;
    }

    .comp-col {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .comp-label {
      font-size: 10px;
      font-weight: 600;
      color: var(--color-muted, #767a90);
    }

    .comp-val {
      font-size: 13px;
      font-weight: 700;
      color: var(--color-ink, #15172b);
    }

    .comp-val.variance-zero {
      color: #0fb27c;
    }

    .comp-val.variance-diff {
      color: #ee4d6b;
    }

    .resolution-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .resolution-options {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .res-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      border-radius: 14px;
      border: 1px solid var(--color-line, rgba(0, 0, 0, 0.1));
      background: var(--color-card, #ffffff);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .res-card.selected {
      border-color: #6c4cff;
      background: rgba(108, 76, 255, 0.04);
    }

    .res-card input[type="radio"] {
      margin-top: 3px;
      accent-color: #6c4cff;
    }

    .res-info strong {
      display: block;
      font-size: 13px;
      color: var(--color-ink, #15172b);
    }

    .res-info p {
      margin: 2px 0 0;
      font-size: 11px;
      color: var(--color-muted, #767a90);
      line-height: 1.35;
    }

    .lock-option-row {
      margin-top: 4px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-ink, #15172b);
      cursor: pointer;
    }

    .checkbox-label input {
      accent-color: #6c4cff;
      width: 16px;
      height: 16px;
    }

    .wizard-actions {
      margin-top: 8px;
    }

    .action-btn.primary {
      width: 100%;
      height: 48px;
      border-radius: 99px;
      border: none;
      background: linear-gradient(135deg, #6c4cff, #ff5f9e);
      color: #ffffff;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(108, 76, 255, 0.35);
    }

    .action-btn.primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }
  `,
})
export class ReconciliationWizardComponent {
  readonly isOpen = input<boolean>(false);
  readonly dismissed = output<void>();

  readonly ledgerStore = inject(LedgerStore);

  readonly statementDate = signal<string>(new Date().toISOString().slice(0, 10));
  readonly statementPeriod = signal<string>(new Date().toISOString().slice(0, 7));

  readonly actualOutstandingInput = signal<number | null>(null);
  readonly actualInterestInput = signal<number | null>(null);
  readonly selectedAction = signal<ResolutionType>('snapshot');

  notesInput = '';
  closeAndLockPeriod = true;

  readonly ledgerOutstanding = computed<Paise>(() => {
    return outstandingAt(this.statementDate(), this.ledgerStore.ledgerState());
  });

  readonly actualOutstandingPaise = computed<Paise>(() => {
    const val = this.actualOutstandingInput();
    return val && val > 0 ? toPaise(val) : paise(0);
  });

  readonly principalVariance = computed<Paise>(() => {
    if (this.actualOutstandingPaise() <= 0) return paise(0);
    return subPaise(this.actualOutstandingPaise(), this.ledgerOutstanding());
  });

  readonly computedInterest = computed<Paise>(() => {
    return monthlySummary(this.statementPeriod(), this.ledgerStore.ledgerState()).interestIncurredEst;
  });

  readonly actualInterestPaise = computed<Paise>(() => {
    const val = this.actualInterestInput();
    return val && val > 0 ? toPaise(val) : paise(0);
  });

  readonly interestVariance = computed<Paise>(() => {
    if (this.actualInterestPaise() <= 0) return paise(0);
    return subPaise(this.actualInterestPaise(), this.computedInterest());
  });

  readonly isExactMatch = computed<boolean>(() => {
    return this.actualOutstandingPaise() > 0 && this.principalVariance() === 0;
  });

  formatPaise(p: Paise): string {
    return formatPaise(p);
  }

  async applyReconciliationAction(): Promise<void> {
    if (this.actualOutstandingPaise() <= 0) return;

    const date = this.statementDate();
    const period = this.statementPeriod();
    const actualOut = this.actualOutstandingPaise();
    const ledgerOut = this.ledgerOutstanding();
    const variance = this.principalVariance();
    const notes = this.notesInput.trim() || 'Bank statement reconciliation';

    switch (this.selectedAction()) {
      case 'snapshot':
        await this.ledgerStore.reconcileBalance(actualOut, date, notes);
        break;

      case 'correction': {
        const corrTx = {
          id: crypto.randomUUID(),
          type: 'manualCorrection' as const,
          previousOutstanding: ledgerOut,
          newOutstanding: actualOut,
          variance,
          reason: notes,
          date,
          forMonth: period,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.ledgerStore.transactions.update((prev) => [corrTx, ...prev]);
        await this.ledgerStore.reconcileBalance(actualOut, date, `Manual correction applied: ${notes}`);
        break;
      }

      case 'investigate':
        await this.ledgerStore.reconcileBalance(
          actualOut,
          date,
          `[FLAGGED FOR INVESTIGATION] ${notes} (Variance: ${formatPaise(variance)})`
        );
        break;
    }

    if (this.closeAndLockPeriod) {
      await this.ledgerStore.closeMonthPeriod(period);
    }

    this.dismissed.emit();
  }
}

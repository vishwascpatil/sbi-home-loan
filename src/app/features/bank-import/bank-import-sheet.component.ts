import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LedgerStore } from '../../core/state';
import {
  DEFAULT_BANK_PROFILES,
  formatPaise,
  ImportMappingProfile,
  mapAndMatchStatementRows,
  Paise,
  parseCsvToRecords,
  ParsedStatementRow,
} from '../../core/engine';
import { ToastService } from '../../shared/ui';

@Component({
  selector: 'app-bank-import-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
  ],
  template: `
    <div
      class="sheet-backdrop"
      (click)="onBackdropClick($event)"
      (keydown.escape)="closed.emit()"
      tabindex="-1"
    >
      <div class="sheet-container" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <!-- Sheet Header -->
        <header class="sheet-header">
          <div>
            <span class="badge">BANK RECONCILIATION</span>
            <h2 id="import-title" class="sheet-title">Import Bank Statement</h2>
          </div>
          <button type="button" class="close-btn" (click)="closed.emit()" aria-label="Close">
            ✕
          </button>
        </header>

        <div class="sheet-body">
          <!-- Step 1: Upload & Profile Selector -->
          @if (parsedRows().length === 0) {
            <section class="upload-section">
              <div class="form-group">
                <label for="bankProfile" class="input-label">Bank Statement Format</label>
                <select
                  id="bankProfile"
                  class="select-input"
                  [ngModel]="selectedProfile().id"
                  (ngModelChange)="onProfileChange($event)"
                >
                  @for (p of profiles; track p.id) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                </select>
              </div>

              <!-- Drag & Drop Zone -->
              <div
                class="drop-zone"
                [class.drag-over]="isDragging()"
                (dragover)="onDragOver($event)"
                (dragleave)="onDragLeave($event)"
                (drop)="onFileDrop($event)"
              >
                <span class="upload-icon">📄</span>
                <p class="drop-text">Drag & drop bank statement CSV file here</p>
                <span class="or-divider">— OR —</span>
                <label class="file-picker-btn">
                  Browse File
                  <input
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    (change)="onFileInput($event)"
                    style="display: none"
                  />
                </label>
              </div>

              <div class="sample-box">
                <span>Testing without a file?</span>
                <button type="button" class="sample-link" (click)="loadSampleCsv()">
                  Load Sample Statement Data (SBI Maxgain)
                </button>
              </div>
            </section>
          } @else {
            <!-- Step 2: Review Queue & Matching Summary -->
            <section class="review-section">
              <!-- Summary Metrics -->
              <div class="stats-row">
                <div class="stat-pill">
                  <span class="stat-label">Total Rows</span>
                  <strong class="stat-num">{{ parsedRows().length }}</strong>
                </div>
                <div class="stat-pill matched">
                  <span class="stat-label">Already Matched</span>
                  <strong class="stat-num">{{ matchedCount() }}</strong>
                </div>
                <div class="stat-pill probable">
                  <span class="stat-label">Probable Matches</span>
                  <strong class="stat-num">{{ probableCount() }}</strong>
                </div>
                <div class="stat-pill new">
                  <span class="stat-label">Ready to Import</span>
                  <strong class="stat-num">{{ importReadyCount() }}</strong>
                </div>
              </div>

              <!-- Quick Bulk Action Bar -->
              <div class="bulk-actions-bar">
                <span class="bulk-title">Quick Actions:</span>
                <button type="button" class="bulk-btn" (click)="setAllUnmatched('bankPayment')">
                  Import Unmatched as Bank Payments
                </button>
                <button type="button" class="bulk-btn" (click)="setAllMatchedToSkip()">
                  Skip All Already Matched
                </button>
                <button type="button" class="bulk-btn secondary" (click)="resetFile()">
                  Upload Different File
                </button>
              </div>

              <!-- Rows Review Queue -->
              <div class="rows-queue-container">
                @for (row of parsedRows(); track row.tempId) {
                  <div
                    class="row-card"
                    [class.action-skip]="row.action === 'skip'"
                    [class.action-import]="row.action !== 'skip'"
                  >
                    <div class="row-header">
                      <div class="row-meta">
                        <span class="row-date">{{ row.date }}</span>
                        <span
                          class="status-chip"
                          [class.matched]="row.matchStatus === 'matched'"
                          [class.probable]="row.matchStatus === 'probable'"
                          [class.unmatched]="row.matchStatus === 'unmatched'"
                        >
                          {{ row.matchStatus === 'matched' ? 'Matched' : row.matchStatus === 'probable' ? 'Probable Match' : 'New Entry' }}
                        </span>
                      </div>
                      <div class="row-amount-badge" [class.credit]="row.creditPaise > 0" [class.debit]="row.debitPaise > 0">
                        {{ row.creditPaise > 0 ? '+ ' + formatPaise(row.creditPaise) : '- ' + formatPaise(row.debitPaise) }}
                      </div>
                    </div>

                    <p class="row-description">{{ row.description }}</p>
                    @if (row.reference) {
                      <small class="row-ref">Ref: {{ row.reference }}</small>
                    }

                    @if (row.matchReason) {
                      <div class="match-notice">{{ row.matchReason }}</div>
                    }

                    <!-- Action Assignment Controls -->
                    <div class="action-controls-row">
                      <label [for]="'action-' + row.tempId" class="action-label">Action:</label>
                      <select
                        [id]="'action-' + row.tempId"
                        class="action-select"
                        [ngModel]="row.action"
                        (ngModelChange)="updateRowAction(row.tempId, $event)"
                      >
                        <option value="skip">Skip (Do not import)</option>
                        <option value="bankPayment">Import as Bank Payment (Principal/Interest)</option>
                        <option value="contribution">Import as Member Contribution</option>
                        <option value="withdrawal">Import as OD Drawdown / Withdrawal</option>
                      </select>

                      @if (row.action === 'contribution') {
                        <select
                          [attr.aria-label]="'Select member for contribution row ' + row.date"
                          class="member-select"
                          [ngModel]="row.selectedMemberId || ledgerStore.members()[0]?.id"
                          (ngModelChange)="updateRowMember(row.tempId, $event)"
                        >
                          @for (m of ledgerStore.members(); track m.id) {
                            <option [value]="m.id">{{ m.name }}</option>
                          }
                        </select>
                      }
                    </div>
                  </div>
                }
              </div>
            </section>
          }

          <!-- Past Batches Reversal Accordion -->
          @if (recentBatches().length > 0 && parsedRows().length === 0) {
            <section class="past-batches-section">
              <h3 class="section-subtitle">Recent Import Batches</h3>
              @for (batch of recentBatches(); track batch.id) {
                <div class="batch-card">
                  <div class="batch-info">
                    <strong>Batch: {{ batch.id }}</strong>
                    <small>{{ batch.count }} active transactions · {{ batch.date | date:'short' }}</small>
                  </div>
                  <button
                    type="button"
                    class="rollback-btn"
                    (click)="rollbackBatch(batch.id)"
                  >
                    ↩️ Rollback Batch
                  </button>
                </div>
              }
            </section>
          }
        </div>

        <!-- Sheet Footer -->
        @if (parsedRows().length > 0) {
          <footer class="sheet-footer">
            <button type="button" class="btn btn-secondary" (click)="resetFile()">
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-primary"
              [disabled]="importReadyCount() === 0"
              (click)="commitImport()"
            >
              Commit {{ importReadyCount() }} Transactions
            </button>
          </footer>
        }
      </div>
    </div>
  `,
  styles: [`
    .sheet-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: grid;
      place-items: center;
      z-index: 1050;
      padding: 16px;
    }

    .sheet-container {
      background: #ffffff;
      color: var(--ink, #1d1d1f);
      width: 100%;
      max-width: 720px;
      max-height: 90vh;
      border-radius: 26px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.16);
      border: 1px solid rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: sheetPop 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes sheetPop {
      from { transform: scale(0.96) translateY(12px); opacity: 0; }
      to { transform: scale(1) translateY(0); opacity: 1; }
    }

    .sheet-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 24px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    .badge {
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: #0071e3;
      background: rgba(0, 113, 227, 0.08);
      padding: 3px 10px;
      border-radius: var(--radius-pill, 9999px);
      display: inline-block;
      margin-bottom: 4px;
    }

    .sheet-title {
      font-size: 1.3rem;
      font-weight: 800;
      margin: 0;
    }

    .close-btn {
      background: rgba(0, 0, 0, 0.05);
      border: none;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      font-size: 1rem;
      cursor: pointer;
      display: grid;
      place-items: center;
      color: var(--color-muted, #767a90);
      &:hover { background: rgba(0, 0, 0, 0.1); color: var(--color-ink, #15172b); }
    }

    .sheet-body {
      padding: 20px 24px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .input-label {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--color-muted, #767a90);
    }

    .select-input {
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      background: var(--color-bg, #f4f1ec);
      font-size: 0.92rem;
      font-weight: 600;
    }

    /* Drag & Drop Zone */
    .drop-zone {
      border: 2px dashed rgba(0, 113, 227, 0.35);
      background: rgba(0, 113, 227, 0.02);
      border-radius: 20px;
      padding: 36px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

      &.drag-over {
        border-color: #0071e3;
        background: rgba(0, 113, 227, 0.08);
      }
    }

    .upload-icon {
      font-size: 2.2rem;
    }

    .drop-text {
      font-size: 0.95rem;
      font-weight: 700;
      margin: 0;
    }

    .or-divider {
      font-size: 0.75rem;
      color: var(--muted);
      font-weight: 600;
    }

    .file-picker-btn {
      padding: 8px 18px;
      background: linear-gradient(135deg, #0071e3 0%, #0056b3 100%);
      color: #fff;
      font-size: 0.85rem;
      font-weight: 700;
      border-radius: var(--radius-pill, 9999px);
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0, 113, 227, 0.28);
      transition: all 0.2s ease;

      &:active {
        transform: scale(0.96);
      }
    }

    .sample-box {
      text-align: center;
      font-size: 0.82rem;
      color: var(--muted, #86868b);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .sample-link {
      background: none;
      border: none;
      color: var(--brand-a, #0071e3);
      font-weight: 700;
      cursor: pointer;
      text-decoration: underline;
    }

    /* Review Section */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }

    .stat-pill {
      background: #f8f9fc;
      border: 1px solid #ededf4;
      padding: 10px 12px;
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      gap: 2px;

      &.matched { border-left: 3px solid #767a90; }
      &.probable { border-left: 3px solid #f59f00; }
      &.new { border-left: 3px solid #0fb27c; }
    }

    .stat-label {
      font-size: 0.7rem;
      font-weight: 700;
      color: #767a90;
    }

    .stat-num {
      font-size: 1.1rem;
      font-weight: 800;
    }

    .bulk-actions-bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      background: #f8f9fc;
      padding: 8px 12px;
      border-radius: 12px;
    }

    .bulk-title {
      font-size: 0.78rem;
      font-weight: 700;
      color: #767a90;
    }

    .bulk-btn {
      padding: 5px 10px;
      font-size: 0.76rem;
      font-weight: 700;
      border-radius: 8px;
      border: 1px solid #d4d6e2;
      background: #ffffff;
      cursor: pointer;
      color: #15172b;

      &.secondary {
        margin-left: auto;
        color: #767a90;
      }
    }

    .rows-queue-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 48vh;
      overflow-y: auto;
      padding-right: 4px;
    }

    .row-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: all 0.2s ease;

      &.action-skip {
        opacity: 0.65;
        background: #fbfbfd;
      }

      &.action-import {
        border-color: #6c4cff;
        box-shadow: 0 2px 8px rgba(108, 76, 255, 0.08);
      }
    }

    .row-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .row-meta {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .row-date {
      font-size: 0.8rem;
      font-weight: 700;
      color: #15172b;
    }

    .status-chip {
      font-size: 0.68rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 99px;

      &.matched { background: #eef0f5; color: #555b72; }
      &.probable { background: #fff3d6; color: #946200; }
      &.unmatched { background: #e6f9f2; color: #0c8a60; }
    }

    .row-amount-badge {
      font-size: 0.92rem;
      font-weight: 800;
      font-variant-numeric: tabular-nums;

      &.credit { color: #0fb27c; }
      &.debit { color: #ee4d6b; }
    }

    .row-description {
      font-size: 0.85rem;
      font-weight: 600;
      margin: 0;
      color: #2b2f42;
    }

    .row-ref {
      font-size: 0.72rem;
      color: #767a90;
    }

    .match-notice {
      font-size: 0.72rem;
      color: #8c6000;
      background: #fff8eb;
      padding: 4px 8px;
      border-radius: 6px;
    }

    .action-controls-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
      padding-top: 6px;
      border-top: 1px dashed #e8e9f2;
    }

    .action-label {
      font-size: 0.75rem;
      font-weight: 700;
      color: #767a90;
    }

    .action-select, .member-select {
      padding: 4px 8px;
      border-radius: 8px;
      border: 1px solid #d4d6e2;
      font-size: 0.78rem;
      font-weight: 600;
      background: #f8f9fc;
    }

    /* Past Batches */
    .past-batches-section {
      border-top: 1px solid rgba(0, 0, 0, 0.08);
      padding-top: 14px;
    }

    .section-subtitle {
      font-size: 0.85rem;
      font-weight: 700;
      color: #767a90;
      margin: 0 0 8px;
    }

    .batch-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      background: #f8f9fc;
      border-radius: 12px;
      margin-bottom: 6px;
    }

    .batch-info {
      display: flex;
      flex-direction: column;
      font-size: 0.8rem;
      strong { color: #15172b; }
      small { color: #767a90; }
    }

    .rollback-btn {
      padding: 5px 10px;
      font-size: 0.75rem;
      font-weight: 700;
      border-radius: 8px;
      background: rgba(238, 77, 107, 0.1);
      color: #ee4d6b;
      border: none;
      cursor: pointer;
      &:hover { background: rgba(238, 77, 107, 0.2); }
    }

    /* Footer */
    .sheet-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 24px;
      border-top: 1px solid rgba(0, 0, 0, 0.08);
      background: var(--color-card, #ffffff);
    }

    .btn {
      padding: 10px 20px;
      border-radius: var(--radius-pill, 9999px);
      font-size: 0.88rem;
      font-weight: 700;
      border: none;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

      &:active {
        transform: scale(0.96);
      }

      &.btn-primary {
        background: linear-gradient(135deg, #0071e3 0%, #0056b3 100%);
        color: #fff;
        box-shadow: 0 4px 14px rgba(0, 113, 227, 0.3);
        &:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
      }

      &.btn-secondary {
        background: var(--bg-subtle, #f5f5f7);
        color: var(--ink, #1d1d1f);
        border: 1px solid var(--line);
      }
    }
  `],
})
export class BankImportSheetComponent {
  readonly closed = output<void>();

  readonly ledgerStore = inject(LedgerStore);
  private readonly toast = inject(ToastService);

  readonly profiles = DEFAULT_BANK_PROFILES;
  readonly selectedProfile = signal<ImportMappingProfile>(DEFAULT_BANK_PROFILES[0]);
  readonly isDragging = signal<boolean>(false);
  readonly parsedRows = signal<ParsedStatementRow[]>([]);

  readonly matchedCount = computed(
    () => this.parsedRows().filter((r) => r.matchStatus === 'matched').length
  );
  readonly probableCount = computed(
    () => this.parsedRows().filter((r) => r.matchStatus === 'probable').length
  );
  readonly importReadyCount = computed(
    () => this.parsedRows().filter((r) => r.action !== 'skip').length
  );

  readonly recentBatches = computed(() => {
    const txs = this.ledgerStore.transactions();
    const batchMap = new Map<string, { id: string; count: number; date: string }>();

    for (const tx of txs) {
      if (tx.importBatchId && !tx.deletedAt) {
        const existing = batchMap.get(tx.importBatchId);
        if (existing) {
          existing.count++;
        } else {
          batchMap.set(tx.importBatchId, {
            id: tx.importBatchId,
            count: 1,
            date: tx.createdAt,
          });
        }
      }
    }

    return Array.from(batchMap.values());
  });

  onProfileChange(profileId: string): void {
    const found = this.profiles.find((p) => p.id === profileId);
    if (found) {
      this.selectedProfile.set(found);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.processFile(file);
    }
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.processFile(file);
    }
  }

  private processFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        this.parseCsvContent(text);
      }
    };
    reader.readAsText(file);
  }

  parseCsvContent(csvContent: string): void {
    try {
      const records = parseCsvToRecords(csvContent);
      if (records.length === 0) {
        this.toast.show('No tabular records found in uploaded file', 'danger');
        return;
      }

      const rows = mapAndMatchStatementRows(
        records,
        this.selectedProfile(),
        this.ledgerStore.ledgerState()
      );

      this.parsedRows.set(rows);
      this.toast.show(
        `Parsed ${rows.length} records (${this.matchedCount()} matched, ${this.importReadyCount()} ready)`,
        'info'
      );
    } catch {
      this.toast.show('Failed to parse bank statement file', 'danger');
    }
  }

  loadSampleCsv(): void {
    const sample = `"Txn Date","Value Date","Description","Ref No./Cheque No.","Debit","Credit","Balance"
"05/06/2024","05/06/2024","BY TRANSFER-UPI/415782910243/Group Pool","TRANSFER-415782910243","","2,40,000.00","1,18,65,189.00"
"05/07/2024","05/07/2024","BY TRANSFER-NEFT/N349281001/Repayment","NEFT-N349281001","","2,40,000.00","1,16,25,189.00"
"20/07/2024","20/07/2024","TO TRANSFER-OD Drawdown for Renovation","CHQ-000491","50,000.00","","1,16,75,189.00"
"05/08/2024","05/08/2024","BY TRANSFER-UPI/519827361928/Monthly EMI","UPI-519827361928","","2,40,000.00","1,14,35,189.00"`;

    this.selectedProfile.set(this.profiles[0]); // SBI Maxgain
    this.parseCsvContent(sample);
  }

  updateRowAction(tempId: string, action: ParsedStatementRow['action']): void {
    this.parsedRows.update((rows) =>
      rows.map((r) => (r.tempId === tempId ? { ...r, action } : r))
    );
  }

  updateRowMember(tempId: string, memberId: string): void {
    this.parsedRows.update((rows) =>
      rows.map((r) => (r.tempId === tempId ? { ...r, selectedMemberId: memberId } : r))
    );
  }

  setAllUnmatched(action: ParsedStatementRow['action']): void {
    this.parsedRows.update((rows) =>
      rows.map((r) => (r.matchStatus === 'unmatched' ? { ...r, action } : r))
    );
  }

  setAllMatchedToSkip(): void {
    this.parsedRows.update((rows) =>
      rows.map((r) => (r.matchStatus === 'matched' ? { ...r, action: 'skip' } : r))
    );
  }

  resetFile(): void {
    this.parsedRows.set([]);
  }

  async commitImport(): Promise<void> {
    const batchId = `batch-${Date.now().toString(36)}`;
    try {
      const count = await this.ledgerStore.commitImportBatch(batchId, this.parsedRows());
      this.toast.show(
        `Successfully imported ${count} transactions from bank statement (Batch ${batchId})`,
        'success'
      );
      this.closed.emit();
    } catch {
      this.toast.show('Failed to commit imported transactions', 'danger');
    }
  }

  async rollbackBatch(batchId: string): Promise<void> {
    try {
      const rolledBack = await this.ledgerStore.rollbackImportBatch(batchId);
      this.toast.show(`Rolled back ${rolledBack} transactions from ${batchId}`, 'info');
    } catch {
      this.toast.show(`Failed to rollback ${batchId}`, 'danger');
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('sheet-backdrop')) {
      this.closed.emit();
    }
  }

  formatPaise(amount: Paise): string {
    return formatPaise(amount);
  }
}

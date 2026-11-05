import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackupDiffSummary } from '../../core/engine';

@Component({
  selector: 'app-restore-preview-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    @if (isOpen() && diff()) {
      <div
        class="modal-backdrop"
        (click)="cancelled.emit()"
        (keydown.escape)="cancelled.emit()"
        tabindex="-1"
      >
        <div
          class="modal-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-title"
          (click)="$event.stopPropagation()"
          (keydown)="$event.stopPropagation()"
          tabindex="0"
        >
          <!-- Header -->
          <header class="modal-header">
            <div>
              <span class="badge" [class.danger]="!diff()?.isValid">
                {{ diff()?.isValid ? 'BACKUP FILE VERIFIED' : 'INVALID BACKUP FILE' }}
              </span>
              <h3 id="restore-title" class="modal-title">Preview Backup File</h3>
            </div>
            <button
              type="button"
              class="close-btn"
              (click)="cancelled.emit()"
              aria-label="Close"
            >
              ✕
            </button>
          </header>

          <!-- Body -->
          <div class="modal-body">
            @if (!diff()?.isValid) {
              <div class="error-alert">
                <strong>Cannot Read This File:</strong>
                <ul>
                  @for (err of diff()?.validationErrors; track err) {
                    <li>{{ err }}</li>
                  }
                </ul>
              </div>
            } @else {
              <!-- Loan Metadata Card -->
              <div class="loan-card">
                <span class="loan-label">Loan in Backup:</span>
                <strong class="loan-title">{{ diff()?.loanName }}</strong>
                <small class="loan-ac">Account: {{ diff()?.accountNumber }}</small>
              </div>

              <!-- Entity Count Diff Table -->
              <div class="diff-table-container">
                <h4 class="table-title">What Will Be Restored</h4>
                <table class="diff-table">
                  <thead>
                    <tr>
                      <th>Record Type</th>
                      <th class="text-right">Currently on Phone</th>
                      <th class="text-right">In Backup File</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Payments & Debits</td>
                      <td class="text-right tabular-nums">{{ diff()?.currentCounts?.transactions }}</td>
                      <td class="text-right tabular-nums font-bold highlight">
                        {{ diff()?.incomingCounts?.transactions }}
                        <span class="delta-badge">+{{ diff()?.newTransactionsCount }} new</span>
                      </td>
                    </tr>
                    <tr>
                      <td>Family Members</td>
                      <td class="text-right tabular-nums">{{ diff()?.currentCounts?.members }}</td>
                      <td class="text-right tabular-nums font-bold">{{ diff()?.incomingCounts?.members }}</td>
                    </tr>
                    <tr>
                      <td>Passbook Balance Checks</td>
                      <td class="text-right tabular-nums">{{ diff()?.currentCounts?.snapshots }}</td>
                      <td class="text-right tabular-nums font-bold">{{ diff()?.incomingCounts?.snapshots }}</td>
                    </tr>
                    <tr>
                      <td>Monthly Interest Records</td>
                      <td class="text-right tabular-nums">{{ diff()?.currentCounts?.interestEntries }}</td>
                      <td class="text-right tabular-nums font-bold">{{ diff()?.incomingCounts?.interestEntries }}</td>
                    </tr>
                    <tr>
                      <td>Saved Statement Snapshots</td>
                      <td class="text-right tabular-nums">{{ diff()?.currentCounts?.statements }}</td>
                      <td class="text-right tabular-nums font-bold">{{ diff()?.incomingCounts?.statements }}</td>
                    </tr>
                    <tr>
                      <td>History Changes</td>
                      <td class="text-right tabular-nums">{{ diff()?.currentCounts?.auditLog }}</td>
                      <td class="text-right tabular-nums font-bold">{{ diff()?.incomingCounts?.auditLog }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="warning-box">
                <span class="warning-icon">⚠️</span>
                <p class="warning-text">
                  Restoring will replace all current data on your phone with the records saved in this backup file.
                </p>
              </div>
            }
          </div>

          <!-- Footer -->
          <footer class="modal-footer">
            <button
              type="button"
              class="btn btn-secondary"
              (click)="cancelled.emit()"
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-primary"
              [disabled]="!diff()?.isValid"
              (click)="confirmed.emit()"
            >
              Restore My Data
            </button>
          </footer>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(10, 12, 21, 0.65);
      backdrop-filter: blur(8px);
      display: grid;
      place-items: center;
      z-index: 1070;
      padding: 16px;
    }

    .modal-dialog {
      background: var(--color-card, #ffffff);
      color: var(--color-ink, #15172b);
      width: 100%;
      max-width: 540px;
      border-radius: 24px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: modalPop 0.22s ease-out;
    }

    @keyframes modalPop {
      from { transform: scale(0.96) translateY(8px); opacity: 0; }
      to { transform: scale(1) translateY(0); opacity: 1; }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 22px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    .badge {
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: #0fb27c;
      background: rgba(15, 178, 124, 0.1);
      padding: 3px 8px;
      border-radius: 99px;
      display: inline-block;
      margin-bottom: 4px;

      &.danger {
        color: #ee4d6b;
        background: rgba(238, 77, 107, 0.1);
      }
    }

    .modal-title {
      font-size: 1.25rem;
      font-weight: 800;
      margin: 0;
    }

    .close-btn {
      background: rgba(0, 0, 0, 0.05);
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      cursor: pointer;
      color: var(--color-muted, #767a90);
      &:hover { background: rgba(0, 0, 0, 0.1); }
    }

    .modal-body {
      padding: 20px 22px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .loan-card {
      background: #f8f9fc;
      border: 1px solid #ededf4;
      border-radius: 14px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .loan-label {
      font-size: 0.72rem;
      color: #767a90;
      font-weight: 700;
      text-transform: uppercase;
    }

    .loan-title {
      font-size: 1.05rem;
      color: #15172b;
    }

    .loan-ac {
      font-size: 0.78rem;
      color: #767a90;
    }

    .diff-table-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .table-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: #15172b;
      margin: 0;
    }

    .diff-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;

      th {
        background: #f4f5f9;
        padding: 8px 10px;
        font-weight: 700;
        color: #555b72;
        border-top: 1px solid #e5e7eb;
        border-bottom: 1px solid #e5e7eb;
      }

      td {
        padding: 8px 10px;
        border-bottom: 1px solid #f0f0f5;
      }
    }

    .text-right { text-align: right; }
    .tabular-nums { font-variant-numeric: tabular-nums; }
    .font-bold { font-weight: 700; }
    .highlight { color: #6c4cff; }

    .delta-badge {
      font-size: 0.65rem;
      font-weight: 700;
      background: rgba(108, 76, 255, 0.1);
      color: #6c4cff;
      padding: 1px 6px;
      border-radius: 99px;
      margin-left: 4px;
    }

    .warning-box {
      background: #fff8eb;
      border: 1px solid #fde4b8;
      border-radius: 12px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .warning-icon { font-size: 1.1rem; }
    .warning-text { font-size: 0.78rem; color: #8c6000; margin: 0; line-height: 1.35; }

    .error-alert {
      background: #fff1f3;
      border: 1px solid #ffd0d7;
      border-radius: 12px;
      padding: 14px;
      color: #c91a3a;
      font-size: 0.82rem;

      ul { margin: 6px 0 0; padding-left: 20px; }
      li { margin-bottom: 4px; }
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 22px;
      border-top: 1px solid rgba(0, 0, 0, 0.08);
      background: var(--color-card, #ffffff);
    }

    .btn {
      padding: 8px 16px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 700;
      border: none;
      cursor: pointer;

      &.btn-primary {
        background: linear-gradient(135deg, #6c4cff, #9b4dff);
        color: #fff;
        &:disabled { opacity: 0.5; cursor: not-allowed; }
      }

      &.btn-secondary {
        background: rgba(0, 0, 0, 0.06);
        color: var(--color-ink, #15172b);
      }
    }
  `],
})
export class RestorePreviewModalComponent {
  readonly diff = input<BackupDiffSummary | null>(null);
  readonly isOpen = input<boolean>(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}


import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LedgerStore } from '../../core/state';
import {
  generateAuditCsv,
  HashChainVerificationResult,
  verifyAuditHashChain,
} from '../../core/engine';
import { GlassCardComponent, ToastService } from '../../shared/ui';

@Component({
  selector: 'app-audit-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    GlassCardComponent,
  ],
  template: `
    <div class="audit-page">
      <header class="audit-header">
        <div>
          <a routerLink="/settings" class="back-link">← Back to Settings</a>
          <h1 class="header-title">Audit Log & Tamper Verification</h1>
          <p class="header-sub">Immutable, append-only cryptographic event log of all mutations.</p>
        </div>

        <div class="header-actions">
          <button type="button" class="btn btn-secondary" (click)="verifyChain()">
            🔒 Verify Hash Chain
          </button>
          <button type="button" class="btn btn-primary" (click)="exportCsv()">
            📥 Export Audit CSV
          </button>
        </div>
      </header>

      <!-- Cryptographic Hash Chain Verification Banner -->
      @if (verificationResult()) {
        <app-glass-card [staggerIndex]="0">
          <div class="verification-card">
            <div class="verification-status-row">
              <span class="status-icon">🛡️</span>
              <div>
                <strong class="status-title">Cryptographic Integrity Verified</strong>
                <p class="status-sub">
                  All {{ verificationResult()!.verifiedCount }} records chained with SHA-256 hash validation [H(n) = SHA256(H(n-1) + Entry(n))]. No tampering detected.
                </p>
              </div>
            </div>

            <div class="hashes-grid">
              <div class="hash-box">
                <span class="hash-label">Genesis Hash:</span>
                <code class="hash-code">{{ verificationResult()!.genesisHash }}</code>
              </div>
              <div class="hash-box">
                <span class="hash-label">Latest Chain Block Hash:</span>
                <code class="hash-code">{{ verificationResult()!.latestHash }}</code>
              </div>
            </div>
          </div>
        </app-glass-card>
      }

      <!-- Filters & Search Bar -->
      <section class="filters-bar">
        <div class="filter-item">
          <label for="actionFilter" class="filter-label">Filter Action:</label>
          <select
            id="actionFilter"
            class="filter-select"
            [ngModel]="selectedAction()"
            (ngModelChange)="selectedAction.set($event)"
          >
            <option value="all">All Actions ({{ ledgerStore.auditLog().length }})</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="reconcile">Reconcile</option>
            <option value="rateChange">Rate Change</option>
            <option value="restore">Restore</option>
            <option value="reset">Reset</option>
          </select>
        </div>

        <div class="filter-item">
          <label for="entityFilter" class="filter-label">Entity Type:</label>
          <select
            id="entityFilter"
            class="filter-select"
            [ngModel]="selectedEntity()"
            (ngModelChange)="selectedEntity.set($event)"
          >
            <option value="all">All Entities</option>
            <option value="transaction">Transaction</option>
            <option value="member">Member</option>
            <option value="loan">Loan Settings</option>
            <option value="snapshot">Balance Snapshot</option>
            <option value="rateChange">Rate Change</option>
            <option value="backup">Backup / Restore</option>
          </select>
        </div>

        <div class="filter-item search-item">
          <label for="searchQuery" class="filter-label">Search Entity ID / Details:</label>
          <input
            id="searchQuery"
            type="text"
            class="search-input"
            placeholder="e.g. batch- or member id..."
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
          />
        </div>
      </section>

      <!-- Audit Timeline Records -->
      <div class="audit-list">
        @for (entry of filteredLog(); track entry.id) {
          <div class="audit-row-card">
            <div class="row-header">
              <div class="badges-row">
                <span class="action-tag" [class]="entry.action">{{ entry.action | uppercase }}</span>
                <span class="entity-tag">{{ entry.entityType }}</span>
                <span class="entity-id">{{ entry.entityId }}</span>
              </div>
              <span class="timestamp">{{ entry.timestamp | date:'medium' }}</span>
            </div>

            <!-- Visual JSON Diff (Expandable) -->
            @if (entry.payloadBefore || entry.payloadAfter) {
              <div class="diff-container">
                <button
                  type="button"
                  class="toggle-diff-btn"
                  (click)="toggleExpand(entry.id)"
                >
                  {{ expandedIds().has(entry.id) ? '▼ Hide Data Payload' : '▶ View Data Payload Diff' }}
                </button>

                @if (expandedIds().has(entry.id)) {
                  <div class="payloads-grid">
                    @if (entry.payloadBefore) {
                      <div class="payload-col before">
                        <span class="payload-label">BEFORE:</span>
                        <pre class="json-code">{{ formatJson(entry.payloadBefore) }}</pre>
                      </div>
                    }
                    @if (entry.payloadAfter) {
                      <div class="payload-col after">
                        <span class="payload-label">AFTER:</span>
                        <pre class="json-code">{{ formatJson(entry.payloadAfter) }}</pre>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        } @empty {
          <div class="empty-audit">
            <span class="empty-icon">📜</span>
            <p>No audit entries match the selected filters.</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .audit-page {
      max-width: 880px;
      margin: 0 auto;
      padding: 16px 16px 80px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .audit-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 14px;
    }

    .back-link {
      font-size: 0.85rem;
      font-weight: 700;
      color: #6c4cff;
      text-decoration: none;
    }

    .header-title {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--color-ink, #15172b);
      margin: 4px 0 2px;
    }

    .header-sub {
      font-size: 0.85rem;
      color: var(--color-muted, #767a90);
      margin: 0;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .btn {
      padding: 8px 16px;
      border-radius: var(--radius-pill, 9999px);
      font-size: 0.85rem;
      font-weight: 700;
      border: 1px solid var(--line);
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

      &:active {
        transform: scale(0.96);
      }

      &.btn-primary {
        background: linear-gradient(135deg, #0071e3 0%, #0056b3 100%);
        color: #fff;
        border: none;
        box-shadow: 0 4px 14px rgba(0, 113, 227, 0.3);
      }
      &.btn-secondary {
        background: #ffffff;
        color: var(--ink, #1d1d1f);
        border: 1px solid var(--line);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
      }
    }

    /* Verification Card */
    .verification-card {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .verification-status-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .status-icon {
      font-size: 1.8rem;
    }

    .status-title {
      font-size: 1.05rem;
      font-weight: 800;
      color: #34c759;
      display: block;
    }

    .status-sub {
      font-size: 0.82rem;
      color: var(--muted, #86868b);
      margin: 2px 0 0;
    }

    .hashes-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .hash-box {
      background: var(--bg-subtle, #f5f5f7);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .hash-label {
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--muted);
    }

    .hash-code {
      font-family: monospace;
      font-size: 0.68rem;
      color: var(--brand-a, #0071e3);
      word-break: break-all;
    }

    /* Filters Bar */
    .filters-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      background: var(--color-card, #ffffff);
      padding: 12px 16px;
      border-radius: 16px;
      border: 1px solid rgba(0, 0, 0, 0.08);
    }

    .filter-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .search-item {
      flex: 1;
      min-width: 200px;
    }

    .filter-label {
      font-size: 0.72rem;
      font-weight: 700;
      color: #767a90;
    }

    .filter-select, .search-input {
      padding: 6px 10px;
      border-radius: 10px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      background: var(--color-bg, #f4f1ec);
      font-size: 0.85rem;
      color: var(--color-ink, #15172b);
    }

    /* Audit List */
    .audit-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .audit-row-card {
      background: var(--color-card, #ffffff);
      border-radius: 14px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .row-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .badges-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .action-tag {
      font-size: 0.68rem;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 6px;

      &.create { background: rgba(15, 178, 124, 0.12); color: #0fb27c; }
      &.update { background: rgba(108, 76, 255, 0.12); color: #6c4cff; }
      &.delete { background: rgba(238, 77, 107, 0.12); color: #ee4d6b; }
      &.reconcile { background: rgba(245, 159, 0, 0.15); color: #b26e00; }
      &.restore, &.reset { background: rgba(46, 144, 255, 0.15); color: #2e90ff; }
    }

    .entity-tag {
      font-size: 0.72rem;
      font-weight: 700;
      color: #555b72;
      background: #f1f2f8;
      padding: 2px 8px;
      border-radius: 6px;
    }

    .entity-id {
      font-size: 0.75rem;
      font-family: monospace;
      color: #767a90;
    }

    .timestamp {
      font-size: 0.72rem;
      color: #767a90;
    }

    .toggle-diff-btn {
      background: none;
      border: none;
      color: #6c4cff;
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
      padding: 0;
      text-align: left;
    }

    .payloads-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-top: 8px;
    }

    .payload-col {
      border-radius: 8px;
      padding: 8px;
      font-size: 0.72rem;

      &.before { background: #fff5f5; border: 1px solid #fed7d7; }
      &.after { background: #f0fff4; border: 1px solid #c6f6d5; }
    }

    .payload-label {
      font-weight: 800;
      font-size: 0.65rem;
      margin-bottom: 4px;
      display: block;
    }

    .json-code {
      margin: 0;
      font-family: monospace;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .empty-audit {
      text-align: center;
      padding: 40px;
      color: #767a90;
    }

    .empty-icon { font-size: 2.2rem; }
  `],
})
export class AuditViewerComponent implements OnInit {
  readonly ledgerStore = inject(LedgerStore);
  private readonly toast = inject(ToastService);

  readonly selectedAction = signal<string>('all');
  readonly selectedEntity = signal<string>('all');
  readonly searchQuery = signal<string>('');
  readonly expandedIds = signal<Set<string>>(new Set());
  readonly verificationResult = signal<HashChainVerificationResult | null>(null);

  readonly filteredLog = computed(() => {
    const log = this.ledgerStore.auditLog();
    const action = this.selectedAction();
    const entity = this.selectedEntity();
    const query = this.searchQuery().toLowerCase().trim();

    return log.filter((entry) => {
      if (action !== 'all' && entry.action !== action) return false;
      if (entity !== 'all' && entry.entityType !== entity) return false;
      if (query) {
        const idMatch = entry.entityId.toLowerCase().includes(query);
        const actionMatch = entry.action.toLowerCase().includes(query);
        const entityMatch = entry.entityType.toLowerCase().includes(query);
        if (!idMatch && !actionMatch && !entityMatch) return false;
      }
      return true;
    });
  });

  ngOnInit(): void {
    void this.verifyChain();
  }

  async verifyChain(): Promise<void> {
    const res = await verifyAuditHashChain(this.ledgerStore.auditLog());
    this.verificationResult.set(res);
    this.toast.show(
      `Audit hash chain verified (${res.verifiedCount} records tamper-evident)`,
      'success'
    );
  }

  toggleExpand(id: string): void {
    this.expandedIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  formatJson(data: unknown): string {
    return JSON.stringify(data, null, 2);
  }

  exportCsv(): void {
    const csv = generateAuditCsv(this.ledgerStore.auditLog());
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loan-tracker-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.show('Audit log exported to CSV', 'success');
  }
}

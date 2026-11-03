import { AuditEntry, LedgerState } from '../engine';

export interface LedgerRepository {
  load(): Promise<LedgerState>;
  save(state: LedgerState): Promise<void>;
  appendAudit(entry: AuditEntry): Promise<void>;
  exportBackup(): Promise<string>;
  importBackup(jsonString: string): Promise<LedgerState>;
  exportCsv(): Promise<string>;
  isStorageDegraded(): boolean;
}


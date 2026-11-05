import { Injectable } from '@angular/core';
import { AuditEntry, LedgerState } from '../engine';
import { generateLedgerCsv } from './csv-export';
import { LedgerRepository } from './ledger-repository.interface';
import { getInitialSeedData } from './seed-data';

interface StoragePayload {
  version: number;
  data: LedgerState;
}

const STORAGE_KEY = 'loan_tracker_ledger_v2';
const CURRENT_SCHEMA_VERSION = 2;

@Injectable({
  providedIn: 'root',
})
export class LocalStorageLedgerRepository implements LedgerRepository {
  private inMemoryCache: LedgerState | null = null;
  private isDegradedStorage = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingStateToSave: LedgerState | null = null;

  constructor() {
    // Flush pending changes before page unloads
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flushPendingSync();
      });
    }
  }

  isStorageDegraded(): boolean {
    return this.isDegradedStorage;
  }

  async load(): Promise<LedgerState> {
    if (this.inMemoryCache) {
      return this.inMemoryCache;
    }

    try {
      if (typeof localStorage !== 'undefined') {
        // Clear old dummy mock storage key if present
        localStorage.removeItem('loan_tracker_ledger_v1');
      }

      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) {
        const seed = getInitialSeedData();
        await this.save(seed);
        this.inMemoryCache = seed;
        return seed;
      }

      const parsed = JSON.parse(raw) as StoragePayload | LedgerState;
      const state = this.migrateSchema(parsed);

      const avatarMap: Record<string, string> = {
        vishwas: '/profiles/vishwas.jpeg',
        vikas: '/profiles/vikas.jpeg',
        bhavya: '/profiles/bhavya.jpeg',
        shruthi: '/profiles/shruthi.jpeg',
        csp: '/profiles/csp.jpeg',
      };
      for (const m of state.members) {
        if (!m.avatarUrl && avatarMap[m.name.toLowerCase().trim()]) {
          m.avatarUrl = avatarMap[m.name.toLowerCase().trim()];
        }
      }

      // Upgrade if stale mock data with generic "Member 1" or outdated opening balance is found
      if (state.members.some((m) => m.name.startsWith('Member ')) || state.loan.openingOutstanding !== getInitialSeedData().loan.openingOutstanding) {
        const freshSeed = getInitialSeedData();
        await this.save(freshSeed);
        this.inMemoryCache = freshSeed;
        return freshSeed;
      }

      this.inMemoryCache = state;
      return state;
    } catch {
      this.isDegradedStorage = true;
      const seed = getInitialSeedData();
      this.inMemoryCache = seed;
      return seed;
    }
  }

  async save(state: LedgerState): Promise<void> {
    this.inMemoryCache = state;
    this.pendingStateToSave = state;

    return new Promise((resolve) => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(() => {
        this.flushPendingSync();
        resolve();
      }, 200);
    });
  }

  async appendAudit(entry: AuditEntry): Promise<void> {
    const current = await this.load();
    current.auditLog = [entry, ...current.auditLog];
    await this.save(current);
  }

  async exportBackup(): Promise<string> {
    const current = await this.load();
    const payload: StoragePayload = {
      version: CURRENT_SCHEMA_VERSION,
      data: current,
    };
    return JSON.stringify(payload, null, 2);
  }

  async importBackup(jsonString: string): Promise<LedgerState> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid JSON format');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid backup structure: root must be an object');
    }

    const state = this.migrateSchema(parsed as StoragePayload | LedgerState);
    if (!state.loan || !Array.isArray(state.members) || !Array.isArray(state.transactions)) {
      throw new Error('Invalid backup: Missing loan, members, or transactions');
    }

    await this.save(state);
    return state;
  }

  async exportCsv(): Promise<string> {
    const current = await this.load();
    return generateLedgerCsv(current);
  }

  private flushPendingSync(): void {
    if (!this.pendingStateToSave) {
      return;
    }

    const payload: StoragePayload = {
      version: CURRENT_SCHEMA_VERSION,
      data: this.pendingStateToSave,
    };

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        this.isDegradedStorage = false;
      }
    } catch {
      // QuotaExceededError or private browsing
      this.isDegradedStorage = true;
    } finally {
      this.pendingStateToSave = null;
    }
  }

  private migrateSchema(rawPayload: StoragePayload | LedgerState | Record<string, unknown>): LedgerState {
    // If encapsulated in versioned envelope
    if ('version' in rawPayload && 'data' in rawPayload && typeof rawPayload.data === 'object' && rawPayload.data !== null) {
      return rawPayload.data as LedgerState;
    }

    // Direct LedgerState check
    if ('loan' in rawPayload && 'members' in rawPayload) {
      return rawPayload as unknown as LedgerState;
    }

    throw new Error('Unrecognized schema version or corrupt data');
  }
}


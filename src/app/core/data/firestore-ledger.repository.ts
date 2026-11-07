import { Injectable } from '@angular/core';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  getFirestore,
  Firestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  writeBatch,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import {
  AuditEntry,
  BalanceSnapshot,
  InterestEntry,
  LedgerState,
  Loan,
  Member,
  RateChange,
  StatementSnapshot,
  Transaction,
} from '../engine';
import { generateLedgerCsv } from './csv-export';
import { LedgerRepository } from './ledger-repository.interface';
import { getInitialSeedData } from './seed-data';
import { environment } from '../../../environments/environment';

const PRIMARY_LOAN_ID = 'loan-primary';

@Injectable({
  providedIn: 'root',
})
export class FirestoreLedgerRepository implements LedgerRepository {
  private app: FirebaseApp;
  private db: Firestore;
  private inMemoryCache: LedgerState | null = null;
  private isDegraded = false;
  private activeListeners: Unsubscribe[] = [];

  constructor() {
    // Purge all legacy local storage keys completely
    this.purgeLegacyLocalStorage();

    // Initialize Firebase
    if (getApps().length === 0) {
      this.app = initializeApp(environment.firebase);
    } else {
      this.app = getApp();
    }

    try {
      this.db = initializeFirestore(this.app, {
        localCache: persistentLocalCache(),
      });
    } catch {
      // If already initialized (e.g. HMR or secondary instance)
      this.db = getFirestore(this.app);
    }
  }

  isStorageDegraded(): boolean {
    return this.isDegraded;
  }

  async load(): Promise<LedgerState> {
    if (this.inMemoryCache) {
      return this.inMemoryCache;
    }

    try {
      const loanDocRef = doc(this.db, 'loans', PRIMARY_LOAN_ID);
      const loanSnap = await getDoc(loanDocRef);

      if (!loanSnap.exists()) {
        // First run: bootstrap Firestore with default 5 profiles and loan baseline
        const seed = getInitialSeedData();
        await this.bootstrapSeedData(seed);
        this.inMemoryCache = seed;
        return seed;
      }

      const loan = loanSnap.data() as Loan;

      // Fetch subcollections in parallel
      const [
        membersSnap,
        transactionsSnap,
        rateChangesSnap,
        snapshotsSnap,
        statementsSnap,
        auditLogSnap,
      ] = await Promise.all([
        getDocs(collection(this.db, 'loans', PRIMARY_LOAN_ID, 'members')),
        getDocs(collection(this.db, 'loans', PRIMARY_LOAN_ID, 'transactions')),
        getDocs(collection(this.db, 'loans', PRIMARY_LOAN_ID, 'rateChanges')),
        getDocs(collection(this.db, 'loans', PRIMARY_LOAN_ID, 'snapshots')),
        getDocs(collection(this.db, 'loans', PRIMARY_LOAN_ID, 'statements')),
        getDocs(collection(this.db, 'loans', PRIMARY_LOAN_ID, 'auditLog')),
      ]);

      const members = membersSnap.docs.map((d) => d.data() as Member);
      const transactions = transactionsSnap.docs.map((d) => d.data() as Transaction);
      const rateChanges = rateChangesSnap.docs.map((d) => d.data() as RateChange);
      const snapshots = snapshotsSnap.docs.map((d) => d.data() as BalanceSnapshot);
      const statements = statementsSnap.docs.map((d) => d.data() as StatementSnapshot);
      const auditLog = auditLogSnap.docs.map((d) => d.data() as AuditEntry);

      // Ensure proper avatar paths for the 5 member profiles
      const avatarMap: Record<string, string> = {
        vishwas: 'profiles/vishwas.jpeg',
        vikas: 'profiles/vikas.jpeg',
        bhavya: 'profiles/bhavya.jpeg',
        shruthi: 'profiles/shruthi.jpeg',
        csp: 'profiles/csp.jpeg',
      };
      for (const m of members) {
        const key = m.name.toLowerCase().trim();
        if (!m.avatarUrl && avatarMap[key]) {
          m.avatarUrl = avatarMap[key];
        }
      }

      const state: LedgerState = {
        loan,
        members: members.length > 0 ? members : getInitialSeedData().members,
        transactions,
        rateChanges,
        snapshots,
        interestEntries: [] as InterestEntry[],
        statements,
        settings: {
          theme: 'light',
          dateFormat: 'DD/MM/YYYY',
          maskAccountNumber: false,
          defaultPaymentMode: 'UPI',
        },
        auditLog,
      };

      this.inMemoryCache = state;
      this.isDegraded = false;
      return state;
    } catch {
      // Offline fallback: Use seed data and operate in-memory if Firestore is unreachable
      this.isDegraded = true;
      const seed = getInitialSeedData();
      this.inMemoryCache = seed;
      return seed;
    }
  }

  async save(state: LedgerState): Promise<void> {
    this.inMemoryCache = state;

    try {
      const batch = writeBatch(this.db);

      // 1. Save root loan document
      const loanDocRef = doc(this.db, 'loans', PRIMARY_LOAN_ID);
      batch.set(loanDocRef, state.loan, { merge: true });

      // 2. Save members
      for (const member of state.members) {
        const memRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'members', member.id);
        batch.set(memRef, member, { merge: true });
      }

      // 3. Save transactions
      for (const tx of state.transactions) {
        const txRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'transactions', tx.id);
        batch.set(txRef, tx, { merge: true });
      }

      // 4. Save rate changes
      for (const rc of state.rateChanges) {
        const rcRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'rateChanges', rc.id);
        batch.set(rcRef, rc, { merge: true });
      }

      // 5. Save snapshots
      for (const snap of state.snapshots) {
        const snapRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'snapshots', snap.id);
        batch.set(snapRef, snap, { merge: true });
      }

      // 6. Save statements
      for (const stmt of state.statements || []) {
        const stmtRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'statements', stmt.id);
        batch.set(stmtRef, stmt, { merge: true });
      }

      await batch.commit();
      this.isDegraded = false;
    } catch {
      // Changes remain safely in inMemoryCache and will synchronize once Firestore connects
      this.isDegraded = true;
    }
  }

  async appendAudit(entry: AuditEntry): Promise<void> {
    try {
      const auditRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'auditLog', entry.id);
      await setDoc(auditRef, entry);
    } catch {
      // In-memory fallback
      if (this.inMemoryCache) {
        this.inMemoryCache.auditLog = [entry, ...this.inMemoryCache.auditLog];
      }
    }
  }

  /**
   * Subscribe to real-time changes from Firestore across devices.
   */
  subscribeToRemoteChanges(callback: (state: LedgerState) => void): Unsubscribe {
    const unsubLoan = onSnapshot(doc(this.db, 'loans', PRIMARY_LOAN_ID), async () => {
      // Force reload when cloud data changes
      this.inMemoryCache = null;
      const fresh = await this.load();
      callback(fresh);
    });

    this.activeListeners.push(unsubLoan);
    return unsubLoan;
  }

  async exportBackup(): Promise<string> {
    const current = await this.load();
    return JSON.stringify({ version: 4, data: current }, null, 2);
  }

  async importBackup(jsonString: string): Promise<LedgerState> {
    let parsed: { data?: LedgerState } | LedgerState;
    try {
      parsed = JSON.parse(jsonString) as { data?: LedgerState } | LedgerState;
    } catch {
      throw new Error('Invalid JSON backup file');
    }

    const state = 'data' in parsed && parsed.data ? parsed.data : (parsed as LedgerState);
    if (!state.loan || !Array.isArray(state.members) || !Array.isArray(state.transactions)) {
      throw new Error('Invalid backup structure: Missing loan, members, or transactions');
    }

    await this.save(state);
    return state;
  }

  async exportCsv(): Promise<string> {
    const current = await this.load();
    return generateLedgerCsv(current);
  }

  private async bootstrapSeedData(seed: LedgerState): Promise<void> {
    try {
      const batch = writeBatch(this.db);

      // Loan document
      const loanDocRef = doc(this.db, 'loans', PRIMARY_LOAN_ID);
      batch.set(loanDocRef, seed.loan);

      // The 5 Member profiles
      for (const m of seed.members) {
        const memRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'members', m.id);
        batch.set(memRef, m);
      }

      // Initial transactions
      for (const tx of seed.transactions) {
        const txRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'transactions', tx.id);
        batch.set(txRef, tx);
      }

      // Rate changes
      for (const rc of seed.rateChanges) {
        const rcRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'rateChanges', rc.id);
        batch.set(rcRef, rc);
      }

      // Snapshots
      for (const snap of seed.snapshots) {
        const snapRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'snapshots', snap.id);
        batch.set(snapRef, snap);
      }

      await batch.commit();
    } catch {
      // In-memory will serve if network is down during initial seed
    }
  }

  private purgeLegacyLocalStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('loan_tracker_ledger_v1');
        localStorage.removeItem('loan_tracker_ledger_v2');
        localStorage.removeItem('loan_tracker_ledger_v3');
      } catch {
        // Ignore if storage is inaccessible
      }
    }
  }
}

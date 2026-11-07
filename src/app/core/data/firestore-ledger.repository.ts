import { Injectable, signal } from '@angular/core';
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
  deleteDoc,
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

function cleanForFirestore<T>(data: T): T {
  if (data === undefined || data === null) {
    return data;
  }
  return JSON.parse(JSON.stringify(data)) as T;
}

@Injectable({
  providedIn: 'root',
})
export class FirestoreLedgerRepository implements LedgerRepository {
  private app: FirebaseApp;
  private db: Firestore;
  private inMemoryCache: LedgerState | null = null;
  private readonly degradedSignal = signal<boolean>(false);
  private readonly errorSignal = signal<string | null>(null);
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
        ignoreUndefinedProperties: true,
        localCache: persistentLocalCache(),
      });
    } catch {
      // If already initialized (e.g. HMR or secondary instance)
      this.db = getFirestore(this.app);
    }
  }

  isStorageDegraded(): boolean {
    return this.degradedSignal();
  }

  getLastError(): string | null {
    return this.errorSignal();
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

      const mockIds = new Set([
        'tx-nov-4-vishwas',
        'tx-nov-5-vikas',
        'tx-nov-5-bhavya',
        'tx-nov-4-bank-payment',
        'tx-nov-5-bank-payment',
      ]);
      const members = membersSnap.docs.map((d) => d.data() as Member);
      const transactions = transactionsSnap.docs
        .map((d) => d.data() as Transaction)
        .filter((t) => !mockIds.has(t.id) && !t.id.startsWith('tx-nov-'));

      // Automatically purge any stale mock transactions from Firestore so they never persist or reappear
      for (const d of transactionsSnap.docs) {
        if (mockIds.has(d.id) || d.id.startsWith('tx-nov-')) {
          void deleteDoc(doc(this.db, 'loans', PRIMARY_LOAN_ID, 'transactions', d.id));
        }
      }
      const rateChanges = rateChangesSnap.docs.map((d) => d.data() as RateChange);
      const snapshots = snapshotsSnap.docs.map((d) => d.data() as BalanceSnapshot);
      const statements = statementsSnap.docs.map((d) => d.data() as StatementSnapshot);
      const auditLog = auditLogSnap.docs.map((d) => d.data() as AuditEntry);

      // Ensure proper avatar paths and contact details for the 5 member profiles
      const avatarMap: Record<string, string> = {
        vishwas: 'profiles/vishwas.jpeg',
        vikas: 'profiles/vikas.jpeg',
        bhavya: 'profiles/bhavya.jpeg',
        shruthi: 'profiles/shruthi.jpeg',
        csp: 'profiles/csp.jpeg',
      };
      const contactMap: Record<string, { phone: string; email?: string }> = {
        vishwas: { phone: '8105242578', email: 'vishwascpatilonline@gmail.com' },
        vikas: { phone: '9880413201', email: 'vikascpatil123@gmail.com' },
        bhavya: { phone: '9902103979' },
        shruthi: { phone: '9844586757' },
        csp: { phone: '9880404025' },
      };
      for (const m of members) {
        const key = m.name.toLowerCase().trim();
        if (!m.avatarUrl && avatarMap[key]) {
          m.avatarUrl = avatarMap[key];
        }
        if (contactMap[key]) {
          if (!m.phone) m.phone = contactMap[key].phone;
          if (!m.email && contactMap[key].email) m.email = contactMap[key].email;
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
      this.degradedSignal.set(false);
      this.errorSignal.set(null);
      return state;
    } catch (err: unknown) {
      // Offline fallback: Use seed data and operate in-memory if Firestore is unreachable
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[FirestoreLedgerRepository] load() failed (operating offline):', msg);
      this.degradedSignal.set(true);
      this.errorSignal.set(msg);
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
      batch.set(loanDocRef, cleanForFirestore(state.loan), { merge: true });

      // 2. Save members
      for (const member of state.members) {
        const memRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'members', member.id);
        batch.set(memRef, cleanForFirestore(member), { merge: true });
      }

      // 3. Save transactions
      for (const tx of state.transactions) {
        if (tx.id.startsWith('tx-nov-') || tx.id === 'tx-nov-4-vishwas' || tx.id === 'tx-nov-5-vikas' || tx.id === 'tx-nov-5-bhavya') {
          continue;
        }
        const txRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'transactions', tx.id);
        batch.set(txRef, cleanForFirestore(tx), { merge: true });
      }

      // 4. Save rate changes
      for (const rc of state.rateChanges) {
        const rcRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'rateChanges', rc.id);
        batch.set(rcRef, cleanForFirestore(rc), { merge: true });
      }

      // 5. Save snapshots
      for (const snap of state.snapshots) {
        const snapRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'snapshots', snap.id);
        batch.set(snapRef, cleanForFirestore(snap), { merge: true });
      }

      // 6. Save statements
      for (const stmt of state.statements || []) {
        const stmtRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'statements', stmt.id);
        batch.set(stmtRef, cleanForFirestore(stmt), { merge: true });
      }

      await batch.commit();
      this.degradedSignal.set(false);
      this.errorSignal.set(null);
    } catch (err: unknown) {
      // Changes remain safely in inMemoryCache and will synchronize once Firestore connects
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[FirestoreLedgerRepository] save() failed:', msg);
      this.degradedSignal.set(true);
      this.errorSignal.set(msg);
    }
  }

  async appendAudit(entry: AuditEntry): Promise<void> {
    try {
      const auditRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'auditLog', entry.id);
      await setDoc(auditRef, cleanForFirestore(entry));
    } catch (err: unknown) {
      console.warn('[FirestoreLedgerRepository] appendAudit() failed:', err);
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
    const notifyFresh = async () => {
      this.inMemoryCache = null;
      const fresh = await this.load();
      callback(fresh);
    };

    const unsubLoan = onSnapshot(doc(this.db, 'loans', PRIMARY_LOAN_ID), () => {
      void notifyFresh();
    });

    const unsubTx = onSnapshot(collection(this.db, 'loans', PRIMARY_LOAN_ID, 'transactions'), () => {
      void notifyFresh();
    });

    const unsubMembers = onSnapshot(collection(this.db, 'loans', PRIMARY_LOAN_ID, 'members'), () => {
      void notifyFresh();
    });

    this.activeListeners.push(unsubLoan, unsubTx, unsubMembers);

    return () => {
      unsubLoan();
      unsubTx();
      unsubMembers();
    };
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
      batch.set(loanDocRef, cleanForFirestore(seed.loan));

      // The 5 Member profiles
      for (const m of seed.members) {
        const memRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'members', m.id);
        batch.set(memRef, cleanForFirestore(m));
      }

      // Initial transactions
      for (const tx of seed.transactions) {
        const txRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'transactions', tx.id);
        batch.set(txRef, cleanForFirestore(tx));
      }

      // Rate changes
      for (const rc of seed.rateChanges) {
        const rcRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'rateChanges', rc.id);
        batch.set(rcRef, cleanForFirestore(rc));
      }

      // Snapshots
      for (const snap of seed.snapshots) {
        const snapRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'snapshots', snap.id);
        batch.set(snapRef, cleanForFirestore(snap));
      }

      await batch.commit();
    } catch (err: unknown) {
      console.warn('[FirestoreLedgerRepository] bootstrapSeedData failed:', err);
    }
  }

  async savePushSubscription(subData: Record<string, unknown>): Promise<void> {
    try {
      const subId = (subData['id'] as string) || crypto.randomUUID();
      const subRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'push_subscriptions', subId);
      await setDoc(subRef, cleanForFirestore(subData), { merge: true });
    } catch (err: unknown) {
      console.warn('[FirestoreLedgerRepository] savePushSubscription error:', err);
    }
  }

  async saveSmsConfig(config: Record<string, unknown>): Promise<void> {
    try {
      const cfgRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'settings', 'sms_gateway');
      await setDoc(cfgRef, cleanForFirestore(config), { merge: true });
    } catch (err: unknown) {
      console.warn('[FirestoreLedgerRepository] saveSmsConfig error:', err);
    }
  }

  async getSmsConfig(): Promise<Record<string, unknown> | null> {
    try {
      const cfgRef = doc(this.db, 'loans', PRIMARY_LOAN_ID, 'settings', 'sms_gateway');
      const snap = await getDoc(cfgRef);
      if (snap.exists()) {
        return snap.data();
      }
    } catch (err: unknown) {
      console.warn('[FirestoreLedgerRepository] getSmsConfig error:', err);
    }
    return null;
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

import { computed, inject, Injectable, signal } from '@angular/core';
import {
  AuditEntry,
  BalanceSnapshot,
  BankRuleSettings,
  bankPaymentSplit,
  CalculationMethod,
  closeMonth,
  DailyLedgerRecord,
  getDailyLedger,
  getEngineForMethod,
  GroupFundsSummary,
  InterestEntry,
  LedgerState,
  Loan,
  Member,
  MemberStatistics,
  memberStatistics,
  monthlySummary,
  MonthlySummary,
  outstandingAt,
  Paise,
  paise,
  PaymentMode,
  RateChange,
  reconcile,
  ReconciliationResult,
  Transaction,
} from '../engine';
import { getInitialSeedData, LocalStorageLedgerRepository } from '../data';
import { SettingsStore } from './settings.store';

@Injectable({
  providedIn: 'root',
})
export class LedgerStore {
  private readonly repo = inject(LocalStorageLedgerRepository);
  private readonly settingsStore = inject(SettingsStore);

  // Core State Signals
  readonly loan = signal<Loan>(getInitialSeedData().loan);
  readonly members = signal<Member[]>([]);
  readonly transactions = signal<Transaction[]>([]);
  readonly rateChanges = signal<RateChange[]>([]);
  readonly snapshots = signal<BalanceSnapshot[]>([]);
  readonly interestEntries = signal<InterestEntry[]>([]);
  readonly auditLog = signal<AuditEntry[]>([]);

  readonly isLoading = signal<boolean>(true);
  readonly storageWarning = signal<string | null>(null);

  // Full derived LedgerState object for pure engine functions
  readonly ledgerState = computed<LedgerState>(() => ({
    loan: this.loan(),
    members: this.members(),
    transactions: this.transactions(),
    rateChanges: this.rateChanges(),
    snapshots: this.snapshots(),
    interestEntries: this.interestEntries(),
    settings: {
      theme: this.settingsStore.theme(),
      dateFormat: this.settingsStore.dateFormat(),
      maskAccountNumber: this.settingsStore.maskAccountNumber(),
      defaultPaymentMode: 'UPI',
    },
    auditLog: this.auditLog(),
  }));

  // Computed Projections
  readonly currentOutstanding = computed<Paise>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return outstandingAt(today, this.ledgerState());
  });

  readonly thisMonthSummary = computed<MonthlySummary>(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return monthlySummary(currentMonth, this.ledgerState());
  });

  readonly groupFunds = computed<GroupFundsSummary>(() => {
    const activeTx = this.transactions().filter((tx) => !tx.deletedAt);
    let totalContributions = paise(0);
    let totalBankPayments = paise(0);

    for (const tx of activeTx) {
      if (tx.type === 'contribution') {
        totalContributions = paise(totalContributions + tx.amount);
      } else if (tx.type === 'bankPayment') {
        totalBankPayments = paise(totalBankPayments + tx.amount);
      }
    }

    return {
      totalContributions,
      totalBankPayments,
      unusedFunds: paise(totalContributions - totalBankPayments),
    };
  });

  readonly memberStats = computed<MemberStatistics[]>(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const ledger = this.ledgerState();
    return this.members()
      .filter((m) => !m.deletedAt)
      .map((m) => memberStatistics(m.id, ledger, currentMonth));
  });

  readonly activeMembers = computed<Member[]>(() =>
    this.members().filter((m) => m.active && !m.deletedAt)
  );

  readonly recentTransactions = computed<Transaction[]>(() => {
    return [...this.transactions()]
      .filter((tx) => !tx.deletedAt)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10);
  });

  constructor() {
    void this.initialize();
  }

  async initialize(): Promise<void> {
    this.isLoading.set(true);
    try {
      const state = await this.repo.load();
      this.syncState(state);
      this.settingsStore.initFromState(state.settings);

      if (this.repo.isStorageDegraded()) {
        this.storageWarning.set(
          'Storage quota exceeded or private browsing active. Running in in-memory mode; data will not persist across browser restarts.'
        );
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  // --- Commands & Mutations ---

  async addContribution(params: {
    memberId: string;
    amount: Paise;
    date: string;
    forMonth?: string;
    mode: PaymentMode;
    reference?: string;
    notes?: string;
  }): Promise<void> {
    const forMonth = params.forMonth || params.date.slice(0, 7);
    const tx: Transaction = {
      id: crypto.randomUUID(),
      type: 'contribution',
      memberId: params.memberId,
      amount: params.amount,
      date: params.date,
      forMonth,
      mode: params.mode,
      reference: params.reference,
      notes: params.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.transactions.update((prev) => [tx, ...prev]);
    await this.logAuditAndSave('create', 'transaction', tx.id, undefined, tx);
  }

  async recordBankPayment(params: {
    amount: Paise;
    interestPortion?: Paise;
    date: string;
    forMonth?: string;
    mode: PaymentMode;
    reference?: string;
    notes?: string;
  }): Promise<void> {
    const forMonth = params.forMonth || params.date.slice(0, 7);
    const currentOut = outstandingAt(params.date, this.ledgerState());
    const estInterest = monthlySummary(forMonth, this.ledgerState()).interestIncurredEst;

    const split = bankPaymentSplit(
      params.amount,
      estInterest || currentOut,
      params.interestPortion
    );

    const tx: Transaction = {
      id: crypto.randomUUID(),
      type: 'bankPayment',
      amount: params.amount,
      interestPortion: split.interestPortion,
      principalPortion: split.principalPortion,
      isEstimatedSplit: split.isEstimatedSplit,
      date: params.date,
      forMonth,
      mode: params.mode,
      reference: params.reference,
      notes: params.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.transactions.update((prev) => [tx, ...prev]);
    await this.logAuditAndSave('create', 'transaction', tx.id, undefined, tx);
  }

  async updateTransaction(txId: string, updates: Partial<Transaction>): Promise<void> {
    const existing = this.transactions().find((t) => t.id === txId);
    if (!existing) return;

    const updatedTx = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    } as Transaction;

    // If bank payment amount or interest updated, recompute split
    if (updatedTx.type === 'bankPayment') {
      const split = bankPaymentSplit(
        updatedTx.amount,
        updatedTx.interestPortion,
        updatedTx.isEstimatedSplit ? undefined : updatedTx.interestPortion
      );
      updatedTx.interestPortion = split.interestPortion;
      updatedTx.principalPortion = split.principalPortion;
    }

    this.transactions.update((prev) => prev.map((t) => (t.id === txId ? updatedTx : t)));
    await this.logAuditAndSave('update', 'transaction', txId, existing, updatedTx);
  }

  async deleteTransaction(txId: string): Promise<void> {
    const existing = this.transactions().find((t) => t.id === txId);
    if (!existing) return;

    const deletedTx: Transaction = {
      ...existing,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.transactions.update((prev) => prev.map((t) => (t.id === txId ? deletedTx : t)));
    await this.logAuditAndSave('delete', 'transaction', txId, existing, deletedTx);
  }

  async updateRate(newRateBps: number, effectiveFrom: string, reason?: string): Promise<void> {
    const previousRateBps = this.loan().currentRateBps;
    const rateChange: RateChange = {
      id: crypto.randomUUID(),
      effectiveFrom,
      rateBps: newRateBps,
      previousRateBps,
      reason,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.rateChanges.update((prev) => [rateChange, ...prev]);
    this.loan.update((prev) => ({
      ...prev,
      currentRateBps: newRateBps,
      updatedAt: new Date().toISOString(),
    }));

    await this.logAuditAndSave('rateChange', 'rateChange', rateChange.id, { previousRateBps }, { newRateBps });
  }

  async reconcileBalance(actualOutstanding: Paise, date: string, notes?: string): Promise<ReconciliationResult> {
    const result = reconcile(actualOutstanding, date, this.ledgerState());

    const snapshot: BalanceSnapshot = {
      id: crypto.randomUUID(),
      date,
      bankActualOutstanding: actualOutstanding,
      ledgerCalculatedOutstanding: result.ledgerCalculatedOutstanding,
      variance: result.variance,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.snapshots.update((prev) => [snapshot, ...prev]);
    await this.logAuditAndSave('reconcile', 'snapshot', snapshot.id, undefined, snapshot);
    return result;
  }

  async updateLoanDetails(updates: Partial<Loan>): Promise<void> {
    const prev = this.loan();
    const updated: Loan = {
      ...prev,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.loan.set(updated);
    await this.logAuditAndSave('update', 'loan', updated.id, prev, updated);
  }

  async updateMember(memberId: string, updates: Partial<Member>): Promise<void> {
    const existing = this.members().find((m) => m.id === memberId);
    if (!existing) return;

    const updated: Member = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.members.update((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
    await this.logAuditAndSave('update', 'member', memberId, existing, updated);
  }

  async addMember(name: string, target?: Paise): Promise<Member> {
    const newMember: Member = {
      id: crypto.randomUUID(),
      name,
      active: true,
      target,
      colorIndex: this.members().length % 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.members.update((prev) => [...prev, newMember]);
    await this.logAuditAndSave('create', 'member', newMember.id, undefined, newMember);
    return newMember;
  }

  async updateBankRules(rules: Partial<BankRuleSettings>): Promise<void> {
    const currentLoan = this.loan();
    const updatedRules: BankRuleSettings = {
      ...(currentLoan.bankRules || {
        dayCountBasis: 'actual/365',
        debitFrequency: 'monthlyLastDay',
        customDebitDay: 31,
        isCapitalised: true,
      }),
      ...rules,
    };
    await this.updateLoanDetails({ bankRules: updatedRules });
  }

  async setCalculationMethod(method: CalculationMethod): Promise<void> {
    await this.updateLoanDetails({ calculationMethod: method });
  }

  getDailyBreakdown(period: string): DailyLedgerRecord[] {
    return getDailyLedger(period, this.ledgerState());
  }

  isPeriodLocked(dateOrMonth: string): boolean {
    const lockedUntil = this.loan().lockedUntilPeriod;
    if (!lockedUntil) return false;
    const period = dateOrMonth.slice(0, 7);
    return period <= lockedUntil;
  }

  async closeMonthPeriod(period: string): Promise<{ entry: InterestEntry; isNew: boolean }> {
    const engine = getEngineForMethod(this.loan().calculationMethod);
    const result = closeMonth(period, engine, this.ledgerState());

    if (result.isNew) {
      const filtered = this.interestEntries().filter(
        (e) => !(e.period === period && e.method === engine.method && e.status === 'active')
      );
      this.interestEntries.set([...result.supersededEntries.filter(e => e.period === period && e.method === engine.method), result.entry, ...filtered]);
    }

    const currentLocked = this.loan().lockedUntilPeriod || '';
    if (period > currentLocked) {
      await this.updateLoanDetails({ lockedUntilPeriod: period });
    }

    await this.logAuditAndSave('create', 'loan', `closeMonth-${period}`, undefined, result.entry);
    return { entry: result.entry, isNew: result.isNew };
  }

  async unlockPeriod(period: string, reason: string): Promise<void> {
    const prev = this.loan();
    const [year, month] = period.split('-').map(Number);
    const prevDate = new Date(year, (month || 1) - 2, 1);
    const prevPeriod = prevDate.toISOString().slice(0, 7);

    const updated: Loan = {
      ...prev,
      lockedUntilPeriod: prevPeriod,
      updatedAt: new Date().toISOString(),
    };
    this.loan.set(updated);
    await this.logAuditAndSave(
      'update',
      'loan',
      `unlock-${period}`,
      { lockedUntilPeriod: prev.lockedUntilPeriod, reason },
      { lockedUntilPeriod: prevPeriod }
    );
  }

  async loadSampleData(): Promise<void> {
    const seed = getInitialSeedData();
    this.syncState(seed);
    await this.repo.save(seed);
    await this.logAuditAndSave('restore', 'backup', 'sample-seed', undefined, { action: 'loadSampleData' });
  }

  async clearAllData(): Promise<void> {
    const loan = this.loan();
    const cleared: LedgerState = {
      loan: {
        ...loan,
        openingOutstanding: loan.openingOutstanding,
        updatedAt: new Date().toISOString(),
      },
      members: this.members(),
      transactions: [],
      rateChanges: [],
      snapshots: [],
      interestEntries: [],
      settings: this.ledgerState().settings,
      auditLog: [],
    };

    this.syncState(cleared);
    await this.repo.save(cleared);
    await this.logAuditAndSave('reset', 'backup', 'clear-all', undefined, { action: 'clearAllData' });
  }

  async exportBackup(): Promise<string> {
    return this.repo.exportBackup();
  }

  async restoreBackup(jsonString: string): Promise<void> {
    const restored = await this.repo.importBackup(jsonString);
    this.syncState(restored);
    this.settingsStore.initFromState(restored.settings);
    await this.logAuditAndSave('restore', 'backup', 'user-restore', undefined, { action: 'restoreBackup' });
  }

  async exportCsv(): Promise<string> {
    return this.repo.exportCsv();
  }

  private syncState(state: LedgerState): void {
    this.loan.set(state.loan);
    this.members.set(state.members || []);
    this.transactions.set(state.transactions || []);
    this.rateChanges.set(state.rateChanges || []);
    this.snapshots.set(state.snapshots || []);
    this.interestEntries.set(state.interestEntries || []);
    this.auditLog.set(state.auditLog || []);
  }

  private async logAuditAndSave(
    action: AuditEntry['action'],
    entityType: AuditEntry['entityType'],
    entityId: string,
    payloadBefore?: unknown,
    payloadAfter?: unknown
  ): Promise<void> {
    const audit: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action,
      entityType,
      entityId,
      payloadBefore,
      payloadAfter,
    };

    this.auditLog.update((prev) => [audit, ...prev]);
    await this.repo.save(this.ledgerState());
  }
}

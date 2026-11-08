import { computed, inject, Injectable, signal } from '@angular/core';
import {
  addPaise,
  AuditEntry,
  BalanceSnapshot,
  BankPaymentTransaction,
  BankRuleSettings,
  bankPaymentSplit,
  CalculationMethod,
  closeMonth,
  ContributionTransaction,
  DailyLedgerRecord,
  FinancialYearSummary,
  generateStatementSnapshot,
  getSbiDailyLedger,
  SbiDailyMonthSummary,
  getEngineForMethod,
  getIndianFinancialYearSummary,
  GroupFundsSummary,
  InterestEntry,
  LedgerState,
  Loan,
  Member,
  MemberStatistics,
  memberStatistics,
  monthlySummary,
  MonthlySummary,
  DualTrackPoint,
  getOdWithdrawalsSummary,
  getSbiAuditSummary,
  getSbiPaymentsSummary,
  OdWithdrawalRecord,
  OdWithdrawalsSummary,
  outstandingAt,
  Paise,
  paise,
  ParsedStatementRow,
  PaymentMode,
  RateChange,
  reconcile,
  ReconciliationResult,
  RepaymentPaceAnalysis,
  getRepaymentPaceAnalysis,
  SavedScenario,
  SbiMonthlyAuditRecord,
  SbiAuditSummary,
  SbiMonthlyPaymentRecord,
  SbiPaymentsSummary,
  StatementSnapshot,
  toPaise,
  Transaction,
  UpcomingPaymentInfo,
  WithdrawalTransaction,
} from '../engine';
import { FirestoreLedgerRepository, SbiPassbookRow } from '../data';
import { SettingsStore } from './settings.store';

@Injectable({
  providedIn: 'root',
})
export class LedgerStore {
  private readonly repo = inject(FirestoreLedgerRepository);
  private readonly settingsStore = inject(SettingsStore);

  // Core State Signals
  readonly loan = signal<Loan>({
    id: 'loan-primary',
    type: 'Overdraft (OD)',
    accountNumber: '43054757071',
    initialDisbursed: toPaise(13300000),
    sanctionedLimit: toPaise(12612930),
    regularEmi: toPaise(118900),
    openingOutstanding: toPaise(11886289),
    openingDate: '2024-06-12',
    maturityDate: '2044-06-12',
    currentRateBps: 790,
    monthlyTarget: toPaise(240000),
    calculationMethod: 'daily',
    bankRules: {
      dayCountBasis: 'actual/365',
      debitFrequency: 'monthlyLastDay',
      isCapitalised: true,
      customDebitDay: 30,
    },
    createdAt: '2024-06-12T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  });
  readonly members = signal<Member[]>([]);
  readonly transactions = signal<Transaction[]>([]);
  readonly rateChanges = signal<RateChange[]>([]);
  readonly snapshots = signal<BalanceSnapshot[]>([]);
  readonly interestEntries = signal<InterestEntry[]>([]);
  readonly statements = signal<StatementSnapshot[]>([]);
  readonly auditLog = signal<AuditEntry[]>([]);

  readonly statementRecords = signal<SbiPassbookRow[]>([]);
  readonly odWithdrawals = signal<OdWithdrawalRecord[]>([]);
  readonly interestAudit = signal<SbiMonthlyAuditRecord[]>([]);
  readonly paymentsAudit = signal<SbiMonthlyPaymentRecord[]>([]);
  readonly balanceTrajectory = signal<DualTrackPoint[]>([]);

  readonly odWithdrawalsSummary = computed<OdWithdrawalsSummary>(() =>
    getOdWithdrawalsSummary(this.odWithdrawals())
  );
  readonly sbiAuditSummary = computed<SbiAuditSummary>(() =>
    getSbiAuditSummary(this.interestAudit())
  );
  readonly sbiPaymentsSummary = computed<SbiPaymentsSummary>(() =>
    getSbiPaymentsSummary(this.paymentsAudit())
  );

  readonly isLoading = signal<boolean>(true);
  readonly storageWarning = computed<string | null>(() => {
    if (this.repo.isStorageDegraded()) {
      const err = this.repo.getLastError?.();
      if (
        err &&
        (err.includes('PERMISSION_DENIED') ||
          err.includes('permission-denied') ||
          err.includes('has not been used'))
      ) {
        return 'Cloud Firestore is not enabled yet in your Firebase Project. In Firebase Console, go to Build -> Firestore Database and click "Create database".';
      }
      return (
        err ||
        'Cloud Firestore is currently unreachable. Operating in local memory fallback; data will synchronize once Firestore connects.'
      );
    }
    return null;
  });

  // Simulated Date Control for testing and month-end preview
  readonly simulatedDate = signal<string | null>(null);

  setSimulatedDate(date: string | null): void {
    this.simulatedDate.set(date);
  }

  readonly currentDate = computed<string>(() => {
    return this.simulatedDate() || new Date().toISOString().slice(0, 10);
  });

  /**
   * Effective statement records with automatic month-end closing interest debit.
   * When datetime reaches the end of the month (e.g. Nov 30th) or during next month's payment window,
   * if no bank interest debit has been posted yet, calculates the month's interest and injects
   * an authentic closing debit row into the passbook statement.
   */
  readonly effectiveStatementRecords = computed<SbiPassbookRow[]>(() => {
    const records = this.statementRecords();
    if (records.length === 0) return records;

    const today = this.currentDate();
    const [yStr, mStr, dStr] = today.split('-');
    const y = parseInt(yStr || '2026', 10);
    const m = parseInt(mStr || '11', 10);
    const d = parseInt(dStr || '01', 10);
    const lastDay = new Date(y, m, 0).getDate();

    let targetPeriod: string;
    let targetLastDayDate: string;
    let targetPostDate: string;

    if (d >= lastDay) {
      // Month-end reached for current month (e.g. 2026-11-30)
      targetPeriod = `${yStr}-${mStr}`;
      targetLastDayDate = `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`;
      targetPostDate = `${String(lastDay).padStart(2, '0')}/${mStr}/${yStr}`;
    } else if (d <= 5) {
      // In early payment window of next month (e.g. 2026-12-01 to 2026-12-05), check previous month's interest
      const prevDate = new Date(y, m - 2, 28);
      const prevY = prevDate.getFullYear();
      const prevM = prevDate.getMonth() + 1;
      const prevLastDay = new Date(prevY, prevM, 0).getDate();
      targetPeriod = `${prevY}-${String(prevM).padStart(2, '0')}`;
      targetLastDayDate = `${targetPeriod}-${String(prevLastDay).padStart(2, '0')}`;
      targetPostDate = `${String(prevLastDay).padStart(2, '0')}/${String(prevM).padStart(2, '0')}/${prevY}`;
    } else {
      return records;
    }

    // Check if an interest_debit already exists for targetPeriod in records
    const hasInterestDebit = records.some(
      (r) => r.category === 'interest_debit' && r.isoDate.slice(0, 7) === targetPeriod
    );

    if (hasInterestDebit) {
      return records;
    }

    // Compute month interest using getSbiDailyLedger for targetPeriod
    const dailyLedger = getSbiDailyLedger(targetPeriod, this.transactions(), records);
    const monthInterest = dailyLedger.totalInterestAccrued;
    if (monthInterest <= 0) {
      return records;
    }

    // Pre-interest closing balance
    const preBalance = dailyLedger.closingBalance;
    const newBalance = addPaise(preBalance, monthInterest);

    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const targetMonthIdx = parseInt(targetPeriod.slice(5, 7), 10) - 1;
    const monthCode = monthNames[targetMonthIdx] || 'MON';
    const yearCode = targetPeriod.slice(0, 4);

    const syntheticRow: SbiPassbookRow = {
      id: `synthetic-interest-${targetPeriod}`,
      postDate: targetPostDate,
      valueDate: targetPostDate,
      isoDate: targetLastDayDate,
      desc: `TO INTEREST FOR ${monthCode} ${yearCode} (CLOSING DEBIT)`,
      refNo: '',
      type: 'debit',
      category: 'interest_debit',
      debitPaise: monthInterest,
      creditPaise: paise(0),
      balancePaise: newBalance,
      rawDebit: (monthInterest / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      rawCredit: '',
      rawBalance: (newBalance / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
    };

    return [syntheticRow, ...records].sort((a, b) => b.isoDate.localeCompare(a.isoDate));
  });

  // Full derived LedgerState object for pure engine functions
  readonly ledgerState = computed<LedgerState>(() => ({
    loan: this.loan(),
    members: this.members(),
    transactions: this.transactions(),
    rateChanges: this.rateChanges(),
    snapshots: this.snapshots(),
    interestEntries: this.interestEntries(),
    statements: this.statements(),
    settings: {
      theme: this.settingsStore.theme(),
      dateFormat: this.settingsStore.dateFormat(),
      maskAccountNumber: this.settingsStore.maskAccountNumber(),
      defaultPaymentMode: 'UPI',
    },
    auditLog: this.auditLog(),
    statementRecords: this.effectiveStatementRecords(),
    odWithdrawals: this.odWithdrawals(),
    interestAudit: this.interestAudit(),
    paymentsAudit: this.paymentsAudit(),
    balanceTrajectory: this.balanceTrajectory(),
  }));

  // Computed Projections
  readonly currentPrincipal = computed<Paise>(() => {
    const today = this.currentDate();
    return outstandingAt(today, this.ledgerState(), this.effectiveStatementRecords());
  });

  readonly currentOutstanding = computed<Paise>(() => {
    const today = this.currentDate();
    const effectiveRows = this.effectiveStatementRecords();
    const baseOutstanding = outstandingAt(today, this.ledgerState(), effectiveRows);

    // If effectiveRows already contains the month-end closing debit, baseOutstanding includes it!
    const curMonth = today.slice(0, 7);
    const hasInterestDebit = effectiveRows.some(
      (r) => r.category === 'interest_debit' && r.isoDate.slice(0, 7) === curMonth
    );

    if (hasInterestDebit) {
      return baseOutstanding;
    }

    // Safety fallback: if day is last day of month and not in records, add estimated interest
    const year = parseInt(today.slice(0, 4), 10);
    const month = parseInt(today.slice(5, 7), 10);
    const day = parseInt(today.slice(8, 10), 10);
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const isLastDay = day >= lastDayOfMonth;

    if (isLastDay) {
      const estInterest = this.thisMonthSummary().interestIncurredEst;
      return addPaise(baseOutstanding, estInterest);
    }

    return baseOutstanding;
  });

  /**
   * Upcoming Payment due on the 1st of next month, incorporating calculated month-end interest.
   */
  readonly upcomingPayment = computed<UpcomingPaymentInfo>(() => {
    const today = this.currentDate();
    const isSimulated = this.simulatedDate() !== null;
    const [yStr, mStr, dStr] = today.split('-');
    const y = parseInt(yStr || '2026', 10);
    const m = parseInt(mStr || '11', 10);
    const d = parseInt(dStr || '01', 10);
    const lastDay = new Date(y, m, 0).getDate();

    let isMonthEnd: boolean;
    let closedPeriod: string;
    let nextPeriod: string;
    let nextDueDate: string;
    let nextDueLabel: string;
    let daysUntilDue: number;

    const monthFullNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    if (d >= lastDay) {
      // Exact month end (e.g. 2026-11-30)
      isMonthEnd = true;
      closedPeriod = `${yStr}-${mStr}`;
      const nextDate = new Date(y, m, 1);
      const nextY = nextDate.getFullYear();
      const nextM = nextDate.getMonth() + 1;
      nextPeriod = `${nextY}-${String(nextM).padStart(2, '0')}`;
      nextDueDate = `${nextPeriod}-01`;
      nextDueLabel = `${monthFullNames[nextM - 1]} 1, ${nextY}`;
      daysUntilDue = 1;
    } else if (d <= 5) {
      // In payment window (e.g. 2026-12-01 to 2026-12-05)
      isMonthEnd = true;
      const prevDate = new Date(y, m - 2, 1);
      const prevY = prevDate.getFullYear();
      const prevM = prevDate.getMonth() + 1;
      closedPeriod = `${prevY}-${String(prevM).padStart(2, '0')}`;
      nextPeriod = `${yStr}-${mStr}`;
      nextDueDate = `${nextPeriod}-01`;
      nextDueLabel = `${monthFullNames[m - 1]} 1, ${y}`;
      daysUntilDue = Math.max(0, 1 - d);
    } else {
      // Mid-month: project closing of current month for preview
      isMonthEnd = false;
      closedPeriod = `${yStr}-${mStr}`;
      const nextDate = new Date(y, m, 1);
      const nextY = nextDate.getFullYear();
      const nextM = nextDate.getMonth() + 1;
      nextPeriod = `${nextY}-${String(nextM).padStart(2, '0')}`;
      nextDueDate = `${nextPeriod}-01`;
      nextDueLabel = `${monthFullNames[nextM - 1]} 1, ${nextY}`;
      daysUntilDue = lastDay - d + 1;
    }

    const closedMonthIdx = parseInt(closedPeriod.slice(5, 7), 10) - 1;
    const closedMonthName = `${monthFullNames[closedMonthIdx]} ${closedPeriod.slice(0, 4)}`;

    // Compute interest for the closedPeriod
    const dailyLedger = getSbiDailyLedger(closedPeriod, this.transactions(), this.statementRecords());
    const calculatedInterest = dailyLedger.totalInterestAccrued;
    const preInterestOutstanding = dailyLedger.closingBalance;
    const totalOutstandingAfterInterest = addPaise(preInterestOutstanding, calculatedInterest);

    const bankRegularEmi = this.loan().regularEmi || paise(11890000);
    const familyTarget = this.loan().monthlyTarget || paise(24000000);

    const bankEmiPrincipalReduction = paise(Math.max(0, bankRegularEmi - calculatedInterest));
    const targetPrincipalReduction = paise(Math.max(0, familyTarget - calculatedInterest));

    const balanceAfterBankEmi = paise(Math.max(0, totalOutstandingAfterInterest - bankRegularEmi));
    const balanceAfterTarget = paise(Math.max(0, totalOutstandingAfterInterest - familyTarget));

    return {
      isMonthEnd,
      isSimulated,
      currentDate: today,
      closedPeriod,
      closedMonthName,
      nextPeriod,
      nextDueDate,
      nextDueLabel,
      daysUntilDue,
      calculatedInterest,
      preInterestOutstanding,
      totalOutstandingAfterInterest,
      bankRegularEmi,
      familyTarget,
      bankEmiPrincipalReduction,
      targetPrincipalReduction,
      balanceAfterBankEmi,
      balanceAfterTarget,
    };
  });

  readonly thisMonthSummary = computed<MonthlySummary>(() => {
    const currentMonth = this.currentDate().slice(0, 7);
    return monthlySummary(currentMonth, this.ledgerState(), undefined, {
      paymentsAudit: this.paymentsAudit(),
      interestAudit: this.interestAudit(),
      statementRows: this.effectiveStatementRecords(),
    });
  });

  readonly repaymentPace = computed<RepaymentPaceAnalysis>(() => {
    return getRepaymentPaceAnalysis(this.ledgerState(), {
      odWithdrawals: this.odWithdrawals(),
      interestAudit: this.interestAudit(),
      paymentsAudit: this.paymentsAudit(),
    });
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
    const currentMonth = this.currentDate().slice(0, 7);
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
    this.repo.subscribeToRemoteChanges((remoteState) => {
      this.syncState(remoteState);
    });
  }

  async initialize(): Promise<void> {
    this.isLoading.set(true);
    try {
      const state = await this.repo.load();
      this.syncState(state);
      this.statementRecords.set(this.repo.getStatementRecords());
      this.odWithdrawals.set(this.repo.getOdWithdrawals());
      this.interestAudit.set(this.repo.getInterestAudit());
      this.paymentsAudit.set(this.repo.getPaymentsAudit());
      this.balanceTrajectory.set(this.repo.getBalanceTrajectory());
      this.settingsStore.initFromState(state.settings);
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
    memberId?: string;
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

    const isOverdraft = this.loan().type === 'Overdraft (OD)';
    const split =
      isOverdraft && params.interestPortion === undefined
        ? {
            principalPortion: params.amount,
            interestPortion: paise(0),
            isEstimatedSplit: false,
          }
        : bankPaymentSplit(
            params.amount,
            estInterest || currentOut,
            params.interestPortion
          );

    const tx: BankPaymentTransaction = {
      id: crypto.randomUUID(),
      type: 'bankPayment',
      memberId: params.memberId,
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

  async setCurrentOutstanding(targetOutstanding: Paise): Promise<void> {
    const curOut = this.currentOutstanding();
    const curOpening = this.loan().openingOutstanding;
    const delta = curOut - curOpening;
    let newOpening = paise(Math.max(0, targetOutstanding - delta));

    await this.updateLoanDetails({ openingOutstanding: newOpening });
    const resultingOut = this.currentOutstanding();
    if (resultingOut !== targetOutstanding) {
      const diff = resultingOut - targetOutstanding;
      newOpening = paise(Math.max(0, newOpening - diff));
      await this.updateLoanDetails({ openingOutstanding: newOpening });
    }
  }

  async updateLoanDetails(updates: Partial<Loan>): Promise<void> {
    const prev = this.loan();
    const updated: Loan = {
      ...prev,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.loan.set(updated);

    if (updates.openingOutstanding !== undefined) {
      this.snapshots.update((snaps) =>
        snaps.map((s) =>
          s.notes?.toLowerCase().includes('baseline')
            ? {
                ...s,
                bankActualOutstanding: updates.openingOutstanding!,
                ledgerCalculatedOutstanding: updates.openingOutstanding!,
                variance: paise(0),
                updatedAt: new Date().toISOString(),
              }
            : s
        )
      );
    }

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

  async deleteMember(memberId: string): Promise<void> {
    const existing = this.members().find((m) => m.id === memberId);
    if (!existing) return;
    const updated: Member = {
      ...existing,
      active: false,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.members.update((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
    await this.logAuditAndSave('delete', 'member', memberId, existing, updated);
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
    return getSbiDailyLedger(period, this.transactions(), this.statementRecords()).records;
  }

  getSbiDailyMonthSummary(period: string): SbiDailyMonthSummary {
    return getSbiDailyLedger(period, this.transactions(), this.statementRecords());
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

  async deleteScenario(scenarioId: string): Promise<void> {
    const currentScenarios = this.loan().savedScenarios || [];
    await this.updateLoanDetails({
      savedScenarios: currentScenarios.filter((s) => s.id !== scenarioId),
    });
  }

  async saveScenario(scenario: Omit<SavedScenario, 'id' | 'createdAt'>): Promise<SavedScenario> {
    const newScenario: SavedScenario = {
      ...scenario,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const currentScenarios = this.loan().savedScenarios || [];
    await this.updateLoanDetails({
      savedScenarios: [...currentScenarios, newScenario],
    });
    return newScenario;
  }

  async loadSampleData(): Promise<void> {
    const loaded = await this.repo.load();
    this.syncState(loaded);
    await this.logAuditAndSave('restore', 'backup', 'cloud-sync', undefined, { action: 'loadSampleData' });
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

  getStatement(period: string): StatementSnapshot {
    return generateStatementSnapshot(period, this.ledgerState());
  }

  async archiveStatement(period: string): Promise<StatementSnapshot> {
    const snapshot = generateStatementSnapshot(period, this.ledgerState());
    this.statements.update((prev) => {
      const filtered = prev.filter((s) => s.period !== period);
      return [snapshot, ...filtered];
    });
    await this.repo.save(this.ledgerState());
    await this.logAuditAndSave('create', 'loan', `statement-${period}`, undefined, snapshot);
    return snapshot;
  }

  getFinancialYearSummary(startYear: number): FinancialYearSummary {
    return getIndianFinancialYearSummary(startYear, this.ledgerState());
  }

  async commitImportBatch(batchId: string, rows: ParsedStatementRow[]): Promise<number> {
    const toImport = rows.filter((r) => r.action !== 'skip');
    if (toImport.length === 0) return 0;

    const newTransactions: Transaction[] = [];
    const now = new Date().toISOString();

    for (const row of toImport) {
      if (row.action === 'bankPayment') {
        const amount = row.creditPaise > 0 ? row.creditPaise : row.debitPaise;
        const forMonth = row.date.slice(0, 7);
        const monthSum = monthlySummary(forMonth, this.ledgerState());
        const split = bankPaymentSplit(amount, monthSum.interestIncurredEst);
        const tx: BankPaymentTransaction = {
          id: crypto.randomUUID(),
          type: 'bankPayment',
          amount,
          date: row.date,
          valueDate: row.date,
          forMonth,
          interestPortion: split.interestPortion,
          principalPortion: split.principalPortion,
          isEstimatedSplit: split.isEstimatedSplit,
          mode: 'Bank transfer',
          reference: row.reference || row.description,
          notes: `Imported from bank statement (${batchId})`,
          createdAt: now,
          updatedAt: now,
          importBatchId: batchId,
        };
        newTransactions.push(tx);
      } else if (row.action === 'contribution') {
        const amount = row.creditPaise > 0 ? row.creditPaise : row.debitPaise;
        const memberId = row.selectedMemberId || this.activeMembers()[0]?.id || '';
        const tx: ContributionTransaction = {
          id: crypto.randomUUID(),
          type: 'contribution',
          memberId,
          amount,
          date: row.date,
          valueDate: row.date,
          forMonth: row.date.slice(0, 7),
          mode: 'Bank transfer',
          reference: row.reference || row.description,
          notes: `Imported from bank statement (${batchId})`,
          createdAt: now,
          updatedAt: now,
          importBatchId: batchId,
        };
        newTransactions.push(tx);
      } else if (row.action === 'withdrawal') {
        const amount = row.debitPaise > 0 ? row.debitPaise : row.creditPaise;
        const tx: WithdrawalTransaction = {
          id: crypto.randomUUID(),
          type: 'withdrawal',
          amount,
          date: row.date,
          valueDate: row.date,
          forMonth: row.date.slice(0, 7),
          mode: 'Bank transfer',
          reference: row.reference || row.description,
          notes: `Imported from bank statement (${batchId})`,
          createdAt: now,
          updatedAt: now,
          importBatchId: batchId,
        };
        newTransactions.push(tx);
      }
    }

    this.transactions.update((prev) => [...newTransactions, ...prev]);
    await this.repo.save(this.ledgerState());
    await this.logAuditAndSave('create', 'transaction', `batch-${batchId}`, undefined, {
      importedCount: newTransactions.length,
      batchId,
    });

    return newTransactions.length;
  }

  async rollbackImportBatch(batchId: string): Promise<number> {
    const now = new Date().toISOString();
    let count = 0;

    this.transactions.update((prev) =>
      prev.map((tx) => {
        if (tx.importBatchId === batchId && !tx.deletedAt) {
          count++;
          return { ...tx, deletedAt: now, updatedAt: now };
        }
        return tx;
      })
    );

    if (count > 0) {
      await this.repo.save(this.ledgerState());
      await this.logAuditAndSave(
        'delete',
        'transaction',
        `rollback-${batchId}`,
        { batchId, rolledBackCount: count },
        undefined
      );
    }

    return count;
  }

  private syncState(state: LedgerState): void {
    this.loan.set(state.loan);
    this.members.set(state.members || []);
    this.transactions.set(state.transactions || []);
    this.rateChanges.set(state.rateChanges || []);
    this.snapshots.set(state.snapshots || []);
    this.interestEntries.set(state.interestEntries || []);
    this.statements.set(state.statements || []);
    this.auditLog.set(state.auditLog || []);
    if (state.statementRecords) this.statementRecords.set(state.statementRecords);
    if (state.odWithdrawals) this.odWithdrawals.set(state.odWithdrawals);
    if (state.interestAudit) this.interestAudit.set(state.interestAudit);
    if (state.paymentsAudit) this.paymentsAudit.set(state.paymentsAudit);
    if (state.balanceTrajectory) this.balanceTrajectory.set(state.balanceTrajectory);
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

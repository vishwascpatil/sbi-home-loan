import { InterestEngine } from './interest-engine.interface';
import { MonthlyReducingBalanceEngine } from './monthly-reducing-balance-engine';
import { DailyReducingBalanceEngine } from './daily-reducing-balance-engine';
import {
  CalculationMethod,
  ContributionTransaction,
  DailyLedgerRecord,
  InterestEntry,
  LedgerState,
  Loan,
  RateChange,
} from './models';
import { addPaise, Paise, paise, subPaise, ZERO_PAISE } from './money';

export interface BankPaymentSplit {
  interestPortion: Paise;
  principalPortion: Paise;
  isEstimatedSplit: boolean;
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  openingOutstanding: Paise;
  closingOutstanding: Paise;
  memberContributions: Paise;
  paidToBank: Paise;
  interestIncurredEst: Paise;
  principalReduced: Paise;
  remainingTarget: Paise;
  monthlyTarget: Paise;
  targetProgressPercent: number;
}

export interface GroupFundsSummary {
  totalContributions: Paise;
  totalBankPayments: Paise;
  unusedFunds: Paise;
}

export interface MemberStatistics {
  memberId: string;
  name: string;
  lifetimeContribution: Paise;
  thisMonthContribution: Paise;
  sharePercentage: number;
  contributionCount: number;
  lastContributionDate?: string;
}

export interface ReconciliationResult {
  date: string;
  bankActualOutstanding: Paise;
  ledgerCalculatedOutstanding: Paise;
  variance: Paise; // actual - calculated
}

const defaultMonthlyEngine = new MonthlyReducingBalanceEngine();
const defaultDailyEngine = new DailyReducingBalanceEngine();

export function getEngineForMethod(method: CalculationMethod): InterestEngine {
  return method === 'daily' ? defaultDailyEngine : defaultMonthlyEngine;
}

/**
 * Filter out soft-deleted records.
 */
export function activeOnly<T extends { deletedAt?: string }>(items: T[]): T[] {
  return items.filter((x) => !x.deletedAt);
}

/**
 * Determine the interest rate in force for a given date or month.
 */
export function getEffectiveRateBps(
  dateOrMonth: string,
  loan: Loan,
  rateChanges: RateChange[]
): number {
  const targetDate = dateOrMonth.length === 7 ? `${dateOrMonth}-28` : dateOrMonth;
  const activeRates = activeOnly(rateChanges)
    .filter((rc) => rc.effectiveFrom <= targetDate)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

  return activeRates.length > 0 && activeRates[0]
    ? activeRates[0].rateBps
    : loan.currentRateBps;
}

/**
 * Splits a bank payment into interest and principal portions.
 * If actual bank interest is known, uses it; otherwise uses estimated interest.
 */
export function bankPaymentSplit(
  paymentAmount: Paise,
  calculatedInterest: Paise,
  actualInterest?: Paise
): BankPaymentSplit {
  if (paymentAmount <= 0) {
    return {
      interestPortion: ZERO_PAISE,
      principalPortion: ZERO_PAISE,
      isEstimatedSplit: true,
    };
  }

  const isEstimated = actualInterest === undefined || actualInterest === null;
  const interestToCharge = isEstimated ? calculatedInterest : actualInterest;

  // Interest cannot exceed payment amount
  const interestPortion = paise(Math.min(paymentAmount, Math.max(0, interestToCharge)));
  const principalPortion = subPaise(paymentAmount, interestPortion);

  return {
    interestPortion,
    principalPortion,
    isEstimatedSplit: isEstimated,
  };
}

/**
 * Calculate the outstanding loan principal at a specific date or month.
 * Derived deterministically from opening balance and historical ledger transactions.
 * Contributions NEVER decrease outstanding; only bank payment principal portions do.
 */
export function outstandingAt(dateOrMonth: string, ledger: LedgerState): Paise {
  const targetDate = dateOrMonth.length === 7 ? `${dateOrMonth}-31` : dateOrMonth;
  let currentBalance = ledger.loan.openingOutstanding;

  // Sort active transactions chronologically
  const activeTx = activeOnly(ledger.transactions)
    .filter((tx) => tx.date <= targetDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  for (const tx of activeTx) {
    switch (tx.type) {
      case 'bankPayment':
        currentBalance = subPaise(currentBalance, tx.principalPortion);
        break;
      case 'principalAdjustment':
        // Positive reduces principal, negative increases
        currentBalance = subPaise(currentBalance, tx.amount);
        break;
      case 'manualCorrection':
        currentBalance = tx.newOutstanding;
        break;
      case 'interestCharge':
        currentBalance = addPaise(currentBalance, tx.amount);
        break;
      case 'contribution':
      case 'withdrawal':
        // Contributions and withdrawals strictly affect group cash, NOT the loan principal!
        break;
    }
  }

  return paise(Math.max(0, currentBalance));
}

/**
 * Produce the financial summary for a specific calendar month (YYYY-MM).
 */
export function monthlySummary(
  month: string,
  ledger: LedgerState,
  engine?: InterestEngine
): MonthlySummary {
  const activeEngine = engine || getEngineForMethod(ledger.loan.calculationMethod);
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr || '2025', 10);
  const monthNum = parseInt(monthStr || '1', 10);
  const prevMonthDate = new Date(year, monthNum - 2, 28).toISOString().slice(0, 10);

  const openingOutstanding = outstandingAt(prevMonthDate, ledger);
  const rateBps = getEffectiveRateBps(month, ledger.loan, ledger.rateChanges);

  let interestIncurredEst: Paise;
  if (activeEngine instanceof DailyReducingBalanceEngine) {
    const dailyRes = activeEngine.calculateDailyInterest({
      period: month,
      openingPrincipal: openingOutstanding,
      annualRateBps: rateBps,
      transactions: ledger.transactions,
      rateChanges: ledger.rateChanges,
      bankRules: ledger.loan.bankRules,
    });
    interestIncurredEst = dailyRes.totalInterest;
  } else {
    interestIncurredEst = activeEngine.calculateInterest(openingOutstanding, rateBps, month);
  }

  const activeTx = activeOnly(ledger.transactions).filter((tx) => tx.forMonth === month);

  let memberContributions = ZERO_PAISE;
  let paidToBank = ZERO_PAISE;
  let principalReduced = ZERO_PAISE;

  for (const tx of activeTx) {
    if (tx.type === 'contribution') {
      memberContributions = addPaise(memberContributions, tx.amount);
    } else if (tx.type === 'bankPayment') {
      paidToBank = addPaise(paidToBank, tx.amount);
      principalReduced = addPaise(principalReduced, tx.principalPortion);
    }
  }

  const closingOutstanding = subPaise(openingOutstanding, principalReduced);
  const monthlyTarget = ledger.loan.monthlyTarget;
  const remainingTarget = paise(Math.max(0, monthlyTarget - memberContributions));
  const targetProgressPercent =
    monthlyTarget > 0 ? Math.min(100, (memberContributions / monthlyTarget) * 100) : 0;

  return {
    month,
    openingOutstanding,
    closingOutstanding,
    memberContributions,
    paidToBank,
    interestIncurredEst,
    principalReduced,
    remainingTarget,
    monthlyTarget,
    targetProgressPercent,
  };
}

/**
 * Calculate the overall group cash pool.
 * Unused funds = Total member contributions - Total bank payments.
 */
export function groupFunds(ledger: LedgerState): GroupFundsSummary {
  const activeTx = activeOnly(ledger.transactions);

  let totalContributions = ZERO_PAISE;
  let totalBankPayments = ZERO_PAISE;

  for (const tx of activeTx) {
    if (tx.type === 'contribution') {
      totalContributions = addPaise(totalContributions, tx.amount);
    } else if (tx.type === 'bankPayment') {
      totalBankPayments = addPaise(totalBankPayments, tx.amount);
    }
  }

  const unusedFunds = subPaise(totalContributions, totalBankPayments);

  return {
    totalContributions,
    totalBankPayments,
    unusedFunds,
  };
}

/**
 * Compute lifetime, monthly, and percentage metrics for all members.
 */
export function memberStatistics(
  memberId: string,
  ledger: LedgerState,
  currentMonth: string
): MemberStatistics {
  const member = ledger.members.find((m) => m.id === memberId);
  const name = member ? member.name : 'Unknown';

  const activeContributions = activeOnly(ledger.transactions).filter(
    (tx): tx is ContributionTransaction => tx.type === 'contribution'
  );

  const memberContributions = activeContributions.filter((tx) => tx.memberId === memberId);
  const allTotal = activeContributions.reduce((sum, tx) => addPaise(sum, tx.amount), ZERO_PAISE);

  let lifetimeContribution = ZERO_PAISE;
  let thisMonthContribution = ZERO_PAISE;
  let lastContributionDate: string | undefined;

  for (const tx of memberContributions) {
    lifetimeContribution = addPaise(lifetimeContribution, tx.amount);
    if (tx.forMonth === currentMonth) {
      thisMonthContribution = addPaise(thisMonthContribution, tx.amount);
    }
    if (!lastContributionDate || tx.date > lastContributionDate) {
      lastContributionDate = tx.date;
    }
  }

  const sharePercentage = allTotal > 0 ? (lifetimeContribution / allTotal) * 100 : 0;

  return {
    memberId,
    name,
    lifetimeContribution,
    thisMonthContribution,
    sharePercentage,
    contributionCount: memberContributions.length,
    lastContributionDate,
  };
}

/**
 * Reconcile ledger outstanding with the actual bank balance snapshot.
 */
export function reconcile(
  actualOutstanding: Paise,
  date: string,
  ledger: LedgerState
): ReconciliationResult {
  const ledgerCalculatedOutstanding = outstandingAt(date, ledger);
  const variance = subPaise(actualOutstanding, ledgerCalculatedOutstanding);

  return {
    date,
    bankActualOutstanding: actualOutstanding,
    ledgerCalculatedOutstanding,
    variance,
  };
}

/**
 * Mark superseded interest entries when recalculating for a period.
 */
export function markSupersededInterestEntries(
  period: string,
  method: CalculationMethod,
  entries: InterestEntry[]
): InterestEntry[] {
  const now = new Date().toISOString();
  return entries.map((entry) => {
    if (entry.period === period && entry.method === method && entry.status === 'active') {
      return {
        ...entry,
        status: 'superseded',
        supersededAt: now,
      };
    }
    return entry;
  });
}

/**
 * Idempotently close a month: creates exactly one active InterestEntry per (period, method).
 */
export function closeMonth(
  period: string,
  engine: InterestEngine,
  ledger: LedgerState
): { entry: InterestEntry; isNew: boolean; supersededEntries: InterestEntry[] } {
  const existingActive = ledger.interestEntries.find(
    (e) => e.period === period && e.method === engine.method && e.status === 'active'
  );

  const openingPrincipal = outstandingAt(`${period}-01`, ledger);
  const rateBps = getEffectiveRateBps(period, ledger.loan, ledger.rateChanges);

  let calculatedInterest: Paise;
  let accruedUnrounded: string | undefined;
  let dailyLedger: DailyLedgerRecord[] | undefined;

  if (engine instanceof DailyReducingBalanceEngine || engine.method === 'daily') {
    const dailyEngine = engine instanceof DailyReducingBalanceEngine ? engine : defaultDailyEngine;
    const dailyRes = dailyEngine.calculateDailyInterest({
      period,
      openingPrincipal,
      annualRateBps: rateBps,
      transactions: ledger.transactions,
      rateChanges: ledger.rateChanges,
      bankRules: ledger.loan.bankRules,
    });
    calculatedInterest = dailyRes.totalInterest;
    accruedUnrounded = dailyRes.accruedUnrounded.toString();
    dailyLedger = dailyRes.dailyLedger;
  } else {
    calculatedInterest = engine.calculateInterest(openingPrincipal, rateBps, period);
  }

  if (
    existingActive &&
    existingActive.calculatedInterest === calculatedInterest &&
    existingActive.openingPrincipal === openingPrincipal &&
    existingActive.rateBps === rateBps
  ) {
    return { entry: existingActive, isNew: false, supersededEntries: [] };
  }

  const supersededEntries = markSupersededInterestEntries(
    period,
    engine.method,
    ledger.interestEntries
  );

  const deterministicId = `${period}_${engine.method}_${Date.now()}`;
  const entry: InterestEntry = {
    id: deterministicId,
    period,
    method: engine.method,
    openingPrincipal,
    calculatedInterest,
    rateBps,
    status: 'active',
    createdAt: new Date().toISOString(),
    accruedUnrounded,
    dailyLedger,
  };

  return { entry, isNew: true, supersededEntries };
}

/**
 * Get daily ledger breakdown for a given period.
 */
export function getDailyLedger(period: string, ledger: LedgerState): DailyLedgerRecord[] {
  const openingPrincipal = outstandingAt(`${period}-01`, ledger);
  const rateBps = getEffectiveRateBps(period, ledger.loan, ledger.rateChanges);
  const res = defaultDailyEngine.calculateDailyInterest({
    period,
    openingPrincipal,
    annualRateBps: rateBps,
    transactions: ledger.transactions,
    rateChanges: ledger.rateChanges,
    bankRules: ledger.loan.bankRules,
  });
  return res.dailyLedger;
}

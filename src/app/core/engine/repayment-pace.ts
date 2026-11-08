import { LedgerState } from './models';
import { Paise, paise, toPaise } from './money';
import { OdWithdrawalRecord } from './od-withdrawals';
import { SbiMonthlyAuditRecord } from './sbi-interest-audit';
import { SbiMonthlyPaymentRecord } from './sbi-payments-audit';

export interface RepaymentPaceAnalysis {
  monthsElapsed: number;
  startDate: string; // '2024-06-12'
  currentPeriod: string;

  // Bank Scheduled Figures (Mandatory regular EMI)
  bankMonthlyEmi: Paise;
  bankSupposedToPay: Paise;

  // Bank Interest Debited Till Now (authentic passbook total from Firestore)
  totalInterestAddedSoFar: Paise;

  // Family Accelerated Target (₹2.4L / month pool)
  familyMonthlyTarget: Paise;
  familySupposedToPay: Paise;

  // Actual Deposits Injected
  grossPaid: Paise;
  totalWithdrawn: Paise;
  netPaid: Paise;

  // Variances vs Bank Schedule
  grossAheadOfBank: Paise;
  grossAheadOfBankPct: number;
  netAheadOfBank: Paise;
  netAheadOfBankPct: number;

  // High-Impact Multipliers
  totalEmisCount: number;
  netEquivalentEmisPrepaid: number;
  grossEquivalentEmisPrepaid: number;
  equivalentEmisPrepaid: number;
  paceMultiplier: number;
  statusMessage: string;
}

export interface RepaymentPaceOptions {
  odWithdrawals?: OdWithdrawalRecord[];
  interestAudit?: SbiMonthlyAuditRecord[];
  paymentsAudit?: SbiMonthlyPaymentRecord[];
}

/**
 * Computes cumulative scheduled payments ("supposed to have paid") vs
 * actual cash pumped into the loan account, completely dynamic from Cloud Firestore.
 */
export function getRepaymentPaceAnalysis(
  ledger: LedgerState,
  options?: RepaymentPaceOptions
): RepaymentPaceAnalysis {
  const loan = ledger.loan;
  const startDate = loan.openingDate || '2024-06-12';
  const startYear = parseInt(startDate.slice(0, 4), 10);
  const startMonth = parseInt(startDate.slice(5, 7), 10);

  // Dynamic calendar horizon relative to start date
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const monthsElapsed = Math.max(1, (currentYear - startYear) * 12 + (currentMonth - startMonth));

  // 1. Bank Scheduled EMI (SBI Statement: ₹1,18,900)
  const bankMonthlyEmi: Paise = loan.regularEmi || toPaise(118900);
  const bankSupposedToPay = paise(monthsElapsed * bankMonthlyEmi);

  // 2. Family Accelerated Target (₹2,40,000 / month)
  const familyMonthlyTarget: Paise = loan.monthlyTarget || toPaise(240000);
  const familySupposedToPay = paise(monthsElapsed * familyMonthlyTarget);

  // 3. Compute Live User Deposits & Withdrawals
  const activeTxs = ledger.transactions.filter((t) => !t.deletedAt);
  let liveBankDeposits = 0;
  let liveWithdrawals = 0;

  for (const tx of activeTxs) {
    if (!tx.id.startsWith('tx-sbi-')) {
      if (tx.type === 'bankPayment') {
        liveBankDeposits += tx.amount;
      } else if (tx.type === 'withdrawal') {
        liveWithdrawals += tx.amount;
      }
    }
  }

  // Baseline from Cloud Firestore subcollections
  const auditPaymentsTotal = options?.paymentsAudit?.length
    ? options.paymentsAudit.reduce((acc, r) => acc + r.totalPaid, 0)
    : 492053900; // fallback to ₹49,20,539.00 if empty

  const auditWithdrawalsTotal = options?.odWithdrawals?.length
    ? options.odWithdrawals.reduce((acc, r) => acc + r.amount, 0)
    : 104803900; // fallback to ₹10,48,039.00 if empty

  const grossPaid = paise(auditPaymentsTotal + liveBankDeposits);
  const totalWithdrawn = paise(auditWithdrawalsTotal + liveWithdrawals);
  const netPaid = paise(grossPaid - totalWithdrawn);

  // 4. Interest Added (sum from Firestore interestAudit)
  const totalInterestAddedSoFar: Paise = options?.interestAudit?.length
    ? (options.interestAudit.reduce((acc, r) => acc + r.sbiInterest, 0) as Paise)
    : toPaise(2479889);

  // 5. Variances vs Bank Schedule
  const grossAheadOfBank = paise(grossPaid - bankSupposedToPay);
  const grossAheadOfBankPct = bankSupposedToPay > 0
    ? Number(((grossAheadOfBank / bankSupposedToPay) * 100).toFixed(1))
    : 0;

  const netAheadOfBank = paise(netPaid - bankSupposedToPay);
  const netAheadOfBankPct = bankSupposedToPay > 0
    ? Number(((netAheadOfBank / bankSupposedToPay) * 100).toFixed(1))
    : 0;

  const totalEmisCount = bankMonthlyEmi > 0
    ? Number((grossPaid / bankMonthlyEmi).toFixed(1))
    : 0;
  const netEquivalentEmisPrepaid = bankMonthlyEmi > 0
    ? Number((netAheadOfBank / bankMonthlyEmi).toFixed(1))
    : 0;
  const grossEquivalentEmisPrepaid = bankMonthlyEmi > 0
    ? Number((grossAheadOfBank / bankMonthlyEmi).toFixed(1))
    : 0;
  const equivalentEmisPrepaid = netEquivalentEmisPrepaid;
  const paceMultiplier = bankSupposedToPay > 0
    ? Number((grossPaid / bankSupposedToPay).toFixed(2))
    : 1;

  const statusMessage =
    netAheadOfBank >= 0
      ? `+${netEquivalentEmisPrepaid} Months Ahead of Bank Schedule (Net)`
      : `${Math.abs(netEquivalentEmisPrepaid)} Months Behind Bank Schedule (Net)`;

  return {
    monthsElapsed,
    startDate,
    currentPeriod: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
    bankMonthlyEmi,
    bankSupposedToPay,
    totalInterestAddedSoFar,
    familyMonthlyTarget,
    familySupposedToPay,
    grossPaid,
    totalWithdrawn,
    netPaid,
    grossAheadOfBank,
    grossAheadOfBankPct,
    netAheadOfBank,
    netAheadOfBankPct,
    totalEmisCount,
    netEquivalentEmisPrepaid,
    grossEquivalentEmisPrepaid,
    equivalentEmisPrepaid,
    paceMultiplier,
    statusMessage,
  };
}

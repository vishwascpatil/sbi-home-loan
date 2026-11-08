import { divideHalfUp, Paise, paise } from './money';
import { DailyLedgerRecord, Transaction } from './models';
import { SBI_AUTHENTIC_STATEMENT_ROWS, SbiPassbookRow } from '../data/sbi-statement-records';

export interface SbiDailyRecord extends DailyLedgerRecord {
  txDetails?: { desc: string; type: 'credit' | 'debit'; amount: string; category: string }[];
}

export interface SbiAvailableMonth {
  period: string;        // "2024-06"
  label: string;         // "June 2024"
  shortLabel: string;    // "Jun '24"
  year: number;          // 2024
  monthIndex: number;    // 6
  hasTransactions: boolean;
  isCurrent?: boolean;
}

export interface SbiDailyMonthSummary {
  period: string;
  monthLabel: string;
  shortLabel: string;
  year: number;
  rateBps: number;
  effectiveRate: number; // e.g. 8.90
  openingBalance: Paise;
  closingBalance: Paise;
  totalMovements: Paise;
  totalDebited: Paise;
  totalCredited: Paise;
  totalInterestAccrued: Paise;
  daysCount: number;
  records: SbiDailyRecord[];
  transactionsCount: number;
}

// SBI Historical Floating Rate Benchmark Eras
export const SBI_RATE_ERAS: Record<string, number> = {
  '2024-06': 890,
  '2024-07': 890,
  '2024-08': 890,
  '2024-09': 890,
  '2024-10': 890,
  '2024-11': 890,
  '2024-12': 890,
  '2025-01': 890,
  '2025-02': 877,
  '2025-03': 865,
  '2025-04': 852,
  '2025-05': 840,
  '2025-06': 813,
  '2025-07': 790,
  '2025-08': 790,
  '2025-09': 790,
  '2025-10': 790,
  '2025-11': 790,
  '2025-12': 776,
  '2026-01': 765,
  '2026-02': 765,
  '2026-03': 765,
  '2026-04': 765,
  '2026-05': 765,
  '2026-06': 765,
  '2026-07': 765,
  '2026-08': 765,
  '2026-09': 765,
  '2026-10': 790,
  '2026-11': 790,
};

// Chronologically ordered statement entries (12-Jun-2024 to 07-Nov-2026)
const CHRONO_STATEMENT_ROWS: SbiPassbookRow[] = [...SBI_AUTHENTIC_STATEMENT_ROWS].reverse();

/**
 * Returns all 30 available months starting from June 2024 to November 2026 (descending).
 */
export function getSbiAvailableMonths(): SbiAvailableMonth[] {
  const months: SbiAvailableMonth[] = [];
  const start = new Date(2024, 5, 1); // Jun 2024
  const end = new Date(2026, 10, 1);  // Nov 2026
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const shortNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = cur.getMonth() + 1;
    const period = `${y}-${String(m).padStart(2, '0')}`;
    const label = `${monthNames[m - 1]} ${y}`;
    const shortLabel = `${shortNames[m - 1]} '${String(y).slice(2)}`;
    const hasTransactions = CHRONO_STATEMENT_ROWS.some((r) => r.isoDate.startsWith(period));

    months.push({
      period,
      label,
      shortLabel,
      year: y,
      monthIndex: m,
      hasTransactions,
      isCurrent: period === '2026-11',
    });

    cur.setMonth(cur.getMonth() + 1);
  }

  // Return reverse chronological (newest first: Nov '26 down to Jun '24)
  return months.reverse();
}

/**
 * Generates the authentic daily interest ledger and balance breakdown
 * for any given period from June 2024 to present.
 */
export function getSbiDailyLedger(
  period: string,
  liveTransactions: Transaction[] = []
): SbiDailyMonthSummary {
  const [yStr, mStr] = period.slice(0, 7).split('-');
  const y = parseInt(yStr || '2026', 10);
  const m = parseInt(mStr || '11', 10);
  const daysInMonth = new Date(y, m, 0).getDate();
  const rateBps = SBI_RATE_ERAS[period] ?? 790;
  const effectiveRate = rateBps / 100;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const shortNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const monthLabel = `${monthNames[m - 1]} ${y}`;
  const shortLabel = `${shortNames[m - 1]} '${String(y).slice(2)}`;

  // 1. Determine opening balance from chronological transactions before period-01
  const priorStatementTxs = CHRONO_STATEMENT_ROWS.filter((t) => t.isoDate < `${period}-01`);
  let currentBalance: Paise = paise(0);

  if (priorStatementTxs.length > 0) {
    currentBalance = priorStatementTxs[priorStatementTxs.length - 1].balancePaise;
  } else if (period === '2024-06') {
    currentBalance = paise(0); // Before June 12 disbursement
  }

  const openingBalance = currentBalance;
  let cumulativeInterestBigInt = 0n;
  let totalDebits = 0;
  let totalCredits = 0;
  let txsCount = 0;

  const records: SbiDailyRecord[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dStr = `${yStr}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOpening = currentBalance;

    // A. Passbook authentic transactions on this day
    const dayStatementTxs = CHRONO_STATEMENT_ROWS.filter((t) => t.isoDate === dStr);

    // B. Live newly recorded transactions in LedgerStore (for current/future active period)
    const dayLiveTxs = liveTransactions.filter(
      (t) => !t.deletedAt && (t.valueDate || t.date) === dStr
    );

    let dayMovements = 0;
    const txDetails: { desc: string; type: 'credit' | 'debit'; amount: string; category: string }[] = [];

    // Apply authentic passbook entries
    for (const st of dayStatementTxs) {
      txsCount++;
      if (st.type === 'debit') {
        dayMovements += st.debitPaise;
        totalDebits += st.debitPaise;
      } else if (st.type === 'credit') {
        dayMovements -= st.creditPaise;
        totalCredits += st.creditPaise;
      }
      currentBalance = st.balancePaise;
      txDetails.push({
        desc: st.desc,
        type: st.type,
        amount: st.rawCredit ? `+₹${st.rawCredit}` : `−₹${st.rawDebit}`,
        category: st.category,
      });
    }

    // Apply live user-recorded direct statement deposits
    if (dayLiveTxs.length > 0) {
      for (const lt of dayLiveTxs) {
        if (lt.type === 'bankPayment' && !lt.id.startsWith('tx-sbi-')) {
          dayMovements -= lt.principalPortion;
          totalCredits += lt.amount;
          currentBalance = paise(Math.max(0, currentBalance - lt.principalPortion));
          txDetails.push({
            desc: lt.notes || 'Direct Statement Deposit',
            type: 'credit',
            amount: `+₹${(lt.amount / 100).toLocaleString('en-IN')}`,
            category: 'prepayment',
          });
        }
      }
    }

    const dayClosing = currentBalance;

    // C. Daily Accrued Interest (actual/365 day count basis)
    let dailyInterest = paise(0);
    if (dayClosing > 0 && rateBps > 0) {
      // In June 2024, interest only runs from 12th (sanction date)
      if (period !== '2024-06' || day >= 12) {
        const scaled = BigInt(dayClosing) * BigInt(rateBps);
        const divisor = 365n * 10000n;
        dailyInterest = paise(Number(divideHalfUp(scaled, divisor)));
      }
    }

    cumulativeInterestBigInt += BigInt(dailyInterest);

    records.push({
      date: dStr,
      opening: dayOpening,
      movements: paise(dayMovements),
      closing: dayClosing,
      rateBps,
      dailyAccruedPaise: dailyInterest,
      cumulativeAccruedPaise: paise(Number(cumulativeInterestBigInt)),
      txDetails: txDetails.length > 0 ? txDetails : undefined,
    });
  }

  return {
    period,
    monthLabel,
    shortLabel,
    year: y,
    rateBps,
    effectiveRate,
    openingBalance,
    closingBalance: currentBalance,
    totalMovements: paise(totalDebits - totalCredits),
    totalDebited: paise(totalDebits),
    totalCredited: paise(totalCredits),
    totalInterestAccrued: paise(Number(cumulativeInterestBigInt)),
    daysCount: daysInMonth,
    records,
    transactionsCount: txsCount,
  };
}

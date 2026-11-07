import { InterestEngine } from './interest-engine.interface';
import {
  BankRuleSettings,
  DailyInterestResult,
  DailyLedgerRecord,
  RateChange,
  Transaction,
} from './models';
import { divideHalfUp, Paise, paise } from './money';

export interface DailyInterestOptions {
  period: string; // YYYY-MM
  openingPrincipal: Paise;
  annualRateBps: number;
  transactions?: Transaction[];
  rateChanges?: RateChange[];
  bankRules?: Partial<BankRuleSettings>;
}

export class DailyReducingBalanceEngine implements InterestEngine {
  readonly method = 'daily' as const;

  /**
   * Basic InterestEngine interface implementation.
   * Assumes no transactions during the period, standard actual/365 basis.
   */
  calculateInterest(principal: Paise, rateBps: number, period: string): Paise {
    const result = this.calculateDailyInterest({
      period,
      openingPrincipal: principal,
      annualRateBps: rateBps,
    });
    return result.totalInterest;
  }

  /**
   * Full day-accurate interest engine with daily ledger breakdown,
   * bank rules, leap year handling, and transaction movements.
   */
  calculateDailyInterest(options: DailyInterestOptions): DailyInterestResult {
    const {
      period,
      openingPrincipal,
      annualRateBps,
      transactions = [],
      rateChanges = [],
      bankRules = {},
    } = options;

    const dayCountBasis = bankRules.dayCountBasis || 'actual/365';
    const isCapitalised = bankRules.isCapitalised ?? true;

    const [yearStr, monthStr] = period.slice(0, 7).split('-');
    const year = parseInt(yearStr || '2025', 10);
    const month = parseInt(monthStr || '1', 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const basisDays = this.getBasisDays(dayCountBasis, year);

    // Filter active (non-deleted) transactions for this period
    const activeTxs = transactions.filter((t) => !t.deletedAt);

    let currentBalance = BigInt(Math.max(0, openingPrincipal));
    let accruedAccumulator = 0n;
    const dailyLedger: DailyLedgerRecord[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${yearStr}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOpening = Number(currentBalance) as Paise;

      // 1. Determine active interest rate for this day
      const dayRateBps = this.getRateForDate(dateStr, annualRateBps, rateChanges);

      // 2. Aggregate movements effective on this date
      let dayMovements = 0n;
      const dayTxs = activeTxs.filter((t) => (t.valueDate || t.date) === dateStr);

      for (const tx of dayTxs) {
        if (tx.type === 'contribution') {
          // Member deposit into OD loan reduces principal from this day forward
          dayMovements -= BigInt(tx.amount);
        } else if (tx.type === 'bankPayment') {
          // Bank payment reduces principal by principalPortion
          dayMovements -= BigInt(tx.principalPortion);
        } else if (tx.type === 'principalAdjustment') {
          // Positive reduces principal, negative increases
          dayMovements -= BigInt(tx.amount);
        } else if (tx.type === 'interestCharge') {
          dayMovements += BigInt(tx.amount);
        } else if (tx.type === 'withdrawal') {
          dayMovements += BigInt(tx.amount);
        }
      }

      const dayClosingBigInt = currentBalance + dayMovements;
      const dayClosing = Number(dayClosingBigInt > 0n ? dayClosingBigInt : 0n) as Paise;

      // 3. Accrue interest on the end-of-day balance
      let dailyScaled = 0n;
      if (dayClosing > 0 && dayRateBps > 0) {
        // Daily unrounded interest scaled by 1,000,000n
        // (Closing * rateBps * 1_000_000n) / (basisDays * 10,000n)
        const numerator = BigInt(dayClosing) * BigInt(dayRateBps) * 1_000_000n;
        const denominator = BigInt(basisDays) * 10_000n;
        dailyScaled = numerator / denominator;
      }

      accruedAccumulator += dailyScaled;

      const dailyAccruedPaise = paise(Number(divideHalfUp(dailyScaled, 1_000_000n)));
      const cumulativeAccruedPaise = paise(Number(divideHalfUp(accruedAccumulator, 1_000_000n)));

      dailyLedger.push({
        date: dateStr,
        opening: dayOpening,
        movements: paise(Number(dayMovements)),
        closing: dayClosing,
        rateBps: dayRateBps,
        dailyAccruedPaise,
        cumulativeAccruedPaise,
      });

      // 4. Update balance for next day
      currentBalance = dayClosingBigInt;

      // If capitalized on last day of month
      if (day === daysInMonth && isCapitalised) {
        const debitedInterest = divideHalfUp(accruedAccumulator, 1_000_000n);
        currentBalance += debitedInterest;
      }
    }

    const totalInterestPaise = paise(Number(divideHalfUp(accruedAccumulator, 1_000_000n)));

    return {
      totalInterest: totalInterestPaise,
      dailyLedger,
      accruedUnrounded: accruedAccumulator,
      basisDays,
    };
  }

  private getBasisDays(basis: string, year: number): number {
    if (basis === '360') return 360;
    if (basis === 'actual/actual') return this.isLeapYear(year) ? 366 : 365;
    return 365; // 'actual/365' default
  }

  private isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  private getRateForDate(date: string, defaultRateBps: number, rateChanges: RateChange[]): number {
    if (!rateChanges || rateChanges.length === 0) {
      return defaultRateBps;
    }

    // Sort descending by effectiveFrom
    const sorted = [...rateChanges].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    for (const rc of sorted) {
      if (rc.effectiveFrom <= date) {
        return rc.rateBps;
      }
    }

    return defaultRateBps;
  }
}

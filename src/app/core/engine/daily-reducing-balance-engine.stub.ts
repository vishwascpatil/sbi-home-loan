import { InterestEngine } from './interest-engine.interface';
import { divideHalfUp, Paise, paise } from './money';

/**
 * Daily Reducing Balance Engine Stub (for Phase 3 preparation).
 * Uses exact days in the period / 365 days.
 */
export class DailyReducingBalanceEngineStub implements InterestEngine {
  readonly method = 'daily' as const;

  calculateInterest(principal: Paise, rateBps: number, period: string): Paise {
    if (principal <= 0 || rateBps <= 0) {
      return paise(0);
    }

    const [yearStr, monthStr] = period.slice(0, 7).split('-');
    const year = parseInt(yearStr || '2025', 10);
    const month = parseInt(monthStr || '1', 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Daily interest formula for the month: P * (rateBps / 10000) * (days / 365)
    // = P * rateBps * days / 3,650,000
    const numerator = BigInt(principal) * BigInt(rateBps) * BigInt(daysInMonth);
    const denominator = 3_650_000n;

    const interestBigInt = divideHalfUp(numerator, denominator);
    return paise(Number(interestBigInt));
  }
}


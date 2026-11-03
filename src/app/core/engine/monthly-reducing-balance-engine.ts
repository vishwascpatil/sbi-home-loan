import { InterestEngine } from './interest-engine.interface';
import { divideHalfUp, Paise, paise } from './money';

/**
 * Monthly Reducing Balance Engine.
 * Interest = roundHalfUp(Principal * rateBps / (12 * 10000))
 * Golden Test verified: ₹1,21,05,189 at 7.90% -> ₹79,692.49 (7,969,249 paise).
 */
export class MonthlyReducingBalanceEngine implements InterestEngine {
  readonly method = 'monthly' as const;

  calculateInterest(principal: Paise, rateBps: number, _period: string): Paise {
    if (principal <= 0 || rateBps <= 0) {
      return paise(0);
    }

    const numerator = BigInt(principal) * BigInt(rateBps);
    const denominator = 120_000n; // 12 months * 10,000 basis points

    const interestBigInt = divideHalfUp(numerator, denominator);
    return paise(Number(interestBigInt));
  }
}


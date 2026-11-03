import { Paise } from './money';
import { CalculationMethod } from './models';

export interface InterestEngine {
  readonly method: CalculationMethod;
  /**
   * Calculate estimated interest on a principal balance for a given period.
   * @param principal Outstanding principal amount in Paise.
   * @param rateBps Annual interest rate in basis points (e.g., 790 = 7.90%).
   * @param period Year-month in 'YYYY-MM' or date in 'YYYY-MM-DD'.
   */
  calculateInterest(principal: Paise, rateBps: number, period: string): Paise;
}


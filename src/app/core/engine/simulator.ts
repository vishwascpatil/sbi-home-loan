import { InterestEngine } from './interest-engine.interface';
import { MonthlyReducingBalanceEngine } from './monthly-reducing-balance-engine';
import { addPaise, Paise, paise, subPaise, ZERO_PAISE } from './money';

export interface SimulationResult {
  months: number;
  closureDate: string; // e.g. "Aug 2029"
  totalInterest: Paise;
  totalPaid: Paise;
  schedule: Paise[]; // Monthly principal balances
}

export interface ScenarioComparison {
  payment: Paise;
  isCustom: boolean;
  result: SimulationResult | null;
  differenceVsBaseline?: {
    interestSaved: Paise; // Positive if saved, negative if cost more
    isSaved: boolean;
  };
}

const defaultEngine = new MonthlyReducingBalanceEngine();

/**
 * Format date n months in the future into "Mon YYYY" (e.g., "Aug 2029").
 */
export function formatFutureMonth(monthsFromNow: number, baseDate = new Date()): string {
  const targetDate = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth() + monthsFromNow,
    1,
    12
  );
  return targetDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

/**
 * Closed-form analytical formula for loan tenure in months:
 * n = -ln(1 - (P * i) / PMT) / ln(1 + i)
 * where P is principal, i is monthly rate (rateBps / 120,000), PMT is payment.
 */
export function closedFormMonths(
  principal: Paise,
  monthlyPayment: Paise,
  rateBps: number
): number | null {
  const P = principal / 100;
  const PMT = monthlyPayment / 100;
  const i = rateBps / 10_000 / 12;

  if (PMT <= P * i) {
    return null; // Never closes
  }

  const n = -Math.log(1 - (P * i) / PMT) / Math.log(1 + i);
  return Math.ceil(n);
}

/**
 * Simulate loan payoff given a fixed monthly payment and reducing balance method.
 * Returns null if the payment is at or below monthly interest ("never closes").
 */
export function simulate(
  principal: Paise,
  monthlyPayment: Paise,
  rateBps: number,
  engine: InterestEngine = defaultEngine,
  baseDate = new Date()
): SimulationResult | null {
  if (principal <= 0) {
    return {
      months: 0,
      closureDate: formatFutureMonth(0, baseDate),
      totalInterest: ZERO_PAISE,
      totalPaid: ZERO_PAISE,
      schedule: [ZERO_PAISE],
    };
  }

  // Initial check: if payment <= first month's interest, principal can never fall
  const firstMonthInterest = engine.calculateInterest(principal, rateBps, '2025-01');
  if (monthlyPayment <= firstMonthInterest) {
    return null;
  }

  let currentPrincipal = principal;
  let totalInterest = ZERO_PAISE;
  let months = 0;
  const schedule: Paise[] = [principal];
  const maxMonths = 600; // 50 years max cap

  while (currentPrincipal > 0 && months < maxMonths) {
    const periodStr = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth() + months,
      1
    )
      .toISOString()
      .slice(0, 7);

    const interest = engine.calculateInterest(currentPrincipal, rateBps, periodStr);

    if (monthlyPayment <= interest) {
      return null;
    }

    totalInterest = addPaise(totalInterest, interest);
    const principalPaid = paise(Math.min(currentPrincipal, subPaise(monthlyPayment, interest)));
    currentPrincipal = subPaise(currentPrincipal, principalPaid);

    months++;
    schedule.push(currentPrincipal);
  }

  if (currentPrincipal > 0) {
    return null; // Did not close within 600 months
  }

  return {
    months,
    closureDate: formatFutureMonth(months, baseDate),
    totalInterest,
    totalPaid: addPaise(principal, totalInterest),
    schedule,
  };
}

/**
 * Compare multiple monthly payment scenarios against a baseline (e.g. ₹1,90,000).
 */
export function compareScenarios(
  principal: Paise,
  scenarios: { payment: Paise; isCustom?: boolean }[],
  rateBps: number,
  baselinePayment?: Paise,
  engine: InterestEngine = defaultEngine,
  baseDate = new Date()
): ScenarioComparison[] {
  const baselineResult = baselinePayment
    ? simulate(principal, baselinePayment, rateBps, engine, baseDate)
    : null;

  return scenarios.map(({ payment, isCustom = false }) => {
    const result = simulate(principal, payment, rateBps, engine, baseDate);

    let differenceVsBaseline: ScenarioComparison['differenceVsBaseline'];

    if (result && baselineResult && baselinePayment && payment !== baselinePayment) {
      const diff = subPaise(baselineResult.totalInterest, result.totalInterest);
      const isSaved = diff >= 0;
      differenceVsBaseline = {
        interestSaved: paise(Math.abs(diff)),
        isSaved,
      };
    }

    return {
      payment,
      isCustom,
      result,
      differenceVsBaseline,
    };
  });
}

import { InterestEngine } from './interest-engine.interface';
import { MonthlyReducingBalanceEngine } from './monthly-reducing-balance-engine';
import { addPaise, divideHalfUp, Paise, paise, subPaise, ZERO_PAISE } from './money';
import { DayCountBasis, DrawdownEvent, PrepaymentEvent } from './models';

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

export interface SimulatorV2Options {
  principal: Paise;
  monthlyPayment: Paise;
  rateBps: number;
  paymentDayOfMonth?: number;
  rateShiftBps?: number;
  prepayments?: PrepaymentEvent[];
  drawdowns?: DrawdownEvent[];
  dayCountBasis?: DayCountBasis;
  baseDate?: Date;
}

/**
 * Day-accurate repayment simulation engine with prepayments, drawdowns,
 * custom payment day of month, and interest rate shifts.
 */
export function simulateV2(options: SimulatorV2Options): SimulationResult | null {
  const {
    principal,
    monthlyPayment,
    rateBps,
    paymentDayOfMonth = 1,
    rateShiftBps = 0,
    prepayments = [],
    drawdowns = [],
    dayCountBasis = 'actual/365',
    baseDate = new Date(),
  } = options;

  if (principal <= 0) {
    return {
      months: 0,
      closureDate: formatFutureMonth(0, baseDate),
      totalInterest: ZERO_PAISE,
      totalPaid: ZERO_PAISE,
      schedule: [ZERO_PAISE],
    };
  }

  const effectiveRateBps = Math.max(10, rateBps + rateShiftBps);
  let currentPrincipalBigInt = BigInt(principal);
  let totalInterestBigInt = 0n;
  let months = 0;
  const schedule: Paise[] = [principal];
  const maxMonths = 600;

  let simDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);

  while (currentPrincipalBigInt > 0n && months < maxMonths) {
    const year = simDate.getFullYear();
    const month = simDate.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    let basisDays = 365;
    if (dayCountBasis === '360') basisDays = 360;
    else if (dayCountBasis === 'actual/actual') {
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      basisDays = isLeap ? 366 : 365;
    }

    const yearStr = String(year);
    const monthStr = String(month).padStart(2, '0');
    let monthAccruedAccumulator = 0n;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;

      // 1. One-off prepayments on this day
      for (const prepay of prepayments) {
        if (prepay.date === dateStr) {
          const prepayBig = BigInt(prepay.amount);
          currentPrincipalBigInt = currentPrincipalBigInt > prepayBig
            ? currentPrincipalBigInt - prepayBig
            : 0n;
        }
      }

      // 2. Scheduled drawdowns on this day
      for (const draw of drawdowns) {
        if (draw.date === dateStr) {
          currentPrincipalBigInt += BigInt(draw.amount);
        }
      }

      // 3. Regular monthly payment on paymentDayOfMonth
      const isPayDay = day === Math.min(paymentDayOfMonth, daysInMonth);
      if (isPayDay && currentPrincipalBigInt > 0n) {
        const estHalfInterest = divideHalfUp(monthAccruedAccumulator, 1_000_000n);
        const netPrincipalReduction = BigInt(monthlyPayment) > estHalfInterest
          ? BigInt(monthlyPayment) - estHalfInterest
          : 0n;
        currentPrincipalBigInt = currentPrincipalBigInt > netPrincipalReduction
          ? currentPrincipalBigInt - netPrincipalReduction
          : 0n;
      }

      // 4. Daily interest accrual on closing balance
      if (currentPrincipalBigInt > 0n && effectiveRateBps > 0) {
        const dailyScaled = (currentPrincipalBigInt * BigInt(effectiveRateBps) * 1_000_000n) /
          (BigInt(basisDays) * 10_000n);
        monthAccruedAccumulator += dailyScaled;
      }
    }

    const monthInterestPaise = divideHalfUp(monthAccruedAccumulator, 1_000_000n);
    totalInterestBigInt += monthInterestPaise;

    if (BigInt(monthlyPayment) <= monthInterestPaise && prepayments.length === 0) {
      return null;
    }

    months++;
    const currentPrincipalPaise = paise(Number(currentPrincipalBigInt));
    schedule.push(currentPrincipalPaise);

    simDate = new Date(simDate.getFullYear(), simDate.getMonth() + 1, 1);
  }

  if (currentPrincipalBigInt > 0n) {
    return null;
  }

  const finalInterest = paise(Number(totalInterestBigInt));
  return {
    months,
    closureDate: formatFutureMonth(months, baseDate),
    totalInterest: finalInterest,
    totalPaid: addPaise(principal, finalInterest),
    schedule,
  };
}


import { Paise, paise } from './money';

export interface OdWithdrawalRecord {
  id: string | number;
  numId?: number;
  date: string; // YYYY-MM-DD
  amount: Paise;
  category: 'bill' | 'personal' | 'investment' | 'creditCard' | 'transfer' | 'fee';
  categoryLabel: string;
  categoryIcon: string;
  destination: string;
  description: string;
  daysActive: number;
  monthlyCost: Paise;
  cumulativeInterestLost: Paise;
}

export interface OdWithdrawalsSummary {
  totalWithdrawn: Paise;
  netWithdrawn: Paise; // excluding reversed SLOP
  totalInterestLost: Paise;
  currentMonthlyBleed: Paise;
  currentDailyBleed: Paise;
  withdrawalCount: number;
  records: OdWithdrawalRecord[];
}

export interface PaybackSimulationResult {
  paybackAmount: Paise;
  remainingBleedPaise: Paise;
  monthlySavingsPaise: Paise;
  lifetimeInterestSavedPaise: Paise;
  monthsTenureReduced: number;
}

// Emptied: All authentic records now reside in Cloud Firestore subcollection: /loans/loan-primary/odWithdrawals
export const FORENSIC_OD_WITHDRAWALS: OdWithdrawalRecord[] = [];

export function getOdWithdrawalsSummary(sourceRecords?: OdWithdrawalRecord[]): OdWithdrawalsSummary {
  const records = sourceRecords && sourceRecords.length > 0 ? sourceRecords : FORENSIC_OD_WITHDRAWALS;
  const totalWithdrawn = records.reduce((acc, r) => (acc + r.amount) as Paise, paise(0));
  const netWithdrawn = records
    .filter((r) => r.id !== 2 && r.id !== 'od-2' && r.numId !== 2)
    .reduce((acc, r) => (acc + r.amount) as Paise, paise(0));
  const totalInterestLost = records.reduce((acc, r) => (acc + r.cumulativeInterestLost) as Paise, paise(0));
  const currentMonthlyBleed = records.reduce((acc, r) => (acc + r.monthlyCost) as Paise, paise(0));
  const currentDailyBleed = paise(Math.round((currentMonthlyBleed * 12) / 365));

  return {
    totalWithdrawn,
    netWithdrawn,
    totalInterestLost,
    currentMonthlyBleed,
    currentDailyBleed,
    withdrawalCount: records.length,
    records,
  };
}

export function simulatePayback(
  paybackAmountPaise: Paise,
  currentRateBps: number = 790,
  sourceSummary?: OdWithdrawalsSummary
): PaybackSimulationResult {
  const summary = sourceSummary || getOdWithdrawalsSummary();
  const clampedPayback = Math.min(paybackAmountPaise, summary.netWithdrawn);
  
  // Rate as fraction
  const rate = currentRateBps / 10000;
  
  // Monthly savings = payback * rate / 12
  const monthlySavingsPaise = paise(Math.round((clampedPayback * rate) / 12));
  const remainingBleedPaise = paise(Math.max(0, summary.currentMonthlyBleed - monthlySavingsPaise));
  
  // On an amortizing OD loan, payback shaves roughly:
  // ~1.3 months per ₹1 Lakh repaid at ~8%
  const lakhsRepaid = clampedPayback / (100000 * 100);
  const monthsTenureReduced = Math.round(lakhsRepaid * 1.35);
  
  // Lifetime interest saved ~ payback * rate * remainingYears * 0.75 factor
  const remainingYears = 14;
  const lifetimeInterestSavedPaise = paise(Math.round(clampedPayback * rate * remainingYears * 0.7));

  return {
    paybackAmount: paise(clampedPayback),
    remainingBleedPaise,
    monthlySavingsPaise,
    lifetimeInterestSavedPaise,
    monthsTenureReduced,
  };
}

import { Paise, paise, toPaise } from './money';

export interface OdWithdrawalRecord {
  id: number;
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

// 21 Itemized Withdrawals from Bank Statement (12-Jun-2024 to 07-Nov-2026)
export const FORENSIC_OD_WITHDRAWALS: OdWithdrawalRecord[] = [
  {
    id: 1,
    date: '2024-09-13',
    amount: toPaise(53087),
    category: 'bill',
    categoryLabel: 'Bill Payment',
    categoryIcon: '💳',
    destination: 'SBI BillDesk',
    description: 'Online utility / bill payment',
    daysActive: 785,
    monthlyCost: toPaise(349),
    cumulativeInterestLost: toPaise(9256),
  },
  {
    id: 2,
    date: '2024-09-17',
    amount: toPaise(1000),
    category: 'fee',
    categoryLabel: 'Bank Fee',
    categoryIcon: '🏦',
    destination: 'SBI',
    description: 'SLOP statement charge (Reversed on 2024-09-20)',
    daysActive: 3,
    monthlyCost: toPaise(0),
    cumulativeInterestLost: toPaise(1),
  },
  {
    id: 3,
    date: '2024-10-13',
    amount: toPaise(88534),
    category: 'personal',
    categoryLabel: 'Personal Draw',
    categoryIcon: '👤',
    destination: 'Personal A/C',
    description: 'Net Banking transfer marked "for self"',
    daysActive: 755,
    monthlyCost: toPaise(583),
    cumulativeInterestLost: toPaise(14789),
  },
  {
    id: 4,
    date: '2024-11-18',
    amount: toPaise(105640),
    category: 'personal',
    categoryLabel: 'Personal Draw',
    categoryIcon: '👤',
    destination: 'Personal A/C',
    description: 'Net Banking transfer marked "expense"',
    daysActive: 719,
    monthlyCost: toPaise(695),
    cumulativeInterestLost: toPaise(16720),
  },
  {
    id: 5,
    date: '2025-02-04',
    amount: toPaise(100000),
    category: 'bill',
    categoryLabel: 'Bill Payment',
    categoryIcon: '💳',
    destination: 'BillDesk',
    description: 'Online Bill Payment via Net Banking',
    daysActive: 641,
    monthlyCost: toPaise(658),
    cumulativeInterestLost: toPaise(13928),
  },
  {
    id: 6,
    date: '2025-02-04',
    amount: toPaise(25000),
    category: 'transfer',
    categoryLabel: 'Loan Transfer',
    categoryIcon: '🔄',
    destination: 'External Loan',
    description: 'Outgoing transfer marked "Loan repayment"',
    daysActive: 641,
    monthlyCost: toPaise(165),
    cumulativeInterestLost: toPaise(3482),
  },
  {
    id: 7,
    date: '2025-02-06',
    amount: toPaise(45278),
    category: 'personal',
    categoryLabel: 'Personal Draw',
    categoryIcon: '👤',
    destination: 'Personal A/C',
    description: 'Net Banking transfer marked "na"',
    daysActive: 639,
    monthlyCost: toPaise(298),
    cumulativeInterestLost: toPaise(6285),
  },
  {
    id: 8,
    date: '2025-02-28',
    amount: toPaise(100000),
    category: 'creditCard',
    categoryLabel: 'Credit Cards',
    categoryIcon: '💳',
    destination: 'Credit Card',
    description: 'Bill settlement marked "credit cards"',
    daysActive: 617,
    monthlyCost: toPaise(658),
    cumulativeInterestLost: toPaise(13369),
  },
  {
    id: 9,
    date: '2025-03-28',
    amount: toPaise(40000),
    category: 'investment',
    categoryLabel: 'Investment',
    categoryIcon: '📈',
    destination: 'Deposit / FD',
    description: 'Transfer marked "Deposit or Inv"',
    daysActive: 589,
    monthlyCost: toPaise(263),
    cumulativeInterestLost: toPaise(5087),
  },
  {
    id: 10,
    date: '2025-05-04',
    amount: toPaise(75000),
    category: 'transfer',
    categoryLabel: 'External EMI',
    categoryIcon: '💰',
    destination: 'EMI Account',
    description: 'Outgoing transfer marked "emi"',
    daysActive: 552,
    monthlyCost: toPaise(494),
    cumulativeInterestLost: toPaise(8892),
  },
  {
    id: 11,
    date: '2025-05-15',
    amount: toPaise(40000),
    category: 'investment',
    categoryLabel: 'Investment',
    categoryIcon: '📈',
    destination: 'Fund',
    description: 'Investment transfer marked "fund"',
    daysActive: 541,
    monthlyCost: toPaise(263),
    cumulativeInterestLost: toPaise(4640),
  },
  {
    id: 12,
    date: '2025-06-04',
    amount: toPaise(100000),
    category: 'transfer',
    categoryLabel: 'Bank Transfer',
    categoryIcon: '🏦',
    destination: 'HDFC Bank xx541',
    description: 'IMPS to Vikas HDFC account',
    daysActive: 521,
    monthlyCost: toPaise(658),
    cumulativeInterestLost: toPaise(11134),
  },
  {
    id: 13,
    date: '2025-08-24',
    amount: toPaise(30000),
    category: 'personal',
    categoryLabel: 'Home / Living',
    categoryIcon: '🛋️',
    destination: 'Merchant',
    description: 'Furniture purchase marked "cot"',
    daysActive: 440,
    monthlyCost: toPaise(198),
    cumulativeInterestLost: toPaise(2801),
  },
  {
    id: 14,
    date: '2025-09-05',
    amount: toPaise(125000),
    category: 'transfer',
    categoryLabel: 'Loan Transfer',
    categoryIcon: '🔄',
    destination: 'External Loan',
    description: 'Largest single draw, marked "Loan repayment"',
    daysActive: 428,
    monthlyCost: toPaise(823),
    cumulativeInterestLost: toPaise(11346),
  },
  {
    id: 15,
    date: '2025-09-13',
    amount: toPaise(7000),
    category: 'creditCard',
    categoryLabel: 'Credit Cards',
    categoryIcon: '💳',
    destination: 'Credit Card',
    description: 'Card payment marked "credit card"',
    daysActive: 420,
    monthlyCost: toPaise(46),
    cumulativeInterestLost: toPaise(623),
  },
  {
    id: 16,
    date: '2025-09-15',
    amount: toPaise(15000),
    category: 'investment',
    categoryLabel: 'Mutual Fund',
    categoryIcon: '📈',
    destination: 'AMC',
    description: 'Investment marked "mutual fund"',
    daysActive: 418,
    monthlyCost: toPaise(99),
    cumulativeInterestLost: toPaise(1329),
  },
  {
    id: 17,
    date: '2025-10-09',
    amount: toPaise(20000),
    category: 'personal',
    categoryLabel: 'Education',
    categoryIcon: '🎓',
    destination: 'Daycare / School',
    description: 'Fees marked "fee bunnies"',
    daysActive: 394,
    monthlyCost: toPaise(132),
    cumulativeInterestLost: toPaise(1668),
  },
  {
    id: 18,
    date: '2026-02-16',
    amount: toPaise(10000),
    category: 'investment',
    categoryLabel: 'Mutual Fund',
    categoryIcon: '📈',
    destination: 'SBI Mutual Fund',
    description: 'Investment marked "Magnum fund"',
    daysActive: 264,
    monthlyCost: toPaise(66),
    cumulativeInterestLost: toPaise(556),
  },
  {
    id: 19,
    date: '2026-03-07',
    amount: toPaise(42000),
    category: 'bill',
    categoryLabel: 'Bill Payment',
    categoryIcon: '💳',
    destination: 'BillDesk',
    description: 'Online Bill Payment via Net Banking',
    daysActive: 245,
    monthlyCost: toPaise(277),
    cumulativeInterestLost: toPaise(2167),
  },
  {
    id: 20,
    date: '2026-05-14',
    amount: toPaise(25000),
    category: 'transfer',
    categoryLabel: 'OD Borrowing',
    categoryIcon: '🔄',
    destination: 'Personal A/C',
    description: 'Marked "Repay back to OD by 2"',
    daysActive: 177,
    monthlyCost: toPaise(165),
    cumulativeInterestLost: toPaise(934),
  },
  {
    id: 21,
    date: '2026-06-23',
    amount: toPaise(500),
    category: 'transfer',
    categoryLabel: 'Bank Transfer',
    categoryIcon: '🏦',
    destination: 'HDFC Bank xx541',
    description: 'IMPS test to Vikas HDFC account',
    daysActive: 137,
    monthlyCost: toPaise(3),
    cumulativeInterestLost: toPaise(14),
  },
];

export function getOdWithdrawalsSummary(): OdWithdrawalsSummary {
  const records = FORENSIC_OD_WITHDRAWALS;
  const totalWithdrawn = records.reduce((acc, r) => (acc + r.amount) as Paise, paise(0));
  const netWithdrawn = records
    .filter((r) => r.id !== 2)
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

export function simulatePayback(paybackAmountPaise: Paise, currentRateBps: number = 790): PaybackSimulationResult {
  const summary = getOdWithdrawalsSummary();
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

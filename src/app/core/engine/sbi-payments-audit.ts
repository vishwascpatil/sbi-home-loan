import { Paise, toPaise } from './money';

export interface SbiMonthlyPaymentRecord {
  month: string;       // e.g. "Jul 2024"
  period: string;      // "2024-07"
  totalPaid: Paise;    // Total deposited in this month
  emiPaid: Paise;      // Regular bank monthly EMI portion (₹1,18,900)
  prepayPaid: Paise;   // Extra lump-sum prepayment portion
  txCount: number;     // Number of credit transactions in month
  isPeak?: boolean;    // Milestone marker
  note?: string;
}

export interface SbiPaymentsSummary {
  totalPaidSoFar: Paise;
  totalEmiPaid: Paise;
  totalPrepaymentsPaid: Paise;
  totalMonths: number;
  avgMonthlyPaid: Paise;
  highestMonth: { month: string; amount: Paise };
  records: SbiMonthlyPaymentRecord[];
}

export const SBI_30_MONTH_PAYMENTS: SbiMonthlyPaymentRecord[] = [
  { month: 'Jun 2024', period: '2024-06', totalPaid: toPaise(0), emiPaid: toPaise(0), prepayPaid: toPaise(0), txCount: 0, note: 'Loan Disbursed 12-Jun (₹1.33 Cr). EMIs started Jul \'24' },
  { month: 'Jul 2024', period: '2024-07', totalPaid: toPaise(318900), emiPaid: toPaise(118900), prepayPaid: toPaise(200000), txCount: 3, note: '1st EMI + ₹2.0L Prepayment' },
  { month: 'Aug 2024', period: '2024-08', totalPaid: toPaise(218900), emiPaid: toPaise(118900), prepayPaid: toPaise(100000), txCount: 2, note: 'EMI + ₹1.0L Prepayment' },
  { month: 'Sep 2024', period: '2024-09', totalPaid: toPaise(654900), emiPaid: toPaise(118900), prepayPaid: toPaise(536000), txCount: 4, isPeak: true, note: 'All-Time Peak Deposit Month (₹6.55L)' },
  { month: 'Oct 2024', period: '2024-10', totalPaid: toPaise(118900), emiPaid: toPaise(118900), prepayPaid: toPaise(0), txCount: 1, note: 'Regular Bank Monthly EMI' },
  { month: 'Nov 2024', period: '2024-11', totalPaid: toPaise(118900), emiPaid: toPaise(118900), prepayPaid: toPaise(0), txCount: 1, note: 'Regular Bank Monthly EMI' },
  { month: 'Dec 2024', period: '2024-12', totalPaid: toPaise(118900), emiPaid: toPaise(118900), prepayPaid: toPaise(0), txCount: 1, note: 'Regular Bank Monthly EMI' },
  { month: 'Jan 2025', period: '2025-01', totalPaid: toPaise(118900), emiPaid: toPaise(118900), prepayPaid: toPaise(0), txCount: 1, note: 'Regular Bank Monthly EMI' },
  { month: 'Feb 2025', period: '2025-02', totalPaid: toPaise(274900), emiPaid: toPaise(118900), prepayPaid: toPaise(156000), txCount: 2, note: 'EMI + ₹1.56L Prepayment' },
  { month: 'Mar 2025', period: '2025-03', totalPaid: toPaise(154900), emiPaid: toPaise(118900), prepayPaid: toPaise(36000), txCount: 2, note: 'EMI + ₹36K Prepayment' },
  { month: 'Apr 2025', period: '2025-04', totalPaid: toPaise(118900), emiPaid: toPaise(118900), prepayPaid: toPaise(0), txCount: 1, note: 'Regular Bank Monthly EMI' },
  { month: 'May 2025', period: '2025-05', totalPaid: toPaise(118900), emiPaid: toPaise(118900), prepayPaid: toPaise(0), txCount: 1, note: 'Regular Bank Monthly EMI' },
  { month: 'Jun 2025', period: '2025-06', totalPaid: toPaise(118900), emiPaid: toPaise(118900), prepayPaid: toPaise(0), txCount: 1, note: 'Regular Bank Monthly EMI' },
  { month: 'Jul 2025', period: '2025-07', totalPaid: toPaise(118900), emiPaid: toPaise(118900), prepayPaid: toPaise(0), txCount: 1, note: 'Regular Bank Monthly EMI' },
  { month: 'Aug 2025', period: '2025-08', totalPaid: toPaise(118900), emiPaid: toPaise(118900), prepayPaid: toPaise(0), txCount: 1, note: 'Regular Bank Monthly EMI' },
  { month: 'Sep 2025', period: '2025-09', totalPaid: toPaise(192900), emiPaid: toPaise(118900), prepayPaid: toPaise(74000), txCount: 3, note: 'EMI + ₹74K Prepayment' },
  { month: 'Oct 2025', period: '2025-10', totalPaid: toPaise(118900), emiPaid: toPaise(118900), prepayPaid: toPaise(0), txCount: 1, note: 'Regular Bank Monthly EMI' },
  { month: 'Nov 2025', period: '2025-11', totalPaid: toPaise(118900), emiPaid: toPaise(118900), prepayPaid: toPaise(0), txCount: 1, note: 'Regular Bank Monthly EMI' },
  { month: 'Dec 2025', period: '2025-12', totalPaid: toPaise(118900), emiPaid: toPaise(118900), prepayPaid: toPaise(0), txCount: 1, note: 'Regular Bank Monthly EMI' },
  { month: 'Jan 2026', period: '2026-01', totalPaid: toPaise(118900), emiPaid: toPaise(118900), prepayPaid: toPaise(0), txCount: 1, note: 'Regular Bank Monthly EMI' },
  { month: 'Feb 2026', period: '2026-02', totalPaid: toPaise(168900), emiPaid: toPaise(118900), prepayPaid: toPaise(50000), txCount: 2, note: 'EMI + ₹50K Prepayment' },
  { month: 'Mar 2026', period: '2026-03', totalPaid: toPaise(156950), emiPaid: toPaise(118900), prepayPaid: toPaise(38050), txCount: 2, note: 'EMI + ₹38.05K Prepayment' },
  { month: 'Apr 2026', period: '2026-04', totalPaid: toPaise(118900), emiPaid: toPaise(118900), prepayPaid: toPaise(0), txCount: 1, note: 'Regular Bank Monthly EMI' },
  { month: 'May 2026', period: '2026-05', totalPaid: toPaise(118900), emiPaid: toPaise(118900), prepayPaid: toPaise(0), txCount: 1, note: 'Regular Bank Monthly EMI' },
  { month: 'Jun 2026', period: '2026-06', totalPaid: toPaise(181950), emiPaid: toPaise(118900), prepayPaid: toPaise(63050), txCount: 2, note: 'EMI + ₹63.05K Prepayment' },
  { month: 'Jul 2026', period: '2026-07', totalPaid: toPaise(118900), emiPaid: toPaise(118900), prepayPaid: toPaise(0), txCount: 1, note: 'Regular Bank Monthly EMI' },
  { month: 'Aug 2026', period: '2026-08', totalPaid: toPaise(118900), emiPaid: toPaise(118900), prepayPaid: toPaise(0), txCount: 1, note: 'Regular Bank Monthly EMI' },
  { month: 'Sep 2026', period: '2026-09', totalPaid: toPaise(178901), emiPaid: toPaise(118900), prepayPaid: toPaise(60001), txCount: 4, note: 'EMI + ₹60K Prepayment' },
  { month: 'Oct 2026', period: '2026-10', totalPaid: toPaise(178900), emiPaid: toPaise(118900), prepayPaid: toPaise(60000), txCount: 4, note: 'EMI + ₹60K Prepayment' },
  { month: 'Nov 2026', period: '2026-11', totalPaid: toPaise(218900), emiPaid: toPaise(118900), prepayPaid: toPaise(100000), txCount: 3, note: 'EMI + ₹1.0L Prepayment' },
];

export function getSbiPaymentsSummary(): SbiPaymentsSummary {
  const records = SBI_30_MONTH_PAYMENTS;
  const totalPaidSoFar = records.reduce((acc, r) => (acc + r.totalPaid) as Paise, toPaise(0));
  const totalEmiPaid = records.reduce((acc, r) => (acc + r.emiPaid) as Paise, toPaise(0));
  const totalPrepaymentsPaid = records.reduce((acc, r) => (acc + r.prepayPaid) as Paise, toPaise(0));
  const activePaidMonths = records.filter((r) => r.totalPaid > 0).length || 1;
  const avgMonthlyPaid = toPaise(Math.round(totalPaidSoFar / (activePaidMonths * 100)));

  let highest = records[0];
  for (const r of records) {
    if (r.totalPaid > highest.totalPaid) {
      highest = r;
    }
  }

  return {
    totalPaidSoFar,
    totalEmiPaid,
    totalPrepaymentsPaid,
    totalMonths: records.length,
    avgMonthlyPaid,
    highestMonth: {
      month: highest.month,
      amount: highest.totalPaid,
    },
    records,
  };
}


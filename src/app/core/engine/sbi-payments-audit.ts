import { Paise, toPaise } from './money';

export interface SbiMonthlyPaymentRecord {
  id?: string;
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

// Emptied: All authentic records now reside in Cloud Firestore subcollection: /loans/loan-primary/paymentsAudit
export const SBI_30_MONTH_PAYMENTS: SbiMonthlyPaymentRecord[] = [];

export function getSbiPaymentsSummary(sourceRecords?: SbiMonthlyPaymentRecord[]): SbiPaymentsSummary {
  const records = sourceRecords && sourceRecords.length > 0 ? sourceRecords : SBI_30_MONTH_PAYMENTS;
  const totalPaidSoFar = records.reduce((acc, r) => (acc + r.totalPaid) as Paise, toPaise(0));
  const totalEmiPaid = records.reduce((acc, r) => (acc + r.emiPaid) as Paise, toPaise(0));
  const totalPrepaymentsPaid = records.reduce((acc, r) => (acc + r.prepayPaid) as Paise, toPaise(0));
  const activePaidMonths = records.filter((r) => r.totalPaid > 0).length || 1;
  const avgMonthlyPaid = records.length
    ? ((Math.round(totalPaidSoFar / activePaidMonths)) as Paise)
    : toPaise(0);

  let highest = records.length > 0 ? records[0] : { month: '', totalPaid: toPaise(0) };
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

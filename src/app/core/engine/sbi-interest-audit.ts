import { Paise, toPaise } from './money';

export interface SbiMonthlyAuditRecord {
  id?: string;
  month: string; // e.g. "Jun 2024"
  period: string; // "2024-06"
  days: number;
  sbiInterest: Paise;
  avgBalance: Paise;
  effectiveRate: number; // e.g. 8.90
  rateEra: string;
  isVerified: boolean;
  variancePaise: Paise;
}

export interface SbiAuditSummary {
  totalInterestPaid: Paise;
  totalMonths: number;
  avgMonthlyInterest: Paise;
  initialRate: number;
  lowestRate: number;
  currentRate: number;
  records: SbiMonthlyAuditRecord[];
}

// Emptied: All authentic records now reside in Cloud Firestore subcollection: /loans/loan-primary/interestAudit
export const SBI_29_MONTH_AUDIT: SbiMonthlyAuditRecord[] = [];

export function getSbiAuditSummary(sourceRecords?: SbiMonthlyAuditRecord[]): SbiAuditSummary {
  const records = sourceRecords && sourceRecords.length > 0 ? sourceRecords : SBI_29_MONTH_AUDIT;
  const totalInterestPaid = records.reduce((acc, r) => (acc + r.sbiInterest) as Paise, toPaise(0));
  const avgMonthlyInterest = records.length
    ? ((Math.round(totalInterestPaid / records.length)) as Paise)
    : toPaise(0);

  const initialRate = records.length > 0 ? records[0].effectiveRate : 7.90;
  const lowestRate = records.length > 0 ? Math.min(...records.map((r) => r.effectiveRate)) : 7.90;
  const currentRate = records.length > 0 ? records[records.length - 1].effectiveRate : 7.90;

  return {
    totalInterestPaid,
    totalMonths: records.length,
    avgMonthlyInterest,
    initialRate,
    lowestRate,
    currentRate,
    records,
  };
}

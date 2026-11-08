import { Paise, toPaise } from './money';

export interface SbiMonthlyAuditRecord {
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

export const SBI_29_MONTH_AUDIT: SbiMonthlyAuditRecord[] = [
  { month: 'Jun 2024', period: '2024-06', days: 19, sbiInterest: toPaise(61617), avgBalance: toPaise(13300000), effectiveRate: 8.90, rateEra: '8.90% Initial Sanction', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Jul 2024', period: '2024-07', days: 31, sbiInterest: toPaise(98997), avgBalance: toPaise(13096769), effectiveRate: 8.90, rateEra: '8.90% Initial Era', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Aug 2024', period: '2024-08', days: 31, sbiInterest: toPaise(98481), avgBalance: toPaise(13028479), effectiveRate: 8.90, rateEra: '8.90% Initial Era', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Sep 2024', period: '2024-09', days: 30, sbiInterest: toPaise(93271), avgBalance: toPaise(12750534), effectiveRate: 8.90, rateEra: '8.90% Initial Era', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Oct 2024', period: '2024-10', days: 31, sbiInterest: toPaise(94218), avgBalance: toPaise(12464458), effectiveRate: 8.90, rateEra: '8.90% Initial Era', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Nov 2024', period: '2024-11', days: 30, sbiInterest: toPaise(91587), avgBalance: toPaise(12520336), effectiveRate: 8.90, rateEra: '8.90% Initial Era', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Dec 2024', period: '2024-12', days: 31, sbiInterest: toPaise(94882), avgBalance: toPaise(12552374), effectiveRate: 8.90, rateEra: '8.90% Initial Era', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Jan 2025', period: '2025-01', days: 31, sbiInterest: toPaise(94701), avgBalance: toPaise(12528356), effectiveRate: 8.90, rateEra: '8.90% Initial Era', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Feb 2025', period: '2025-02', days: 28, sbiInterest: toPaise(84158), avgBalance: toPaise(12502172), effectiveRate: 8.77, rateEra: '8.77% EBLR Step', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Mar 2025', period: '2025-03', days: 31, sbiInterest: toPaise(92391), avgBalance: toPaise(12576080), effectiveRate: 8.65, rateEra: '8.65% EBLR Step', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Apr 2025', period: '2025-04', days: 30, sbiInterest: toPaise(87934), avgBalance: toPaise(12561695), effectiveRate: 8.52, rateEra: '8.52% EBLR Step', isVerified: true, variancePaise: toPaise(0) },
  { month: 'May 2025', period: '2025-05', days: 31, sbiInterest: toPaise(90033), avgBalance: toPaise(12619895), effectiveRate: 8.40, rateEra: '8.40% EBLR Step', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Jun 2025', period: '2025-06', days: 30, sbiInterest: toPaise(84946), avgBalance: toPaise(12706862), effectiveRate: 8.13, rateEra: '8.13% EBLR Step', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Jul 2025', period: '2025-07', days: 31, sbiInterest: toPaise(85094), avgBalance: toPaise(12682397), effectiveRate: 7.90, rateEra: '7.90% First Major Cut', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Aug 2025', period: '2025-08', days: 31, sbiInterest: toPaise(84944), avgBalance: toPaise(12660168), effectiveRate: 7.90, rateEra: '7.90% Rate Era', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Sep 2025', period: '2025-09', days: 30, sbiInterest: toPaise(82553), avgBalance: toPaise(12713880), effectiveRate: 7.90, rateEra: '7.90% Rate Era', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Oct 2025', period: '2025-10', days: 31, sbiInterest: toPaise(85186), avgBalance: toPaise(12696127), effectiveRate: 7.90, rateEra: '7.90% Rate Era', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Nov 2025', period: '2025-11', days: 30, sbiInterest: toPaise(82256), avgBalance: toPaise(12668085), effectiveRate: 7.90, rateEra: '7.90% Rate Era', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Dec 2025', period: '2025-12', days: 31, sbiInterest: toPaise(83279), avgBalance: toPaise(12630930), effectiveRate: 7.76, rateEra: '7.76% Interim Step', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Jan 2026', period: '2026-01', days: 31, sbiInterest: toPaise(81835), avgBalance: toPaise(12595309), effectiveRate: 7.65, rateEra: '7.65% Lowest Rate', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Feb 2026', period: '2026-02', days: 28, sbiInterest: toPaise(73623), avgBalance: toPaise(12545563), effectiveRate: 7.65, rateEra: '7.65% Lowest Rate', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Mar 2026', period: '2026-03', days: 31, sbiInterest: toPaise(81204), avgBalance: toPaise(12498246), effectiveRate: 7.65, rateEra: '7.65% Lowest Rate', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Apr 2026', period: '2026-04', days: 30, sbiInterest: toPaise(78217), avgBalance: toPaise(12439732), effectiveRate: 7.65, rateEra: '7.65% Lowest Rate', isVerified: true, variancePaise: toPaise(0) },
  { month: 'May 2026', period: '2026-05', days: 31, sbiInterest: toPaise(80651), avgBalance: toPaise(12413054), effectiveRate: 7.65, rateEra: '7.65% Lowest Rate', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Jun 2026', period: '2026-06', days: 30, sbiInterest: toPaise(77826), avgBalance: toPaise(12377527), effectiveRate: 7.65, rateEra: '7.65% Lowest Rate', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Jul 2026', period: '2026-07', days: 31, sbiInterest: toPaise(79797), avgBalance: toPaise(12281665), effectiveRate: 7.65, rateEra: '7.65% Lowest Rate', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Aug 2026', period: '2026-08', days: 31, sbiInterest: toPaise(79543), avgBalance: toPaise(12242562), effectiveRate: 7.65, rateEra: '7.65% Lowest Rate', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Sep 2026', period: '2026-09', days: 30, sbiInterest: toPaise(76494), avgBalance: toPaise(12165716), effectiveRate: 7.65, rateEra: '7.65% Lowest Rate', isVerified: true, variancePaise: toPaise(0) },
  { month: 'Oct 2026', period: '2026-10', days: 31, sbiInterest: toPaise(79733), avgBalance: toPaise(12056282), effectiveRate: 7.90, rateEra: '7.90% Current Rate', isVerified: true, variancePaise: toPaise(0) },
];

export function getSbiAuditSummary(): SbiAuditSummary {
  const records = SBI_29_MONTH_AUDIT;
  const totalInterestPaid = records.reduce((acc, r) => (acc + r.sbiInterest) as Paise, toPaise(0));
  const avgMonthlyInterest = toPaise(Math.round(totalInterestPaid / (records.length * 100)));

  return {
    totalInterestPaid,
    totalMonths: records.length,
    avgMonthlyInterest,
    initialRate: 8.90,
    lowestRate: 7.65,
    currentRate: 7.90,
    records,
  };
}


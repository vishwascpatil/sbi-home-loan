import { LedgerState } from './models';
import { Paise, paise } from './money';
import { monthlySummary } from './ledger';

export interface RupeeSplit {
  totalPaidToBank: Paise;
  totalInterestPaid: Paise;
  totalPrincipalReduced: Paise;
  interestPercent: number;
  principalPercent: number;
}

export interface MemberConsistencyMetric {
  memberId: string;
  name: string;
  avatarColor: string;
  totalContributed: Paise;
  targetAdherencePercent: number;
  onTimePercent: number;
  currentStreakMonths: number;
}

export interface AmortizationPoint {
  period: string; // YYYY-MM
  label: string; // e.g. "Jun 24"
  cumulativeInterest: Paise;
  cumulativePrincipal: Paise;
  closingOutstanding: Paise;
}

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  amount: Paise;
  level: 0 | 1 | 2 | 3 | 4; // 0: none, 1: light, 2: med, 3: strong, 4: max
}

export interface HeatmapMonthGroup {
  monthName: string;
  days: HeatmapDay[];
}

/**
 * Computes Where Each Rupee Went breakdown of bank payments.
 */
export function computeRupeeSplit(ledger: LedgerState): RupeeSplit {
  let totalPaidToBank = paise(0);
  let totalInterestPaid = paise(0);
  let totalPrincipalReduced = paise(0);

  for (const tx of ledger.transactions) {
    if (!tx.deletedAt && tx.type === 'bankPayment') {
      totalPaidToBank = paise(totalPaidToBank + tx.amount);
      totalInterestPaid = paise(totalInterestPaid + tx.interestPortion);
      totalPrincipalReduced = paise(totalPrincipalReduced + tx.principalPortion);
    }
  }

  const interestPercent = totalPaidToBank > 0 ? (totalInterestPaid / totalPaidToBank) * 100 : 0;
  const principalPercent = totalPaidToBank > 0 ? (totalPrincipalReduced / totalPaidToBank) * 100 : 0;

  return {
    totalPaidToBank,
    totalInterestPaid,
    totalPrincipalReduced,
    interestPercent,
    principalPercent,
  };
}

/**
 * Computes consistency scores and streaks for each active member.
 */
export function computeMemberConsistencyScores(ledger: LedgerState): MemberConsistencyMetric[] {
  const activeMembers = ledger.members.filter((m) => m.active && !m.deletedAt);
  const activeTx = ledger.transactions.filter((tx) => !tx.deletedAt && tx.type === 'contribution');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Track past 6 calendar months
  const recentMonths: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - 1 - i, 1);
    recentMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  return activeMembers.map((m, idx) => {
    const memberTx = activeTx.filter((t) => t.type === 'contribution' && t.memberId === m.id);
    let totalContributed = paise(0);
    let onTimeCount = 0;

    for (const tx of memberTx) {
      if (tx.type === 'contribution') {
        totalContributed = paise(totalContributed + tx.amount);
        const day = parseInt(tx.date.slice(8, 10), 10);
        if (day <= 10) {
          onTimeCount++;
        }
      }
    }

    const onTimePercent = memberTx.length > 0 ? Math.round((onTimeCount / memberTx.length) * 100) : 100;
    const monthlyTarget = m.target || paise(4000000);
    const expectedTotal = monthlyTarget * recentMonths.length;
    const targetAdherencePercent = expectedTotal > 0 ? Math.min(100, Math.round((totalContributed / expectedTotal) * 100)) : 100;

    // Calculate active streak
    let streak = 0;
    for (let i = recentMonths.length - 1; i >= 0; i--) {
      const month = recentMonths[i];
      const hasContributed = memberTx.some((t) => t.date.startsWith(month));
      if (hasContributed) {
        streak++;
      } else {
        break;
      }
    }

    return {
      memberId: m.id,
      name: m.name,
      avatarColor: idx.toString(),
      totalContributed,
      targetAdherencePercent,
      onTimePercent,
      currentStreakMonths: streak,
    };
  });
}

/**
 * Computes chronological amortization progression for stacked area charts.
 */
export function computeAmortizationHistory(ledger: LedgerState): AmortizationPoint[] {
  const points: AmortizationPoint[] = [];
  const startPeriod = ledger.loan.openingDate.slice(0, 7);
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [startYear, startMonth] = startPeriod.split('-').map(Number);
  const [endYear, endMonth] = currentPeriod.split('-').map(Number);

  let cumInterest = paise(0);
  let cumPrincipal = paise(0);

  let curY = startYear;
  let curM = startMonth;

  while (curY < endYear || (curY === endYear && curM <= endMonth)) {
    const period = `${curY}-${String(curM).padStart(2, '0')}`;
    const summary = monthlySummary(period, ledger);

    cumInterest = paise(cumInterest + summary.interestIncurredEst);
    cumPrincipal = paise(cumPrincipal + summary.principalReduced);

    const d = new Date(curY, curM - 1, 1);
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

    points.push({
      period,
      label,
      cumulativeInterest: cumInterest,
      cumulativePrincipal: cumPrincipal,
      closingOutstanding: summary.closingOutstanding,
    });

    curM++;
    if (curM > 12) {
      curM = 1;
      curY++;
    }
  }

  return points;
}

/**
 * Computes daily contribution heatmap data for past 12 months.
 */
export function computeContributionHeatmap(ledger: LedgerState): HeatmapDay[] {
  const now = new Date();
  const days: HeatmapDay[] = [];
  const contributionMap = new Map<string, Paise>();

  for (const tx of ledger.transactions) {
    if (!tx.deletedAt && tx.type === 'contribution') {
      const current = contributionMap.get(tx.date) || paise(0);
      contributionMap.set(tx.date, paise(current + tx.amount));
    }
  }

  // Generate past 365 days
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const amount = contributionMap.get(dateStr) || paise(0);

    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (amount > 0) {
      if (amount < 2500000) level = 1; // < 25k
      else if (amount < 5000000) level = 2; // < 50k
      else if (amount < 10000000) level = 3; // < 1L
      else level = 4; // >= 1L
    }

    days.push({ date: dateStr, amount, level });
  }

  return days;
}

import {
  BankPaymentTransaction,
  ContributionTransaction,
  LedgerState,
  Transaction,
} from './models';
import { formatPaise, Paise, paise } from './money';

export type NotificationType =
  | 'contributionReminder'
  | 'paymentDue'
  | 'rateChange'
  | 'limitExpiry'
  | 'monthCloseReady'
  | 'unusualDuplicate'
  | 'unusualAmount'
  | 'unusualDeviation'
  | 'reconciliationVariance';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'alert';
  timestamp: string;
  read?: boolean;
  actionRoute?: string;
  entityId?: string;
}

export interface NotificationPreferences {
  enableContributionReminders: boolean;
  enablePaymentDue: boolean;
  enableRateChanges: boolean;
  enableLimitExpiry: boolean;
  enableMonthClose: boolean;
  enableAnomalyAlerts: boolean;
  quietHoursStart?: string; // "22:00"
  quietHoursEnd?: string; // "08:00"
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  enableContributionReminders: true,
  enablePaymentDue: true,
  enableRateChanges: true,
  enableLimitExpiry: true,
  enableMonthClose: true,
  enableAnomalyAlerts: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
};

/**
 * Pure generator that computes all active notifications and anomaly alerts
 * by scanning the ledger state.
 */
export function generateLedgerNotifications(
  ledger: LedgerState,
  prefs: NotificationPreferences = DEFAULT_NOTIFICATION_PREFS,
  currentDateIso: string = new Date().toISOString()
): AppNotification[] {
  const notifications: AppNotification[] = [];
  const today = currentDateIso.slice(0, 10);
  const currentMonth = currentDateIso.slice(0, 7);

  // 1. Limit Expiry Check (PRD §16, tenure warnings at 90, 30, 7 days)
  if (prefs.enableLimitExpiry && ledger.loan.maturityDate) {
    const maturity = new Date(ledger.loan.maturityDate).getTime();
    const now = new Date(today).getTime();
    const diffDays = Math.ceil((maturity - now) / (1000 * 60 * 60 * 24));

    if (diffDays <= 7 && diffDays >= 0) {
      notifications.push({
        id: `limit-expiry-7d-${ledger.loan.maturityDate}`,
        type: 'limitExpiry',
        title: '⚠️ Urgent: Sanction Limit Expiry in 7 Days',
        message: `Your home loan OD tenure expires on ${ledger.loan.maturityDate} (${diffDays} days left). Contact your bank for renewal.`,
        severity: 'alert',
        timestamp: currentDateIso,
        actionRoute: '/settings',
      });
    } else if (diffDays <= 30 && diffDays > 7) {
      notifications.push({
        id: `limit-expiry-30d-${ledger.loan.maturityDate}`,
        type: 'limitExpiry',
        title: 'Limit Expiry in 30 Days',
        message: `Your home loan OD tenure ends on ${ledger.loan.maturityDate}. Prepare renewal documents.`,
        severity: 'warning',
        timestamp: currentDateIso,
        actionRoute: '/settings',
      });
    } else if (diffDays <= 90 && diffDays > 30) {
      notifications.push({
        id: `limit-expiry-90d-${ledger.loan.maturityDate}`,
        type: 'limitExpiry',
        title: 'Tenure Expiry Notice (90 Days)',
        message: `Loan tenure renewal due in ${diffDays} days (${ledger.loan.maturityDate}).`,
        severity: 'info',
        timestamp: currentDateIso,
        actionRoute: '/settings',
      });
    }
  }

  // 2. Month Close Ready Notification
  if (prefs.enableMonthClose) {
    const [year, month] = currentMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    if (!ledger.loan.lockedUntilPeriod || ledger.loan.lockedUntilPeriod < prevMonth) {
      notifications.push({
        id: `month-close-${prevMonth}`,
        type: 'monthCloseReady',
        title: 'Month Close Ready',
        message: `Month ${prevMonth} is complete. Run reconciliation and close the period to freeze calculations.`,
        severity: 'info',
        timestamp: currentDateIso,
        actionRoute: '/settings',
      });
    }
  }

  // 3. Payment Due Alert
  if (prefs.enablePaymentDue) {
    const thisMonthPayments = ledger.transactions
      .filter((tx): tx is Transaction & { amount: Paise } => !tx.deletedAt && tx.type === 'bankPayment' && tx.date.startsWith(currentMonth))
      .reduce((sum, tx) => (sum + tx.amount) as Paise, paise(0));

    if (thisMonthPayments < ledger.loan.monthlyTarget) {
      const remaining = paise(ledger.loan.monthlyTarget - thisMonthPayments);
      const dayOfMonth = parseInt(today.slice(8, 10), 10);
      if (dayOfMonth >= 1 && dayOfMonth <= 10) {
        notifications.push({
          id: `payment-due-${currentMonth}`,
          type: 'paymentDue',
          title: 'Bank EMI Target Due',
          message: `${formatPaise(remaining)} remaining to meet monthly target of ${formatPaise(ledger.loan.monthlyTarget)} for ${currentMonth}.`,
          severity: 'info',
          timestamp: currentDateIso,
          actionRoute: '/home',
        });
      }
    }
  }

  // 4. Rate Change Alerts
  if (prefs.enableRateChanges && ledger.rateChanges.length > 0) {
    const latestRate = ledger.rateChanges[0];
    const rateAgeDays = Math.ceil(
      (new Date(today).getTime() - new Date(latestRate.effectiveFrom).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (rateAgeDays <= 14 && rateAgeDays >= 0) {
      notifications.push({
        id: `rate-change-${latestRate.id}`,
        type: 'rateChange',
        title: 'Interest Rate Updated',
        message: `Interest rate adjusted to ${(latestRate.rateBps / 100).toFixed(2)}% p.a. effective from ${latestRate.effectiveFrom}.`,
        severity: 'info',
        timestamp: latestRate.createdAt,
        actionRoute: '/insights',
      });
    }
  }

  // 5. Anomaly Detection Alerts
  if (prefs.enableAnomalyAlerts) {
    const anomalyAlerts = detectLedgerAnomalies(ledger, currentDateIso);
    notifications.push(...anomalyAlerts);
  }

  return notifications;
}

/**
 * Detects unusual transactions:
 * - Duplicate transactions within 24 hours
 * - Outlier amount exceeding 3x member median contribution
 * - Bank payment deviating > 10% from target
 * - Reconciliation variance exceeding ₹1,000
 */
export function detectLedgerAnomalies(ledger: LedgerState, currentDateIso: string): AppNotification[] {
  const anomalies: AppNotification[] = [];
  const activeTx = ledger.transactions.filter((tx) => !tx.deletedAt);

  // A. Duplicate detection (same date, amount, type within 24 hours)
  for (let i = 0; i < activeTx.length; i++) {
    for (let j = i + 1; j < activeTx.length; j++) {
      const a = activeTx[i];
      const b = activeTx[j];

      if (a.date === b.date && a.type === b.type && 'amount' in a && 'amount' in b && a.amount === b.amount) {
        const timeDiffMs = Math.abs(new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        if (timeDiffMs <= 24 * 60 * 60 * 1000) {
          anomalies.push({
            id: `anomaly-duplicate-${a.id}-${b.id}`,
            type: 'unusualDuplicate',
            title: '⚠️ Potential Duplicate Entry',
            message: `Two identical ${a.type} transactions of ${formatPaise(a.amount)} were recorded on ${a.date}. Please verify.`,
            severity: 'alert',
            timestamp: currentDateIso,
            actionRoute: '/history',
            entityId: a.id,
          });
          break;
        }
      }
    }
  }

  // B. Member contribution > 3x median
  const memberContributionsMap = new Map<string, number[]>();
  for (const tx of activeTx) {
    if (tx.type === 'contribution') {
      const list = memberContributionsMap.get(tx.memberId) || [];
      list.push(tx.amount);
      memberContributionsMap.set(tx.memberId, list);
    }
  }

  for (const [memberId, amounts] of memberContributionsMap.entries()) {
    if (amounts.length >= 3) {
      const sorted = [...amounts].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const member = ledger.members.find((m) => m.id === memberId);
      const memberName = member?.name || 'Member';

      // Check most recent contribution for this member
      const latestMemberTx = activeTx.find((tx): tx is ContributionTransaction => tx.type === 'contribution' && tx.memberId === memberId);
      if (latestMemberTx && latestMemberTx.amount > median * 3) {
        anomalies.push({
          id: `anomaly-amount-${latestMemberTx.id}`,
          type: 'unusualAmount',
          title: 'Unusually High Contribution',
          message: `${memberName} contributed ${formatPaise(latestMemberTx.amount)}, which is more than 3× their median contribution (${formatPaise(paise(median))}).`,
          severity: 'warning',
          timestamp: latestMemberTx.createdAt,
          actionRoute: '/history',
          entityId: latestMemberTx.id,
        });
      }
    }
  }

  // C. Bank payment deviating > 10% from target
  const target = ledger.loan.monthlyTarget;
  const recentPayments = activeTx.filter((tx): tx is BankPaymentTransaction => tx.type === 'bankPayment').slice(0, 3);
  for (const p of recentPayments) {
    const deviationPercent = Math.abs((p.amount - target) / target) * 100;
    if (deviationPercent > 10 && deviationPercent < 200) {
      anomalies.push({
        id: `anomaly-deviation-${p.id}`,
        type: 'unusualDeviation',
        title: 'Payment Deviation from Target',
        message: `Bank payment of ${formatPaise(p.amount)} on ${p.date} deviates by ${deviationPercent.toFixed(1)}% from monthly target of ${formatPaise(target)}.`,
        severity: 'info',
        timestamp: p.createdAt,
        actionRoute: '/history',
        entityId: p.id,
      });
      break;
    }
  }

  // D. Reconciliation variance > ₹1,000 (100,000 paise)
  if (ledger.snapshots.length > 0) {
    const latestSnapshot = ledger.snapshots[0];
    if (Math.abs(latestSnapshot.variance) > 100000) {
      anomalies.push({
        id: `anomaly-variance-${latestSnapshot.id}`,
        type: 'reconciliationVariance',
        title: '⚠️ Significant Bank Variance',
        message: `Unresolved variance of ${formatPaise(latestSnapshot.variance)} recorded on ${latestSnapshot.date}. Bank ledger check recommended.`,
        severity: 'alert',
        timestamp: latestSnapshot.createdAt,
        actionRoute: '/settings',
        entityId: latestSnapshot.id,
      });
    }
  }

  return anomalies;
}

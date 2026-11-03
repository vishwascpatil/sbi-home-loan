import { LedgerState, toRupees } from '../engine';

/**
 * Escapes a single CSV value in compliance with RFC 4180.
 */
function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) {
    return '""';
  }
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Serializes all ledger transactions and events into an RFC 4180 CSV with UTF-8 BOM.
 */
export function generateLedgerCsv(ledger: LedgerState): string {
  const memberMap = new Map(ledger.members.map((m) => [m.id, m.name]));

  const headers = [
    'Date',
    'For Month',
    'Transaction Type',
    'Member Name',
    'Amount (₹)',
    'Interest Portion (₹)',
    'Principal Portion (₹)',
    'Payment Mode',
    'Reference',
    'Notes',
  ];

  const rows: string[][] = [headers];

  const sortedTransactions = [...ledger.transactions]
    .filter((tx) => !tx.deletedAt)
    .sort((a, b) => b.date.localeCompare(a.date));

  for (const tx of sortedTransactions) {
    let typeLabel = '';
    let memberName = '';
    let amountStr = '';
    let interestStr = '';
    let principalStr = '';
    let modeStr = '';
    let refStr = '';
    let notesStr = '';

    switch (tx.type) {
      case 'contribution':
        typeLabel = 'Contribution';
        memberName = memberMap.get(tx.memberId) || 'Unknown';
        amountStr = toRupees(tx.amount).toFixed(2);
        modeStr = tx.mode;
        refStr = tx.reference || '';
        notesStr = tx.notes || '';
        break;

      case 'bankPayment':
        typeLabel = 'Bank Payment';
        amountStr = toRupees(tx.amount).toFixed(2);
        interestStr = toRupees(tx.interestPortion).toFixed(2);
        principalStr = toRupees(tx.principalPortion).toFixed(2);
        modeStr = tx.mode;
        refStr = tx.reference || '';
        notesStr = tx.notes || '';
        break;

      case 'withdrawal':
        typeLabel = 'Withdrawal';
        memberName = tx.memberId ? memberMap.get(tx.memberId) || '' : '';
        amountStr = toRupees(tx.amount).toFixed(2);
        modeStr = tx.mode;
        refStr = tx.reference || '';
        notesStr = tx.notes || '';
        break;

      case 'interestCharge':
        typeLabel = 'Interest Charge';
        interestStr = toRupees(tx.amount).toFixed(2);
        notesStr = tx.notes || '';
        break;

      case 'principalAdjustment':
        typeLabel = 'Principal Adjustment';
        amountStr = toRupees(tx.amount).toFixed(2);
        notesStr = tx.reason;
        break;

      case 'manualCorrection':
        typeLabel = 'Manual Balance Correction';
        amountStr = toRupees(tx.newOutstanding).toFixed(2);
        notesStr = `Reconciled from ${toRupees(tx.previousOutstanding).toFixed(2)}. ${tx.reason}`;
        break;
    }

    rows.push([
      tx.date,
      tx.forMonth,
      typeLabel,
      memberName,
      amountStr,
      interestStr,
      principalStr,
      modeStr,
      refStr,
      notesStr,
    ]);
  }

  const csvContent = rows
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(','))
    .join('\r\n');

  // Prepend UTF-8 Byte Order Mark (BOM)
  return `\uFEFF${csvContent}`;
}

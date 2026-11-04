import {
  ImportMappingProfile,
  ImportMatchStatus,
  LedgerState,
  ParsedStatementRow,
  Transaction,
} from './models';
import { Paise, paise } from './money';

export const DEFAULT_BANK_PROFILES: ImportMappingProfile[] = [
  {
    id: 'sbi-maxgain',
    name: 'SBI Maxgain Home Loan OD',
    dateColumn: 'Txn Date',
    descriptionColumn: 'Description',
    referenceColumn: 'Ref No./Cheque No.',
    debitColumn: 'Debit',
    creditColumn: 'Credit',
    balanceColumn: 'Balance',
    dateFormat: 'DD/MM/YYYY',
  },
  {
    id: 'hdfc-bank',
    name: 'HDFC Bank',
    dateColumn: 'Date',
    descriptionColumn: 'Narration',
    referenceColumn: 'Chq./Ref.No.',
    debitColumn: 'Withdrawal Amt.',
    creditColumn: 'Deposit Amt.',
    balanceColumn: 'Closing Balance',
    dateFormat: 'DD/MM/YYYY',
  },
  {
    id: 'icici-bank',
    name: 'ICICI Bank',
    dateColumn: 'Transaction Date',
    descriptionColumn: 'Transaction Remarks',
    referenceColumn: 'Cheque Number',
    debitColumn: 'Withdrawal Amount (INR )',
    creditColumn: 'Deposit Amount (INR )',
    balanceColumn: 'Balance (INR )',
    dateFormat: 'DD/MM/YYYY',
  },
  {
    id: 'generic-csv',
    name: 'Generic Bank CSV',
    dateColumn: 'Date',
    descriptionColumn: 'Particulars',
    referenceColumn: 'Reference',
    debitColumn: 'Debit',
    creditColumn: 'Credit',
    balanceColumn: 'Balance',
    dateFormat: 'DD/MM/YYYY',
  },
];

/**
 * Parses raw CSV string into an array of records (header -> value map).
 * Handles quoted fields with internal commas and newlines.
 */
export function parseCsvToRecords(csvText: string): Record<string, string>[] {
  const lines: string[] = [];
  let currentLine = '';
  let insideQuote = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      insideQuote = !insideQuote;
      currentLine += char;
    } else if ((char === '\n' || (char === '\r' && csvText[i + 1] === '\n')) && !insideQuote) {
      if (char === '\r') i++; // Skip \n
      lines.push(currentLine.trim());
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim().length > 0) {
    lines.push(currentLine.trim());
  }

  // Find header row: the first line with multiple commas
  let headerIndex = -1;
  for (let idx = 0; idx < lines.length; idx++) {
    if (lines[idx].includes(',')) {
      headerIndex = idx;
      break;
    }
  }

  if (headerIndex === -1 || headerIndex >= lines.length - 1) {
    return [];
  }

  const rawHeaders = splitCsvRow(lines[headerIndex]).map((h) => h.trim().replace(/^"|"$/g, ''));
  const records: Record<string, string>[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const values = splitCsvRow(line).map((v) => v.trim().replace(/^"|"$/g, ''));
    if (values.every((v) => v === '')) continue;

    const row: Record<string, string> = {};
    for (let colIdx = 0; colIdx < rawHeaders.length; colIdx++) {
      const header = rawHeaders[colIdx];
      row[header] = values[colIdx] ?? '';
    }
    records.push(row);
  }

  return records;
}

function splitCsvRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Standardizes common date representations to YYYY-MM-DD.
 */
export function normalizeDateToIso(rawDate: string): string {
  const cleaned = rawDate.trim().replace(/['"]/g, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  // Matches DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Matches DD-MMM-YYYY (e.g. 15-Jun-2024 or 15/Jun/2024)
  const dMmmYMatch = cleaned.match(/^(\d{1,2})[/-]([A-Za-z]{3})[/-](\d{4})$/);
  if (dMmmYMatch) {
    const day = dMmmYMatch[1].padStart(2, '0');
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthIndex = monthNames.indexOf(dMmmYMatch[2].toLowerCase());
    if (monthIndex >= 0) {
      const month = String(monthIndex + 1).padStart(2, '0');
      const year = dMmmYMatch[3];
      return `${year}-${month}-${day}`;
    }
  }

  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return cleaned;
}

/**
 * Converts currency text (with commas, rupee symbol, spaces) to integer Paise.
 */
export function parseCurrencyToPaise(val: string): Paise {
  if (!val) return paise(0);
  const sanitized = val.replace(/[₹$,\s]/g, '');
  if (!sanitized || sanitized === '-' || isNaN(Number(sanitized))) {
    return paise(0);
  }
  const parts = sanitized.split('.');
  const whole = parseInt(parts[0], 10) || 0;
  const fractionStr = (parts[1] || '').padEnd(2, '0').slice(0, 2);
  const fraction = parseInt(fractionStr, 10) || 0;

  const totalPaise = whole * 100 + (whole >= 0 ? fraction : -fraction);
  return paise(Math.max(0, totalPaise));
}

/**
 * Maps raw records to structured ParsedStatementRows and runs auto-deduplication against ledger.
 */
export function mapAndMatchStatementRows(
  records: Record<string, string>[],
  profile: ImportMappingProfile,
  ledger: LedgerState
): ParsedStatementRow[] {
  const existingTx = ledger.transactions.filter((tx) => !tx.deletedAt);
  const rows: ParsedStatementRow[] = [];

  for (const rec of records) {
    const dateRaw = rec[profile.dateColumn] || '';
    const date = normalizeDateToIso(dateRaw);
    const description = (rec[profile.descriptionColumn] || '').trim();
    const reference = profile.referenceColumn ? (rec[profile.referenceColumn] || '').trim() : undefined;
    const debitPaise = profile.debitColumn ? parseCurrencyToPaise(rec[profile.debitColumn]) : paise(0);
    const creditPaise = profile.creditColumn ? parseCurrencyToPaise(rec[profile.creditColumn]) : paise(0);
    const balancePaise = profile.balanceColumn ? parseCurrencyToPaise(rec[profile.balanceColumn]) : undefined;

    // Skip blank rows where both debit and credit are 0
    if (debitPaise === 0 && creditPaise === 0) {
      continue;
    }

    // Run matching against existing ledger
    const match = findLedgerMatch(date, debitPaise, creditPaise, reference, existingTx);

    // Initial default action
    let defaultAction: ParsedStatementRow['action'] = 'skip';
    if (match.status === 'unmatched') {
      defaultAction = creditPaise > 0 ? 'bankPayment' : 'withdrawal';
    }

    rows.push({
      tempId: crypto.randomUUID(),
      date,
      description,
      reference,
      debitPaise,
      creditPaise,
      balancePaise,
      matchStatus: match.status,
      matchedTransactionId: match.matchedTxId,
      matchReason: match.reason,
      action: defaultAction,
    });
  }

  return rows;
}

function findLedgerMatch(
  date: string,
  debitPaise: Paise,
  creditPaise: Paise,
  reference: string | undefined,
  existingTransactions: Transaction[]
): { status: ImportMatchStatus; matchedTxId?: string; reason?: string } {
  const targetAmount = creditPaise > 0 ? creditPaise : debitPaise;

  for (const tx of existingTransactions) {
    let txAmount = paise(0);
    if ('amount' in tx) {
      txAmount = tx.amount;
    }

    const txDate = tx.date;
    const txRef = 'reference' in tx ? (tx.reference || '') : '';
    const isSameDate = txDate === date;
    const isSameAmount = txAmount === targetAmount;
    const isSameRef = Boolean(reference && txRef && reference.trim() === txRef.trim());

    // 1. Exact match: same date, amount, and reference
    if (isSameDate && isSameAmount && isSameRef) {
      return {
        status: 'matched',
        matchedTxId: tx.id,
        reason: `Exact match (Date, Amount, Ref: ${reference})`,
      };
    }

    // 2. Exact date & amount
    if (isSameDate && isSameAmount) {
      return {
        status: 'matched',
        matchedTxId: tx.id,
        reason: `Exact match on date and amount (Tx: ${tx.id.slice(0, 8)})`,
      };
    }

    // 3. Probable match: close date (within 3 days) and exact amount OR exact date and within ₹1 (100 paise)
    const dayDiff = Math.abs(
      (new Date(date).getTime() - new Date(txDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const amountDiff = Math.abs(txAmount - targetAmount);

    if (dayDiff <= 3 && amountDiff === 0) {
      return {
        status: 'probable',
        matchedTxId: tx.id,
        reason: `Probable match: identical amount ₹${(targetAmount / 100).toFixed(2)}, date shifted by ${Math.round(dayDiff)} day(s)`,
      };
    }

    if (isSameDate && amountDiff <= 100) {
      return {
        status: 'probable',
        matchedTxId: tx.id,
        reason: `Probable match: same date, amount difference within ₹1`,
      };
    }
  }

  return { status: 'unmatched' };
}

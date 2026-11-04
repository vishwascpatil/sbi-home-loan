import { LedgerState } from './models';

export interface BackupDiffSummary {
  schemaVersion: number;
  loanName: string;
  accountNumber: string;
  currentCounts: {
    transactions: number;
    members: number;
    snapshots: number;
    rateChanges: number;
    interestEntries: number;
    statements: number;
    auditLog: number;
  };
  incomingCounts: {
    transactions: number;
    members: number;
    snapshots: number;
    rateChanges: number;
    interestEntries: number;
    statements: number;
    auditLog: number;
  };
  newTransactionsCount: number;
  isValid: boolean;
  validationErrors: string[];
  parsedState?: LedgerState;
}

/**
 * Parses and runs a dry-run validation diff of an incoming backup JSON against current state.
 */
export function inspectBackupDiff(jsonString: string, current: LedgerState): BackupDiffSummary {
  const errors: string[] = [];
  let parsedRaw: unknown;

  try {
    parsedRaw = JSON.parse(jsonString);
  } catch {
    return {
      schemaVersion: 0,
      loanName: 'Unknown',
      accountNumber: 'Unknown',
      currentCounts: getCounts(current),
      incomingCounts: getEmptyCounts(),
      newTransactionsCount: 0,
      isValid: false,
      validationErrors: ['File is not valid JSON syntax.'],
    };
  }

  if (!parsedRaw || typeof parsedRaw !== 'object') {
    return {
      schemaVersion: 0,
      loanName: 'Unknown',
      accountNumber: 'Unknown',
      currentCounts: getCounts(current),
      incomingCounts: getEmptyCounts(),
      newTransactionsCount: 0,
      isValid: false,
      validationErrors: ['Backup root is not a valid JSON object.'],
    };
  }

  // Extract envelope or direct LedgerState
  let incomingState: LedgerState | null = null;
  let schemaVersion = 1;

  if ('version' in parsedRaw && 'data' in parsedRaw && typeof (parsedRaw as { data: unknown }).data === 'object') {
    schemaVersion = Number((parsedRaw as { version: unknown }).version) || 1;
    incomingState = (parsedRaw as { data: LedgerState }).data;
  } else if ('loan' in parsedRaw && 'members' in parsedRaw) {
    incomingState = parsedRaw as LedgerState;
  }

  if (!incomingState) {
    return {
      schemaVersion,
      loanName: 'Unknown',
      accountNumber: 'Unknown',
      currentCounts: getCounts(current),
      incomingCounts: getEmptyCounts(),
      newTransactionsCount: 0,
      isValid: false,
      validationErrors: ['Unrecognized backup format. Missing standard ledger payload.'],
    };
  }

  // Validation rules
  if (!incomingState.loan || typeof incomingState.loan !== 'object') {
    errors.push('Missing loan profile settings.');
  }
  if (!Array.isArray(incomingState.members) || incomingState.members.length === 0) {
    errors.push('Backup must contain at least one loan member.');
  }
  if (!Array.isArray(incomingState.transactions)) {
    errors.push('Missing transactions collection.');
  }

  // Check transaction amounts integrity
  if (Array.isArray(incomingState.transactions)) {
    for (let i = 0; i < Math.min(incomingState.transactions.length, 100); i++) {
      const tx = incomingState.transactions[i];
      if ('amount' in tx && (typeof tx.amount !== 'number' || !Number.isInteger(tx.amount) || tx.amount < 0)) {
        errors.push(`Transaction at index ${i} has invalid non-integer paise amount: ${tx.amount}`);
        break;
      }
    }
  }

  const incomingCounts = getCounts(incomingState);
  const currentCounts = getCounts(current);

  // Compute new transactions count
  const currentTxIds = new Set(current.transactions.map((t) => t.id));
  const newTransactionsCount = incomingState.transactions
    ? incomingState.transactions.filter((t) => !currentTxIds.has(t.id)).length
    : 0;

  return {
    schemaVersion,
    loanName: incomingState.loan?.type || 'Home Loan',
    accountNumber: incomingState.loan?.accountNumber || '••••',
    currentCounts,
    incomingCounts,
    newTransactionsCount,
    isValid: errors.length === 0,
    validationErrors: errors,
    parsedState: incomingState,
  };
}

function getCounts(state: LedgerState) {
  return {
    transactions: state.transactions?.length || 0,
    members: state.members?.length || 0,
    snapshots: state.snapshots?.length || 0,
    rateChanges: state.rateChanges?.length || 0,
    interestEntries: state.interestEntries?.length || 0,
    statements: state.statements?.length || 0,
    auditLog: state.auditLog?.length || 0,
  };
}

function getEmptyCounts() {
  return {
    transactions: 0,
    members: 0,
    snapshots: 0,
    rateChanges: 0,
    interestEntries: 0,
    statements: 0,
    auditLog: 0,
  };
}


import { Paise } from '../engine';

export interface SbiPassbookRow {
  id: string;
  postDate: string;
  valueDate: string;
  isoDate: string;
  desc: string;
  refNo: string;
  type: 'credit' | 'debit';
  category: 'emi_credit' | 'prepayment' | 'interest_debit' | 'withdrawal' | 'disbursement' | 'other';
  debitPaise: Paise;
  creditPaise: Paise;
  balancePaise: Paise;
  rawDebit: string;
  rawCredit: string;
  rawBalance: string;
}

// Emptied: All 101 authentic statement records now reside in Cloud Firestore subcollection: /loans/loan-primary/statementRecords
export const SBI_AUTHENTIC_STATEMENT_ROWS: SbiPassbookRow[] = [];

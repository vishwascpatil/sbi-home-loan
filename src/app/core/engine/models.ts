import { Paise } from './money';

export type PaymentMode = 'UPI' | 'Bank transfer' | 'Cash' | 'Cheque' | 'NEFT/RTGS';

export type CalculationMethod = 'monthly' | 'daily';

export type DayCountBasis = 'actual/365' | '360' | 'actual/actual';
export type DebitFrequency = 'monthlyLastDay' | 'quarterly' | 'customDay';

export interface BankRuleSettings {
  dayCountBasis: DayCountBasis;
  debitFrequency: DebitFrequency;
  customDebitDay?: number;
  isCapitalised: boolean;
}

export interface DailyLedgerRecord {
  date: string; // YYYY-MM-DD
  opening: Paise;
  movements: Paise;
  closing: Paise;
  rateBps: number;
  dailyAccruedPaise: Paise;
  cumulativeAccruedPaise: Paise;
}

export interface DailyInterestResult {
  totalInterest: Paise;
  dailyLedger: DailyLedgerRecord[];
  accruedUnrounded: bigint;
  basisDays: number;
}

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  importBatchId?: string;
}

export type ImportMatchStatus = 'matched' | 'probable' | 'unmatched';

export interface ImportMappingProfile {
  id: string;
  name: string;
  dateColumn: string;
  descriptionColumn: string;
  referenceColumn?: string;
  debitColumn?: string;
  creditColumn?: string;
  balanceColumn?: string;
  dateFormat?: string;
}

export interface ParsedStatementRow {
  tempId: string;
  date: string; // YYYY-MM-DD
  description: string;
  reference?: string;
  debitPaise: Paise;
  creditPaise: Paise;
  balancePaise?: Paise;
  matchStatus: ImportMatchStatus;
  matchedTransactionId?: string;
  matchReason?: string;
  action: 'skip' | 'bankPayment' | 'contribution' | 'withdrawal';
  selectedMemberId?: string;
}

export interface PrepaymentEvent {
  date: string; // YYYY-MM-DD
  amount: Paise;
}

export interface DrawdownEvent {
  date: string; // YYYY-MM-DD
  amount: Paise;
}

export interface SavedScenario {
  id: string;
  name: string;
  monthlyPayment: Paise;
  paymentDayOfMonth: number;
  rateShiftBps: number;
  prepayments: PrepaymentEvent[];
  drawdowns: DrawdownEvent[];
  createdAt: string;
}

export interface Loan extends BaseEntity {
  type: string;
  accountNumber: string;
  sanctionedLimit: Paise;
  openingOutstanding: Paise;
  openingDate: string; // YYYY-MM-DD
  maturityDate: string; // YYYY-MM-DD
  currentRateBps: number; // e.g. 790 = 7.90%
  monthlyTarget: Paise; // e.g. 24,000,000 paise = ₹2,40,000
  calculationMethod: CalculationMethod;
  bankRules?: BankRuleSettings;
  lockedUntilPeriod?: string; // YYYY-MM
  savedScenarios?: SavedScenario[];
}

export interface Member extends BaseEntity {
  name: string;
  active: boolean;
  target?: Paise;
  colorIndex: number;
}

export interface ContributionTransaction extends BaseEntity {
  type: 'contribution';
  memberId: string;
  amount: Paise;
  date: string; // YYYY-MM-DD
  valueDate?: string; // YYYY-MM-DD
  forMonth: string; // YYYY-MM
  mode: PaymentMode;
  reference?: string;
  notes?: string;
}

export interface BankPaymentTransaction extends BaseEntity {
  type: 'bankPayment';
  amount: Paise;
  interestPortion: Paise;
  principalPortion: Paise;
  isEstimatedSplit: boolean;
  date: string; // YYYY-MM-DD
  valueDate?: string; // YYYY-MM-DD
  forMonth: string; // YYYY-MM
  mode: PaymentMode;
  reference?: string;
  notes?: string;
}

export interface WithdrawalTransaction extends BaseEntity {
  type: 'withdrawal';
  memberId?: string;
  amount: Paise;
  date: string; // YYYY-MM-DD
  valueDate?: string; // YYYY-MM-DD
  forMonth: string; // YYYY-MM
  mode: PaymentMode;
  reference?: string;
  notes?: string;
}

export interface InterestChargeTransaction extends BaseEntity {
  type: 'interestCharge';
  amount: Paise;
  method: CalculationMethod;
  isEstimated: boolean;
  date: string; // YYYY-MM-DD
  valueDate?: string; // YYYY-MM-DD
  forMonth: string; // YYYY-MM
  notes?: string;
}

export interface PrincipalAdjustmentTransaction extends BaseEntity {
  type: 'principalAdjustment';
  amount: Paise; // Can be positive or negative
  reason: string;
  date: string; // YYYY-MM-DD
  valueDate?: string; // YYYY-MM-DD
  forMonth: string; // YYYY-MM
  notes?: string;
}

export interface ManualCorrectionTransaction extends BaseEntity {
  type: 'manualCorrection';
  previousOutstanding: Paise;
  newOutstanding: Paise;
  variance: Paise;
  reason: string;
  date: string; // YYYY-MM-DD
  valueDate?: string; // YYYY-MM-DD
  forMonth: string; // YYYY-MM
  notes?: string;
}

export type Transaction =
  | ContributionTransaction
  | BankPaymentTransaction
  | WithdrawalTransaction
  | InterestChargeTransaction
  | PrincipalAdjustmentTransaction
  | ManualCorrectionTransaction;

export interface RateChange extends BaseEntity {
  effectiveFrom: string; // YYYY-MM-DD
  rateBps: number; // e.g. 790
  previousRateBps: number;
  reason?: string;
}

export interface BalanceSnapshot extends BaseEntity {
  date: string; // YYYY-MM-DD
  bankActualOutstanding: Paise;
  ledgerCalculatedOutstanding: Paise;
  variance: Paise; // bankActual - ledgerCalculated
  reconciledBy?: string;
  notes?: string;
}

export interface InterestEntry {
  id: string;
  period: string; // YYYY-MM
  method: CalculationMethod;
  openingPrincipal: Paise;
  calculatedInterest: Paise;
  rateBps: number;
  status: 'active' | 'superseded';
  createdAt: string;
  supersededAt?: string;
  accruedUnrounded?: string;
  dailyLedger?: DailyLedgerRecord[];
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: 'create' | 'update' | 'delete' | 'reconcile' | 'rateChange' | 'restore' | 'reset';
  entityType: 'transaction' | 'rateChange' | 'loan' | 'member' | 'snapshot' | 'backup';
  entityId: string;
  payloadBefore?: unknown;
  payloadAfter?: unknown;
}

export interface Settings {
  theme: 'auto' | 'light' | 'dark';
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD';
  maskAccountNumber: boolean;
  defaultPaymentMode: PaymentMode;
}

export function getTransactionAmount(tx: Transaction): Paise {
  if (tx.type === 'manualCorrection') {
    return Math.abs(tx.variance) as Paise;
  }
  return tx.amount;
}

export function getTransactionMode(tx: Transaction): string {
  if ('mode' in tx && tx.mode) {
    return tx.mode;
  }
  return 'System';
}

export function getTransactionReference(tx: Transaction): string | undefined {
  if ('reference' in tx) {
    return tx.reference;
  }
  return undefined;
}

export interface StatementSnapshot extends BaseEntity {
  period: string; // YYYY-MM
  loanId: string;
  accountNumber: string;
  generatedAt: string;
  openingOutstanding: Paise;
  closingOutstanding: Paise;
  totalContributions: Paise;
  paidToBank: Paise;
  interestPaid: Paise;
  principalReduced: Paise;
  status: 'reconciled' | 'estimated';
  unusedGroupFunds: Paise;
  memberContributions: {
    memberId: string;
    name: string;
    amount: Paise;
    sharePercentage: number;
  }[];
}

export interface FinancialYearMonthSummary {
  period: string; // YYYY-MM
  opening: Paise;
  contributions: Paise;
  paidToBank: Paise;
  interest: Paise;
  principalReduction: Paise;
  closing: Paise;
}

export interface FinancialYearSummary {
  financialYear: string; // e.g. "FY 2024-25"
  startPeriod: string; // YYYY-MM (e.g. 2024-04)
  endPeriod: string; // YYYY-MM (e.g. 2025-03)
  totalInterestPaid: Paise;
  totalPrincipalReduced: Paise;
  totalPaidToBank: Paise;
  totalMemberContributions: Paise;
  openingPrincipal: Paise;
  closingPrincipal: Paise;
  months: FinancialYearMonthSummary[];
  memberShares: {
    memberId: string;
    name: string;
    totalContributed: Paise;
    sharePercentage: number;
  }[];
}

export interface LedgerState {
  loan: Loan;
  members: Member[];
  transactions: Transaction[];
  rateChanges: RateChange[];
  snapshots: BalanceSnapshot[];
  interestEntries: InterestEntry[];
  statements?: StatementSnapshot[];
  settings: Settings;
  auditLog: AuditEntry[];
}

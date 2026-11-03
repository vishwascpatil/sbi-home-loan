import { Paise } from './money';

export type PaymentMode = 'UPI' | 'Bank transfer' | 'Cash' | 'Cheque' | 'NEFT/RTGS';

export type CalculationMethod = 'monthly' | 'daily';

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
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
  forMonth: string; // YYYY-MM
  notes?: string;
}

export interface PrincipalAdjustmentTransaction extends BaseEntity {
  type: 'principalAdjustment';
  amount: Paise; // Can be positive or negative
  reason: string;
  date: string; // YYYY-MM-DD
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
  createdAt: string;
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

export interface LedgerState {
  loan: Loan;
  members: Member[];
  transactions: Transaction[];
  rateChanges: RateChange[];
  snapshots: BalanceSnapshot[];
  interestEntries: InterestEntry[];
  settings: Settings;
  auditLog: AuditEntry[];
}

import {
  BalanceSnapshot,
  LedgerState,
  Loan,
  Member,
  RateChange,
  toPaise,
  Transaction,
} from '../engine';

export function getInitialSeedData(): LedgerState {
  const loan: Loan = {
    id: 'loan-primary',
    type: 'Overdraft (OD)',
    accountNumber: '43054757071',
    initialDisbursed: toPaise(13300000), // ₹1,33,00,000.00 initial disbursement
    sanctionedLimit: toPaise(12612930), // ₹1,26,12,930.00 current drawing power limit
    regularEmi: toPaise(118900), // ₹1,18,900.00 scheduled bank monthly EMI
    openingOutstanding: toPaise(11886289), // ₹1,18,86,289.00 current book balance (Nov 5, 2026)
    openingDate: '2024-06-12',
    maturityDate: '2044-06-12',
    currentRateBps: 790, // 7.90% p.a.
    monthlyTarget: toPaise(240000), // ₹2,40,000.00 (pool sum of member targets)
    calculationMethod: 'daily',
    bankRules: {
      dayCountBasis: 'actual/365',
      debitFrequency: 'monthlyLastDay',
      isCapitalised: true,
      customDebitDay: 30,
    },
    createdAt: '2024-06-12T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  };

  const members: Member[] = [
    {
      id: 'mem-vishwas',
      name: 'Vishwas',
      active: true,
      target: toPaise(105000), // ₹1,05,000.00
      colorIndex: 0,
      avatarUrl: 'profiles/vishwas.jpeg',
      phone: '8105242578',
      email: 'vishwascpatilonline@gmail.com',
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: '2024-06-12T00:00:00.000Z',
    },
    {
      id: 'mem-vikas',
      name: 'Vikas',
      active: true,
      target: toPaise(105000), // ₹1,05,000.00
      colorIndex: 1,
      avatarUrl: 'profiles/vikas.jpeg',
      phone: '9880413201',
      email: 'vikascpatil123@gmail.com',
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: '2024-06-12T00:00:00.000Z',
    },
    {
      id: 'mem-bhavya',
      name: 'Bhavya',
      active: true,
      target: toPaise(10000), // ₹10,000.00
      colorIndex: 2,
      avatarUrl: 'profiles/bhavya.jpeg',
      phone: '9902103979',
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: '2024-06-12T00:00:00.000Z',
    },
    {
      id: 'mem-shruthi',
      name: 'Shruthi',
      active: true,
      target: toPaise(10000), // ₹10,000.00
      colorIndex: 3,
      avatarUrl: 'profiles/shruthi.jpeg',
      phone: '9844586757',
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: '2024-06-12T00:00:00.000Z',
    },
    {
      id: 'mem-csp',
      name: 'CSP',
      active: true,
      target: toPaise(10000), // ₹10,000.00
      colorIndex: 4,
      avatarUrl: 'profiles/csp.jpeg',
      phone: '9880404025',
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: '2024-06-12T00:00:00.000Z',
    },
  ];

  // Start with clean empty transactions; no default mock deposits
  const transactions: Transaction[] = [];

  const rateChanges: RateChange[] = [
    {
      id: crypto.randomUUID(),
      effectiveFrom: '2024-06-12',
      rateBps: 890,
      previousRateBps: 890,
      reason: 'Sanction rate 8.90% p.a.',
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: '2024-06-12T00:00:00.000Z',
    },
    {
      id: crypto.randomUUID(),
      effectiveFrom: '2025-02-01',
      rateBps: 850,
      previousRateBps: 890,
      reason: 'EBLR rate reduction to 8.50% p.a.',
      createdAt: '2025-02-01T00:00:00.000Z',
      updatedAt: '2025-02-01T00:00:00.000Z',
    },
    {
      id: crypto.randomUUID(),
      effectiveFrom: '2025-07-01',
      rateBps: 790,
      previousRateBps: 850,
      reason: 'EBLR rate reduction to 7.90% p.a.',
      createdAt: '2025-07-01T00:00:00.000Z',
      updatedAt: '2025-07-01T00:00:00.000Z',
    },
    {
      id: crypto.randomUUID(),
      effectiveFrom: '2026-01-01',
      rateBps: 765,
      previousRateBps: 790,
      reason: 'EBLR rate reduction to 7.65% p.a.',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: crypto.randomUUID(),
      effectiveFrom: '2026-10-01',
      rateBps: 790,
      previousRateBps: 765,
      reason: 'Current rate 7.90% p.a.',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  const snapshots: BalanceSnapshot[] = [
    {
      id: crypto.randomUUID(),
      date: '2026-11-05',
      bankActualOutstanding: toPaise(11886289),
      ledgerCalculatedOutstanding: toPaise(11886289),
      variance: toPaise(0),
      notes: 'Passbook balance baseline as of Nov 5, 2026 (post-Nov EMI)',
      createdAt: '2026-11-05T00:00:00.000Z',
      updatedAt: '2026-11-05T00:00:00.000Z',
    },
  ];

  return {
    loan,
    members,
    transactions,
    rateChanges,
    snapshots,
    interestEntries: [],
    statements: [],
    settings: {
      theme: 'light',
      dateFormat: 'DD/MM/YYYY',
      maskAccountNumber: true,
      defaultPaymentMode: 'UPI',
    },
    auditLog: [
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        action: 'create',
        entityType: 'loan',
        entityId: loan.id,
        payloadAfter: {
          accountNumber: loan.accountNumber,
          sanctionedLimit: loan.sanctionedLimit,
          openingOutstanding: loan.openingOutstanding,
          rateBps: loan.currentRateBps,
        },
      },
    ],
  };
}

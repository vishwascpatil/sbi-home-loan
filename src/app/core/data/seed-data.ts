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
    sanctionedLimit: toPaise(12636108), // ₹1,26,36,108.00
    openingOutstanding: toPaise(11886289), // ₹1,18,86,289.00 as of November baseline
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
      avatarUrl: '/profiles/vishwas.jpeg',
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: '2024-06-12T00:00:00.000Z',
    },
    {
      id: 'mem-vikas',
      name: 'Vikas',
      active: true,
      target: toPaise(105000), // ₹1,05,000.00
      colorIndex: 1,
      avatarUrl: '/profiles/vikas.jpeg',
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: '2024-06-12T00:00:00.000Z',
    },
    {
      id: 'mem-bhavya',
      name: 'Bhavya',
      active: true,
      target: toPaise(10000), // ₹10,000.00
      colorIndex: 2,
      avatarUrl: '/profiles/bhavya.jpeg',
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: '2024-06-12T00:00:00.000Z',
    },
    {
      id: 'mem-shruthi',
      name: 'Shruthi',
      active: true,
      target: toPaise(10000), // ₹10,000.00
      colorIndex: 3,
      avatarUrl: '/profiles/shruthi.jpeg',
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: '2024-06-12T00:00:00.000Z',
    },
    {
      id: 'mem-csp',
      name: 'CSP',
      active: true,
      target: toPaise(10000), // ₹10,000.00
      colorIndex: 4,
      avatarUrl: '/profiles/csp.jpeg',
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: '2024-06-12T00:00:00.000Z',
    },
  ];

  // November EMI / OD payment of ₹2,18,900 reducing loan outstanding from November baseline
  const transactions: Transaction[] = [
    {
      id: 'tx-nov-2026-emi',
      type: 'bankPayment',
      amount: toPaise(218900),
      interestPortion: toPaise(0),
      principalPortion: toPaise(218900),
      isEstimatedSplit: false,
      date: '2026-11-05',
      forMonth: '2026-11',
      mode: 'Bank transfer',
      notes: 'November EMI / OD Payment',
      createdAt: '2026-11-05T09:00:00.000Z',
      updatedAt: '2026-11-05T09:00:00.000Z',
    },
  ];

  const rateChanges: RateChange[] = [
    {
      id: crypto.randomUUID(),
      effectiveFrom: '2024-06-12',
      rateBps: 790,
      previousRateBps: 790,
      reason: 'Current rate 7.90% p.a.',
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: '2024-06-12T00:00:00.000Z',
    },
  ];

  const snapshots: BalanceSnapshot[] = [
    {
      id: crypto.randomUUID(),
      date: '2026-11-01',
      bankActualOutstanding: toPaise(11886289),
      ledgerCalculatedOutstanding: toPaise(11886289),
      variance: toPaise(0),
      notes: 'Passbook balance baseline as of November',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
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

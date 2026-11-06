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
    openingOutstanding: toPaise(12055189), // ₹1,20,55,189.00 as of Oct 31st baseline
    openingDate: '2026-10-31',
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

  // November payments totaling ₹2,18,900 added on Nov 4th & Nov 5th
  const transactions: Transaction[] = [
    // Vishwas contribution on Nov 4
    {
      id: 'tx-nov-4-vishwas',
      type: 'contribution',
      memberId: 'mem-vishwas',
      amount: toPaise(105000),
      date: '2026-11-04',
      forMonth: '2026-11',
      mode: 'Bank transfer',
      notes: 'Vishwas deposit on Nov 4',
      createdAt: '2026-11-04T10:00:00.000Z',
      updatedAt: '2026-11-04T10:00:00.000Z',
    },
    // Loan payment on Nov 4
    {
      id: 'tx-nov-4-bank-payment',
      type: 'bankPayment',
      amount: toPaise(105000),
      principalPortion: toPaise(105000),
      interestPortion: toPaise(0),
      isEstimatedSplit: false,
      date: '2026-11-04',
      forMonth: '2026-11',
      mode: 'Bank transfer',
      notes: 'Payment to loan on Nov 4',
      createdAt: '2026-11-04T10:30:00.000Z',
      updatedAt: '2026-11-04T10:30:00.000Z',
    },
    // Vikas contribution on Nov 5
    {
      id: 'tx-nov-5-vikas',
      type: 'contribution',
      memberId: 'mem-vikas',
      amount: toPaise(105000),
      date: '2026-11-05',
      forMonth: '2026-11',
      mode: 'Bank transfer',
      notes: 'Vikas deposit on Nov 5',
      createdAt: '2026-11-05T09:00:00.000Z',
      updatedAt: '2026-11-05T09:00:00.000Z',
    },
    // Bhavya contribution on Nov 5
    {
      id: 'tx-nov-5-bhavya',
      type: 'contribution',
      memberId: 'mem-bhavya',
      amount: toPaise(8900),
      date: '2026-11-05',
      forMonth: '2026-11',
      mode: 'Bank transfer',
      notes: 'Bhavya deposit on Nov 5',
      createdAt: '2026-11-05T09:15:00.000Z',
      updatedAt: '2026-11-05T09:15:00.000Z',
    },
    // Loan payment on Nov 5
    {
      id: 'tx-nov-5-bank-payment',
      type: 'bankPayment',
      amount: toPaise(113900),
      principalPortion: toPaise(113900),
      interestPortion: toPaise(0),
      isEstimatedSplit: false,
      date: '2026-11-05',
      forMonth: '2026-11',
      mode: 'Bank transfer',
      notes: 'Payment to loan on Nov 5',
      createdAt: '2026-11-05T09:30:00.000Z',
      updatedAt: '2026-11-05T09:30:00.000Z',
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
      date: '2026-10-31',
      bankActualOutstanding: toPaise(12055189),
      ledgerCalculatedOutstanding: toPaise(12055189),
      variance: toPaise(0),
      notes: 'Passbook balance baseline as of Oct 31st',
      createdAt: '2026-10-31T00:00:00.000Z',
      updatedAt: '2026-10-31T00:00:00.000Z',
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

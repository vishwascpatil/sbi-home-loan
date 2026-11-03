import {
  bankPaymentSplit,
  LedgerState,
  Loan,
  Member,
  MonthlyReducingBalanceEngine,
  PaymentMode,
  toPaise,
  Transaction,
} from '../engine';

export function getInitialSeedData(): LedgerState {
  const loan: Loan = {
    id: 'loan-primary',
    type: 'Overdraft (OD)',
    accountNumber: '43054757071',
    sanctionedLimit: toPaise(12636108), // ₹1,26,36,108.00
    openingOutstanding: toPaise(12105189), // ₹1,21,05,189.00
    openingDate: '2024-06-12',
    maturityDate: '2044-06-12',
    currentRateBps: 790, // 7.90%
    monthlyTarget: toPaise(240000), // ₹2,40,000.00
    calculationMethod: 'monthly',
    createdAt: '2024-06-12T00:00:00.000Z',
    updatedAt: '2024-06-12T00:00:00.000Z',
  };

  const members: Member[] = [
    {
      id: 'mem-1',
      name: 'Member 1',
      active: true,
      target: toPaise(50000),
      colorIndex: 0,
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: '2024-06-12T00:00:00.000Z',
    },
    {
      id: 'mem-2',
      name: 'Member 2',
      active: true,
      target: toPaise(40000),
      colorIndex: 1,
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: '2024-06-12T00:00:00.000Z',
    },
    {
      id: 'mem-3',
      name: 'Member 3',
      active: true,
      target: toPaise(60000),
      colorIndex: 2,
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: '2024-06-12T00:00:00.000Z',
    },
    {
      id: 'mem-4',
      name: 'Member 4',
      active: true,
      target: toPaise(45000),
      colorIndex: 3,
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: '2024-06-12T00:00:00.000Z',
    },
    {
      id: 'mem-5',
      name: 'Member 5',
      active: true,
      target: toPaise(35000),
      colorIndex: 4,
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: '2024-06-12T00:00:00.000Z',
    },
  ];

  const engine = new MonthlyReducingBalanceEngine();
  const transactions: Transaction[] = [];

  // Generate 6 preceding months of realistic historical activity
  const now = new Date();
  const baseContributions = [50000, 40000, 60000, 45000, 35000];
  const modes: PaymentMode[] = ['UPI', 'UPI', 'Bank transfer', 'UPI', 'Cash'];

  for (let k = 5; k >= 0; k--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const yyyy = monthDate.getFullYear();
    const mm = String(monthDate.getMonth() + 1).padStart(2, '0');
    const monthStr = `${yyyy}-${mm}`;

    // Member contributions
    baseContributions.forEach((baseAmt, i) => {
      // Small variation per month
      const variation = ((i * 3 + k * 7) % 5 - 2) * 2500;
      const amt = toPaise(baseAmt + variation);
      const day = String(1 + (i % 3)).padStart(2, '0');
      const dateStr = `${monthStr}-${day}`;

      transactions.push({
        id: crypto.randomUUID(),
        type: 'contribution',
        memberId: members[i]!.id,
        amount: amt,
        date: dateStr,
        forMonth: monthStr,
        mode: modes[i] || 'UPI',
        reference: `UPI-${monthStr.replace('-', '')}-${i + 1}`,
        notes: `Monthly contribution for ${monthStr}`,
        createdAt: `${dateStr}T09:00:00.000Z`,
        updatedAt: `${dateStr}T09:00:00.000Z`,
      });
    });

    // Monthly bank payment
    const estInterest = engine.calculateInterest(loan.openingOutstanding, loan.currentRateBps, monthStr);
    const paymentAmount = toPaise(200000); // ₹2,00,000 monthly bank payment
    const split = bankPaymentSplit(paymentAmount, estInterest);
    const bankPayDate = `${monthStr}-05`;

    transactions.push({
      id: crypto.randomUUID(),
      type: 'bankPayment',
      amount: paymentAmount,
      interestPortion: split.interestPortion,
      principalPortion: split.principalPortion,
      isEstimatedSplit: true,
      date: bankPayDate,
      forMonth: monthStr,
      mode: 'Bank transfer',
      reference: `NEFT-SBI-${monthStr.replace('-', '')}`,
      notes: `Bank payment for ${monthStr}`,
      createdAt: `${bankPayDate}T12:00:00.000Z`,
      updatedAt: `${bankPayDate}T12:00:00.000Z`,
    });
  }

  return {
    loan,
    members,
    transactions,
    rateChanges: [],
    snapshots: [],
    interestEntries: [],
    settings: {
      theme: 'auto',
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
        payloadAfter: { accountNumber: loan.accountNumber },
      },
    ],
  };
}


import { describe, expect, it } from 'vitest';
import {
  addPaise,
  bankPaymentSplit,
  closeMonth,
  closedFormMonths,
  compareScenarios,
  DailyReducingBalanceEngine,
  DailyReducingBalanceEngineStub,
  formatCompactPaise,
  formatPaise,
  groupFunds,
  LedgerState,
  Loan,
  Member,
  memberStatistics,
  MonthlyReducingBalanceEngine,
  monthlySummary,
  outstandingAt,
  paise,
  reconcile,
  simulate,
  subPaise,
  toPaise,
  toRupees,
  Transaction,
  ZERO_PAISE,
} from './index';

function createMockLedger(): LedgerState {
  const loan: Loan = {
    id: 'loan-1',
    type: 'Overdraft (OD)',
    accountNumber: '43054757071',
    sanctionedLimit: toPaise(12636108), // ₹1,26,36,108.00
    openingOutstanding: toPaise(12105189), // ₹1,21,05,189.00
    openingDate: '2024-06-12',
    maturityDate: '2044-06-12',
    currentRateBps: 790, // 7.90%
    monthlyTarget: toPaise(240000), // ₹2,40,000.00
    calculationMethod: 'monthly',
    createdAt: '2024-06-12T00:00:00Z',
    updatedAt: '2024-06-12T00:00:00Z',
  };

  const members: Member[] = [
    {
      id: 'm1',
      name: 'Member 1',
      active: true,
      colorIndex: 0,
      createdAt: '2024-06-12T00:00:00Z',
      updatedAt: '2024-06-12T00:00:00Z',
    },
    {
      id: 'm2',
      name: 'Member 2',
      active: true,
      colorIndex: 1,
      createdAt: '2024-06-12T00:00:00Z',
      updatedAt: '2024-06-12T00:00:00Z',
    },
    {
      id: 'm3',
      name: 'Member 3',
      active: true,
      colorIndex: 2,
      createdAt: '2024-06-12T00:00:00Z',
      updatedAt: '2024-06-12T00:00:00Z',
    },
    {
      id: 'm4',
      name: 'Member 4',
      active: true,
      colorIndex: 3,
      createdAt: '2024-06-12T00:00:00Z',
      updatedAt: '2024-06-12T00:00:00Z',
    },
    {
      id: 'm5',
      name: 'Member 5',
      active: true,
      colorIndex: 4,
      createdAt: '2024-06-12T00:00:00Z',
      updatedAt: '2024-06-12T00:00:00Z',
    },
  ];

  return {
    loan,
    members,
    transactions: [],
    rateChanges: [],
    snapshots: [],
    interestEntries: [],
    settings: {
      theme: 'light',
      dateFormat: 'DD/MM/YYYY',
      maskAccountNumber: true,
      defaultPaymentMode: 'UPI',
    },
    auditLog: [],
  };
}

describe('Domain Engine: Money Helpers', () => {
  it('converts between rupees and integer paise accurately', () => {
    expect(toPaise(100)).toBe(10000);
    expect(toPaise('1,21,05,189.00')).toBe(1210518900);
    expect(toPaise('79692.49')).toBe(7969249);
    expect(toRupees(toPaise('79692.49'))).toBe(79692.49);
    expect(toPaise('-500.50')).toBe(-50050);
  });

  it('formats currency using en-IN conventions', () => {
    const principal = toPaise(12105189);
    expect(formatPaise(principal)).toBe('₹1,21,05,189');
    expect(formatPaise(toPaise('79692.49'), { showPaise: true })).toBe('₹79,692.49');
    expect(formatPaise(toPaise('79692.49'), { showPaise: true, isEstimated: true })).toBe(
      '₹79,692.49 est.'
    );
  });

  it('formats compact Indian denominations', () => {
    expect(formatCompactPaise(toPaise(12636108))).toBe('₹1.26 Cr');
    expect(formatCompactPaise(toPaise(240000))).toBe('₹2.4L');
    expect(formatCompactPaise(toPaise(50000))).toBe('₹50,000');
  });

  it('safely adds and subtracts paise without float error', () => {
    const a = toPaise('0.10');
    const b = toPaise('0.20');
    expect(addPaise(a, b)).toBe(toPaise('0.30'));
    expect(subPaise(b, a)).toBe(toPaise('0.10'));
  });
});

describe('Golden Test (a): Exact Monthly Interest Calculation', () => {
  it('₹1,21,05,189 at 7.90%, monthly → interest ₹79,692.49', () => {
    const engine = new MonthlyReducingBalanceEngine();
    const principal = toPaise(12105189); // 1,210,518,900 paise
    const rateBps = 790; // 7.90%

    const interest = engine.calculateInterest(principal, rateBps, '2025-01');

    // Expected exact calculation:
    // (12105189 * 0.0790) / 12 = 79692.49425 rupees
    // In paise: 7,969,249.425 paise -> roundHalfUp -> 7,969,249 paise (₹79,692.49)
    expect(interest).toBe(7969249);
    expect(formatPaise(interest, { showPaise: true })).toBe('₹79,692.49');
  });
});

describe('Golden Test (b): Ledger Balance Transition & Principal Reduction', () => {
  it('Opening ₹1,21,05,189; contributions ₹2,40,000; bank payment ₹2,40,000 with interest portion ₹79,692.49 → principal reduction ₹1,60,307.51 → closing ₹1,19,44,881.49', () => {
    const ledger = createMockLedger();
    const opening = ledger.loan.openingOutstanding; // 1,210,518,900 paise
    expect(opening).toBe(toPaise(12105189));

    // Record member contribution of ₹2,40,000
    ledger.transactions.push({
      id: 'tx-c1',
      type: 'contribution',
      memberId: 'm1',
      amount: toPaise(240000),
      date: '2024-07-01',
      forMonth: '2024-07',
      mode: 'UPI',
      createdAt: '2024-07-01T10:00:00Z',
      updatedAt: '2024-07-01T10:00:00Z',
    });

    // Record bank payment with split
    const split = bankPaymentSplit(toPaise(240000), toPaise('79692.49'));
    expect(split.interestPortion).toBe(toPaise('79692.49')); // 7,969,249 paise
    expect(split.principalPortion).toBe(toPaise('160307.51')); // 16,030,751 paise

    ledger.transactions.push({
      id: 'tx-b1',
      type: 'bankPayment',
      amount: toPaise(240000),
      interestPortion: split.interestPortion,
      principalPortion: split.principalPortion,
      isEstimatedSplit: false,
      date: '2024-07-05',
      forMonth: '2024-07',
      mode: 'Bank transfer',
      createdAt: '2024-07-05T10:00:00Z',
      updatedAt: '2024-07-05T10:00:00Z',
    });

    const closing = outstandingAt('2024-07-31', ledger);
    expect(closing).toBe(toPaise('11944881.49')); // 1,194,488,149 paise
    expect(formatPaise(closing, { showPaise: true })).toBe('₹1,19,44,881.49');

    // That closing becomes the next opening
    const nextOpening = outstandingAt('2024-08-01', ledger);
    expect(nextOpening).toBe(closing);
  });
});

describe('Golden Test (c): Contributions Isolation & Group Cash Tracking', () => {
  it('Contributions alone never change outstanding; ₹2,40,000 contributions with ₹2,00,000 payment leaves +₹40,000 unused funds', () => {
    const ledger = createMockLedger();
    const initialOutstanding = ledger.loan.openingOutstanding;

    // Member contributes ₹2,40,000
    ledger.transactions.push({
      id: 'tx-c1',
      type: 'contribution',
      memberId: 'm1',
      amount: toPaise(240000),
      date: '2024-07-01',
      forMonth: '2024-07',
      mode: 'UPI',
      createdAt: '2024-07-01T10:00:00Z',
      updatedAt: '2024-07-01T10:00:00Z',
    });

    // Verification 1: Outstanding is completely unchanged after contribution
    expect(outstandingAt('2024-07-02', ledger)).toBe(initialOutstanding);

    // Group pays ₹2,00,000 to bank
    const split = bankPaymentSplit(toPaise(200000), toPaise('79692.49'));
    ledger.transactions.push({
      id: 'tx-b1',
      type: 'bankPayment',
      amount: toPaise(200000),
      interestPortion: split.interestPortion,
      principalPortion: split.principalPortion,
      isEstimatedSplit: true,
      date: '2024-07-04',
      forMonth: '2024-07',
      mode: 'Bank transfer',
      createdAt: '2024-07-04T10:00:00Z',
      updatedAt: '2024-07-04T10:00:00Z',
    });

    // Verification 2: Group funds unused cash = 2,40,000 - 2,00,000 = +40,000
    const funds = groupFunds(ledger);
    expect(funds.totalContributions).toBe(toPaise(240000));
    expect(funds.totalBankPayments).toBe(toPaise(200000));
    expect(funds.unusedFunds).toBe(toPaise(40000));
  });
});

describe('Golden Test (d): Recalculation on Edit/Delete & Idempotent Month Close', () => {
  it('editing or deleting a bank payment recalculates outstanding and subsequent months', () => {
    const ledger = createMockLedger();

    // Add bank payment of ₹2,00,000 in July
    const split1 = bankPaymentSplit(toPaise(200000), toPaise('79692.49'));
    const paymentTx: Transaction = {
      id: 'tx-b1',
      type: 'bankPayment',
      amount: toPaise(200000),
      interestPortion: split1.interestPortion,
      principalPortion: split1.principalPortion,
      isEstimatedSplit: true,
      date: '2024-07-05',
      forMonth: '2024-07',
      mode: 'Bank transfer',
      createdAt: '2024-07-05T10:00:00Z',
      updatedAt: '2024-07-05T10:00:00Z',
    };
    ledger.transactions.push(paymentTx);

    const balanceAfterInitial = outstandingAt('2024-07-31', ledger);

    // Edit payment: change amount to ₹2,50,000
    const split2 = bankPaymentSplit(toPaise(250000), toPaise('79692.49'));
    const txIndex = ledger.transactions.findIndex((t) => t.id === 'tx-b1');
    ledger.transactions[txIndex] = {
      ...paymentTx,
      amount: toPaise(250000),
      interestPortion: split2.interestPortion,
      principalPortion: split2.principalPortion,
      updatedAt: '2024-07-06T10:00:00Z',
    };

    const balanceAfterEdit = outstandingAt('2024-07-31', ledger);
    // Principal reduction increased by ₹50,000, so balance dropped by ₹50,000
    expect(balanceAfterInitial - balanceAfterEdit).toBe(toPaise(50000));

    // Soft delete payment: balance returns to opening balance
    ledger.transactions[txIndex]!.deletedAt = '2024-07-07T10:00:00Z';
    const balanceAfterDelete = outstandingAt('2024-07-31', ledger);
    expect(balanceAfterDelete).toBe(ledger.loan.openingOutstanding);
  });

  it('closing a month twice creates only one InterestEntry (idempotency)', () => {
    const ledger = createMockLedger();
    const engine = new MonthlyReducingBalanceEngine();

    const close1 = closeMonth('2024-07', engine, ledger);
    expect(close1.isNew).toBe(true);
    ledger.interestEntries.push(close1.entry);

    const close2 = closeMonth('2024-07', engine, ledger);
    expect(close2.isNew).toBe(false);
    expect(close2.entry.id).toBe(close1.entry.id);
    expect(ledger.interestEntries.length).toBe(1);
  });
});

describe('Golden Test (e): Simulator Accuracy & Closed-Form Verification', () => {
  const principal = toPaise(12105189);
  const rateBps = 790;
  const engine = new MonthlyReducingBalanceEngine();

  it('matches closed-form analytical tenure for ₹2,40,000 and ₹1,90,000 within ±1 month', () => {
    const sim240 = simulate(principal, toPaise(240000), rateBps, engine);
    const closed240 = closedFormMonths(principal, toPaise(240000), rateBps);
    expect(sim240).not.toBeNull();
    expect(closed240).toBe(62);
    expect(Math.abs((sim240?.months ?? 0) - (closed240 ?? 0))).toBeLessThanOrEqual(1);

    const sim190 = simulate(principal, toPaise(190000), rateBps, engine);
    const closed190 = closedFormMonths(principal, toPaise(190000), rateBps);
    expect(sim190).not.toBeNull();
    expect(closed190).toBe(83);
    expect(Math.abs((sim190?.months ?? 0) - (closed190 ?? 0))).toBeLessThanOrEqual(1);
  });

  it('returns null (never closes) when payment is at or below monthly interest', () => {
    // Monthly interest on ₹1.21 Cr at 7.9% is ~₹79,692.49
    const underPayment = toPaise(70000);
    const simFail = simulate(principal, underPayment, rateBps, engine);
    expect(simFail).toBeNull();

    const exactInterestPayment = toPaise('79692.49');
    const simExact = simulate(principal, exactInterestPayment, rateBps, engine);
    expect(simExact).toBeNull();
  });

  it('compares repayment scenarios correctly against ₹1,90,000 baseline', () => {
    const baseline = toPaise(190000);
    const comparisons = compareScenarios(
      principal,
      [{ payment: toPaise(240000) }, { payment: toPaise(230000) }, { payment: toPaise(190000) }],
      rateBps,
      baseline,
      engine
    );

    expect(comparisons.length).toBe(3);
    const comp240 = comparisons[0]!;
    expect(comp240.result).not.toBeNull();
    expect(comp240.differenceVsBaseline?.isSaved).toBe(true);
    expect(comp240.differenceVsBaseline?.interestSaved).toBeGreaterThan(0);
  });
});

describe('Mathematical Invariants & Property Tests', () => {
  it('Invariant 1: Member contributions never alter loan outstanding', () => {
    const ledger = createMockLedger();
    const initial = outstandingAt('2024-07-31', ledger);

    for (let i = 1; i <= 10; i++) {
      ledger.transactions.push({
        id: `tx-c-${i}`,
        type: 'contribution',
        memberId: `m${(i % 5) + 1}`,
        amount: paise(i * 100000),
        date: `2024-07-${i.toString().padStart(2, '0')}`,
        forMonth: '2024-07',
        mode: 'UPI',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    expect(outstandingAt('2024-07-31', ledger)).toBe(initial);
  });

  it('Invariant 2: Closing balance of period m equals opening balance of period m+1', () => {
    const ledger = createMockLedger();
    const split = bankPaymentSplit(toPaise(200000), toPaise('79692.49'));

    ledger.transactions.push({
      id: 'tx-b1',
      type: 'bankPayment',
      amount: toPaise(200000),
      interestPortion: split.interestPortion,
      principalPortion: split.principalPortion,
      isEstimatedSplit: true,
      date: '2024-07-05',
      forMonth: '2024-07',
      mode: 'Bank transfer',
      createdAt: '2024-07-05T00:00:00Z',
      updatedAt: '2024-07-05T00:00:00Z',
    });

    const summaryJuly = monthlySummary('2024-07', ledger);
    const summaryAugust = monthlySummary('2024-08', ledger);

    expect(summaryJuly.closingOutstanding).toBe(summaryAugust.openingOutstanding);
  });

  it('Invariant 3: Sum of principal portions of bank payments equals total drop in outstanding', () => {
    const ledger = createMockLedger();
    const opening = ledger.loan.openingOutstanding;

    const payments = [toPaise(150000), toPaise(220000), toPaise(180000)];
    let totalPrincipalPaid = ZERO_PAISE;

    payments.forEach((amt, idx) => {
      const split = bankPaymentSplit(amt, toPaise(75000));
      totalPrincipalPaid = addPaise(totalPrincipalPaid, split.principalPortion);

      ledger.transactions.push({
        id: `tx-b-${idx}`,
        type: 'bankPayment',
        amount: amt,
        interestPortion: split.interestPortion,
        principalPortion: split.principalPortion,
        isEstimatedSplit: true,
        date: `2024-0${idx + 7}-05`,
        forMonth: `2024-0${idx + 7}`,
        mode: 'Bank transfer',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    const finalOutstanding = outstandingAt('2024-10-01', ledger);
    expect(subPaise(opening, finalOutstanding)).toBe(totalPrincipalPaid);
  });
});

describe('Member Statistics & Reconciliation', () => {
  it('computes member statistics and share percentages correctly', () => {
    const ledger = createMockLedger();

    ledger.transactions.push(
      {
        id: 'c1',
        type: 'contribution',
        memberId: 'm1',
        amount: toPaise(60000),
        date: '2024-07-01',
        forMonth: '2024-07',
        mode: 'UPI',
        createdAt: '2024-07-01T00:00:00Z',
        updatedAt: '2024-07-01T00:00:00Z',
      },
      {
        id: 'c2',
        type: 'contribution',
        memberId: 'm2',
        amount: toPaise(40000),
        date: '2024-07-02',
        forMonth: '2024-07',
        mode: 'UPI',
        createdAt: '2024-07-02T00:00:00Z',
        updatedAt: '2024-07-02T00:00:00Z',
      }
    );

    const m1Stats = memberStatistics('m1', ledger, '2024-07');
    expect(m1Stats.lifetimeContribution).toBe(toPaise(60000));
    expect(m1Stats.thisMonthContribution).toBe(toPaise(60000));
    expect(m1Stats.sharePercentage).toBe(60);

    const m2Stats = memberStatistics('m2', ledger, '2024-07');
    expect(m2Stats.lifetimeContribution).toBe(toPaise(40000));
    expect(m2Stats.sharePercentage).toBe(40);
  });

  it('reconciles bank statement actuals against ledger balance and calculates variance', () => {
    const ledger = createMockLedger();
    const ledgerBal = outstandingAt('2024-07-01', ledger);

    // Bank statement shows ₹1,21,00,000 (variance of -₹5,189)
    const actual = toPaise(12100000);
    const rec = reconcile(actual, '2024-07-01', ledger);

    expect(rec.bankActualOutstanding).toBe(actual);
    expect(rec.ledgerCalculatedOutstanding).toBe(ledgerBal);
    expect(rec.variance).toBe(subPaise(actual, ledgerBal));
  });

  it('daily reducing balance engine stub calculates interest based on days in month', () => {
    const dailyEngine = new DailyReducingBalanceEngineStub();
    const principal = toPaise(12105189);
    const rateBps = 790;

    // January has 31 days
    const janInterest = dailyEngine.calculateInterest(principal, rateBps, '2025-01');
    expect(janInterest).toBeGreaterThan(0);

    // February 2025 has 28 days
    const febInterest = dailyEngine.calculateInterest(principal, rateBps, '2025-02');
    expect(febInterest).toBeLessThan(janInterest);
  });

  describe('DailyReducingBalanceEngine (Phase 3 Golden Tests & Bank Rules)', () => {
    const dailyEngine = new DailyReducingBalanceEngine();

    it('Golden Test 1: ₹10,00,000 at 8.00%, actual/365, 31 days, no movements -> ₹6,794.52', () => {
      const principal = toPaise(1000000); // 100,000,000 paise
      const rateBps = 800; // 8.00%
      const period = '2025-01'; // 31 days

      const result = dailyEngine.calculateDailyInterest({
        period,
        openingPrincipal: principal,
        annualRateBps: rateBps,
        bankRules: { dayCountBasis: 'actual/365' },
      });

      // 679452 paise = ₹6,794.52
      expect(result.totalInterest).toBe(paise(679452));
      expect(formatPaise(result.totalInterest)).toBe('₹6,794.52');
      expect(result.dailyLedger.length).toBe(31);
    });

    it('Golden Test 2: ₹10,00,000 for 10 days then ₹9,00,000 for 21 days at 8.00% -> ₹6,334.25', () => {
      const principal = toPaise(1000000); // ₹10,00,000
      const rateBps = 800; // 8.00%
      const period = '2025-01'; // 31 days

      // On day 11, a bank payment reduces principal by ₹1,00,000
      // So days 1..10 (10 days) close at ₹10,00,000 and days 11..31 (21 days) close at ₹9,00,000
      const transactions: Transaction[] = [
        {
          id: 'bp1',
          type: 'bankPayment',
          amount: toPaise(110000),
          interestPortion: toPaise(10000),
          principalPortion: toPaise(100000),
          isEstimatedSplit: false,
          date: '2025-01-11',
          forMonth: '2025-01',
          mode: 'Bank transfer',
          createdAt: '2025-01-11T00:00:00Z',
          updatedAt: '2025-01-11T00:00:00Z',
        },
      ];

      const result = dailyEngine.calculateDailyInterest({
        period,
        openingPrincipal: principal,
        annualRateBps: rateBps,
        transactions,
        bankRules: { dayCountBasis: 'actual/365' },
      });

      // 633425 paise = ₹6,334.25
      expect(result.totalInterest).toBe(paise(633425));
      expect(formatPaise(result.totalInterest)).toBe('₹6,334.25');
      expect(result.dailyLedger[9].closing).toBe(toPaise(1000000)); // Day 10
      expect(result.dailyLedger[10].closing).toBe(toPaise(900000)); // Day 11
    });

    it('handles mid-month rate changes correctly across daily accrual', () => {
      const principal = toPaise(1000000);
      const period = '2025-01';

      // Rate changes to 8.50% from Jan 16
      const rateChanges = [
        {
          id: 'rc1',
          effectiveFrom: '2025-01-16',
          rateBps: 850,
          previousRateBps: 800,
          createdAt: '2025-01-16T00:00:00Z',
          updatedAt: '2025-01-16T00:00:00Z',
        },
      ];

      const result = dailyEngine.calculateDailyInterest({
        period,
        openingPrincipal: principal,
        annualRateBps: 800,
        rateChanges,
        bankRules: { dayCountBasis: 'actual/365' },
      });

      // Days 1..15 at 8.00%, Days 16..31 at 8.50%
      expect(result.dailyLedger[14].rateBps).toBe(800); // Day 15
      expect(result.dailyLedger[15].rateBps).toBe(850); // Day 16
      expect(result.totalInterest).toBeGreaterThan(paise(679452));
    });

    it('handles leap year in actual/actual basis', () => {
      const principal = toPaise(1000000);

      // 2024 is a leap year (Feb has 29 days, year has 366 days)
      const leapRes = dailyEngine.calculateDailyInterest({
        period: '2024-02',
        openingPrincipal: principal,
        annualRateBps: 800,
        bankRules: { dayCountBasis: 'actual/actual' },
      });
      expect(leapRes.dailyLedger.length).toBe(29);
      expect(leapRes.basisDays).toBe(366);

      // 2025 is a non-leap year (Feb has 28 days, year has 365 days)
      const nonLeapRes = dailyEngine.calculateDailyInterest({
        period: '2025-02',
        openingPrincipal: principal,
        annualRateBps: 800,
        bankRules: { dayCountBasis: 'actual/actual' },
      });
      expect(nonLeapRes.dailyLedger.length).toBe(28);
      expect(nonLeapRes.basisDays).toBe(365);
    });

    it('handles day-count basis 360', () => {
      const principal = toPaise(1000000);
      const res360 = dailyEngine.calculateDailyInterest({
        period: '2025-01',
        openingPrincipal: principal,
        annualRateBps: 800,
        bankRules: { dayCountBasis: '360' },
      });
      expect(res360.basisDays).toBe(360);
      // Denominator 360 is smaller than 365, so interest is higher
      expect(res360.totalInterest).toBeGreaterThan(paise(679452));
    });

    it('handles same-day payment and principal adjustment', () => {
      const principal = toPaise(1000000);
      const transactions: Transaction[] = [
        {
          id: 'bp1',
          type: 'bankPayment',
          amount: toPaise(60000),
          interestPortion: toPaise(10000),
          principalPortion: toPaise(50000),
          isEstimatedSplit: false,
          date: '2025-01-15',
          forMonth: '2025-01',
          mode: 'Bank transfer',
          createdAt: '2025-01-15T00:00:00Z',
          updatedAt: '2025-01-15T00:00:00Z',
        },
        {
          id: 'pa1',
          type: 'principalAdjustment',
          amount: toPaise(10000), // Additional principal reduction
          reason: 'Bank correction',
          date: '2025-01-15',
          forMonth: '2025-01',
          createdAt: '2025-01-15T00:00:00Z',
          updatedAt: '2025-01-15T00:00:00Z',
        },
      ];

      const result = dailyEngine.calculateDailyInterest({
        period: '2025-01',
        openingPrincipal: principal,
        annualRateBps: 800,
        transactions,
      });

      // Total movement on day 15 = -50,000 - 10,000 = -60,000
      expect(result.dailyLedger[14].movements).toBe(toPaise(-60000));
      expect(result.dailyLedger[14].closing).toBe(toPaise(940000));
    });

    it('supersedes previous interest entries on recalculation in closeMonth', () => {
      const ledger = createMockLedger();
      ledger.loan.calculationMethod = 'daily';

      const firstClose = closeMonth('2025-01', dailyEngine, ledger);
      expect(firstClose.isNew).toBe(true);
      expect(firstClose.entry.status).toBe('active');
      expect(firstClose.entry.dailyLedger?.length).toBe(31);

      // Now add existing entry into ledger state
      ledger.interestEntries.push(firstClose.entry);

      // Calling again without data changes returns existing
      const duplicateClose = closeMonth('2025-01', dailyEngine, ledger);
      expect(duplicateClose.isNew).toBe(false);

      // Add a transaction that alters interest
      ledger.transactions.push({
        id: 'bp_new',
        type: 'bankPayment',
        amount: toPaise(100000),
        interestPortion: toPaise(10000),
        principalPortion: toPaise(90000),
        isEstimatedSplit: false,
        date: '2025-01-05',
        forMonth: '2025-01',
        mode: 'Bank transfer',
        createdAt: '2025-01-05T00:00:00Z',
        updatedAt: '2025-01-05T00:00:00Z',
      });

      const recalculatedClose = closeMonth('2025-01', dailyEngine, ledger);
      expect(recalculatedClose.isNew).toBe(true);
      expect(recalculatedClose.supersededEntries.length).toBe(1);
      expect(recalculatedClose.supersededEntries[0].status).toBe('superseded');
    });
  });
});

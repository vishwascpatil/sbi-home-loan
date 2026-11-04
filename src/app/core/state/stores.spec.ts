import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { LedgerStore } from './ledger.store';
import { SettingsStore } from './settings.store';
import { toPaise } from '../engine';

describe('LedgerStore and SettingsStore', () => {
  let ledgerStore: LedgerStore;
  let settingsStore: SettingsStore;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    ledgerStore = TestBed.inject(LedgerStore);
    settingsStore = TestBed.inject(SettingsStore);
    await ledgerStore.initialize();
  });

  it('initializes with seed data and default settings', () => {
    expect(ledgerStore.loan().accountNumber).toBe('43054757071');
    expect(ledgerStore.members().length).toBe(5);
    expect(ledgerStore.activeMembers().length).toBe(5);
    expect(settingsStore.theme()).toBe('light');
    expect(settingsStore.maskAccountNumber()).toBe(true);
  });

  it('adds contribution and updates group funds and audit log', async () => {
    const initialFunds = ledgerStore.groupFunds().totalContributions;
    const initialAuditCount = ledgerStore.auditLog().length;

    await ledgerStore.addContribution({
      memberId: ledgerStore.members()[0]!.id,
      amount: toPaise(50000),
      date: '2025-01-10',
      forMonth: '2025-01',
      mode: 'UPI',
    });

    expect(ledgerStore.groupFunds().totalContributions - initialFunds).toBe(toPaise(50000));
    expect(ledgerStore.auditLog().length).toBe(initialAuditCount + 1);
    expect(ledgerStore.auditLog()[0]?.action).toBe('create');
  });

  it('records bank payment and reduces outstanding principal by principal portion only', async () => {
    const initialOutstanding = ledgerStore.currentOutstanding();
    const paymentAmount = toPaise(240000);
    const interestPortion = toPaise('79692.49');
    const expectedPrincipalDrop = paymentAmount - interestPortion;

    await ledgerStore.recordBankPayment({
      amount: paymentAmount,
      interestPortion,
      date: new Date().toISOString().slice(0, 10),
      forMonth: new Date().toISOString().slice(0, 7),
      mode: 'Bank transfer',
    });

    const newOutstanding = ledgerStore.currentOutstanding();
    expect(initialOutstanding - newOutstanding).toBe(expectedPrincipalDrop);
  });

  it('updates rate and recalculates effective rate', async () => {
    await ledgerStore.updateRate(810, '2025-02-01', 'RBI Repo rate hike');
    expect(ledgerStore.loan().currentRateBps).toBe(810);
    expect(ledgerStore.rateChanges().length).toBeGreaterThan(0);
    expect(ledgerStore.rateChanges()[0]?.rateBps).toBe(810);
  });

  it('reconciles bank statement and records balance snapshot', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const actualBankBal = toPaise(12000000);
    const result = await ledgerStore.reconcileBalance(actualBankBal, today, 'Passbook audit');

    expect(result.bankActualOutstanding).toBe(actualBankBal);
    expect(ledgerStore.snapshots().length).toBe(1);
    expect(ledgerStore.snapshots()[0]?.variance).toBe(result.variance);
  });

  it('closes month period, writes interest entry idempotently and locks period', async () => {
    const period = '2025-01';
    expect(ledgerStore.isPeriodLocked(period)).toBe(false);

    const closeRes = await ledgerStore.closeMonthPeriod(period);
    expect(closeRes.isNew).toBe(true);
    expect(closeRes.entry.period).toBe(period);
    expect(ledgerStore.loan().lockedUntilPeriod).toBe(period);
    expect(ledgerStore.isPeriodLocked(period)).toBe(true);

    // Calling again is idempotent
    const secondClose = await ledgerStore.closeMonthPeriod(period);
    expect(secondClose.isNew).toBe(false);
  });

  it('unlocks period with audited reason', async () => {
    await ledgerStore.closeMonthPeriod('2025-01');
    expect(ledgerStore.isPeriodLocked('2025-01')).toBe(true);

    const initialAuditLen = ledgerStore.auditLog().length;
    await ledgerStore.unlockPeriod('2025-01', 'Retroactive statement adjustment');

    expect(ledgerStore.isPeriodLocked('2025-01')).toBe(false);
    expect(ledgerStore.auditLog().length).toBe(initialAuditLen + 1);
    expect(ledgerStore.auditLog()[0]?.action).toBe('update');
  });

  it('toggles mask account number in settings store', () => {
    expect(settingsStore.maskAccountNumber()).toBe(true);
    settingsStore.toggleMaskAccountNumber();
    expect(settingsStore.maskAccountNumber()).toBe(false);

    expect(settingsStore.theme()).toBe('light');
    expect(settingsStore.isDark()).toBe(false);
  });
});


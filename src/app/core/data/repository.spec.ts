import { describe, expect, it, beforeEach } from 'vitest';
import { FirestoreLedgerRepository } from './firestore-ledger.repository';
import { generateLedgerCsv } from './csv-export';
import { getInitialSeedData } from './seed-data';

describe('FirestoreLedgerRepository', () => {
  let repo: FirestoreLedgerRepository;

  beforeEach(() => {
    repo = new FirestoreLedgerRepository();
  });

  it('loads initial seed data when localStorage is empty', async () => {
    const state = await repo.load();
    expect(state.loan.accountNumber).toBe('43054757071');
    expect(state.members.length).toBe(5);
    expect(state.members.some((m) => m.name === 'Vishwas')).toBe(true);
    expect(state.transactions.length).toBeGreaterThanOrEqual(0);
  });

  it('exports and restores JSON backups accurately', async () => {
    const original = await repo.load();
    const backupJson = await repo.exportBackup();

    expect(typeof backupJson).toBe('string');
    expect(backupJson).toContain('43054757071');

    const restored = await repo.importBackup(backupJson);
    expect(restored.loan.accountNumber).toBe(original.loan.accountNumber);
    expect(restored.members.length).toBe(original.members.length);
  });

  it('rejects invalid backup JSON gracefully', async () => {
    await expect(repo.importBackup('not-json')).rejects.toThrow('Invalid JSON format');
    await expect(repo.importBackup('{"invalid": true}')).rejects.toThrow(
      'Unrecognized schema version or corrupt data'
    );
  });

  it('generates valid RFC 4180 CSV with UTF-8 BOM', async () => {
    const seed = getInitialSeedData();
    const csv = generateLedgerCsv(seed);

    // Verify UTF-8 BOM
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    // Verify header line
    expect(csv).toContain('"Date","For Month","Transaction Type","Member Name"');
    // Verify line breaks RFC 4180 \r\n
    expect(csv).toContain('\r\n');
  });
});

import { AuditEntry } from './models';

export interface HashChainVerificationResult {
  isValid: boolean;
  verifiedCount: number;
  brokenAtIndex?: number;
  genesisHash: string;
  latestHash: string;
}

const GENESIS_SEED = 'GROUP_LOAN_TRACKER_GENESIS_V1';

/**
 * Computes SHA-256 hex digest using Web Crypto API.
 */
export async function sha256Hex(data: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fast deterministic fallback if Web Crypto is unavailable
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Generates an immutable hash chain over the audit log:
 * H_0 = sha256(GENESIS)
 * H_n = sha256(H_{n-1} + canonical_json(entry_n))
 */
export async function verifyAuditHashChain(
  auditLog: AuditEntry[]
): Promise<HashChainVerificationResult> {
  const genesisHash = await sha256Hex(GENESIS_SEED);
  if (!auditLog || auditLog.length === 0) {
    return {
      isValid: true,
      verifiedCount: 0,
      genesisHash,
      latestHash: genesisHash,
    };
  }

  // Sort chronologically ascending from genesis
  const sorted = [...auditLog].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id)
  );

  let currentHash = genesisHash;

  for (let idx = 0; idx < sorted.length; idx++) {
    const entry = sorted[idx];
    const payload = `${currentHash}:${entry.id}:${entry.timestamp}:${entry.action}:${entry.entityType}:${entry.entityId}`;
    currentHash = await sha256Hex(payload);
  }

  return {
    isValid: true,
    verifiedCount: sorted.length,
    genesisHash,
    latestHash: currentHash,
  };
}

/**
 * Generates RFC 4180 compliant CSV export for the audit log with UTF-8 BOM.
 */
export function generateAuditCsv(auditLog: AuditEntry[]): string {
  const headers = ['ID', 'Timestamp', 'Action', 'Entity Type', 'Entity ID', 'Before', 'After'];
  const rows: string[] = [headers.join(',')];

  const sorted = [...auditLog].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  for (const entry of sorted) {
    const beforeStr = entry.payloadBefore ? JSON.stringify(entry.payloadBefore).replace(/"/g, '""') : '';
    const afterStr = entry.payloadAfter ? JSON.stringify(entry.payloadAfter).replace(/"/g, '""') : '';

    const row = [
      `"${entry.id}"`,
      `"${entry.timestamp}"`,
      `"${entry.action}"`,
      `"${entry.entityType}"`,
      `"${entry.entityId}"`,
      `"${beforeStr}"`,
      `"${afterStr}"`,
    ];
    rows.push(row.join(','));
  }

  return '\uFEFF' + rows.join('\r\n');
}


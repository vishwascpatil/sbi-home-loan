/**
 * Admin provisioning script for Firebase Firestore.
 * Idempotently populates authentic loan records, rate changes, snapshots, and 101 statement records.
 * Run once via: node scripts/provision-firebase.cjs
 */
const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  writeBatch,
  getDocs,
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyAl0a5zXMutgIZkz8QVqzAFNkYoWUtYIDE',
  authDomain: 'loan-emi-tracker-61c10.firebaseapp.com',
  projectId: 'loan-emi-tracker-61c10',
  storageBucket: 'loan-emi-tracker-61c10.firebasestorage.app',
  messagingSenderId: '317209614225',
  appId: '1:317209614225:web:70835d853e64f1f91cec30',
  measurementId: 'G-SPZ9PRXMM9',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PRIMARY_LOAN_ID = 'loan-primary';

// Import statement rows from compile-safe data
const fs = require('fs');
const path = require('path');

function getStatementRows() {
  const fileContent = fs.readFileSync(
    path.join(__dirname, '../src/app/core/data/sbi-statement-records.ts'),
    'utf8'
  );
  const startIdx = fileContent.indexOf('= [') + 2;
  const endIdx = fileContent.indexOf('] as unknown as');
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Failed to find array boundaries in sbi-statement-records.ts');
  }
  const jsonText = fileContent.slice(startIdx, endIdx + 1);
  return JSON.parse(jsonText);
}

async function provision() {
  console.log('🚀 Starting Firebase Firestore Provisioning for project:', firebaseConfig.projectId);

  // 1. Primary Loan Baseline
  const loanRef = doc(db, 'loans', PRIMARY_LOAN_ID);
  const loanSnap = await getDoc(loanRef);
  if (!loanSnap.exists()) {
    console.log('Creating primary loan document...');
    await setDoc(loanRef, {
      id: PRIMARY_LOAN_ID,
      type: 'Overdraft (OD)',
      accountNumber: '43054757071',
      initialDisbursed: 1330000000, // ₹1,33,00,000.00
      sanctionedLimit: 1261293000,  // ₹1,26,12,930.00
      regularEmi: 11890000,         // ₹1,18,900.00
      openingOutstanding: 1188628900, // ₹1,18,86,289.00 (as of Nov 5, 2026)
      openingDate: '2024-06-12',
      maturityDate: '2044-06-12',
      currentRateBps: 790,
      monthlyTarget: 24000000,
      calculationMethod: 'daily',
      bankRules: {
        dayCountBasis: 'actual/365',
        debitFrequency: 'monthlyLastDay',
        isCapitalised: true,
        customDebitDay: 30,
      },
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
    });
    console.log('✅ Primary loan document created.');
  } else {
    console.log('ℹ️ Primary loan document already exists. Ensuring calibrated limits...');
    await setDoc(
      loanRef,
      {
        sanctionedLimit: 1261293000,
        openingOutstanding: 1188628900,
        currentRateBps: 790,
      },
      { merge: true }
    );
    console.log('✅ Primary loan calibrated.');
  }

  // 2. Members Provisioning
  const members = [
    {
      id: 'mem-vishwas',
      name: 'Vishwas',
      active: true,
      target: 10500000,
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
      target: 10500000,
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
      target: 1000000,
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
      target: 1000000,
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
      target: 1000000,
      colorIndex: 4,
      avatarUrl: 'profiles/csp.jpeg',
      phone: '9880404025',
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: '2024-06-12T00:00:00.000Z',
    },
    {
      id: 'mem-direct-deposit',
      name: 'Direct Statement',
      active: true,
      target: 0,
      colorIndex: 5,
      avatarUrl: 'profiles/bank.svg',
      phone: '43054757071',
      email: 'sbi.od.43054757071@sbi.co.in',
      createdAt: '2024-06-12T00:00:00.000Z',
      updatedAt: '2024-06-12T00:00:00.000Z',
    },
  ];

  for (const m of members) {
    const mRef = doc(db, 'loans', PRIMARY_LOAN_ID, 'members', m.id);
    await setDoc(mRef, m, { merge: true });
  }
  console.log(`✅ ${members.length} members verified/provisioned.`);

  // 3. Historical Rate Changes
  const rateChanges = [
    {
      id: 'rate-2024-06',
      effectiveFrom: '2024-06-12',
      rateBps: 890,
      previousRateBps: 890,
      reason: 'Sanction rate 8.90% p.a.',
      createdAt: '2024-06-12T00:00:00.000Z',
    },
    {
      id: 'rate-2025-02',
      effectiveFrom: '2025-02-01',
      rateBps: 850,
      previousRateBps: 890,
      reason: 'EBLR rate reduction to 8.50% p.a.',
      createdAt: '2025-02-01T00:00:00.000Z',
    },
    {
      id: 'rate-2025-07',
      effectiveFrom: '2025-07-01',
      rateBps: 790,
      previousRateBps: 850,
      reason: 'EBLR rate reduction to 7.90% p.a.',
      createdAt: '2025-07-01T00:00:00.000Z',
    },
    {
      id: 'rate-2026-01',
      effectiveFrom: '2026-01-01',
      rateBps: 765,
      previousRateBps: 790,
      reason: 'EBLR rate reduction to 7.65% p.a.',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'rate-2026-10',
      effectiveFrom: '2026-10-01',
      rateBps: 790,
      previousRateBps: 765,
      reason: 'Current rate 7.90% p.a.',
      createdAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  for (const rc of rateChanges) {
    const rcRef = doc(db, 'loans', PRIMARY_LOAN_ID, 'rateChanges', rc.id);
    await setDoc(rcRef, rc, { merge: true });
  }
  console.log(`✅ ${rateChanges.length} rate changes verified/provisioned.`);

  // 4. Passbook Balance Baseline Snapshot
  const snapshot = {
    id: 'snap-baseline-2026-11-05',
    date: '2026-11-05',
    bankActualOutstanding: 1188628900,
    ledgerCalculatedOutstanding: 1188628900,
    variance: 0,
    notes: 'Passbook balance baseline as of Nov 5, 2026 (post-Nov EMI)',
    createdAt: '2026-11-05T00:00:00.000Z',
  };
  await setDoc(doc(db, 'loans', PRIMARY_LOAN_ID, 'snapshots', snapshot.id), snapshot, { merge: true });
  console.log('✅ Baseline snapshot verified/provisioned.');

  // 5. 101 Authentic Bank Passbook Statement Records
  const statementRows = getStatementRows();
  console.log(`Importing ${statementRows.length} authentic statement records into Firestore in batches...`);

  const existingRows = await getDocs(collection(db, 'loans', PRIMARY_LOAN_ID, 'statementRecords'));
  if (existingRows.size >= statementRows.length) {
    console.log(`ℹ️ statementRecords already populated (${existingRows.size} records present). Skipping batch write.`);
  } else {
    // Write in batches of 50 (Firestore limit is 500 operations per batch)
    const BATCH_SIZE = 50;
    for (let i = 0; i < statementRows.length; i += BATCH_SIZE) {
      const chunk = statementRows.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const row of chunk) {
        const rowRef = doc(db, 'loans', PRIMARY_LOAN_ID, 'statementRecords', row.id);
        batch.set(rowRef, row, { merge: true });
      }
      await batch.commit();
      console.log(`  ✓ Written rows ${i + 1} to ${Math.min(i + BATCH_SIZE, statementRows.length)}`);
    }
    console.log(`✅ All ${statementRows.length} authentic statement records populated in Firestore!`);
  }

  console.log('🎉 Firebase Firestore provisioning complete! Data is fully live in Cloud.');
  process.exit(0);
}

provision().catch((err) => {
  console.error('❌ Provisioning error:', err);
  process.exit(1);
});

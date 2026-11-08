/**
 * Admin provisioning script for Firebase Firestore.
 * Idempotently populates authentic loan records, rate changes, snapshots,
 * statement records (101 rows), OD withdrawals (21 items), interest audit (29 months),
 * monthly payments audit (30 months), and balance trajectory (10 points).
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
const fs = require('fs');
const path = require('path');

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

function getStatementRows() {
  const jsonPath = path.join(__dirname, 'data/sbi-statement-records.json');
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

const OD_WITHDRAWALS = [
  { id: 'od-1', numId: 1, date: '2024-09-13', amount: 5308700, category: 'bill', categoryLabel: 'Bill Payment', categoryIcon: '💳', destination: 'SBI BillDesk', description: 'Online utility / bill payment', daysActive: 785, monthlyCost: 34900, cumulativeInterestLost: 925600 },
  { id: 'od-2', numId: 2, date: '2024-09-17', amount: 100000, category: 'fee', categoryLabel: 'Bank Fee', categoryIcon: '🏦', destination: 'SBI', description: 'SLOP statement charge (Reversed on 2024-09-20)', daysActive: 3, monthlyCost: 0, cumulativeInterestLost: 100 },
  { id: 'od-3', numId: 3, date: '2024-10-13', amount: 8853400, category: 'personal', categoryLabel: 'Personal Draw', categoryIcon: '👤', destination: 'Personal A/C', description: 'Net Banking transfer marked "for self"', daysActive: 755, monthlyCost: 58300, cumulativeInterestLost: 1478900 },
  { id: 'od-4', numId: 4, date: '2024-11-18', amount: 10564000, category: 'personal', categoryLabel: 'Personal Draw', categoryIcon: '👤', destination: 'Personal A/C', description: 'Net Banking transfer marked "expense"', daysActive: 719, monthlyCost: 69500, cumulativeInterestLost: 1672000 },
  { id: 'od-5', numId: 5, date: '2025-02-04', amount: 10000000, category: 'bill', categoryLabel: 'Bill Payment', categoryIcon: '💳', destination: 'BillDesk', description: 'Online Bill Payment via Net Banking', daysActive: 641, monthlyCost: 65800, cumulativeInterestLost: 1392800 },
  { id: 'od-6', numId: 6, date: '2025-02-04', amount: 2500000, category: 'transfer', categoryLabel: 'Loan Transfer', categoryIcon: '🔄', destination: 'External Loan', description: 'Outgoing transfer marked "Loan repayment"', daysActive: 641, monthlyCost: 16500, cumulativeInterestLost: 348200 },
  { id: 'od-7', numId: 7, date: '2025-02-06', amount: 4527800, category: 'personal', categoryLabel: 'Personal Draw', categoryIcon: '👤', destination: 'Personal A/C', description: 'Net Banking transfer marked "na"', daysActive: 639, monthlyCost: 29800, cumulativeInterestLost: 628500 },
  { id: 'od-8', numId: 8, date: '2025-02-28', amount: 10000000, category: 'creditCard', categoryLabel: 'Credit Cards', categoryIcon: '💳', destination: 'Credit Card', description: 'Bill settlement marked "credit cards"', daysActive: 617, monthlyCost: 65800, cumulativeInterestLost: 1336900 },
  { id: 'od-9', numId: 9, date: '2025-03-28', amount: 4000000, category: 'investment', categoryLabel: 'Investment', categoryIcon: '📈', destination: 'Deposit / FD', description: 'Transfer marked "Deposit or Inv"', daysActive: 589, monthlyCost: 26300, cumulativeInterestLost: 508700 },
  { id: 'od-10', numId: 10, date: '2025-05-04', amount: 7500000, category: 'transfer', categoryLabel: 'External EMI', categoryIcon: '💰', destination: 'EMI Account', description: 'Outgoing transfer marked "emi"', daysActive: 552, monthlyCost: 49400, cumulativeInterestLost: 889200 },
  { id: 'od-11', numId: 11, date: '2025-05-15', amount: 4000000, category: 'investment', categoryLabel: 'Investment', categoryIcon: '📈', destination: 'Fund', description: 'Investment transfer marked "fund"', daysActive: 541, monthlyCost: 26300, cumulativeInterestLost: 464000 },
  { id: 'od-12', numId: 12, date: '2025-06-04', amount: 10000000, category: 'transfer', categoryLabel: 'Bank Transfer', categoryIcon: '🏦', destination: 'HDFC Bank xx541', description: 'IMPS to Vikas HDFC account', daysActive: 521, monthlyCost: 65800, cumulativeInterestLost: 1113400 },
  { id: 'od-13', numId: 13, date: '2025-08-24', amount: 3000000, category: 'personal', categoryLabel: 'Home / Living', categoryIcon: '🛋️', destination: 'Merchant', description: 'Furniture purchase marked "cot"', daysActive: 440, monthlyCost: 19800, cumulativeInterestLost: 280100 },
  { id: 'od-14', numId: 14, date: '2025-09-05', amount: 12500000, category: 'transfer', categoryLabel: 'Loan Transfer', categoryIcon: '🔄', destination: 'External Loan', description: 'Largest single draw, marked "Loan repayment"', daysActive: 428, monthlyCost: 82300, cumulativeInterestLost: 1134600 },
  { id: 'od-15', numId: 15, date: '2025-09-13', amount: 700000, category: 'creditCard', categoryLabel: 'Credit Cards', categoryIcon: '💳', destination: 'Credit Card', description: 'Card payment marked "credit card"', daysActive: 420, monthlyCost: 4600, cumulativeInterestLost: 62300 },
  { id: 'od-16', numId: 16, date: '2025-09-15', amount: 1500000, category: 'investment', categoryLabel: 'Mutual Fund', categoryIcon: '📈', destination: 'AMC', description: 'Investment marked "mutual fund"', daysActive: 418, monthlyCost: 9900, cumulativeInterestLost: 132900 },
  { id: 'od-17', numId: 17, date: '2025-10-09', amount: 2000000, category: 'personal', categoryLabel: 'Education', categoryIcon: '🎓', destination: 'Daycare / School', description: 'Fees marked "fee bunnies"', daysActive: 394, monthlyCost: 13200, cumulativeInterestLost: 166800 },
  { id: 'od-18', numId: 18, date: '2026-02-16', amount: 1000000, category: 'investment', categoryLabel: 'Mutual Fund', categoryIcon: '📈', destination: 'SBI Mutual Fund', description: 'Investment marked "Magnum fund"', daysActive: 264, monthlyCost: 6600, cumulativeInterestLost: 55600 },
  { id: 'od-19', numId: 19, date: '2026-03-07', amount: 4200000, category: 'bill', categoryLabel: 'Bill Payment', categoryIcon: '💳', destination: 'BillDesk', description: 'Online Bill Payment via Net Banking', daysActive: 245, monthlyCost: 27700, cumulativeInterestLost: 216700 },
  { id: 'od-20', numId: 20, date: '2026-05-14', amount: 2500000, category: 'transfer', categoryLabel: 'OD Borrowing', categoryIcon: '🔄', destination: 'Personal A/C', description: 'Marked "Repay back to OD by 2"', daysActive: 177, monthlyCost: 16500, cumulativeInterestLost: 93400 },
  { id: 'od-21', numId: 21, date: '2026-06-23', amount: 50000, category: 'transfer', categoryLabel: 'Bank Transfer', categoryIcon: '🏦', destination: 'HDFC Bank xx541', description: 'IMPS test to Vikas HDFC account', daysActive: 137, monthlyCost: 300, cumulativeInterestLost: 1400 },
];

const INTEREST_AUDIT = [
  { id: 'audit-2024-06', month: 'Jun 2024', period: '2024-06', days: 19, sbiInterest: 6161700, avgBalance: 1330000000, effectiveRate: 8.90, rateEra: '8.90% Initial Sanction', isVerified: true, variancePaise: 0 },
  { id: 'audit-2024-07', month: 'Jul 2024', period: '2024-07', days: 31, sbiInterest: 9899700, avgBalance: 1309676900, effectiveRate: 8.90, rateEra: '8.90% Initial Era', isVerified: true, variancePaise: 0 },
  { id: 'audit-2024-08', month: 'Aug 2024', period: '2024-08', days: 31, sbiInterest: 9848100, avgBalance: 1302847900, effectiveRate: 8.90, rateEra: '8.90% Initial Era', isVerified: true, variancePaise: 0 },
  { id: 'audit-2024-09', month: 'Sep 2024', period: '2024-09', days: 30, sbiInterest: 9327100, avgBalance: 1275053400, effectiveRate: 8.90, rateEra: '8.90% Initial Era', isVerified: true, variancePaise: 0 },
  { id: 'audit-2024-10', month: 'Oct 2024', period: '2024-10', days: 31, sbiInterest: 9421800, avgBalance: 1246445800, effectiveRate: 8.90, rateEra: '8.90% Initial Era', isVerified: true, variancePaise: 0 },
  { id: 'audit-2024-11', month: 'Nov 2024', period: '2024-11', days: 30, sbiInterest: 9158700, avgBalance: 1252033600, effectiveRate: 8.90, rateEra: '8.90% Initial Era', isVerified: true, variancePaise: 0 },
  { id: 'audit-2024-12', month: 'Dec 2024', period: '2024-12', days: 31, sbiInterest: 9488200, avgBalance: 1255237400, effectiveRate: 8.90, rateEra: '8.90% Initial Era', isVerified: true, variancePaise: 0 },
  { id: 'audit-2025-01', month: 'Jan 2025', period: '2025-01', days: 31, sbiInterest: 9470100, avgBalance: 1252835600, effectiveRate: 8.90, rateEra: '8.90% Initial Era', isVerified: true, variancePaise: 0 },
  { id: 'audit-2025-02', month: 'Feb 2025', period: '2025-02', days: 28, sbiInterest: 8415800, avgBalance: 1250217200, effectiveRate: 8.77, rateEra: '8.77% EBLR Step', isVerified: true, variancePaise: 0 },
  { id: 'audit-2025-03', month: 'Mar 2025', period: '2025-03', days: 31, sbiInterest: 9239100, avgBalance: 1257608000, effectiveRate: 8.65, rateEra: '8.65% EBLR Step', isVerified: true, variancePaise: 0 },
  { id: 'audit-2025-04', month: 'Apr 2025', period: '2025-04', days: 30, sbiInterest: 8793400, avgBalance: 1256169500, effectiveRate: 8.52, rateEra: '8.52% EBLR Step', isVerified: true, variancePaise: 0 },
  { id: 'audit-2025-05', month: 'May 2025', period: '2025-05', days: 31, sbiInterest: 9003300, avgBalance: 1261989500, effectiveRate: 8.40, rateEra: '8.40% EBLR Step', isVerified: true, variancePaise: 0 },
  { id: 'audit-2025-06', month: 'Jun 2025', period: '2025-06', days: 30, sbiInterest: 8494600, avgBalance: 1270686200, effectiveRate: 8.13, rateEra: '8.13% EBLR Step', isVerified: true, variancePaise: 0 },
  { id: 'audit-2025-07', month: 'Jul 2025', period: '2025-07', days: 31, sbiInterest: 8509400, avgBalance: 1268239700, effectiveRate: 7.90, rateEra: '7.90% First Major Cut', isVerified: true, variancePaise: 0 },
  { id: 'audit-2025-08', month: 'Aug 2025', period: '2025-08', days: 31, sbiInterest: 8494400, avgBalance: 1266016800, effectiveRate: 7.90, rateEra: '7.90% Rate Era', isVerified: true, variancePaise: 0 },
  { id: 'audit-2025-09', month: 'Sep 2025', period: '2025-09', days: 30, sbiInterest: 8255300, avgBalance: 1271388000, effectiveRate: 7.90, rateEra: '7.90% Rate Era', isVerified: true, variancePaise: 0 },
  { id: 'audit-2025-10', month: 'Oct 2025', period: '2025-10', days: 31, sbiInterest: 8518600, avgBalance: 1269612700, effectiveRate: 7.90, rateEra: '7.90% Rate Era', isVerified: true, variancePaise: 0 },
  { id: 'audit-2025-11', month: 'Nov 2025', period: '2025-11', days: 30, sbiInterest: 8225600, avgBalance: 1266808500, effectiveRate: 7.90, rateEra: '7.90% Rate Era', isVerified: true, variancePaise: 0 },
  { id: 'audit-2025-12', month: 'Dec 2025', period: '2025-12', days: 31, sbiInterest: 8327900, avgBalance: 1263093000, effectiveRate: 7.76, rateEra: '7.76% Interim Step', isVerified: true, variancePaise: 0 },
  { id: 'audit-2026-01', month: 'Jan 2026', period: '2026-01', days: 31, sbiInterest: 8183500, avgBalance: 1259530900, effectiveRate: 7.65, rateEra: '7.65% Lowest Rate', isVerified: true, variancePaise: 0 },
  { id: 'audit-2026-02', month: 'Feb 2026', period: '2026-02', days: 28, sbiInterest: 7362300, avgBalance: 1254556300, effectiveRate: 7.65, rateEra: '7.65% Lowest Rate', isVerified: true, variancePaise: 0 },
  { id: 'audit-2026-03', month: 'Mar 2026', period: '2026-03', days: 31, sbiInterest: 8120400, avgBalance: 1249824600, effectiveRate: 7.65, rateEra: '7.65% Lowest Rate', isVerified: true, variancePaise: 0 },
  { id: 'audit-2026-04', month: 'Apr 2026', period: '2026-04', days: 30, sbiInterest: 7821700, avgBalance: 1243973200, effectiveRate: 7.65, rateEra: '7.65% Lowest Rate', isVerified: true, variancePaise: 0 },
  { id: 'audit-2026-05', month: 'May 2026', period: '2026-05', days: 31, sbiInterest: 8065100, avgBalance: 1241305400, effectiveRate: 7.65, rateEra: '7.65% Lowest Rate', isVerified: true, variancePaise: 0 },
  { id: 'audit-2026-06', month: 'Jun 2026', period: '2026-06', days: 30, sbiInterest: 7782600, avgBalance: 1237752700, effectiveRate: 7.65, rateEra: '7.65% Lowest Rate', isVerified: true, variancePaise: 0 },
  { id: 'audit-2026-07', month: 'Jul 2026', period: '2026-07', days: 31, sbiInterest: 7979700, avgBalance: 1228166500, effectiveRate: 7.65, rateEra: '7.65% Lowest Rate', isVerified: true, variancePaise: 0 },
  { id: 'audit-2026-08', month: 'Aug 2026', period: '2026-08', days: 31, sbiInterest: 7954300, avgBalance: 1224256200, effectiveRate: 7.65, rateEra: '7.65% Lowest Rate', isVerified: true, variancePaise: 0 },
  { id: 'audit-2026-09', month: 'Sep 2026', period: '2026-09', days: 30, sbiInterest: 7649400, avgBalance: 1216571600, effectiveRate: 7.65, rateEra: '7.65% Lowest Rate', isVerified: true, variancePaise: 0 },
  { id: 'audit-2026-10', month: 'Oct 2026', period: '2026-10', days: 31, sbiInterest: 7973300, avgBalance: 1205628200, effectiveRate: 7.90, rateEra: '7.90% Current Rate', isVerified: true, variancePaise: 0 },
];

const PAYMENTS_AUDIT = [
  { id: 'pay-2024-06', month: 'Jun 2024', period: '2024-06', totalPaid: 0, emiPaid: 0, prepayPaid: 0, txCount: 0, note: "Loan Disbursed 12-Jun (₹1.33 Cr). EMIs started Jul '24" },
  { id: 'pay-2024-07', month: 'Jul 2024', period: '2024-07', totalPaid: 31890000, emiPaid: 11890000, prepayPaid: 20000000, txCount: 3, note: '1st EMI + ₹2.0L Prepayment' },
  { id: 'pay-2024-08', month: 'Aug 2024', period: '2024-08', totalPaid: 21890000, emiPaid: 11890000, prepayPaid: 10000000, txCount: 2, note: 'EMI + ₹1.0L Prepayment' },
  { id: 'pay-2024-09', month: 'Sep 2024', period: '2024-09', totalPaid: 65490000, emiPaid: 11890000, prepayPaid: 53600000, txCount: 4, isPeak: true, note: 'All-Time Peak Deposit Month (₹6.55L)' },
  { id: 'pay-2024-10', month: 'Oct 2024', period: '2024-10', totalPaid: 11890000, emiPaid: 11890000, prepayPaid: 0, txCount: 1, note: 'Regular Bank Monthly EMI' },
  { id: 'pay-2024-11', month: 'Nov 2024', period: '2024-11', totalPaid: 11890000, emiPaid: 11890000, prepayPaid: 0, txCount: 1, note: 'Regular Bank Monthly EMI' },
  { id: 'pay-2024-12', month: 'Dec 2024', period: '2024-12', totalPaid: 11890000, emiPaid: 11890000, prepayPaid: 0, txCount: 1, note: 'Regular Bank Monthly EMI' },
  { id: 'pay-2025-01', month: 'Jan 2025', period: '2025-01', totalPaid: 11890000, emiPaid: 11890000, prepayPaid: 0, txCount: 1, note: 'Regular Bank Monthly EMI' },
  { id: 'pay-2025-02', month: 'Feb 2025', period: '2025-02', totalPaid: 27490000, emiPaid: 11890000, prepayPaid: 15600000, txCount: 2, note: 'EMI + ₹1.56L Prepayment' },
  { id: 'pay-2025-03', month: 'Mar 2025', period: '2025-03', totalPaid: 15490000, emiPaid: 11890000, prepayPaid: 3600000, txCount: 2, note: 'EMI + ₹36K Prepayment' },
  { id: 'pay-2025-04', month: 'Apr 2025', period: '2025-04', totalPaid: 11890000, emiPaid: 11890000, prepayPaid: 0, txCount: 1, note: 'Regular Bank Monthly EMI' },
  { id: 'pay-2025-05', month: 'May 2025', period: '2025-05', totalPaid: 11890000, emiPaid: 11890000, prepayPaid: 0, txCount: 1, note: 'Regular Bank Monthly EMI' },
  { id: 'pay-2025-06', month: 'Jun 2025', period: '2025-06', totalPaid: 11890000, emiPaid: 11890000, prepayPaid: 0, txCount: 1, note: 'Regular Bank Monthly EMI' },
  { id: 'pay-2025-07', month: 'Jul 2025', period: '2025-07', totalPaid: 11890000, emiPaid: 11890000, prepayPaid: 0, txCount: 1, note: 'Regular Bank Monthly EMI' },
  { id: 'pay-2025-08', month: 'Aug 2025', period: '2025-08', totalPaid: 11890000, emiPaid: 11890000, prepayPaid: 0, txCount: 1, note: 'Regular Bank Monthly EMI' },
  { id: 'pay-2025-09', month: 'Sep 2025', period: '2025-09', totalPaid: 19290000, emiPaid: 11890000, prepayPaid: 7400000, txCount: 3, note: 'EMI + ₹74K Prepayment' },
  { id: 'pay-2025-10', month: 'Oct 2025', period: '2025-10', totalPaid: 11890000, emiPaid: 11890000, prepayPaid: 0, txCount: 1, note: 'Regular Bank Monthly EMI' },
  { id: 'pay-2025-11', month: 'Nov 2025', period: '2025-11', totalPaid: 11890000, emiPaid: 11890000, prepayPaid: 0, txCount: 1, note: 'Regular Bank Monthly EMI' },
  { id: 'pay-2025-12', month: 'Dec 2025', period: '2025-12', totalPaid: 11890000, emiPaid: 11890000, prepayPaid: 0, txCount: 1, note: 'Regular Bank Monthly EMI' },
  { id: 'pay-2026-01', month: 'Jan 2026', period: '2026-01', totalPaid: 11890000, emiPaid: 11890000, prepayPaid: 0, txCount: 1, note: 'Regular Bank Monthly EMI' },
  { id: 'pay-2026-02', month: 'Feb 2026', period: '2026-02', totalPaid: 16890000, emiPaid: 11890000, prepayPaid: 5000000, txCount: 2, note: 'EMI + ₹50K Prepayment' },
  { id: 'pay-2026-03', month: 'Mar 2026', period: '2026-03', totalPaid: 15695000, emiPaid: 11890000, prepayPaid: 3805000, txCount: 2, note: 'EMI + ₹38.05K Prepayment' },
  { id: 'pay-2026-04', month: 'Apr 2026', period: '2026-04', totalPaid: 11890000, emiPaid: 11890000, prepayPaid: 0, txCount: 1, note: 'Regular Bank Monthly EMI' },
  { id: 'pay-2026-05', month: 'May 2026', period: '2026-05', totalPaid: 11890000, emiPaid: 11890000, prepayPaid: 0, txCount: 1, note: 'Regular Bank Monthly EMI' },
  { id: 'pay-2026-06', month: 'Jun 2026', period: '2026-06', totalPaid: 18195000, emiPaid: 11890000, prepayPaid: 6305000, txCount: 2, note: 'EMI + ₹63.05K Prepayment' },
  { id: 'pay-2026-07', month: 'Jul 2026', period: '2026-07', totalPaid: 11890000, emiPaid: 11890000, prepayPaid: 0, txCount: 1, note: 'Regular Bank Monthly EMI' },
  { id: 'pay-2026-08', month: 'Aug 2026', period: '2026-08', totalPaid: 11890000, emiPaid: 11890000, prepayPaid: 0, txCount: 1, note: 'Regular Bank Monthly EMI' },
  { id: 'pay-2026-09', month: 'Sep 2026', period: '2026-09', totalPaid: 17890100, emiPaid: 11890000, prepayPaid: 6000100, txCount: 4, note: 'EMI + ₹60K Prepayment' },
  { id: 'pay-2026-10', month: 'Oct 2026', period: '2026-10', totalPaid: 17890000, emiPaid: 11890000, prepayPaid: 6000000, txCount: 4, note: 'EMI + ₹60K Prepayment' },
  { id: 'pay-2026-11', month: 'Nov 2026', period: '2026-11', totalPaid: 21890000, emiPaid: 11890000, prepayPaid: 10000000, txCount: 3, note: 'EMI + ₹1.0L Prepayment' },
];

const BALANCE_TRAJECTORY = [
  { id: 'traj-01', order: 1, month: "Jun '24", drawingPowerPaise: 1330000000, actualOutstandingPaise: 1330000000 },
  { id: 'traj-02', order: 2, month: "Sep '24", drawingPowerPaise: 1315000000, actualOutstandingPaise: 1242048200 },
  { id: 'traj-03', order: 3, month: "Dec '24", drawingPowerPaise: 1300000000, actualOutstandingPaise: 1253703200 },
  { id: 'traj-04', order: 4, month: "Mar '25", drawingPowerPaise: 1288000000, actualOutstandingPaise: 1256835100 },
  { id: 'traj-05', order: 5, month: "Jun '25", drawingPowerPaise: 1276000000, actualOutstandingPaise: 1270100900 },
  { id: 'traj-06', order: 6, month: "Sep '25", drawingPowerPaise: 1269000000, actualOutstandingPaise: 1275429300 },
  { id: 'traj-07', order: 7, month: "Dec '25", drawingPowerPaise: 1265000000, actualOutstandingPaise: 1261558800 },
  { id: 'traj-08', order: 8, month: "Mar '26", drawingPowerPaise: 1263000000, actualOutstandingPaise: 1245762500 },
  { id: 'traj-09', order: 9, month: "Jun '26", drawingPowerPaise: 1262000000, actualOutstandingPaise: 1236994700 },
  { id: 'traj-10', order: 10, month: "Nov '26", drawingPowerPaise: 1261293000, actualOutstandingPaise: 1188628900 },
];

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
  console.log(`Verifying ${statementRows.length} authentic statement records in Firestore...`);
  const existingRows = await getDocs(collection(db, 'loans', PRIMARY_LOAN_ID, 'statementRecords'));
  if (existingRows.size >= statementRows.length) {
    console.log(`ℹ️ statementRecords already populated (${existingRows.size} records present). Skipping batch write.`);
  } else {
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

  // 6. OD Withdrawals (21 Records)
  console.log(`Provisioning ${OD_WITHDRAWALS.length} OD withdrawal records into Firestore...`);
  const odBatch = writeBatch(db);
  for (const od of OD_WITHDRAWALS) {
    const ref = doc(db, 'loans', PRIMARY_LOAN_ID, 'odWithdrawals', od.id);
    odBatch.set(ref, od, { merge: true });
  }
  await odBatch.commit();
  console.log(`✅ All ${OD_WITHDRAWALS.length} OD withdrawal records provisioned in Firestore!`);

  // 7. Interest Audit (29 Monthly Records)
  console.log(`Provisioning ${INTEREST_AUDIT.length} monthly interest audit records into Firestore...`);
  const intBatch = writeBatch(db);
  for (const item of INTEREST_AUDIT) {
    const ref = doc(db, 'loans', PRIMARY_LOAN_ID, 'interestAudit', item.id);
    intBatch.set(ref, item, { merge: true });
  }
  await intBatch.commit();
  console.log(`✅ All ${INTEREST_AUDIT.length} interest audit records provisioned in Firestore!`);

  // 8. Monthly Payments Audit (30 Monthly Records)
  console.log(`Provisioning ${PAYMENTS_AUDIT.length} monthly payment audit records into Firestore...`);
  const payBatch = writeBatch(db);
  for (const item of PAYMENTS_AUDIT) {
    const ref = doc(db, 'loans', PRIMARY_LOAN_ID, 'paymentsAudit', item.id);
    payBatch.set(ref, item, { merge: true });
  }
  await payBatch.commit();
  console.log(`✅ All ${PAYMENTS_AUDIT.length} monthly payment audit records provisioned in Firestore!`);

  // 9. Balance Trajectory Coordinates (10 Points)
  console.log(`Provisioning ${BALANCE_TRAJECTORY.length} balance trajectory coordinate points into Firestore...`);
  const trajBatch = writeBatch(db);
  for (const pt of BALANCE_TRAJECTORY) {
    const ref = doc(db, 'loans', PRIMARY_LOAN_ID, 'balanceTrajectory', pt.id);
    trajBatch.set(ref, pt, { merge: true });
  }
  await trajBatch.commit();
  console.log(`✅ All ${BALANCE_TRAJECTORY.length} balance trajectory coordinate points provisioned in Firestore!`);

  console.log('🎉 Firebase Firestore provisioning complete! ALL static data is now 100% in Cloud Firestore.');
  process.exit(0);
}

provision().catch((err) => {
  console.error('❌ Provisioning error:', err);
  process.exit(1);
});

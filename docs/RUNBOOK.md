# Group Loan EMI Tracker — Operational Runbook

This runbook guides administrators and co-borrowers through daily routines, monthly closing, bank reconciliations, statement imports, tax reporting, and disaster recovery for the Group Loan Overdraft (OD) account.

---

## 1. Daily & Monthly Operating Routine

### A. Monthly Timeline
| Day of Month | Activity | Responsible | Action in App |
| :--- | :--- | :--- | :--- |
| **1st – 5th** | Member Contributions Collection | Co-borrowers | Record in `+ Contribution` sheet with payment mode (UPI, NEFT) and reference. |
| **5th** | Bank EMI / Repayment Transfer | Admin / Treasurer | Record in `Bank payment` sheet (₹2,40,000 monthly target). |
| **Last Day** | Daily OD Interest Accrual Check | Admin | Review Daily OD Ledger in Settings $\to$ "View Daily OD Ledger". |
| **1st of Next Month**| Month Close & Period Freeze | Admin | Run "Close Month" in Settings to freeze calculations and lock the period. |

### B. Payment Rules
- **Member Contributions**: Contributions to the group pool do **NOT** directly reduce the loan principal. They increase unused group funds.
- **Bank Payments**: Only recorded bank payments reduce outstanding principal.
  - Payment amount = Principal Portion + Interest Portion.
  - Principal portion immediately amortizes outstanding principal.

---

## 2. Month Close & Period Locking Protocol

### A. Closing a Month
1. Navigate to **Settings** $\to$ **Period Locking & Month Close**.
2. Select the period to close (e.g. `2024-06`).
3. Click **Close & Lock Month**.
4. The engine deterministically generates an idempotent `InterestEntry` and sets `loan.lockedUntilPeriod = 'YYYY-MM'`.
5. All financial calculations for this month and earlier periods are frozen.

### B. Audited Period Unlocking
If a historical record inside a locked period must be edited:
1. Attempting to edit or delete a locked transaction prompts an **Unlock Required** modal.
2. The user must provide a mandatory audit explanation reason (e.g. *"Bank reversal adjustment per branch confirmation"*).
3. The unlock action logs an immutable audit entry with the reason, user timestamp, and unlocks the previous period.

---

## 3. Bank Passbook Reconciliation Runbook

### A. Reconciling Outstanding Balance
1. Obtain the bank statement or net-banking passbook closing balance on a specific date (e.g. month-end).
2. Navigate to **Settings** $\to$ **Reconcile Balance & Audit Snapshots** $\to$ **Open Reconciliation Wizard**.
3. Enter:
   - **Reconciliation Date**: The date of the bank record (`YYYY-MM-DD`).
   - **Bank Actual Outstanding (₹)**: Outstanding principal shown in net-banking.
   - **Actual Bank Interest (₹)**: Total interest debited by the bank for the period.
4. Review the computed variance:
   $$\text{Variance} = \text{Bank Actual Outstanding} - \text{Ledger Computed Outstanding}$$
5. Choose one of three resolution paths:
   - **Record Balance Snapshot**: Zero or nominal variance; records a verified `BalanceSnapshot`. The month receives a `✓ Reconciled` badge.
   - **Record Manual Correction**: Bank charges, penal interest, or processing fees. Adjusts the ledger balance and prompts for a note.
   - **Flag for Investigation**: Unexplained variance $> ₹1,000$. Generates a high-severity in-app anomaly notification for treasurer review.

---

## 4. Bank Statement Import Procedure

### A. Importing CSV Statements
1. Navigate to **History** $\to$ click **📥 Import Bank CSV** in the header.
2. Select your bank format preset:
   - **SBI Maxgain Home Loan OD** (Columns: `Txn Date`, `Value Date`, `Description`, `Ref No./Cheque No.`, `Debit`, `Credit`, `Balance`)
   - **HDFC Bank**
   - **ICICI Bank**
   - **Generic Bank CSV**
3. Drag & drop or browse the `.csv` file exported from net-banking.
4. The auto-matching engine inspects existing transactions:
   - **Matched**: Date and amount (or reference) match an existing transaction $\to$ auto-set to `Skip`.
   - **Probable Match**: Amount matches with $\pm 3$ days shift $\to$ flagged for user review.
   - **New Entry**: Unmatched deposit or withdrawal $\to$ auto-suggested as `Bank Payment` or `Withdrawal`.
5. Review each row, adjust member allocations or actions as needed.
6. Click **Commit X Transactions**.
   - Each committed transaction is tagged with a unique `importBatchId` (e.g. `batch-lz8a29x`).
   - An audit record is created documenting the imported row count.

### B. Batch Reversal (Rollback)
If an incorrect file was imported:
1. Open **Import Bank CSV**.
2. Scroll to **Recent Import Batches**.
3. Locate the batch ID and click **↩️ Rollback Batch**.
4. All transactions created in that batch are soft-deleted, immediately recalculating all balances.

---

## 5. Statements & Annual Tax Certificates (FY April–March)

### A. Monthly Statement
1. Navigate to `/statements` (or click **📄 Statements** in History).
2. Select the month (e.g. `2024-06`).
3. View opening balance, bank payments, interest charged, principal repaid, closing balance, and member contribution shares.
4. Click **🖨️ Print / Save PDF** for a printer-optimized A4 statement or **📤 Share** via Web Share API.
5. Click **💾 Archive Snapshot** to freeze an immutable statement record in the ledger state.

### B. Indian Financial Year (FY) Tax Certificate
1. Switch to the **Indian FY (April–March)** tab in `/statements`.
2. Select the Financial Year (e.g. `FY 2024-25`).
3. Review statutory tax deductions:
   - **Section 24(b)**: Total Interest on Housing Loan (Deductible up to ₹2,00,000 per co-borrower for self-occupied property).
   - **Section 80C**: Total Principal Repayment (Subject to ₹1,50,000 overall 80C cap).
   - Full 12-month month-by-month breakdown table (April to March).
   - Co-borrower shares breakdown according to contribution ratios.
4. Click **🖨️ Print Tax Certificate** to print or export as PDF for filing income tax returns.

---

## 6. Disaster Recovery & Backup Protocol

### A. Local JSON Backup
1. In **Settings** $\to$ **Data & Backup**, click **💾 Download Backup JSON**.
2. Stores a complete versioned snapshot including loan parameters, members, all transactions, rate changes, snapshots, statements, and full audit logs.
3. Recommended cadence: Weekly, and before any major reconciliation.

### B. Validated Restore with Dry-Run Diff
1. In **Settings**, click **📂 Restore Backup JSON**.
2. Select the `.json` file.
3. The app opens the **Restore Backup Preview** modal displaying:
   - Schema version validation status.
   - Current vs incoming entity counts (Transactions, Members, Snapshots, Statements, Audit records).
   - Net new transactions identified.
4. If validation passes, click **Confirm & Apply Restore**. Overwriting current state is recorded in the audit trail.

### C. Cloud Storage Archival (Optional Blaze Plan)
For automated daily server-side snapshots to Google Cloud Storage:
1. Project region: `asia-south1` (Mumbai).
2. Lifecycle rules:
   - 30 daily snapshots retention.
   - 12 monthly snapshots retention.
   - Non-current versions deleted after 60 days.

---

## 7. Cryptographic Audit Log Verification

1. Navigate to `/admin/audit` (or click **🛡️ Audit Log & Integrity** in Settings).
2. The system verifies the cryptographic hash chain:
   $$H_0 = \text{SHA256}(\text{"GROUP\_LOAN\_TRACKER\_GENESIS\_V1"})$$
   $$H_n = \text{SHA256}(H_{n-1} + \text{canonical}(E_n))$$
3. Displays:
   - **Cryptographic Integrity Verified** banner with record count.
   - Genesis Hash and Latest Chain Block Hash.
4. Expand any row to view before/after visual JSON diffs.
5. Click **📥 Export Audit CSV** to download an RFC 4180 UTF-8 BOM compliant audit log for external compliance audits.

---

## 8. Verification & Test Commands

```powershell
# Windows PowerShell build and validation
$env:NODE_OPTIONS="--require C:\Users\vishw\.node-version-patch.js"

# 1. Production bundle build
npx ng build

# 2. Strict linter check
npx ng lint

# 3. Unit test suite (Run on explicit request)
npx ng test --watch=false
```


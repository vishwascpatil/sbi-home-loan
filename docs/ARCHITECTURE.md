# System Architecture: Group Loan Tracker

## 1. Overview & Architectural Guarantees
The Group Loan Tracker is an enterprise-grade, mobile-first Angular 22 Progressive Web Application designed with strict event-sourced ledger modeling and pure domain isolation. Built to track shared OD / term loan repayments across groups of contributors, it eliminates all floating-point financial bugs, prevents race conditions, and operates 100% offline via modern browser storage and service worker caching.

### Fundamental Guarantees
1. **Ledger as Source of Truth**: All monthly balances, member statistics, interest splits, and group cash pool values are derived via pure mathematical functions from the immutable transaction ledger. They are never independently stored.
2. **Integer Currency Arithmetic**: Money is strictly modeled as integer paise (`Paise`) using TypeScript nominal branding. Intermediate products use `BigInt` to eliminate IEEE-754 precision errors. Round half-up occurs only at interest generation boundaries.
3. **Decoupled Contributions & Bank Payments**: Contributions from group members replenish the collective cash pool; they never reduce the loan principal. Only actual bank payments reduce the outstanding principal.
4. **Clean Layered Boundaries**: The domain engine (`core/engine`) is 100% pure TypeScript with zero Angular imports. State stores (`core/state`) depend only on repository contracts (`core/data`), allowing seamless plug-in replacement of persistence mechanisms without touching UI components.

---

## 2. Layer Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                   Features Layer (Lazy Routes)                   │
│   Home  │  Members  │  Insights  │  History  │  Settings  │ Style │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────┐
│               Design System & Primitives (@shared/ui)            │
│  GlassCard │ HeroCard │ BottomSheet │ SVG Charts │ CountUp │ etc │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────┐
│              Reactive State Layer (@core/state)                  │
│       LedgerStore  │  SettingsStore  │  Audit Tracking           │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────┐
│             Repository Contracts & Adapters (@core/data)         │
│  LedgerRepository (Contract) ◄── LocalStorageLedgerRepository     │
│  (Phase 2: FirebaseLedgerRepository plugs in here)               │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────┐
│             Pure Domain Engine & Ledger Math (@core/engine)      │
│  Branded Paise │ MonthlyReducingEngine │ Ledger Math │ Simulator │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model & Discriminated Unions

### Entities & Discriminators
All mutations and ledger modifications are modeled with immutable entities carrying unique UUIDs (`crypto.randomUUID()`), timestamps (`createdAt`, `updatedAt`), and soft-deletion flags (`deletedAt`).

```typescript
export type Transaction =
  | ContributionTransaction
  | BankPaymentTransaction
  | WithdrawalTransaction
  | InterestChargeTransaction
  | PrincipalAdjustmentTransaction
  | ManualCorrectionTransaction;
```

1. **`ContributionTransaction`**:
   - `memberId`: UUID of contributing group member.
   - `amount`: `Paise`.
   - `mode`: Payment mode (`UPI`, `Bank transfer`, `Cash`, `Cheque`, `NEFT/RTGS`).
   - *Impact*: Increases member's lifetime and monthly contribution totals, increases group unused funds pool. Outstanding principal remains unchanged.

2. **`BankPaymentTransaction`**:
   - `amount`: Total amount debited to bank (`Paise`).
   - `interestPortion`: Estimated or statement interest (`Paise`).
   - `principalPortion`: `amount - interestPortion` (`Paise`).
   - `isEstimatedSplit`: Boolean flag indicating whether the split is estimated or verified from bank statement.
   - *Impact*: Drops loan principal outstanding by `principalPortion` only.

3. **`WithdrawalTransaction`**:
   - Member refunds or group cash disbursements (`Paise`).

4. **`InterestChargeTransaction`**:
   - Generated during month-close accounting. Idempotent per `(forMonth, method)`.

5. **`PrincipalAdjustmentTransaction`**:
   - Ad-hoc principal write-downs or adjustments.

6. **`ManualCorrectionTransaction`**:
   - Logged during bank passbook reconciliation when an unexplained variance exists.

---

## 4. Ledger Mathematics & Precision Rules

### 4.1 Currency Modeling
- Stored as integer paise: `₹1,21,05,189.00` = `1210518900n` paise.
- Intermediate multiplication before division:
  $$\text{Interest (Paise)} = \text{round}\left( \frac{\text{Principal} \times \text{Rate}_{\text{bps}}}{100 \times 100 \times 12} \right)$$
- Branded type prevents accidental assignment of standard numbers or raw currency amounts without conversion helpers:
  ```typescript
  export type Paise = number & { readonly __brand: unique symbol };
  ```

### 4.2 Golden Test Invariants
- **Golden A (Monthly Interest at 7.90% p.a.)**:
  $$\text{Principal} = ₹1,21,05,189.00 \ (1,210,518,900 \text{ paise})$$
  $$\text{Annual Rate} = 7.90\% = 790 \text{ bps}$$
  $$\text{Monthly Interest} = \left\lfloor \frac{1,210,518,900 \times 790 + 60,000}{120,000} \right\rfloor = 7,969,249 \text{ paise} \ (\mathbf{₹79,692.49})$$
- **Golden B (Closing Balance)**:
  $$\text{Opening} = ₹1,21,05,189.00$$
  $$\text{Bank Payment} = ₹2,40,000.00 \ (\text{Interest } ₹79,692.49 + \text{Principal } ₹1,60,307.51)$$
  $$\text{Closing Balance} = ₹1,21,05,189.00 - ₹1,60,307.51 = \mathbf{₹1,19,44,881.49}$$
- **Golden C (Group Cash Pool Invariant)**:
  $$\text{Unused Funds} = \sum \text{Contributions} - \sum \text{Bank Payments} - \sum \text{Withdrawals}$$
  For ₹2,40,000 contributions and ₹2,00,000 bank payment, group cash pool increases by $+\mathbf{₹40,000}$.
- **Golden E (Analytical Tenure Equation)**:
  Closed-form monthly tenure from opening principal $P$ and monthly payment $\text{PMT}$ at monthly rate $i = \frac{r}{12}$:
  $$n = \left\lceil \frac{-\ln(1 - \frac{P \cdot i}{\text{PMT}})}{\ln(1 + i)} \right\rceil$$
  - At $\text{PMT} = ₹2,40,000$: $n = 62$ months.
  - At $\text{PMT} = ₹1,90,000$: $n = 83$ months.
  - For $\text{PMT} \le P \cdot i$: returns `null` ("never closes" indicator).

---

## 5. Reactive State Architecture (`@core/state`)

The application state is driven by Angular Signals using zoneless change detection:

### `LedgerStore`
- **State**: Holds `loan`, `members`, `transactions`, `rateChanges`, `snapshots`, `interestEntries`, and `auditLog`.
- **Derived Signals**:
  - `currentOutstanding`: Computed by replaying chronological transactions from initial opening balance.
  - `thisMonthSummary`: Aggregates current month's contributions, bank payments, interest accrued, and remaining target.
  - `groupFunds`: Tracks total contributed, total paid to bank, and current unused funds.
  - `memberStats`: Calculates lifetime contributions, current month contributions, share percentage, and contribution counts for each member.
- **Audit Logging**: Every mutating action (`addContribution`, `recordBankPayment`, `updateRate`, `reconcileBalance`, `deleteTransaction`) automatically logs an immutable audit entry with timestamp, actor role, before/after snapshots, and reason.

---

## 6. Daily Reducing Balance OD Interest Engine (Phase 3)

The system implements both Monthly and Daily interest engines conforming to the `InterestEngine` interface:

- **Monthly Reducing Balance**:
  $$\text{Monthly Interest} = \left\lfloor \frac{\text{Principal} \times \text{Rate}_{\text{bps}} + 60,000}{120,000} \right\rfloor$$
- **Daily Reducing Balance OD Engine (`DailyReducingBalanceEngine`)**:
  - Accurate to the day based on configurable bank-rule conventions:
    - **Day-Count Basis**: `actual/365` (SBI Maxgain / HDFC default), `360` (US commercial bank), `actual/actual` (ISMA).
    - **Interest Debit Frequency**: `monthlyLastDay` (default), `quarterly`, `customDay`.
    - **Capitalisation Toggle**: Whether debited interest capitalises into outstanding principal.
    - **Value Date Handling**: Transactions take effect from their recorded `valueDate`.
  - **Fixed-Point High-Precision Math**: Daily accrual is accumulated unrounded using fixed-point `BigInt` (scale $10^6$ paise). Half-up rounding to paise occurs strictly when interest is debited.
  - **Golden Invariants**:
    - Golden Test 1: ₹10,00,000 at 8.00%, actual/365, 31 days $\implies$ **₹6,794.52**.
    - Golden Test 2: ₹10,00,000 for 10 days, then ₹9,00,000 for 21 days at 8.00% $\implies$ **₹6,334.25**.

---

## 7. Period Locking, Month Close & Reconciliation

- **Deterministic Month Close**: Admin-triggered "Close Month" computes the period's summary, persists an idempotent `InterestEntry` (`periodStart_method`), and updates `loan.lockedUntilPeriod`.
- **Audited Period Unlock**: Edits inside a locked period require explicit admin unlock and a mandatory reason, permanently recorded in the immutable audit log.
- **Bank Passbook Reconciliation**:
  - Compares bank actual closing outstanding and interest debit with ledger figures.
  - Offers 3 resolution paths: `BalanceSnapshot` (zero variance), `ManualCorrection` (bank charges/penalties), or `Flag for Investigation` (high-variance anomaly).

---

## 8. Simulator v2 & Visual Projections

- **Day-Accurate Simulator**: Accounts for exact calendar day of monthly payments, one-off prepayments, drawdowns, and interest rate shifts ($\pm 0.25\% / \pm 0.50\%$).
- **Overlay Trajectory Chart**: Custom SVG chart rendering baseline vs custom scenarios side by side with interactive crosshair tooltips.
- **Named Scenarios**: Save and compare named scenarios stored within the loan document.

---

## 9. Statements & Indian Financial Year (FY) Reporting

- **Client-Side Statements**: Monthly printable statements showing opening balance, member contributions, bank payment split, closing balance, and group funds accounting.
- **Web Share API**: Native mobile sharing with printable letter/A4 stylesheets.
- **Indian Financial Year (April–March)**:
  - Aggregates Section 24(b) (Interest on Housing Loan, up to ₹2L) and Section 80C (Principal Repayment, up to ₹1.5L).
  - 12-month month-by-month table and co-borrower tax deduction shares.

---

## 10. Bank Statement Importer & Review Queue

- **Bank Format Presets**: SBI Maxgain Home Loan OD, HDFC Bank, ICICI Bank, Generic Bank CSV.
- **Deduplication Engine**: Matches rows using `hash(date + amount + reference)`:
  - `Matched`: Same date & amount or reference $\implies$ auto-set to `Skip`.
  - `Probable`: Same amount with $\pm 3$ days shift $\implies$ flagged for review.
  - `Unmatched`: New payments/drawdowns $\implies$ suggested for import.
- **Zero Auto-Writing**: Mutations occur only after explicit review and confirmation.
- **Batch Reversal**: Assigns `importBatchId` to all imported records, enabling 1-click batch rollback.

---

## 11. In-App Notification Center & Anomaly Detection

- Floating notification bell with unread badge counter and slide-out tray.
- **Anomaly Detection Rules**:
  - Potential duplicates recorded within 24 hours.
  - Member contributions $> 3\times$ individual median.
  - Bank payment deviating $> 10\%$ from monthly target.
  - Bank reconciliation variance $> ₹1,000$.
- User-configurable alert preferences and quiet hours.

---

## 12. Validated Backup & Cryptographic Audit Verification

- **Full JSON Backup**: Complete snapshot of loan parameters, members, transactions, rate changes, snapshots, statements, and audit history.
- **Dry-Run Validated Restore**: Inspects schema version, checks entity counts, verifies paise integer arithmetic, and displays visual diff before applying.
- **Cryptographic Hash Chain**: Verifies audit log immutability via Web Crypto SHA-256 chain:
  $$H_0 = \text{SHA256}(\text{"GROUP\_LOAN\_TRACKER\_GENESIS\_V1"})$$
  $$H_n = \text{SHA256}(H_{n-1} + \text{canonical}(E_n))$$
- **Audit Export**: RFC 4180 CSV export with UTF-8 BOM.


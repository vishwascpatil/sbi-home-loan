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

## 6. How to Add an Interest Engine

The system abstracts interest computation behind the `InterestEngine` interface:

```typescript
export interface InterestEngine {
  readonly method: CalculationMethod;
  calculateInterest(
    period: string, // YYYY-MM
    openingBalance: Paise,
    annualRateBps: number,
    transactionsInPeriod: Transaction[]
  ): InterestCalculationResult;
}
```

### Steps to Implement a Daily Balance Engine in Phase 3:
1. Create `src/app/core/engine/daily-reducing-balance-engine.ts` implementing `InterestEngine`.
2. Break the calendar month into sub-day intervals between daily transactions.
3. Compute daily interest for each slice using $\text{Principal}_d \times \frac{\text{Rate}_{\text{bps}}}{100 \times 100 \times 365}$.
4. In `engine.ts` / `settings.component.ts`, register the engine in the calculation engine registry.
5. All UI cards, hero indicators, and monthly summaries will immediately compute daily interest splits without touching any UI component!

---

## 7. Phase 2: Firebase Migration Path

Phase 1 provides a 100% contract-compliant repository adapter: `LocalStorageLedgerRepository`.

To transition to multi-user collaborative sync with Firebase in Phase 2:
1. Implement `FirebaseLedgerRepository` implementing `LedgerRepository`:
   ```typescript
   export class FirebaseLedgerRepository implements LedgerRepository {
     // Connects to Firestore collections:
     // - loans/{loanId}
     // - loans/{loanId}/transactions
     // - loans/{loanId}/members
     // - loans/{loanId}/audit
   }
   ```
2. In `app.config.ts`, swap the provider:
   ```typescript
   { provide: LedgerRepository, useClass: FirebaseLedgerRepository }
   ```
3. Because `LedgerStore` and `SettingsStore` interact strictly via the `LedgerRepository` contract, zero state or UI layer changes are required!

# Group Loan Tracker — Product Requirements Document (PRD)

## 1. Executive Summary
The Group Loan Tracker is a mobile-first, local-first Progressive Web Application (PWA) designed to track, audit, and simulate repayments for a high-value group overdraft (OD) / home loan account. The application runs entirely in the browser with local persistence (`localStorage`), requiring zero backend infrastructure in Phase 1.

## 2. Product Objectives
- **Mathematical Integrity**: Guarantee accurate tracking of principal balances, interest accruals, member contributions, and bank payments using integer paise arithmetic.
- **Transparency & Accountability**: Provide members with clarity on individual lifetime contributions, monthly targets, and remaining pool funds.
- **Scenario Simulation**: Allow real-time forecasting of loan payoff timelines and interest savings based on variable monthly payment amounts.
- **Offline & First-Class UX**: Offer an app-like mobile experience with biometric-ready glassmorphic aesthetics, instant load times, and offline capabilities.

## 3. Account & Loan Profile
- **Loan Type**: Overdraft (OD) / Home Loan Maxgain
- **Account Number**: `43054757071` (Masked as `•••• 7071` by default)
- **Sanctioned Limit**: ₹1,26,36,108.00 (1,263,610,800 paise)
- **Initial Outstanding Principal**: ₹1,21,05,189.00 (1,210,518,900 paise)
- **Sanction Date**: 2024-06-12
- **Expiry / Tenure End**: 2044-06-12 (240 months)
- **Benchmark Interest Rate**: 7.90% per annum (790 basis points)
- **Monthly Repayment Target**: ₹2,40,000.00 (24,000,000 paise)

## 4. Member Structure
The initial setup includes 5 members:
- Member 1 (Target: ₹50,000)
- Member 2 (Target: ₹40,000)
- Member 3 (Target: ₹60,000)
- Member 4 (Target: ₹45,000)
- Member 5 (Target: ₹35,000)
Each member has customizable display names and active/inactive status.

## 5. Ledger Architecture & Accounting Principles
1. **Source of Truth**:
   The ledger is strictly event-sourced from immutable records:
   - Contributions (`contribution`)
   - Bank Payments (`bankPayment`)
   - Withdrawals (`withdrawal`)
   - Interest Charges (`interestCharge`)
   - Principal Adjustments (`principalAdjustment`)
   - Manual Corrections / Reconciliation Snapshots (`manualCorrection`)
   - Rate Changes (`rateChange`)
2. **Derived States**:
   Outstanding balance, monthly summaries, unused group funds, and member statistics are pure functions of the ledger history and never stored as static mutated balances.
3. **Principal Reduction Rule**:
   - Contributions from members do **NOT** directly reduce the loan principal.
   - Only recorded **Bank Payments** reduce the principal.
   - Bank payment amount = Principal Portion + Interest Portion.
   - If interest is unspecified, it defaults to estimated interest for that period.
4. **Group Funds Balance**:
   $$\text{Unused Funds} = \sum \text{Contributions} - \sum \text{Bank Payments}$$

## 6. Interest Calculation Engines
- **Interface**: `InterestEngine`
- **Active Method (Phase 1)**: Monthly Reducing Balance.
  $$\text{Monthly Interest} = \text{roundHalfUp}\left(\frac{\text{Principal} \times \text{Rate}_{\text{bps}}}{12 \times 10,000}\right)$$
  - Golden test check: ₹1,21,05,189 at 7.90% per annum:
    $$\frac{1,21,05,189 \times 0.0790}{12} = 79,692.49416\dots \implies \mathbf{₹79,692.49}$$
- **Daily Balance Stub (Phase 3 Prep)**: Daily reducing balance using exact days in month divided by 365.
- All interest figures displayed in Phase 1 carry the label **"est."**.

## 7. Repayment Simulator
- Formula for loan payoff months $n$ given constant monthly payment $\text{PMT}$ and monthly rate $i = \frac{r}{12}$:
  $$n = \left\lceil -\frac{\ln\left(1 - \frac{P \times i}{\text{PMT}}\right)}{\ln(1 + i)} \right\rceil$$
- If $\text{PMT} \le P \times i$, the principal never decreases; return status **"Never closes"**.
- Standard comparison scenarios:
  - ₹2,40,000/month (~62 months)
  - ₹2,30,000/month (~67 months)
  - ₹1,90,000/month (~83 months)
  - Custom monthly payment amount

## 8. Screen Specifications
1. **Home (`/home`)**:
   - Hero balance card showing outstanding, repaid amount and %, limit, count-up animation, and account reveal.
   - Quick action pills: `+ Contribution`, `Bank payment`, `History`, `Update rate`, `Simulator`.
   - "This month" card with live target progress bar and interest/principal breakdown.
   - "Group funds" card displaying total contributions, bank payments, and unused cash.
   - Projected balance sparkline chart and estimated payoff date.
   - Top members snapshot and 4 most recent transactions.
2. **Add/Edit Sheet**:
   - Segmented toggle: Contribution vs Bank Payment (with More options).
   - Member chip selector for contributions.
   - Live interest/principal split preview for bank payments.
   - Date, month, payment mode (UPI, Bank Transfer, Cash, Cheque, NEFT/RTGS), reference, notes.
   - Edit mode allows updating or deleting (with two-step confirmation).
3. **Members (`/members`)**:
   - Pinterest-style two-column masonry card layout.
   - Dynamic cover height proportional to lifetime contribution share.
   - Shows this month, lifetime, share %, contribution count, last date.
   - Tap row to navigate to member-filtered history.
4. **Insights (`/insights`)**:
   - 6-month monthly contribution SVG bar chart.
   - Highest and lowest contributor highlights.
   - Member contribution share progress bars.
   - Interactive repayment simulator with scenario comparison cards.
5. **History (`/history`)**:
   - Searchable, filterable transaction timeline.
   - Filter chips for transaction types, members, months, and date ranges.
   - Export to CSV button (RFC 4180 with UTF-8 BOM).
6. **Settings (`/settings`)**:
   - Editable loan parameters (type, limit, monthly target).
   - Interest rate change input (generates dated `RateChange`).
   - Reconcile balance input (records `BalanceSnapshot` with variance).
   - Member management (rename, toggle active status).
   - Theme toggle (Auto / Light / Dark).
   - Backup & Restore JSON tools.
   - Clear and reset buttons.
   - Privacy disclosure: Local storage is unencrypted.

## 9. Design System & Tokens
- **Themes**:
  - Light: BG `#f4f1ec`, Card `#ffffff`, Ink `#15172b`, Muted `#767a90`, Line `#15172b14`.
  - Dark: BG `#0a0c15`, Card `#151929`, Ink `#f2f3fb`, Muted `#9399b4`, Line `#ffffff17`.
- **Accents**:
  - Brand gradient: `#6c4cff` $\to$ `#ff5f9e`
  - Hero card gradient: `#4f35ff` $\to$ `#9b4dff` $\to$ `#ff5f9e`
  - Success: `#0fb27c`, Danger: `#ee4d6b`
- **Geometry**: Cards `26px`, Inner tiles `16px`, Chips `99px`.
- **Typography**: Self-hosted `Plus Jakarta Sans` via `@fontsource/plus-jakarta-sans`. Tabular numerals for money.

## 10. Acceptance Criteria (§20 Mapping)
- **AC-01**: Money arithmetic uses integer paise in branded `Paise` type with `BigInt` rate calculations and half-up rounding.
- **AC-02**: All 5 Golden Tests pass without variance.
- **AC-03**: Member contributions do not decrease principal; only bank payments do.
- **AC-04**: Group unused funds accurately reflect total contributions minus total bank payments.
- **AC-05**: Editing or deleting any transaction immediately recalculates current and historical balances.
- **AC-06**: Local storage repository handles quota limits and incognito mode gracefully with in-memory fallback.
- **AC-07**: Backup export/restore round-trips correctly with schema validation.
- **AC-08**: CSV export produces valid RFC 4180 format with UTF-8 BOM.
- **AC-09**: UI is responsive, touch-friendly (44px min targets), supports light/dark themes, and respects `prefers-reduced-motion`.
- **AC-10**: Full PWA functionality with service worker caching and standalone manifest.
- **AC-11**: Lighthouse Performance $\ge 90$ and Accessibility $\ge 95$.
- **AC-12**: 100% unit test coverage on core engine.


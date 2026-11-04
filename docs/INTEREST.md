# Daily OD Interest Engine: Mathematical Specification & Verifications

## 1. Overview
The **`DailyReducingBalanceEngine`** calculates interest for Overdraft (OD) and Maxgain loan facilities on a true daily accrual basis. Instead of applying a flat monthly rate to the opening balance, interest accrues on the actual closing balance of each calendar day, reflecting same-day repayments, drawdowns, and mid-period benchmark interest rate adjustments.

---

## 2. Bank Rules & Conventions

### 2.1 Day-Count Basis
The annual interest rate ($R$) is distributed across days in the year according to the bank's configured day-count convention:
- **`actual/365` (Default Indian Banking Standard)**:
  $$\text{Daily Rate} = \frac{\text{Rate}_{\text{bps}}}{10,000 \times 365}$$
- **`360` (Commercial Year / Money Market Basis)**:
  $$\text{Daily Rate} = \frac{\text{Rate}_{\text{bps}}}{10,000 \times 360}$$
- **`actual/actual` (ISDA Leap Year Convention)**:
  $$\text{Daily Rate} = \frac{\text{Rate}_{\text{bps}}}{10,000 \times \text{DaysInYear}}$$
  where $\text{DaysInYear} = 366$ in a leap year (e.g. 2024, 2028) and $365$ otherwise.

### 2.2 Value Date Handling
Transactions carry an optional `valueDate` (defaults to the recorded transaction `date`). The effective principal movement occurs on `valueDate`, impacting interest accrual starting from the end-of-day balance on that date.

### 2.3 Interest Capitalisation
When `isCapitalised === true` (standard OD/Maxgain terms), the debited interest for a period is capitalized (added to the principal balance) on the debit date, thereby compounding interest in subsequent periods.

---

## 3. Accrual & Rounding Precision Rules

1. **Fixed-Point Scaling**:
   Daily interest is calculated and accumulated unrounded using `BigInt` fixed-point arithmetic with a scale factor of $10^6$ (`SCALE = 1_000_000n`):
   $$\text{Daily Accrual (Scaled)} = \left\lfloor \frac{\text{Balance}_{\text{paise}} \times \text{Rate}_{\text{bps}} \times 1,000,000}{\text{BasisDays} \times 10,000} \right\rfloor$$
2. **Debit-Day Half-Up Rounding**:
   Rounding to integer `Paise` is deferred strictly to the interest debit date (e.g. the final calendar day of the month):
   $$\text{Debited Interest (Paise)} = \left\lfloor \frac{\sum_{d=1}^{N} \text{Daily Accrual (Scaled)}_d + 500,000}{1,000,000} \right\rfloor$$
3. **Idempotency & Superseding**:
   When retroactive transactions or rate revisions occur, previously recorded `InterestEntry` records for affected periods are flagged with `status: 'superseded'` (never deleted), and a new `status: 'active'` entry is created.

---

## 4. Hand-Checked Golden Test Fixtures

### Golden Test 1: Constant ₹10,00,000 Balance over 31 Days
- **Opening Principal**: ₹10,00,000.00 ($100,000,000$ paise)
- **Annual Rate**: 8.00% ($800$ basis points)
- **Period**: 31 calendar days (e.g., January)
- **Movements**: None
- **Calculation**:
  $$\text{Daily Interest} = \frac{100,000,000 \times 800}{365 \times 10,000} = \frac{80,000,000,000}{3,650,000} \approx 21,917.808219... \text{ paise/day}$$
  $$\text{Accumulated 31 Days} = 31 \times 21,917.808219... = 679,452.05479... \text{ paise}$$
  $$\text{Rounded Half-Up} = \mathbf{679,452 \text{ paise}} \ (\mathbf{₹6,794.52})$$

### Golden Test 2: Principal Reduction Mid-Month
- **Opening Principal**: ₹10,00,000.00 ($100,000,000$ paise) for 10 days
- **Principal Reduction**: ₹1,00,000.00 on Day 11 $\rightarrow$ ₹9,00,000.00 ($90,000,000$ paise) for 21 days
- **Annual Rate**: 8.00% ($800$ basis points)
- **Period**: 31 calendar days
- **Calculation**:
  $$\text{Days 1–10 Accrual} = 10 \times \frac{100,000,000 \times 800}{3,650,000} = 219,178.08219... \text{ paise}$$
  $$\text{Days 11–31 Accrual} = 21 \times \frac{90,000,000 \times 800}{3,650,000} = 414,246.57534... \text{ paise}$$
  $$\text{Total Unrounded} = 219,178.08219... + 414,246.57534... = 633,424.65753... \text{ paise}$$
  $$\text{Rounded Half-Up} = \mathbf{633,425 \text{ paise}} \ (\mathbf{₹6,334.25})$$

### Golden Test 3: Mid-Month Rate Change
- **Opening Principal**: ₹10,00,000.00
- **Rate**: 8.00% ($800$ bps) for 15 days, then 8.25% ($825$ bps) for 16 days
- **Calculation**:
  $$\text{15 Days @ 8.00\%} = 15 \times \frac{80,000,000,000}{3,650,000} = 328,767.12328... \text{ paise}$$
  $$\text{16 Days @ 8.25\%} = 16 \times \frac{82,500,000,000}{3,650,000} = 361,643.83561... \text{ paise}$$
  $$\text{Total} = 328,767.12328... + 361,643.83561... = 690,410.9589... \implies \mathbf{690,411 \text{ paise}} \ (\mathbf{₹6,904.11})$$

### Golden Test 4: Leap Year vs Non-Leap Year (February)
- **Feb 2024 (Leap Year, 29 Days @ 8.00%, actual/365)**:
  $$29 \times 21,917.808219... = 635,616.438... \implies \mathbf{635,616 \text{ paise}} \ (\mathbf{₹6,356.16})$$
- **Feb 2025 (Standard Year, 28 Days @ 8.00%, actual/365)**:
  $$28 \times 21,917.808219... = 613,698.630... \implies \mathbf{613,699 \text{ paise}} \ (\mathbf{₹6,136.99})$$


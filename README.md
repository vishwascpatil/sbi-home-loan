# Group Loan Tracker & EMI Ledger (Phases 1, 2 & 3 Complete)

A mobile-first, local-first Progressive Web Application (PWA) built with **Angular 22** for tracking shared group loans, overdraft (OD) facilities, member contributions, bank EMI payments, and tax reporting with mathematical precision.

---

## 🌟 Key Features

### Advanced Banking & Calculations (Phase 3)
- **Daily Reducing Balance OD Engine**: Day-accurate accrual with customizable bank rules: `actual/365` (SBI Maxgain / HDFC default), `360`, and `actual/actual`. Interest accumulated with fixed-point `BigInt` ($10^6$ scale) and rounded half-up only on debit. Includes interactive Daily OD Ledger sheet.
- **Period Locking & Month Close**: Freeze financial periods idempotently. Historical edits inside locked periods require an admin unlock with a mandatory audited reason.
- **Bank Reconciliation Wizard**: Compare ledger balances with net-banking closing figures. Three resolution paths: *Record Snapshot* (`✓ Reconciled`), *Record Manual Correction*, or *Flag for Investigation*.
- **Day-Accurate Simulator v2**: Model payment day of month, one-off prepayments, drawdowns, and interest rate shifts ($\pm 0.25\% / \pm 0.50\%$) with an SVG overlay comparison chart and saved named scenarios.
- **Client-Side Statements & Tax Reports**:
  - Monthly printable statements with Web Share API and PDF print styling.
  - Indian Financial Year (April–March) tax certificates: Section 24(b) (Interest up to ₹2L) and Section 80C (Principal up to ₹1.5L) breakdown table and co-borrower shares.
- **Bank Statement CSV Importer**: Pre-configured profiles for SBI Maxgain, HDFC, ICICI, and Generic CSVs. Features automated deduplication (`hash(date + amount + reference)`), interactive review queue, and 1-click batch rollback.
- **In-App Notification Center & Anomaly Detection**: Floating bell with unread badge and slide-out tray. Detects 24h duplicates, $>3\times$ median contribution outliers, $>10\%$ target payment deviations, and tenure expiry warnings (90, 30, 7 days).
- **Cryptographic Audit Log & Verification**: Append-only tamper-evident audit log verified via Web Crypto SHA-256 hash chains ($H_n = \text{SHA256}(H_{n-1} + \text{canonical}(E_n))$). Exportable to RFC 4180 CSV.
- **Validated JSON Backup & Dry-Run Restore**: Validates schema version and entity counts, with a visual diff preview before applying restores.

### Core Architecture (Phases 1 & 2)
- **Branded Integer Arithmetic**: Money is strictly modeled as integer paise (`Paise`) with intermediate `BigInt` multiplication. Zero floating-point rounding errors.
- **Pure Event-Sourced Ledger**: Outstanding balances, member statistics, and monthly summaries are pure functions of historical transactions.
- **Decoupled Accounting**: Group member contributions fund the collective cash pool; only recorded bank payments reduce loan principal.
- **Offline-First PWA**: Powered by `@angular/service-worker` with versioned schema migrations, debounced writes, and in-memory failover.
- **Fintech Design**: iPhone 17 Pro Max first (~440px wide) with smooth glassmorphism, responsive desktop side rail ($\ge 900\text{px}$), custom SVG charts, tabular numerals, and dynamic theme switching (`auto`, `light`, `dark`).

---

## 🏗️ Architecture

Built on a five-layer decoupled architecture:
1. **`core/engine`**: Pure TypeScript domain logic (zero Angular imports). Handles interest engines, ledger reduction, and simulation math.
2. **`core/data`**: Repository contracts (`LedgerRepository`), local storage adapters, schema migrations, and RFC 4180 CSV export.
3. **`core/state`**: Reactive signal stores (`LedgerStore`, `SettingsStore`) and append-only audit tracking.
4. **`features/*`**: Lazy-loaded routed views (`Home`, `Members`, `Insights`, `History`, `Settings`, `Styleguide`).
5. **`shared/ui`**: Standalone presentational design system (Glass cards, Hero balance, SVG charts, CDK bottom sheets, Count-up animation).

For detailed layer documentation and Phase 2 Firebase migration path, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 📋 Prerequisites

- **Node.js**: `22.22.3+` or `24.x`
- **npm**: `10.x+`
- **Angular CLI**: `22.2.x`

---

## 🚀 Getting Started

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/your-org/loan-tracker.git
cd loan-tracker
npm install
```

### 2. Development Server
Start the local development server:
```bash
npm start
```
Navigate to `http://localhost:4200/`. The app reloads automatically on source changes.

---

## 🧪 Testing & Verification

### Unit Tests (Angular Vitest Runner)
Runs 29 unit tests covering all 5 Golden Tests, invariant property checks, repository migrations, and signal store actions:
```bash
npm test -- --watch=false
```

### End-to-End Tests (Playwright)
Executes the 18-scenario e2e suite running on **Mobile Safari (iPhone 17 Pro Max viewport: 440x956)** and **Desktop Chrome**:
```bash
npm run test:e2e
```

### Code Quality & Linting
Run ESLint and Prettier checks:
```bash
npm run lint
```

---

## 📦 Production Build

Compile the production PWA bundle with service worker and asset prefetching:
```bash
npm run build
```
Build artifacts are placed in `dist/loan-tracker/browser`.

---

## 🌐 Static HTTPS Deployment

The output in `dist/loan-tracker/browser` is completely static and can be deployed to any HTTPS host:

### Netlify
```bash
npx netlify deploy --dir=dist/loan-tracker/browser --prod
```
Ensure your `_redirects` file includes:
```
/*    /index.html   200
```

### Vercel
```bash
npx vercel deploy --prod dist/loan-tracker/browser
```

### Cloudflare Pages
1. Build Command: `npm run build`
2. Output Directory: `dist/loan-tracker/browser`

---

## 📄 License
MIT

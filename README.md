# Group Loan Tracker & EMI Ledger (Phase 1)

A mobile-first, local-first Progressive Web Application (PWA) built with **Angular 22** for tracking shared group loans, overdraft (OD) facilities, member contributions, and bank EMI payments with mathematical precision.

---

## 🌟 Key Features

- **Mathematical Precision**: Currency is strictly stored as branded integer paise (`Paise`) with `BigInt` intermediate calculations. Eliminates all floating-point rounding errors.
- **Pure Event-Sourced Ledger**: Outstanding balances, member statistics, and monthly summaries are pure functions of historical transactions. Editing or deleting past records recalculates the entire ledger automatically.
- **Decoupled Accounting**: Group member contributions fund the collective cash pool; only recorded bank payments reduce loan principal. Bank payments feature a live estimated interest vs. principal reduction split.
- **Offline-First PWA**: Powered by `@angular/service-worker` and browser `localStorage` with versioned schema migrations, debounced writes, and in-memory failover.
- **Fintech Design**: iPhone 17 Pro Max first (~440px wide) with smooth glassmorphism, responsive desktop side rail ($\ge 900\text{px}$), custom SVG charts, tabular numerals, and dynamic theme switching (`auto`, `light`, `dark`).
- **Repayment Simulator**: Interactive analytical payoff modeling with closed-form mathematical tenure calculation and graceful "never closes" handling.
- **Data Portability**: Full JSON backup/restore with schema validation and RFC 4180 CSV export with UTF-8 BOM (`\uFEFF`).

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

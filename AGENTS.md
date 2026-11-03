# PROJECT RULES

Stack
- Angular 22 (latest stable 22.x; confirm with `ng version`), strict TypeScript 6, Node 22.22.3+. Standalone components only, zoneless, OnPush, signals (`signal`, `computed`, `linkedSignal`; `effect` only for side effects), `input()`/`output()`/`model()`, `@if/@for/@switch`, `inject()`, lazy routes via `loadComponent`. Forms: Signal Forms. No NgModules, no NgRx, no RxJS unless a stream is genuinely needed.
- SCSS + CSS custom properties. Angular CDK only for overlay/dialog/a11y primitives. No Material component styling or UI kits. Charts are custom SVG components. Self-host Plus Jakarta Sans via Fontsource so the PWA works offline.
- Motion: CSS keyframes and Angular's native animate.enter/animate.leave (not the deprecated @angular/animations); route transitions with `withViewTransitions()`. Always honour prefers-reduced-motion.
- Vitest for unit tests, Playwright for e2e, angular-eslint + Prettier. No `any`. Components stay small and presentational; business logic lives in core/.
Money
- Money is integer paise in a branded `Paise` type. Never use floating-point arithmetic on money. Multiply before dividing; use BigInt for intermediate products. Round half-up to paise only where an interest figure is produced.
- Rates are stored in basis points (7.90% = 790) with an effective-from date; every historical calculation uses the rate in force for its period.
- Format with en-IN: ₹1,21,05,189 and compact ₹1.26 Cr / ₹2.4L. Estimated figures carry "est."; actual bank figures look visibly different.
- Every record has a UUID (`crypto.randomUUID()`), createdAt, updatedAt. Deletes are soft (deletedAt) so history is preserved.
Architecture
- Layers: core/engine (pure TypeScript, zero Angular imports) → core/data (repository interface + adapters) → core/state (signal stores) → features/* (lazy routes) → shared/ui (design system). No localStorage access outside the adapter.
- The ledger (transactions, rate changes, balance snapshots) is the source of truth. Balances, monthly summaries, member stats and projections are derived by pure functions and never stored, so editing or deleting a historical entry recalculates every affected period.
- Contributions never reduce outstanding principal. Only the principal portion of recorded bank payments does. A bank payment is split into interest and principal when the interest portion is known; otherwise it defaults to the estimated interest and is flagged "estimated split".
- Month close is idempotent: one InterestEntry per (period, method). Never process a transaction twice.
Design (premium fintech, Pinterest-style visual feel)
- Light: bg #f4f1ec, card #ffffff, ink #15172b, muted #767a90. Dark: bg #0a0c15, card #151929, ink #f2f3fb, muted #9399b4. Brand gradient #6c4cff → #ff5f9e; hero card gradient #4f35ff → #9b4dff → #ff5f9e; success #0fb27c; danger #ee4d6b.
- Radii: cards 26px, inner tiles 16px, chips 99px. Soft shadows. Glass (backdrop blur 14–22px, translucent card colour) for the nav bar and tiles on the hero card. Tabular numerals for all money.
- Motion: staggered card entrance (70 ms steps), balance count-up (~1 s ease-out), animated progress bars and charts, bottom-sheet slide-up.
- Layout: iPhone 17 Pro Max first (~440 px wide), viewport-fit=cover, safe-area insets, 44 px minimum touch targets. Bottom tab bar: Home · Members · ＋ (raised centre action) · Insights · Settings. From 900 px up use a side rail and a two-column dashboard; the content column maxes at 560 px on tablets.
- Accessibility: WCAG AA contrast in both themes, visible focus, labelled controls, semantic landmarks.


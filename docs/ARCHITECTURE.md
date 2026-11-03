# System Architecture: Group Loan Tracker

## Overview
The Group Loan Tracker is an Angular 22 local-first Progressive Web Application designed with clean layering, event-sourced ledger modeling, and strict mathematical guarantees.

## Layered Architecture
```
+-------------------------------------------------------------+
|                Presentation: Features & Views                |
|      (Home, Members, Insights, History, Settings, Sheet)    |
+-------------------------------------------------------------+
                              |
+-------------------------------------------------------------+
|             Design System & Primitives (@shared/ui)         |
|     (Glass Cards, CDK Overlays, SVG Charts, CountUp, Pills) |
+-------------------------------------------------------------+
                              |
+-------------------------------------------------------------+
|             State Layer: Signal Stores (@core/state)         |
|         (LedgerStore, SettingsStore, Audit Logger)          |
+-------------------------------------------------------------+
                              |
+-------------------------------------------------------------+
|          Data Layer: Repository Contracts (@core/data)      |
|    (LedgerRepository interface, LocalStorageLedgerAdapter)  |
+-------------------------------------------------------------+
                              |
+-------------------------------------------------------------+
|          Pure Domain Engine & Ledger Math (@core/engine)    |
|   (Paise Branded Type, Pure Reducers, Simulators, Engines)  |
+-------------------------------------------------------------+
```

## Future Extensibility (Phase 2 & 3)
- **Phase 2 (Cloud Sync & Multi-User)**: Replace `LocalStorageLedgerAdapter` with `FirebaseLedgerAdapter` implementing the exact same `LedgerRepository` interface. Signal stores and UI layers require zero modifications.
- **Phase 3 (Daily Balance Engine)**: Implement `DailyBalanceEngine` adhering to the `InterestEngine` interface for sub-day compound interest calculation.

*(This document will be fully detailed in Step 7).*

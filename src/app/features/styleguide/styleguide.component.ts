import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AvatarComponent,
  BarChartComponent,
  BottomSheetComponent,
  ChipComponent,
  ConfirmSheetComponent,
  EmptyStateComponent,
  GlassCardComponent,
  HeroCardComponent,
  ProgressBarComponent,
  SegmentedControlComponent,
  SegmentOption,
  ShareBarComponent,
  SparklineChartComponent,
  StatTileComponent,
  ToastComponent,
  ToastService,
} from '../../shared/ui';
import { Loan, Paise, toPaise } from '../../core/engine';
import { SettingsStore } from '../../core/state';

@Component({
  selector: 'app-styleguide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    GlassCardComponent,
    HeroCardComponent,
    AvatarComponent,
    ChipComponent,
    SegmentedControlComponent,
    ProgressBarComponent,
    StatTileComponent,
    SparklineChartComponent,
    BarChartComponent,
    ShareBarComponent,
    BottomSheetComponent,
    ConfirmSheetComponent,
    EmptyStateComponent,
    ToastComponent,
  ],
  template: `
    <div class="styleguide-page">
      <header class="sg-header">
        <div>
          <small class="sg-subtitle">Design System & Primitives</small>
          <h1 class="sg-title">Fintech UI Styleguide</h1>
        </div>
        <button type="button" class="theme-btn" (click)="settings.toggleTheme()">
          {{ settings.isDark() ? '☀️ Light' : '🌙 Dark' }}
        </button>
      </header>

      <!-- Section: Hero Card -->
      <section class="sg-section">
        <h2 class="section-title">Hero Outstanding Card</h2>
        <app-hero-card
          [loan]="sampleLoan"
          [currentOutstanding]="sampleOutstanding()"
          [isMasked]="isMasked()"
          closureDate="Aug 2029"
          (toggleReveal)="isMasked.set(!isMasked())"
        />
      </section>

      <!-- Section: Glass Cards & Stagger -->
      <section class="sg-section">
        <h2 class="section-title">Cards & Glass Elevation</h2>
        <app-glass-card [staggerIndex]="0">
          <h3>Standard Glass Card</h3>
          <p class="muted-text">
            Card with 26px radius, soft drop shadow, and crisp 1px border.
          </p>
        </app-glass-card>

        <app-glass-card variant="inset">
          <h3>Inset Tile Variant</h3>
          <p class="muted-text">Secondary background with 16px radius.</p>
        </app-glass-card>
      </section>

      <!-- Section: Chips & Segmented Control -->
      <section class="sg-section">
        <h2 class="section-title">Controls & Chips</h2>
        <div class="sg-row">
          <app-chip [selected]="activeChip() === 'c1'" (clicked)="activeChip.set('c1')">
            Contribution
          </app-chip>
          <app-chip [selected]="activeChip() === 'c2'" (clicked)="activeChip.set('c2')">
            Bank Payment
          </app-chip>
          <app-chip [selected]="activeChip() === 'c3'" (clicked)="activeChip.set('c3')">
            History
          </app-chip>
        </div>

        <div style="margin-top: 14px">
          <app-segmented-control
            [options]="segmentOptions"
            [selectedValue]="selectedSegment()"
            (changed)="selectedSegment.set($event)"
          />
        </div>
      </section>

      <!-- Section: Avatars & Members -->
      <section class="sg-section">
        <h2 class="section-title">Member Avatars & Gradients</h2>
        <div class="sg-row">
          <app-avatar name="Member 1" [colorIndex]="0" [size]="48" />
          <app-avatar name="Member 2" [colorIndex]="1" [size]="48" />
          <app-avatar name="Member 3" [colorIndex]="2" [size]="48" />
          <app-avatar name="Member 4" [colorIndex]="3" [size]="48" />
          <app-avatar name="Member 5" [colorIndex]="4" [size]="48" />
        </div>
      </section>

      <!-- Section: Progress Bars & Stat Tiles -->
      <section class="sg-section">
        <h2 class="section-title">Progress & Metrics</h2>
        <app-progress-bar [progressPercent]="68" [height]="12" />
        <div class="sg-grid" style="margin-top: 14px">
          <app-stat-tile label="Monthly Avg" value="₹2,40,000" />
          <app-stat-tile label="Highest Share" value="Member 3 · 28%" />
          <app-stat-tile label="Unused Cash" value="₹40,000" />
        </div>
      </section>

      <!-- Section: Custom SVG Charts -->
      <section class="sg-section">
        <h2 class="section-title">Custom SVG Charts</h2>
        <app-glass-card>
          <h3>Balance Payoff Sparkline</h3>
          <app-sparkline-chart [data]="sparklineData" />
        </app-glass-card>

        <app-glass-card>
          <h3>Monthly Contributions (Last 6 Months)</h3>
          <app-bar-chart [data]="barData" />
        </app-glass-card>

        <app-glass-card>
          <h3>Member Contribution Share</h3>
          <app-share-bar [segments]="shareSegments" />
        </app-glass-card>
      </section>

      <!-- Section: Sheets & Overlays -->
      <section class="sg-section">
        <h2 class="section-title">Sheets & Feedback</h2>
        <div class="sg-row">
          <button type="button" class="btn-demo" (click)="isSheetOpen.set(true)">
            Open Bottom Sheet
          </button>
          <button type="button" class="btn-demo danger" (click)="isConfirmOpen.set(true)">
            Open Confirm Sheet
          </button>
          <button type="button" class="btn-demo alt" (click)="showToast()">
            Trigger Toast
          </button>
        </div>
      </section>

      <!-- Section: Empty State -->
      <section class="sg-section">
        <h2 class="section-title">Empty State</h2>
        <app-glass-card>
          <app-empty-state
            icon="📊"
            title="No activity recorded"
            description="Tap the ＋ button to record your first member contribution or bank payment."
            actionLabel="＋ Add Entry"
            (actionClicked)="isSheetOpen.set(true)"
          />
        </app-glass-card>
      </section>

      <!-- Bottom Sheet Instance -->
      <app-bottom-sheet
        [isOpen]="isSheetOpen()"
        title="Sample Bottom Sheet"
        (dismissed)="isSheetOpen.set(false)"
      >
        <p class="muted-text">
          Interactive CDK-based slide-up sheet supporting forms, safe-area insets, and gesture dismiss.
        </p>
      </app-bottom-sheet>

      <!-- Confirm Sheet Instance -->
      <app-confirm-sheet
        [isOpen]="isConfirmOpen()"
        title="Delete Transaction"
        message="Are you sure you want to delete this payment? All balances and summaries will be recalculated."
        confirmText="Yes, Delete"
        [isDanger]="true"
        (confirmed)="isConfirmOpen.set(false); toastService.show('Deleted successfully', 'danger')"
        (cancelled)="isConfirmOpen.set(false)"
      />

      <!-- Toast Container -->
      <app-toast-container />
    </div>
  `,
  styles: `
    .styleguide-page {
      max-width: 560px;
      margin: 0 auto;
      padding: 16px 16px 120px;
    }

    .sg-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .sg-subtitle {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .sg-title {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.025em;
      margin: 2px 0 0;
    }

    .theme-btn {
      padding: 8px 16px;
      border-radius: var(--radius-pill, 99px);
      border: 1px solid var(--line);
      background: var(--card);
      color: var(--ink);
      font-weight: 700;
      cursor: pointer;
      min-height: 40px;
    }

    .sg-section {
      margin-bottom: 32px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
      margin-bottom: 12px;
    }

    .sg-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }

    .sg-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .muted-text {
      color: var(--muted);
      font-size: 14px;
      margin: 4px 0 0;
    }

    .btn-demo {
      padding: 10px 18px;
      border-radius: var(--radius-pill, 99px);
      background: var(--brand-a);
      color: #ffffff;
      border: none;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      min-height: 44px;
    }

    .btn-demo.danger {
      background: var(--danger);
    }

    .btn-demo.alt {
      background: var(--card);
      color: var(--ink);
      border: 1px solid var(--line);
    }
  `,
})
export class StyleguideComponent {
  readonly settings = inject(SettingsStore);
  readonly toastService = inject(ToastService);

  readonly isMasked = signal<boolean>(true);
  readonly activeChip = signal<string>('c1');
  readonly selectedSegment = signal<string>('all');
  readonly isSheetOpen = signal<boolean>(false);
  readonly isConfirmOpen = signal<boolean>(false);

  readonly sampleLoan: Loan = {
    id: 'loan-1',
    type: 'Overdraft (OD)',
    accountNumber: '43054757071',
    sanctionedLimit: toPaise(12636108),
    openingOutstanding: toPaise(12105189),
    openingDate: '2024-06-12',
    maturityDate: '2044-06-12',
    currentRateBps: 790,
    monthlyTarget: toPaise(240000),
    calculationMethod: 'monthly',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  readonly sampleOutstanding = signal<Paise>(toPaise(12105189));

  readonly segmentOptions: SegmentOption[] = [
    { label: 'All', value: 'all' },
    { label: 'Contributions', value: 'contrib' },
    { label: 'Bank Payments', value: 'bank' },
  ];

  readonly sparklineData: Paise[] = [
    toPaise(12105189),
    toPaise(11944881),
    toPaise(11784573),
    toPaise(11624265),
    toPaise(11463957),
    toPaise(11303649),
    toPaise(11143341),
  ];

  readonly barData = [
    { label: 'Jun', value: 230000 },
    { label: 'Jul', value: 240000 },
    { label: 'Aug', value: 245000 },
    { label: 'Sep', value: 235000 },
    { label: 'Oct', value: 250000 },
    { label: 'Nov', value: 240000 },
  ];

  readonly shareSegments = [
    { name: 'Member 1', percentage: 22, color: '#6c4cff' },
    { name: 'Member 2', percentage: 18, color: '#ff5f9e' },
    { name: 'Member 3', percentage: 26, color: '#0fb27c' },
    { name: 'Member 4', percentage: 19, color: '#f59f00' },
    { name: 'Member 5', percentage: 15, color: '#2e90ff' },
  ];

  showToast(): void {
    this.toastService.show('Ledger balance recalculated', 'success');
  }
}

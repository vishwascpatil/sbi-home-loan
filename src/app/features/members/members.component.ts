import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LedgerStore } from '../../core/state';
import {
  addPaise,
  formatCompactPaise,
  formatPaise,
  MemberStatistics,
  Paise,
  ZERO_PAISE,
} from '../../core/engine';
import {
  AvatarComponent,
  CountUpDirective,
  ProgressBarComponent,
  ShareBarComponent,
  ShareSegment,
} from '../../shared/ui';
import { AddEditTransactionSheetComponent } from '../transaction-sheet/add-edit-transaction-sheet.component';

@Component({
  selector: 'app-members',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CountUpDirective,
    AvatarComponent,
    ProgressBarComponent,
    ShareBarComponent,
    AddEditTransactionSheetComponent,
  ],
  template: `
    <div class="members-page-container">
      <!-- 1. Top Bar (Matching Home Top Bar) -->
      <header class="app-top-bar">
        <div class="user-profile-cluster">
          <app-avatar name="Vishwas" [size]="44" [circular]="true" />
          <div class="profile-text-wrap">
            <span class="profile-greeting">Due by 5th every month</span>
            <h1 class="profile-user-name">Family Members</h1>
          </div>
        </div>
      </header>

      <!-- 2. Matte Black Hero Card (Go Premium style in screenshot) -->
      <div class="matte-hero-banner" role="region" aria-label="Monthly Money to Collect">
        <div class="hero-left-content">
          <div class="hero-badge-pill">
            <span class="lightning-bolt">⚡</span>
            <span>Total Monthly Target · {{ activeCount() }} Members</span>
          </div>
          <div class="hero-number-wrap">
            <div class="hero-balance-headline tabular-nums" [appCountUp]="totalMonthlyTarget()">
              {{ formatPaise(totalMonthlyTarget()) }}
            </div>
            <span class="hero-balance-sub">
              ₹1.05L for 2 people · ₹10k for 3 people · Due 5th
            </span>
          </div>
        </div>

        <button
          type="button"
          class="hero-circle-cta"
          (click)="openAddContribution()"
          aria-label="Add Member Money"
          title="Add Member Money"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#111216" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      <!-- 3. Section: Overview ("Wellness" style in screenshot) -->
      <section class="page-section">
        <h2 class="section-main-heading">Collection Status</h2>

        <div class="dual-squircle-grid">
          <!-- Card 1: This Month Collection -->
          <button
            type="button"
            class="squircle-metric-card"
            (click)="router.navigate(['/members/history'])"
            aria-label="View this month contributions history"
          >
            <div class="card-top-header">
              <span class="card-caption-title">This Month</span>
              <span class="card-chevron-icon">›</span>
            </div>
            <div class="card-metric-body">
              <div class="metric-pair">
                <span class="metric-big-num tabular-nums" [appCountUp]="totalThisMonth()">
                  {{ formatPaise(totalThisMonth()) }}
                </span>
                <span class="metric-label-sub">
                  Collected of {{ formatCompactPaise(totalMonthlyTarget()) }}
                </span>
              </div>
              <div class="mini-progress-wrap">
                <app-progress-bar [progressPercent]="monthCollectionPercent()" [height]="5" />
              </div>
            </div>
          </button>

          <!-- Card 2: Quota Allocation -->
          <button
            type="button"
            class="squircle-metric-card"
            (click)="router.navigate(['/home'])"
            aria-label="View member share breakdown on home"
          >
            <div class="card-top-header">
              <span class="card-caption-title">Who Pays What</span>
              <span class="card-chevron-icon">›</span>
            </div>
            <div class="card-metric-body">
              <div class="metric-stat-row">
                <div class="stat-col">
                  <span class="metric-big-num">87.5%</span>
                  <span class="metric-label-sub">Main (2)</span>
                </div>
                <div class="stat-col">
                  <span class="metric-big-num">12.5%</span>
                  <span class="metric-label-sub">Others (3)</span>
                </div>
              </div>
              <div class="share-bar-wrap">
                <app-share-bar [segments]="shareSegments()" />
              </div>
            </div>
          </button>
        </div>
      </section>

      <!-- 4. Section: Member Cards List ("Past Activities" style in screenshot) -->
      <section class="page-section">
        <div class="section-title-bar">
          <div>
            <h2 class="section-main-heading">All 5 Members</h2>
            <span class="section-sub-caption">Monthly amount each person needs to pay by the 5th</span>
          </div>
          <button type="button" class="section-see-all-btn" (click)="router.navigate(['/members/history'])">
            History ›
          </button>
        </div>

        <div class="squircle-cards-list">
          @for (m of ledgerStore.memberStats(); track m.memberId) {
            <div class="member-squircle-card">
              <!-- Member Header Row -->
              <div class="member-top-row">
                <div class="member-identity-group">
                  <app-avatar [name]="m.name" [colorIndex]="$index" [size]="44" [avatarUrl]="m.avatarUrl" />
                  <div class="member-text-group">
                    <span class="member-name">{{ m.name }}</span>
                    <span class="member-due-date">Due on the 5th</span>
                  </div>
                </div>
                <div class="member-badge-cluster">
                  <span class="pool-share-pill">{{ (m.targetSharePercentage || m.sharePercentage).toFixed(1) }}% share</span>
                  <button
                    type="button"
                    class="member-icon-circle-btn"
                    (click)="viewMemberHistory(m.memberId)"
                    [attr.aria-label]="'View history for ' + m.name"
                    title="View payment history"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#111216" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Metric Row: Monthly Share, This Month, Lifetime -->
              <div class="member-metrics-row">
                <div class="member-metric-col">
                  <span class="metric-col-label">Monthly Share</span>
                  <span class="metric-col-val tabular-nums highlight">
                    {{ m.target ? formatPaise(m.target) : '₹0' }}
                  </span>
                </div>
                <div class="member-metric-col">
                  <span class="metric-col-label">This Month</span>
                  <span class="metric-col-val tabular-nums">
                    {{ formatPaise(m.thisMonthContribution) }}
                  </span>
                </div>
                <div class="member-metric-col">
                  <span class="metric-col-label">Total Paid</span>
                  <span class="metric-col-val tabular-nums muted">
                    {{ formatCompactPaise(m.lifetimeContribution) }}
                  </span>
                </div>
              </div>

              <!-- Progress Bar for Monthly Target -->
              <div class="member-progress-wrap">
                <div class="progress-label-row">
                  <span
                    class="progress-status-badge"
                    [class.completed]="m.target && m.thisMonthContribution >= m.target"
                  >
                    @if (m.target && m.thisMonthContribution >= m.target) {
                      ✓ Fully Paid
                    } @else if (m.thisMonthContribution > 0) {
                      Partially Paid ({{ getMemberProgress(m).toFixed(0) }}%)
                    } @else {
                      Not Paid Yet
                    }
                  </span>
                  <span class="progress-ratio tabular-nums">
                    {{ formatCompactPaise(m.thisMonthContribution) }} / {{ m.target ? formatCompactPaise(m.target) : '₹0' }}
                  </span>
                </div>
                <app-progress-bar
                  [progressPercent]="getMemberProgress(m)"
                  [height]="6"
                  [color]="m.target && m.thisMonthContribution >= m.target ? '#0fb27c' : '#111216'"
                />
              </div>

              <!-- Footer Meta & History Action -->
              <div class="member-card-footer">
                <div class="footer-meta-info">
                  <span>{{ m.contributionCount }} {{ m.contributionCount === 1 ? 'payment' : 'payments' }}</span>
                  @if (m.lastContributionDate) {
                    <span> · Last {{ m.lastContributionDate }}</span>
                  }
                </div>
                <button
                  type="button"
                  class="member-action-btn-subtle"
                  (click)="viewMemberHistory(m.memberId)"
                >
                  History ›
                </button>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- Footnote Information Callout -->
      <div class="footnote-info-card">
        <span class="footnote-icon">ℹ️</span>
        <span class="footnote-text">
          Together, the 5 members contribute ₹2,40,000 every month by the 5th to pay the home loan. Every payment is tracked here automatically.
        </span>
      </div>

      <!-- Add Contribution Sheet Modal -->
      @if (isAddTxOpen()) {
        <app-add-edit-transaction-sheet
          [isOpen]="isAddTxOpen()"
          initialType="contribution"
          [initialMemberId]="selectedMemberId()"
          (dismissed)="isAddTxOpen.set(false)"
        />
      }
    </div>
  `,
  styles: `
    .members-page-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow-x: hidden;
      padding: 0 0 96px;
    }

    /* 1. Top Bar */
    .app-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 8px 0 20px;
      padding: 0 4px;
      width: 100%;
      box-sizing: border-box;
    }

    .user-profile-cluster {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .profile-text-wrap {
      display: flex;
      flex-direction: column;
    }

    .profile-greeting {
      font-size: 11px;
      font-weight: 500;
      color: #8e8e93;
      letter-spacing: -0.01em;
    }

    .profile-user-name {
      font-size: 18px;
      font-weight: 800;
      color: #111216;
      letter-spacing: -0.02em;
      margin: 0;
    }

    /* 2. Matte Black Hero Card */
    .matte-hero-banner {
      background: #111216;
      color: #ffffff;
      border-radius: 28px;
      padding: 22px 24px;
      margin-bottom: 26px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 12px 32px -6px rgba(0, 0, 0, 0.22);
      cursor: pointer;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        transform: translateY(-2px);
      }

      &:active {
        transform: scale(0.99);
      }
    }

    .hero-left-content {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
      overflow: hidden;
    }

    .hero-badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .lightning-bolt {
      color: #f59e0b;
      font-size: 14px;
      flex-shrink: 0;
    }

    .hero-number-wrap {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }

    .hero-balance-headline {
      font-size: clamp(26px, 6.5vw, 34px);
      font-weight: 800;
      letter-spacing: -0.035em;
      line-height: 1.1;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .hero-balance-sub {
      font-size: 12px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.6);
      word-break: break-word;
    }

    .hero-circle-cta {
      width: 44px;
      height: 44px;
      min-width: 44px;
      min-height: 44px;
      border-radius: 50%;
      background: #ffffff;
      border: none;
      display: grid;
      place-items: center;
      cursor: pointer;
      flex-shrink: 0;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        transform: scale(1.08);
      }

      &:active {
        transform: scale(0.92);
      }
    }

    /* 3. Section Containers */
    .page-section {
      display: flex;
      flex-direction: column;
      margin-bottom: 26px;
      width: 100%;
      box-sizing: border-box;
    }

    .section-main-heading {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #111216;
      margin: 0 0 14px;
      padding: 0 4px;
    }

    .section-title-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin: 0 0 14px;
      padding: 0 4px;
    }

    .section-sub-caption {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #8e8e93;
      margin-top: 2px;
    }

    .section-see-all-btn {
      background: transparent;
      border: none;
      color: #8e8e93;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      padding: 4px 6px;
      white-space: nowrap;
      transition: color 0.15s ease;

      &:hover {
        color: #111216;
      }
    }

    /* Dual Squircle Grid */
    .dual-squircle-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
    }

    .squircle-metric-card {
      background: #ffffff;
      border: none;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      overflow: hidden;
      text-align: left;
      font-family: inherit;
      border-radius: 26px;
      padding: 16px 16px;
      box-shadow: var(--shadow-card);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 140px;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.05);
      }

      &:active {
        transform: scale(0.98);
      }
    }

    .card-top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card-caption-title {
      font-size: 13px;
      font-weight: 700;
      color: #111216;
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-chevron-icon {
      font-size: 16px;
      color: #9ca3af;
      font-weight: 700;
      flex-shrink: 0;
    }

    .card-metric-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }

    .metric-pair {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .metric-big-num {
      font-size: clamp(16px, 4.2vw, 21px);
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #111216;
      line-height: 1.15;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .metric-label-sub {
      font-size: 11px;
      font-weight: 500;
      color: #8e8e93;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mini-progress-wrap {
      margin-top: 4px;
      width: 100%;
    }

    .metric-stat-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      width: 100%;
      min-width: 0;
    }

    .stat-col {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .share-bar-wrap {
      margin-top: 4px;
      width: 100%;
    }

    /* 4. Squircle Cards List for Members */
    .squircle-cards-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
      width: 100%;
      box-sizing: border-box;
    }

    .member-squircle-card {
      background: #ffffff;
      border-radius: 26px;
      padding: 18px 18px;
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      gap: 14px;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow: hidden;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 26px -4px rgba(0, 0, 0, 0.06);
      }
    }

    /* Member Top Row */
    .member-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      width: 100%;
      min-width: 0;
    }

    .member-identity-group {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1;
    }

    .member-text-group {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .member-name {
      font-size: 16px;
      font-weight: 800;
      color: #111216;
      letter-spacing: -0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .member-due-date {
      font-size: 11px;
      font-weight: 500;
      color: #8e8e93;
    }

    .member-badge-cluster {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .pool-share-pill {
      font-size: 11px;
      font-weight: 700;
      background: #f2f3f6;
      color: #111216;
      padding: 4px 10px;
      border-radius: 9999px;
      letter-spacing: -0.01em;
      white-space: nowrap;
    }

    .member-icon-circle-btn {
      width: 34px;
      height: 34px;
      min-width: 34px;
      min-height: 34px;
      border-radius: 50%;
      background: #f2f3f6;
      border: none;
      display: grid;
      place-items: center;
      cursor: pointer;
      padding: 0;
      transition: all 0.2s ease;

      &:hover {
        background: #111216;
        svg {
          stroke: #ffffff;
        }
      }

      &:active {
        transform: scale(0.9);
      }
    }

    /* Metrics Row */
    .member-metrics-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      background: #f8f9fb;
      padding: 10px 12px;
      border-radius: 16px;
      width: 100%;
      box-sizing: border-box;
    }

    .member-metric-col {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .metric-col-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #8e8e93;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .metric-col-val {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #111216;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      &.highlight {
        color: #111216;
        font-weight: 800;
      }

      &.muted {
        color: #6b7280;
      }
    }

    /* Progress Wrap */
    .member-progress-wrap {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
    }

    .progress-label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      font-size: 11px;
    }

    .progress-status-badge {
      font-weight: 700;
      color: #6b7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      &.completed {
        color: #0fb27c;
      }
    }

    .progress-ratio {
      font-weight: 600;
      color: #8e8e93;
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* Member Card Footer */
    .member-card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      padding-top: 4px;
      width: 100%;
      box-sizing: border-box;
    }

    .footer-meta-info {
      font-size: 11px;
      font-weight: 500;
      color: #8e8e93;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .member-action-btn-subtle {
      background: #f2f3f6;
      color: #111216;
      border: none;
      border-radius: 9999px;
      padding: 6px 14px;
      min-height: 34px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;

      &:hover {
        background: #e5e7eb;
      }

      &:active {
        transform: scale(0.95);
      }
    }

    /* Footnote Info Card */
    .footnote-info-card {
      margin: 10px 0 0;
      background: #ffffff;
      border-radius: 20px;
      padding: 14px 18px;
      box-shadow: var(--shadow-card);
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
    }

    .footnote-icon {
      font-size: 18px;
      flex-shrink: 0;
    }

    .footnote-text {
      font-size: 12px;
      font-weight: 500;
      line-height: 1.45;
      color: #8e8e93;
    }

    @media (max-width: 360px) {
      .member-card-footer {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }

      .member-action-btn-subtle {
        align-self: flex-end;
      }
    }
  `,
})
export class MembersComponent {
  readonly ledgerStore = inject(LedgerStore);
  readonly router = inject(Router);

  readonly isAddTxOpen = signal(false);
  readonly selectedMemberId = signal<string | undefined>(undefined);

  readonly formatPaise = formatPaise;
  readonly formatCompactPaise = formatCompactPaise;

  readonly activeCount = computed(
    () => this.ledgerStore.activeMembers().length
  );

  readonly totalMonthlyTarget = computed<Paise>(() => {
    const members = this.ledgerStore.members().filter((m) => !m.deletedAt);
    return members.reduce((sum, m) => addPaise(sum, m.target || ZERO_PAISE), ZERO_PAISE);
  });

  readonly totalThisMonth = computed<Paise>(() => {
    return this.ledgerStore.memberStats().reduce(
      (sum, m) => addPaise(sum, m.thisMonthContribution),
      ZERO_PAISE
    );
  });

  readonly monthCollectionPercent = computed<number>(() => {
    const target = this.totalMonthlyTarget();
    if (target <= 0) return 0;
    return Math.min(100, (this.totalThisMonth() / target) * 100);
  });

  readonly shareSegments = computed<ShareSegment[]>(() => {
    const palette = ['#111216', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'];
    return this.ledgerStore.memberStats().map((m, idx) => ({
      name: m.name,
      percentage: m.targetSharePercentage || m.sharePercentage || 0,
      color: palette[idx % palette.length]!,
    }));
  });

  getMemberProgress(m: MemberStatistics): number {
    if (!m.target || m.target <= 0) return 0;
    return Math.min(100, (m.thisMonthContribution / m.target) * 100);
  }

  viewMemberHistory(memberId: string): void {
    void this.router.navigate(['/members/history'], { queryParams: { member: memberId } });
  }

  openAddContribution(memberId?: string): void {
    this.selectedMemberId.set(memberId);
    this.isAddTxOpen.set(true);
  }
}

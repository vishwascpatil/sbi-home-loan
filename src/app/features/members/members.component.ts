import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LedgerStore } from '../../core/state';
import { formatCompactPaise, formatPaise } from '../../core/engine';
import { ProgressBarComponent } from '../../shared/ui';

const MEMBER_GRADIENTS = [
  'linear-gradient(135deg, #0071e3, #60a5fa)',
  'linear-gradient(135deg, #4338ca, #818cf8)',
  'linear-gradient(135deg, #059669, #34d399)',
  'linear-gradient(135deg, #d97706, #fbbf24)',
  'linear-gradient(135deg, #e11d48, #fb7185)',
];

@Component({
  selector: 'app-members',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProgressBarComponent],
  template: `
    <div class="members-page">
      <header class="members-header">
        <div>
          <small class="header-count">{{ activeCount() }} active members</small>
          <h1 class="header-title">Members</h1>
        </div>
      </header>

      <!-- Pinterest-Style Masonry Columns -->
      <div class="masonry-grid">
        @for (m of ledgerStore.memberStats(); track m.memberId) {
          <button
            type="button"
            class="masonry-card"
            (click)="viewMemberHistory(m.memberId)"
            [style.--cover-height.px]="getCoverHeight(m.sharePercentage)"
          >
            <!-- Member Gradient Cover Banner -->
            <div
              class="card-cover-banner"
              [style.background]="getGradient($index)"
            >
              <span class="cover-initials">{{ getInitials(m.name) }}</span>
            </div>

            <!-- Card Body Content -->
            <div class="card-body">
              <h3 class="member-title">{{ m.name }}</h3>

              <div class="metric-block">
                <span class="metric-label">Monthly limit (Due 5th)</span>
                <span class="metric-value tabular-nums highlight">
                  {{ m.target ? formatPaise(m.target) : '₹0' }} · {{ (m.targetSharePercentage || m.sharePercentage).toFixed(1) }}%
                </span>
              </div>

              <div class="metric-block">
                <span class="metric-label">This month</span>
                <span class="metric-value tabular-nums">{{ formatPaise(m.thisMonthContribution) }}</span>
              </div>

              <div class="metric-block">
                <span class="metric-label">Lifetime contribution</span>
                <span class="metric-value tabular-nums">
                  {{ formatCompactPaise(m.lifetimeContribution) }}
                </span>
              </div>

              <!-- Share Progress Bar -->
              <div style="margin-top: 8px">
                <app-progress-bar [progressPercent]="m.targetSharePercentage || m.sharePercentage" [height]="6" />
              </div>

              <div class="card-footer-sub">
                <span>{{ m.contributionCount }} contributions</span>
                @if (m.lastContributionDate) {
                  <span>Last {{ m.lastContributionDate }}</span>
                }
              </div>
            </div>
          </button>
        }
      </div>

      <p class="footnote-hint">Tap any member card to view their full contribution history.</p>
    </div>
  `,
  styles: `
    .members-page {
      display: flex;
      flex-direction: column;
    }

    .members-header {
      margin: 8px 4px 20px;
    }

    .header-count {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .header-title {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.025em;
      margin: 2px 0 0;
    }

    .masonry-grid {
      columns: 2;
      column-gap: 12px;
    }

    .masonry-card {
      break-inside: avoid;
      display: flex;
      flex-direction: column;
      width: 100%;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius-card, 22px);
      box-shadow: var(--shadow-sm);
      margin-bottom: 12px;
      padding: 0;
      text-align: left;
      cursor: pointer;
      overflow: hidden;
      transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .masonry-card:hover {
      transform: translateY(-3px) scale(1.015);
      box-shadow: var(--shadow-tv-hover);
    }

    .masonry-card:active {
      transform: scale(0.97);
    }

    .card-cover-banner {
      width: 100%;
      height: var(--cover-height, 100px);
      display: grid;
      place-items: center;
      transition: height 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .cover-initials {
      font-size: 30px;
      font-weight: 800;
      color: #ffffff;
      opacity: 0.95;
      transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .masonry-card:hover .cover-initials {
      transform: scale(1.12);
    }

    .card-body {
      padding: 14px;
      display: flex;
      flex-direction: column;
    }

    .member-title {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: -0.015em;
      margin: 0 0 10px;
    }

    .metric-block {
      display: flex;
      flex-direction: column;
      margin-bottom: 6px;
    }

    .metric-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--muted);
    }

    .metric-value {
      font-size: 13px;
      font-weight: 800;
      color: var(--ink);

      &.highlight {
        color: #0071e3;
      }
    }

    .card-footer-sub {
      display: flex;
      flex-direction: column;
      font-size: 10px;
      font-weight: 600;
      color: var(--muted);
      margin-top: 10px;
      gap: 2px;
    }

    .footnote-hint {
      text-align: center;
      font-size: 12px;
      color: var(--muted);
      margin-top: 16px;
    }
  `,
})
export class MembersComponent {
  readonly ledgerStore = inject(LedgerStore);
  readonly router = inject(Router);

  readonly formatPaise = formatPaise;
  readonly formatCompactPaise = formatCompactPaise;

  readonly activeCount = computed(
    () => this.ledgerStore.activeMembers().length
  );

  getCoverHeight(sharePercent: number): number {
    return Math.round(90 + sharePercent * 2.2);
  }

  getGradient(index: number): string {
    return MEMBER_GRADIENTS[index % MEMBER_GRADIENTS.length]!;
  }

  getInitials(name: string): string {
    const digit = name.match(/\d+$/);
    if (digit) return digit[0];
    return name.slice(0, 2).toUpperCase();
  }

  viewMemberHistory(memberId: string): void {
    void this.router.navigate(['/history'], { queryParams: { member: memberId } });
  }
}


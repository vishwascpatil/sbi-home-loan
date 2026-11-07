import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { LedgerStore } from '../../core/state';
import {
  buildDailyInterestBroadcast,
  buildMonthlyDueReminder,
  computeDailyInterest,
  generateAnnualExcelSpreadsheet,
  buildAnnualReportMailtoUrl,
  formatPaise,
  MemberStatistics,
  Paise,
  paise,
  toRupees,
  Member,
} from '../../core/engine';
import { BottomSheetComponent } from '../../shared/ui/bottom-sheet/bottom-sheet.component';

type BroadcastTab = 'daily' | 'monthly' | 'annual';

@Component({
  selector: 'app-broadcast-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent],
  template: `
    <app-bottom-sheet
      [isOpen]="isOpen()"
      title="Family Notifications Hub"
      (dismissed)="dismissed.emit()"
    >
      <div class="hub-container">
        <!-- Subtitle -->
        <p class="sheet-sub">Daily 9 AM updates, 1st of month reminders &amp; November Excel reports</p>

        <!-- Tab Switcher -->
        <div class="pill-tab-bar" role="tablist">
          <button
            type="button"
            class="pill-tab-item"
            [class.active]="activeTab() === 'daily'"
            (click)="activeTab.set('daily')"
          >
            ☀️ Daily 9 AM Interest
          </button>
          <button
            type="button"
            class="pill-tab-item"
            [class.active]="activeTab() === 'monthly'"
            (click)="activeTab.set('monthly')"
          >
            🔔 1st of Month Reminders
          </button>
          <button
            type="button"
            class="pill-tab-item"
            [class.active]="activeTab() === 'annual'"
            (click)="activeTab.set('annual')"
          >
            📊 Nov Excel &amp; Email
          </button>
        </div>

        <!-- TAB 1: DAILY 9 AM INTEREST -->
        @if (activeTab() === 'daily') {
          <div class="tab-pane-content">
            <div class="daily-hero-badge">
              <div class="badge-row">
                <span class="badge-label">Today's Interest Accrued</span>
                <span class="badge-val-amber tabular-nums">+{{ formatPaise(dailyInterest()) }}</span>
              </div>
              <div class="badge-row secondary">
                <span class="badge-label">Effective Balance Today</span>
                <span class="badge-val tabular-nums">{{ formatPaise(effectiveTodayBalance()) }}</span>
              </div>
            </div>

            <div class="preview-box">
              <span class="preview-box-title">WhatsApp Notification Message:</span>
              <pre class="message-preview-text">{{ dailyMessage().body }}</pre>
            </div>

            <!-- Action Buttons -->
            <div class="broadcast-action-cluster">
              <a
                [href]="dailyMessage().whatsappUrl"
                target="_blank"
                class="btn-primary-action whatsapp-brand-btn"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.53 7.37C9.36 7.37 9.09 7.43 8.85 7.69C8.61 7.95 7.94 8.58 7.94 9.87C7.94 11.15 8.88 12.39 9.01 12.56C9.14 12.73 10.84 15.36 13.45 16.49C14.07 16.76 14.56 16.92 14.94 17.04C15.56 17.24 16.13 17.21 16.57 17.15C17.07 17.07 18.09 16.53 18.3 15.93C18.52 15.34 18.52 14.83 18.45 14.73C18.39 14.62 18.21 14.56 17.95 14.43C17.69 14.3 16.42 13.67 16.18 13.59C15.95 13.5 15.78 13.46 15.6 13.72C15.43 13.97 14.95 14.56 14.8 14.73C14.66 14.9 14.51 14.92 14.25 14.79C14 14.66 12.92 14.31 11.64 13.17C10.65 12.28 9.98 11.19 9.79 10.85C9.59 10.51 9.77 10.33 9.9 10.2C10.02 10.08 10.16 9.89 10.29 9.74C10.42 9.59 10.46 9.49 10.55 9.32C10.64 9.15 10.59 9 10.53 8.87C10.46 8.74 9.95 7.48 9.73 6.97C9.52 6.47 9.31 6.54 9.15 6.53C9 6.52 8.83 6.52 8.65 6.52" />
                </svg>
                Share to Family Group
              </a>
            </div>

            <!-- Direct Member Buttons -->
            <div class="member-direct-send-list">
              <span class="direct-send-title">Or send directly to personal numbers:</span>
              <div class="direct-chips-grid">
                @for (m of ledgerStore.activeMembers(); track m.id) {
                  <a
                    [href]="getMemberDailyWhatsApp(m)"
                    target="_blank"
                    class="direct-member-pill"
                  >
                    <span>{{ m.name }}</span>
                    <small>({{ m.phone || 'N/A' }})</small>
                  </a>
                }
              </div>
            </div>
          </div>
        }

        <!-- TAB 2: MONTHLY 1st REMINDERS -->
        @if (activeTab() === 'monthly') {
          <div class="tab-pane-content">
            <div class="info-callout-bubble">
              <p>Send short due date reminders to members due on the 5th of every month. Each message includes their individual remaining target.</p>
            </div>

            <div class="reminders-table-list">
              @for (m of ledgerStore.memberStats(); track m.memberId) {
                @let memberObj = getMember(m.memberId);
                <div class="reminder-member-card">
                  <div class="reminder-meta-left">
                    <span class="reminder-name">{{ m.name }}</span>
                    <span class="reminder-phone tabular-nums">{{ memberObj?.phone || 'No phone' }}</span>
                    <span class="reminder-target tabular-nums">
                      Due: <strong>{{ formatPaise(getMemberDue(m)) }}</strong>
                      <small>({{ formatPaise(m.thisMonthContribution) }} paid of {{ m.target ? formatPaise(m.target) : '₹0' }})</small>
                    </span>
                  </div>

                  <div class="reminder-action-right">
                    @if (m.target && m.thisMonthContribution >= m.target) {
                      <span class="status-badge-paid">✓ Fully Paid</span>
                    } @else {
                      <a
                        [href]="getMonthlyReminderWhatsApp(memberObj)"
                        target="_blank"
                        class="reminder-send-btn"
                        title="Send reminder to WhatsApp"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.53 7.37C9.36 7.37 9.09 7.43 8.85 7.69C8.61 7.95 7.94 8.58 7.94 9.87C7.94 11.15 8.88 12.39 9.01 12.56C9.14 12.73 10.84 15.36 13.45 16.49C14.07 16.76 14.56 16.92 14.94 17.04C15.56 17.24 16.13 17.21 16.57 17.15C17.07 17.07 18.09 16.53 18.3 15.93C18.52 15.34 18.52 14.83 18.45 14.73C18.39 14.62 18.21 14.56 17.95 14.43C17.69 14.3 16.42 13.67 16.18 13.59C15.95 13.5 15.78 13.46 15.6 13.72C15.43 13.97 14.95 14.56 14.8 14.73C14.66 14.9 14.51 14.92 14.25 14.79C14 14.66 12.92 14.31 11.64 13.17C10.65 12.28 9.98 11.19 9.79 10.85C9.59 10.51 9.77 10.33 9.9 10.2C10.02 10.08 10.16 9.89 10.29 9.74C10.42 9.59 10.46 9.49 10.55 9.32C10.64 9.15 10.59 9 10.53 8.87C10.46 8.74 9.95 7.48 9.73 6.97C9.52 6.47 9.31 6.54 9.15 6.53C9 6.52 8.83 6.52 8.65 6.52" />
                        </svg>
                        Send Reminder
                      </a>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- TAB 3: NOVEMBER ANNUAL EXCEL & EMAIL -->
        @if (activeTab() === 'annual') {
          <div class="tab-pane-content">
            <div class="info-callout-bubble">
              <p>Maintain an Excel sheet of who paid how much, keep track of all numbers, and email the complete annual ledger to all 5 members every 1st of November.</p>
            </div>

            <!-- Quick numbers summary preview -->
            <div class="excel-preview-card">
              <div class="preview-header">
                <span class="preview-badge">Excel Ledger Preview</span>
                <span class="file-name">SBI-Home-Loan-Annual-Report.xls</span>
              </div>
              <div class="excel-rows-preview">
                @for (m of ledgerStore.memberStats(); track m.memberId) {
                  <div class="excel-row-item">
                    <span class="col-name">{{ m.name }}</span>
                    <span class="col-phone tabular-nums">{{ getMember(m.memberId)?.phone || '-' }}</span>
                    <span class="col-target tabular-nums">{{ m.target ? formatPaise(m.target) : '₹0' }}/mo</span>
                    <span class="col-paid tabular-nums font-bold">{{ formatPaise(m.lifetimeContribution) }}</span>
                  </div>
                }
              </div>
            </div>

            <!-- Action buttons -->
            <div class="excel-actions-grid">
              <button
                type="button"
                class="btn-primary-action excel-download-btn"
                (click)="downloadExcel()"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download Annual Excel File
              </button>

              <a
                [href]="annualEmailUrl()"
                class="btn-secondary-action email-client-btn"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                Send Email to Members
              </a>
            </div>
          </div>
        }
      </div>
    </app-bottom-sheet>
  `,
  styles: `
    .hub-container {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding-bottom: 24px;
    }

    .sheet-sub {
      font-size: 13px;
      color: var(--muted, #767a90);
      margin: 0;
    }

    .pill-tab-bar {
      display: flex;
      gap: 6px;
      background: rgba(0, 0, 0, 0.04);
      padding: 4px;
      border-radius: 14px;
      overflow-x: auto;
    }

    .pill-tab-item {
      flex: 1;
      padding: 8px 10px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 10px;
      border: none;
      background: transparent;
      color: var(--muted, #767a90);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;

      &.active {
        background: #ffffff;
        color: var(--ink, #15172b);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }
    }

    .daily-hero-badge {
      background: linear-gradient(135deg, #15172b 0%, #20243d 100%);
      color: #ffffff;
      border-radius: 18px;
      padding: 16px;
      margin-bottom: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;

      .badge-row {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .badge-label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
        }

        .badge-val-amber {
          font-size: 20px;
          font-weight: 800;
          color: #ffb84e;
        }

        .badge-val {
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
        }

        &.secondary {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 8px;
        }
      }
    }

    .preview-box {
      background: rgba(0, 0, 0, 0.03);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 14px;
      padding: 12px 14px;
      margin-bottom: 14px;

      .preview-box-title {
        display: block;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--muted, #767a90);
        margin-bottom: 6px;
      }

      .message-preview-text {
        font-family: inherit;
        font-size: 13px;
        line-height: 1.45;
        color: var(--ink, #15172b);
        white-space: pre-wrap;
        margin: 0;
      }
    }

    .broadcast-action-cluster {
      margin-bottom: 16px;
    }

    .btn-primary-action {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 14px;
      border-radius: 16px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      box-sizing: border-box;
      transition: transform 0.15s ease;

      &:active {
        transform: scale(0.98);
      }
    }

    .whatsapp-brand-btn {
      background: #25d366;
      color: #ffffff;
      border: none;
      box-shadow: 0 4px 14px rgba(37, 211, 102, 0.35);
    }

    .direct-send-title {
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: var(--muted, #767a90);
      margin-bottom: 8px;
    }

    .direct-chips-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;

      .direct-member-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 99px;
        background: rgba(37, 211, 102, 0.1);
        color: #128c7e;
        border: 1px solid rgba(37, 211, 102, 0.3);
        font-size: 12px;
        font-weight: 700;
        text-decoration: none;

        small {
          color: rgba(18, 140, 126, 0.7);
        }
      }
    }

    .info-callout-bubble {
      background: rgba(108, 76, 255, 0.08);
      border-left: 3px solid #6c4cff;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 14px;

      p {
        margin: 0;
        font-size: 13px;
        color: var(--ink, #15172b);
        line-height: 1.4;
      }
    }

    .reminders-table-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .reminder-member-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 14px;
      border-radius: 16px;
      background: rgba(0, 0, 0, 0.02);
      border: 1px solid rgba(0, 0, 0, 0.06);

      .reminder-meta-left {
        display: flex;
        flex-direction: column;
        gap: 2px;

        .reminder-name {
          font-size: 15px;
          font-weight: 800;
          color: var(--ink, #15172b);
        }

        .reminder-phone {
          font-size: 12px;
          color: var(--muted, #767a90);
        }

        .reminder-target {
          font-size: 12px;
          color: var(--ink, #15172b);
          margin-top: 2px;

          small {
            color: var(--muted, #767a90);
          }
        }
      }

      .status-badge-paid {
        font-size: 12px;
        font-weight: 700;
        color: #0fb27c;
        background: rgba(15, 178, 124, 0.1);
        padding: 6px 12px;
        border-radius: 99px;
      }

      .reminder-send-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: 12px;
        background: #25d366;
        color: #ffffff;
        font-size: 12px;
        font-weight: 700;
        text-decoration: none;
        box-shadow: 0 2px 8px rgba(37, 211, 102, 0.3);
      }
    }

    .excel-preview-card {
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 16px;
      padding: 14px;
      background: rgba(0, 0, 0, 0.02);
      margin-bottom: 16px;

      .preview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        .preview-badge {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          color: #0fb27c;
        }

        .file-name {
          font-size: 12px;
          color: var(--muted, #767a90);
          font-family: monospace;
        }
      }

      .excel-rows-preview {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .excel-row-item {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          padding-bottom: 6px;
          border-bottom: 1px dashed rgba(0, 0, 0, 0.06);

          .col-name {
            font-weight: 700;
            width: 70px;
          }

          .col-phone {
            color: var(--muted, #767a90);
            font-size: 12px;
          }

          .col-target {
            color: var(--muted, #767a90);
          }

          .col-paid {
            color: var(--ink, #15172b);
          }
        }
      }
    }

    .excel-actions-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;

      .excel-download-btn {
        background: #0fb27c;
        color: #ffffff;
        border: none;
        box-shadow: 0 4px 14px rgba(15, 178, 124, 0.35);
      }

      .btn-secondary-action {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 13px;
        border-radius: 16px;
        font-size: 14px;
        font-weight: 700;
        text-decoration: none;
        background: rgba(0, 0, 0, 0.05);
        color: var(--ink, #15172b);
        border: 1px solid rgba(0, 0, 0, 0.08);
        box-sizing: border-box;
      }
    }
  `,
})
export class BroadcastModalComponent {
  readonly ledgerStore = inject(LedgerStore);
  readonly isOpen = input<boolean>(false);
  readonly dismissed = output<void>();

  readonly activeTab = signal<BroadcastTab>('daily');

  readonly formatPaise = formatPaise;
  readonly toRupees = toRupees;

  readonly dailyInterest = computed<Paise>(() => {
    const loan = this.ledgerStore.loan();
    const principal = this.ledgerStore.currentPrincipal();
    const basisDays = loan.bankRules?.dayCountBasis === '360' ? 360 : 365;
    return computeDailyInterest(principal, loan.currentRateBps, basisDays);
  });

  readonly effectiveTodayBalance = computed<Paise>(() => {
    return paise(this.ledgerStore.currentPrincipal() + this.dailyInterest());
  });

  readonly dailyMessage = computed(() => {
    return buildDailyInterestBroadcast(this.ledgerStore.ledgerState());
  });

  readonly annualEmailUrl = computed(() => {
    return buildAnnualReportMailtoUrl(this.ledgerStore.ledgerState());
  });

  getMember(memberId: string): Member | undefined {
    return this.ledgerStore.activeMembers().find((m) => m.id === memberId);
  }

  getMemberDue(m: MemberStatistics): Paise {
    if (!m.target) return paise(0);
    return paise(Math.max(0, m.target - m.thisMonthContribution));
  }

  getMemberDailyWhatsApp(member: Member): string {
    return buildDailyInterestBroadcast(this.ledgerStore.ledgerState(), member.phone).whatsappUrl;
  }

  getMonthlyReminderWhatsApp(member?: Member): string {
    if (!member) return '';
    return buildMonthlyDueReminder(member, this.ledgerStore.ledgerState()).whatsappUrl;
  }

  downloadExcel(): void {
    const blob = generateAnnualExcelSpreadsheet(this.ledgerStore.ledgerState());
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SBI-Home-Loan-Annual-Report-Nov-${new Date().getFullYear()}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

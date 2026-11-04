import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  NgZone,
  OnDestroy,
  output,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CountUpDirective } from '../../shared/ui/count-up/count-up.directive';
import { formatCompactPaise, formatPaise, Loan, Paise } from '../../core/engine';

interface Particle {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  speedX: number;
  opacity: number;
  hue: number;
}

@Component({
  selector: 'app-ambient-motion-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CountUpDirective],
  template: `
    <div class="ambient-hero-container">
      <!-- High-End Generative Fluid Motion Canvas -->
      <canvas #motionCanvas class="ambient-canvas"></canvas>

      <!-- Glass Vignette & Ambient Light Veil -->
      <div class="ambient-veil"></div>

      <!-- Hero Visual Core -->
      <div class="hero-content">
        <!-- Top Metadata & Reveal Pill -->
        <div class="top-pill-row">
          <span class="live-indicator">
            <span class="pulse-dot"></span>
            Live Accrual · {{ loan().type }}
          </span>

          <button
            type="button"
            class="account-pill"
            (click)="toggleReveal.emit()"
            [attr.aria-label]="isMasked() ? 'Reveal account number' : 'Hide account number'"
          >
            <span class="acc-num">{{ displayAccountNumber() }}</span>
            <span class="reveal-hint">{{ isMasked() ? 'Show' : 'Hide' }}</span>
          </button>
        </div>

        <!-- Central High-End Number Showcase -->
        <div class="number-stage">
          <span class="stage-label">TOTAL OUTSTANDING</span>
          <div class="main-balance tabular-nums" [appCountUp]="currentOutstanding()">
            {{ formattedOutstanding() }}
          </div>
        </div>

        <!-- Payoff Radial Arc & Repaid Metrics -->
        <div class="payoff-metric-row">
          <div class="arc-container">
            <svg class="payoff-arc-svg" viewBox="0 0 100 100">
              <circle
                class="arc-bg"
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke-width="5"
              />
              <circle
                class="arc-fill"
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke-width="5"
                [style.strokeDasharray]="circumference"
                [style.strokeDashoffset]="strokeDashoffset()"
              />
            </svg>
            <div class="arc-center-text">
              <span class="arc-percent">{{ repaidPercent().toFixed(1) }}%</span>
              <span class="arc-sub">REPAID</span>
            </div>
          </div>

          <div class="payoff-stats-list">
            <div class="payoff-stat-item">
              <span class="p-label">Repaid to date</span>
              <span class="p-val tabular-nums">{{ formattedRepaid() }}</span>
            </div>
            <div class="payoff-stat-item">
              <span class="p-label">Sanction limit</span>
              <span class="p-val tabular-nums">{{ formattedLimit() }}</span>
            </div>
          </div>
        </div>

        <!-- Calm Minimal Metrics Flow -->
        <div class="minimal-metrics-bar">
          <div class="metric-flow-item">
            <span class="m-label">Interest rate</span>
            <span class="m-val">{{ (loan().currentRateBps / 100).toFixed(2) }}% p.a.</span>
          </div>
          <div class="metric-flow-divider"></div>
          <div class="metric-flow-item">
            <span class="m-label">Monthly target</span>
            <span class="m-val tabular-nums">{{ formattedTarget() }}</span>
          </div>
          <div class="metric-flow-divider"></div>
          <div class="metric-flow-item">
            <span class="m-label">Est. payoff</span>
            <span class="m-val">{{ closureDate() || '—' }}</span>
          </div>
        </div>

        <!-- Floating Quick Action Chips -->
        <div class="action-dock" role="toolbar" aria-label="Quick Actions">
          <button
            type="button"
            class="action-pill primary"
            (click)="quickAction.emit('contribution')"
          >
            <span class="action-icon">＋</span>
            <span>Contribution</span>
          </button>
          <button
            type="button"
            class="action-pill"
            (click)="quickAction.emit('bankPayment')"
          >
            <span>Bank Payment</span>
          </button>
          <button
            type="button"
            class="action-pill"
            (click)="quickAction.emit('insights')"
          >
            <span>Simulator</span>
          </button>
          <button
            type="button"
            class="action-pill"
            (click)="quickAction.emit('history')"
          >
            <span>History</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .ambient-hero-container {
      position: relative;
      width: 100%;
      min-height: 440px;
      margin: 0 0 44px;
      border-radius: 36px;
      overflow: hidden;
      background: radial-gradient(120% 90% at 50% 0%, #ffffff 0%, #f4f6fb 55%, #eef2f9 100%);
      box-shadow: 
        0 24px 60px -16px rgba(0, 113, 227, 0.08),
        0 4px 20px -2px rgba(0, 0, 0, 0.02),
        inset 0 1px 2px rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(0, 0, 0, 0.03);
      display: flex;
      flex-direction: column;
    }

    .ambient-canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    }

    .ambient-veil {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.85) 85%);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      pointer-events: none;
      z-index: 2;
    }

    .hero-content {
      position: relative;
      z-index: 3;
      padding: 30px 24px 28px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .top-pill-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      margin-bottom: 24px;
    }

    .live-indicator {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted, #86868b);
    }

    .pulse-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #34c759;
      box-shadow: 0 0 0 0 rgba(52, 199, 89, 0.6);
      animation: pulseGreen 2.2s infinite;
    }

    @keyframes pulseGreen {
      0% {
        box-shadow: 0 0 0 0 rgba(52, 199, 89, 0.6);
      }
      70% {
        box-shadow: 0 0 0 7px rgba(52, 199, 89, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(52, 199, 89, 0);
      }
    }

    .account-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(0, 0, 0, 0.06);
      color: var(--ink, #1d1d1f);
      font-size: 12px;
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        background: #ffffff;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
      }

      &:active {
        transform: scale(0.96);
      }
    }

    .reveal-hint {
      font-size: 10px;
      font-weight: 800;
      color: var(--brand-a, #0071e3);
      text-transform: uppercase;
    }

    .number-stage {
      margin: 10px 0 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      animation: numberReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes numberReveal {
      from {
        opacity: 0;
        transform: translateY(18px) scale(0.96);
        filter: blur(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
        filter: blur(0);
      }
    }

    .stage-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: var(--muted, #86868b);
      text-transform: uppercase;
      margin-bottom: 6px;
    }

    .main-balance {
      font-size: 46px;
      font-weight: 800;
      letter-spacing: -0.04em;
      line-height: 1.05;
      color: #1d1d1f;
      background: linear-gradient(180deg, #1d1d1f 60%, #3a3a3e 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
    }

    @media (min-width: 500px) {
      .main-balance {
        font-size: 52px;
      }
    }

    /* Payoff Arc Row */
    .payoff-metric-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 24px;
      margin-bottom: 24px;
      padding: 12px 20px;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-radius: 24px;
      border: 1px solid rgba(0, 0, 0, 0.04);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
      width: 100%;
      max-width: 440px;
    }

    .arc-container {
      position: relative;
      width: 68px;
      height: 68px;
      flex-shrink: 0;
    }

    .payoff-arc-svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    .arc-bg {
      stroke: rgba(0, 0, 0, 0.06);
    }

    .arc-fill {
      stroke: #0071e3;
      stroke-linecap: round;
      transition: stroke-dashoffset 1.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .arc-center-text {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .arc-percent {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #1d1d1f;
    }

    .arc-sub {
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: var(--muted, #86868b);
    }

    .payoff-stats-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      text-align: left;
    }

    .payoff-stat-item {
      display: flex;
      flex-direction: column;
    }

    .p-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--muted, #86868b);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .p-val {
      font-size: 14px;
      font-weight: 800;
      color: #1d1d1f;
      letter-spacing: -0.01em;
    }

    /* Minimal Metrics Bar */
    .minimal-metrics-bar {
      display: flex;
      align-items: center;
      justify-content: space-around;
      width: 100%;
      max-width: 440px;
      padding: 10px 0;
      margin-bottom: 22px;
    }

    .metric-flow-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .m-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted, #86868b);
    }

    .m-val {
      font-size: 13px;
      font-weight: 800;
      color: #1d1d1f;
      letter-spacing: -0.01em;
    }

    .metric-flow-divider {
      width: 1px;
      height: 22px;
      background: rgba(0, 0, 0, 0.08);
    }

    /* Action Dock */
    .action-dock {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
      width: 100%;
    }

    .action-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 18px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(0, 0, 0, 0.06);
      color: #1d1d1f;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
      -webkit-tap-highlight-color: transparent;

      &:hover {
        background: #ffffff;
        transform: translateY(-2px);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
      }

      &:active {
        transform: scale(0.95);
      }

      &.primary {
        background: linear-gradient(135deg, #0071e3 0%, #0056b3 100%);
        color: #ffffff;
        border: none;
        box-shadow: 0 4px 16px rgba(0, 113, 227, 0.35);

        &:hover {
          box-shadow: 0 8px 24px rgba(0, 113, 227, 0.45);
        }
      }
    }

    .action-icon {
      font-size: 15px;
      font-weight: 800;
      line-height: 1;
    }
  `,
})
export class AmbientMotionHeroComponent implements AfterViewInit, OnDestroy {
  private readonly ngZone = inject(NgZone);

  readonly loan = input.required<Loan>();
  readonly currentOutstanding = input.required<Paise>();
  readonly isMasked = input<boolean>(true);
  readonly closureDate = input<string | undefined>(undefined);

  readonly toggleReveal = output<void>();
  readonly quickAction = output<'contribution' | 'bankPayment' | 'history' | 'settings' | 'insights'>();

  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('motionCanvas');

  private animFrameId: number | null = null;
  private resizeHandler: (() => void) | null = null;
  private particles: Particle[] = [];
  private time = 0;

  readonly radius = 40;
  readonly circumference = 2 * Math.PI * this.radius;

  readonly displayAccountNumber = computed(() => {
    const raw = this.loan().accountNumber;
    if (!this.isMasked()) return raw;
    return `•••• ${raw.slice(-4)}`;
  });

  readonly formattedOutstanding = computed(() =>
    formatPaise(this.currentOutstanding())
  );

  readonly repaidAmount = computed<Paise>(() => {
    const lim = this.loan().sanctionedLimit;
    const out = this.currentOutstanding();
    return Math.max(0, lim - out) as Paise;
  });

  readonly repaidPercent = computed(() => {
    const lim = this.loan().sanctionedLimit;
    if (lim <= 0) return 0;
    return (this.repaidAmount() / lim) * 100;
  });

  readonly strokeDashoffset = computed(() => {
    const pct = Math.min(100, Math.max(0, this.repaidPercent()));
    return this.circumference - (pct / 100) * this.circumference;
  });

  readonly formattedRepaid = computed(() =>
    formatPaise(this.repaidAmount())
  );

  readonly formattedLimit = computed(() =>
    formatCompactPaise(this.loan().sanctionedLimit)
  );

  readonly formattedTarget = computed(() =>
    formatCompactPaise(this.loan().monthlyTarget)
  );

  ngAfterViewInit(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    this.ngZone.runOutsideAngular(() => {
      this.initAnimation(canvas);
    });
  }

  ngOnDestroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
  }

  private initAnimation(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.resizeHandler = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    this.resizeHandler();
    window.addEventListener('resize', this.resizeHandler);

    // Seed particles
    const particleCount = 28;
    this.particles = [];
    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: Math.random() * canvas.clientWidth,
        y: Math.random() * canvas.clientHeight,
        radius: Math.random() * 2.5 + 1,
        speedY: -(Math.random() * 0.4 + 0.15),
        speedX: (Math.random() - 0.5) * 0.25,
        opacity: Math.random() * 0.6 + 0.2,
        hue: Math.random() > 0.5 ? 210 : 225, // Apple blue/indigo palette
      });
    }

    const render = () => {
      this.time += 0.015;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      ctx.clearRect(0, 0, w, h);

      // Generative Luminous Fluid Light Spheres
      // Light Orb 1 (Top Right Sapphire)
      const orb1X = w * 0.75 + Math.sin(this.time * 0.8) * (w * 0.12);
      const orb1Y = h * 0.25 + Math.cos(this.time * 0.6) * (h * 0.1);
      const grad1 = ctx.createRadialGradient(orb1X, orb1Y, 0, orb1X, orb1Y, w * 0.55);
      grad1.addColorStop(0, 'rgba(0, 113, 227, 0.18)');
      grad1.addColorStop(0.5, 'rgba(56, 189, 248, 0.08)');
      grad1.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, w, h);

      // Light Orb 2 (Bottom Left Cyan/Emerald)
      const orb2X = w * 0.25 + Math.cos(this.time * 0.7) * (w * 0.14);
      const orb2Y = h * 0.65 + Math.sin(this.time * 0.5) * (h * 0.12);
      const grad2 = ctx.createRadialGradient(orb2X, orb2Y, 0, orb2X, orb2Y, w * 0.5);
      grad2.addColorStop(0, 'rgba(52, 199, 89, 0.12)');
      grad2.addColorStop(0.5, 'rgba(0, 113, 227, 0.06)');
      grad2.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, w, h);

      // Light Orb 3 (Center Top Aura)
      const orb3X = w * 0.5 + Math.sin(this.time * 1.1) * (w * 0.08);
      const orb3Y = h * 0.1 + Math.cos(this.time * 0.9) * (h * 0.08);
      const grad3 = ctx.createRadialGradient(orb3X, orb3Y, 0, orb3X, orb3Y, w * 0.35);
      grad3.addColorStop(0, 'rgba(67, 56, 202, 0.12)');
      grad3.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad3;
      ctx.fillRect(0, 0, w, h);

      // Floating Particle Embers
      for (const p of this.particles) {
        p.y += p.speedY;
        p.x += p.speedX;

        if (p.y < -10) {
          p.y = h + 10;
          p.x = Math.random() * w;
        }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 85%, 60%, ${p.opacity * (0.6 + 0.4 * Math.sin(this.time * 2 + p.x))})`;
        ctx.fill();
      }

      this.animFrameId = requestAnimationFrame(render);
    };

    render();
  }
}

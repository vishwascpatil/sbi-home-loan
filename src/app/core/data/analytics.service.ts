import { inject, Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Analytics,
  getAnalytics,
  isSupported,
  logEvent,
  setUserId,
  setUserProperties,
} from 'firebase/analytics';
import { environment } from '../../../environments/environment';

export interface AnalyticsActionParams {
  category?: string;
  label?: string;
  value?: number;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class AppAnalyticsService {
  private readonly router = inject(Router);
  private analytics: Analytics | null = null;
  private currentMemberName: string = 'Anonymous';
  private currentMemberId: string = '';
  private isReady = false;

  constructor() {
    void this.initAnalytics();
    this.listenToNavigation();
  }

  /**
   * Initializes Firebase / Google Analytics (GA4) safely.
   */
  private async initAnalytics(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const supported = await isSupported();
      if (!supported) {
        console.warn('[GA4 Analytics] Not supported in this browser environment');
        return;
      }

      const app: FirebaseApp =
        getApps().length === 0 ? initializeApp(environment.firebase) : getApp();

      this.analytics = getAnalytics(app);
      this.isReady = true;

      // If member identity was assigned before GA4 finished loading, sync it now
      if (this.currentMemberName && this.currentMemberName !== 'Anonymous') {
        this.applyMemberIdentity();
      }

      this.logAction('app_launch', {
        platform: 'pwa',
        measurement_id: environment.firebase.measurementId,
      });
    } catch (err) {
      console.warn('[GA4 Analytics] Initialization error:', err);
    }
  }

  /**
   * Tags all future analytics events and sessions with the active family member.
   * Enables GA4 User-ID tracking and custom dimension breakdown.
   */
  setMember(memberName: string, memberId: string): void {
    this.currentMemberName = memberName || 'Anonymous';
    this.currentMemberId = memberId || '';

    if (this.isReady && this.analytics) {
      this.applyMemberIdentity();
    }
  }

  private applyMemberIdentity(): void {
    if (!this.analytics) return;
    try {
      // 1. GA4 Native User-ID (Identifies individual family member across sessions)
      setUserId(this.analytics, this.currentMemberName);

      // 2. Custom User Properties (Available in GA4 Explorations & Comparison reports)
      setUserProperties(this.analytics, {
        member_name: this.currentMemberName,
        member_id: this.currentMemberId,
        member_role: this.getRole(this.currentMemberName),
      });

      // 3. Activity Ping for Member Leaderboard
      logEvent(this.analytics, 'member_active_session', {
        member_name: this.currentMemberName,
        member_id: this.currentMemberId,
      });
    } catch (err) {
      console.warn('[GA4 Analytics] Failed to apply member identity:', err);
    }
  }

  /**
   * Tracks route changes automatically, attributing each screen visit to the active member.
   */
  private listenToNavigation(): void {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        const screenName = this.getScreenName(event.urlAfterRedirects || event.url);
        this.logScreenView(screenName);
      });
  }

  logScreenView(screenName: string): void {
    if (!this.analytics) return;
    try {
      logEvent(this.analytics, 'screen_view', {
        firebase_screen: screenName,
        firebase_screen_class: screenName,
        member_name: this.currentMemberName,
      });
    } catch {
      // Ignore
    }
  }

  /**
   * Logs a high-value interaction tagged with member name.
   */
  logAction(actionName: string, params: AnalyticsActionParams = {}): void {
    if (!this.analytics) return;
    try {
      logEvent(this.analytics, actionName, {
        ...params,
        member_name: this.currentMemberName,
        member_id: this.currentMemberId,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Ignore
    }
  }

  private getScreenName(url: string): string {
    const clean = url.split('?')[0].split('#')[0];
    if (clean === '/' || clean === '/home') return 'Home Dashboard';
    if (clean.startsWith('/statements')) return 'Bank Statements';
    if (clean === '/members/history') return 'Payment History';
    if (clean.startsWith('/members')) return 'Family Members';
    if (clean.startsWith('/settings')) return 'Settings & Tools';
    return clean;
  }

  private getRole(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('vishwas') || n.includes('vikas')) return 'Co-Borrower (₹1.05L Target)';
    if (n.includes('bhavya') || n.includes('shruthi')) return 'Co-Borrower';
    if (n.includes('csp')) return 'Primary Contributor';
    return 'Family Member';
  }
}


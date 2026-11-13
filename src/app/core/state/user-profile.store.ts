import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { AppAnalyticsService, BrowserDeviceStorageAdapter } from '../data';
import { LedgerStore } from './ledger.store';
import { Member } from '../engine';

@Injectable({
  providedIn: 'root',
})
export class UserProfileStore {
  private readonly storage = inject(BrowserDeviceStorageAdapter);
  private readonly ledgerStore = inject(LedgerStore);
  private readonly analytics = inject(AppAnalyticsService);

  readonly currentMemberId = signal<string | null>(this.storage.getDeviceMemberId());

  // Whether a profile has already been selected on this phone
  readonly isConfigured = computed<boolean>(() => !!this.currentMemberId());

  // Welcome board opens on first launch or when the user wants to switch profiles
  readonly isWelcomeBoardOpen = signal<boolean>(!this.storage.getDeviceMemberId());

  readonly currentMember = computed<Member | null>(() => {
    const id = this.currentMemberId();
    if (!id) return null;
    return this.ledgerStore.members().find((m) => m.id === id) || null;
  });

  readonly currentMemberName = computed<string>(() => {
    const member = this.currentMember();
    return member?.name || 'Vishwas';
  });

  readonly currentMemberAvatar = computed<string | undefined>(() => {
    return this.currentMember()?.avatarUrl;
  });

  constructor() {
    // Synchronize member profile with Google Analytics whenever currentMember changes
    effect(() => {
      const name = this.currentMemberName();
      const id = this.currentMemberId();
      if (id && name) {
        this.analytics.setMember(name, id);
      }
    });
  }

  setProfile(memberId: string): void {
    this.currentMemberId.set(memberId);
    this.storage.setDeviceMemberId(memberId);
    this.isWelcomeBoardOpen.set(false);
    const member = this.currentMember();
    if (member) {
      this.analytics.setMember(member.name, member.id);
      this.analytics.logAction('select_profile', {
        member_name: member.name,
      });
    }
  }

  openProfilePicker(): void {
    this.isWelcomeBoardOpen.set(true);
    this.analytics.logAction('open_profile_picker');
  }

  closeProfilePicker(): void {
    if (this.isConfigured()) {
      this.isWelcomeBoardOpen.set(false);
    }
  }

  resetProfile(): void {
    this.currentMemberId.set(null);
    this.storage.clearDeviceMemberId();
    this.isWelcomeBoardOpen.set(true);
    this.analytics.setMember('Anonymous', '');
  }
}


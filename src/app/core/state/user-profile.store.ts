import { computed, inject, Injectable, signal } from '@angular/core';
import { BrowserDeviceStorageAdapter } from '../data';
import { LedgerStore } from './ledger.store';
import { Member } from '../engine';

@Injectable({
  providedIn: 'root',
})
export class UserProfileStore {
  private readonly storage = inject(BrowserDeviceStorageAdapter);
  private readonly ledgerStore = inject(LedgerStore);

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

  setProfile(memberId: string): void {
    this.currentMemberId.set(memberId);
    this.storage.setDeviceMemberId(memberId);
    this.isWelcomeBoardOpen.set(false);
  }

  openProfilePicker(): void {
    this.isWelcomeBoardOpen.set(true);
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
  }
}


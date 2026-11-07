import { Injectable } from '@angular/core';

export const DEVICE_MEMBER_STORAGE_KEY = 'sbi_loan_device_member_id';

export interface DeviceStorageAdapter {
  getDeviceMemberId(): string | null;
  setDeviceMemberId(memberId: string): void;
  clearDeviceMemberId(): void;
}

@Injectable({
  providedIn: 'root',
})
export class BrowserDeviceStorageAdapter implements DeviceStorageAdapter {
  getDeviceMemberId(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      return localStorage.getItem(DEVICE_MEMBER_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  setDeviceMemberId(memberId: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(DEVICE_MEMBER_STORAGE_KEY, memberId);
    } catch {
      // Handle storage quota or private browsing exceptions
    }
  }

  clearDeviceMemberId(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.removeItem(DEVICE_MEMBER_STORAGE_KEY);
    } catch {
      // Handle storage quota or private browsing exceptions
    }
  }
}

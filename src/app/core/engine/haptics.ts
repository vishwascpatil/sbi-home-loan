/**
 * Haptic feedback utility providing crisp native-like micro haptic taps.
 *
 * Supported environments:
 * - Android & Chromium devices: Uses W3C Web Vibration API (`navigator.vibrate`).
 * - iOS Safari / iOS WebKit (iOS 27.2+): Apple strictly restricts hardware Taptic Engine
 *   access to native App Store applications (UIImpactFeedbackGenerator / CoreHaptics).
 *   WebKit omits the Vibration API entirely; the engine falls back to visual spring physics.
 */
export type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning';

export function triggerHaptic(type: HapticType = 'light'): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return;
  }

  // W3C Web Vibration API (Android / Chrome)
  if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
    try {
      switch (type) {
        case 'light':
        case 'selection':
          navigator.vibrate(12);
          break;
        case 'medium':
          navigator.vibrate(22);
          break;
        case 'heavy':
          navigator.vibrate(35);
          break;
        case 'success':
          navigator.vibrate([10, 30, 15]);
          break;
        case 'warning':
          navigator.vibrate([15, 40, 20]);
          break;
      }
    } catch {
      // Graceful no-op when permissions or hardware are restricted
    }
  }
}

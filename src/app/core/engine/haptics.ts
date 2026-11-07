/**
 * Haptic feedback utility providing crisp native-like micro haptic taps
 * (identical to Zepto / Swiggy / iOS UIImpactFeedbackGenerator).
 */
export type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning';

export function triggerHaptic(type: HapticType = 'light'): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return;
  }

  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      switch (type) {
        case 'light':
        case 'selection':
          // Zepto-style crisp micro tap (12ms)
          navigator.vibrate(12);
          break;
        case 'medium':
          // Slightly firmer tactile bump (22ms)
          navigator.vibrate(22);
          break;
        case 'heavy':
          // Prominent impact (35ms)
          navigator.vibrate(35);
          break;
        case 'success':
          // Double tick: tick, short pause, tick
          navigator.vibrate([10, 30, 15]);
          break;
        case 'warning':
          // Warning alert pattern
          navigator.vibrate([15, 40, 20]);
          break;
      }
    }
  } catch {
    // Graceful no-op on platforms or permissions where vibration is unavailable
  }
}


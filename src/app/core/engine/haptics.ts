/**
 * Haptic feedback utility providing crisp native-like micro haptic taps
 * (identical to Zepto / Swiggy / iOS UIImpactFeedbackGenerator).
 *
 * Supports:
 * 1. Android & Chromium devices via W3C Web Vibration API (`navigator.vibrate`).
 * 2. iOS Safari (iPhone / iPad) via native WebKit switch element hook (`<input type="checkbox" switch>`).
 * 3. Acoustic tactile micro-pop via Web Audio API for iOS / muted vibration environments.
 */
export type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning';

let iosSwitchLabel: HTMLLabelElement | null = null;
let audioCtx: AudioContext | null = null;
let lastIOSHaptic = 0;

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function ensureIOSSwitch(): HTMLLabelElement | null {
  if (typeof document === 'undefined') return null;
  if (!iosSwitchLabel) {
    try {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = 'ios-taptic-switch';
      input.setAttribute('switch', '');
      input.style.cssText =
        'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;z-index:-1;';
      input.tabIndex = -1;
      input.setAttribute('aria-hidden', 'true');
      document.body.appendChild(input);

      const label = document.createElement('label');
      label.htmlFor = 'ios-taptic-switch';
      label.style.cssText =
        'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;z-index:-1;';
      label.tabIndex = -1;
      label.setAttribute('aria-hidden', 'true');
      document.body.appendChild(label);
      iosSwitchLabel = label;
    } catch {
      return null;
    }
  }
  return iosSwitchLabel;
}

/**
 * High-fidelity synthetic micro-tap pop (120Hz damped in 12ms)
 * Simulates the mechanical impulse click felt on iPhone haptic touch.
 */
function playTactileMicroPop(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.012);

    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.012);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.015);
  } catch {
    // Non-blocking if audio context is unavailable
  }
}

export function triggerHaptic(type: HapticType = 'light'): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return;
  }

  const ios = isIOS();

  // 1. Android & Chromium devices (Native Web Vibration API)
  if (!ios && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
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
      return;
    } catch {
      // Fall through to fallback
    }
  }

  // 2. iOS Safari (iPhone / iPad) - Trigger WebKit Switch Taptic Hook + Acoustic Pop
  if (ios) {
    const now = Date.now();
    if (now - lastIOSHaptic > 50) {
      lastIOSHaptic = now;
      try {
        const label = ensureIOSSwitch();
        if (label) {
          label.click();
        }
      } catch {
        // Fallback
      }
      playTactileMicroPop();
    }
  }
}

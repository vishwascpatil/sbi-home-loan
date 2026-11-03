/**
 * Pure monetary arithmetic using integer paise.
 * Zero floating-point arithmetic on currency values.
 */

declare const PaiseBrand: unique symbol;
export type Paise = number & { readonly [PaiseBrand]: true };

/**
 * Cast a safe integer number of paise into branded Paise type.
 */
export function paise(val: number): Paise {
  if (!Number.isSafeInteger(val)) {
    throw new TypeError(`Paise value must be a safe integer, received: ${val}`);
  }
  return val as Paise;
}

/**
 * Zero paise constant.
 */
export const ZERO_PAISE = paise(0);

/**
 * Convert rupees (number or string) to integer Paise.
 * Uses string manipulation or integer decomposition to avoid floating-point inaccuracies.
 */
export function toPaise(rupees: number | string): Paise {
  if (typeof rupees === 'number') {
    if (!Number.isFinite(rupees)) {
      throw new TypeError(`Invalid rupee number: ${rupees}`);
    }
    // Convert to fixed-point string with 2 decimal places to prevent float drift
    rupees = rupees.toFixed(2);
  }

  const clean = rupees.trim().replace(/,/g, '');
  if (!clean || clean === '-') {
    return ZERO_PAISE;
  }

  const isNegative = clean.startsWith('-');
  const unsigned = isNegative ? clean.slice(1) : clean;
  const parts = unsigned.split('.');

  const integerPart = parts[0] || '0';
  let fractionPart = parts[1] || '0';

  if (fractionPart.length === 1) {
    fractionPart += '0';
  } else if (fractionPart.length > 2) {
    // Round half-up on the 3rd decimal place
    const firstTwo = parseInt(fractionPart.slice(0, 2), 10);
    const thirdDigit = parseInt(fractionPart[2] || '0', 10);
    fractionPart = (thirdDigit >= 5 ? firstTwo + 1 : firstTwo).toString().padStart(2, '0');
  }

  const totalPaise = parseInt(integerPart, 10) * 100 + parseInt(fractionPart, 10);
  return (isNegative ? -totalPaise : totalPaise) as Paise;
}

/**
 * Convert integer Paise to a floating-point rupee number for display/ratios only.
 */
export function toRupees(p: Paise): number {
  return p / 100;
}

/**
 * Addition of two Paise amounts.
 */
export function addPaise(a: Paise, b: Paise): Paise {
  return paise(a + b);
}

/**
 * Subtraction of two Paise amounts.
 */
export function subPaise(a: Paise, b: Paise): Paise {
  return paise(a - b);
}

/**
 * Perform exact integer division with half-up rounding using BigInt.
 * Returns: roundHalfUp(numerator / denominator)
 */
export function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new RangeError('Division by zero');
  }

  const isNeg = (numerator < 0n) !== (denominator < 0n);
  const absNum = numerator < 0n ? -numerator : numerator;
  const absDen = denominator < 0n ? -denominator : denominator;

  const quotient = absNum / absDen;
  const remainder = absNum % absDen;

  // Half-up rounding condition: remainder * 2 >= denominator
  const rounded = remainder * 2n >= absDen ? quotient + 1n : quotient;
  return isNeg ? -rounded : rounded;
}

/**
 * Format Paise using Indian English numbering (e.g. ₹1,21,05,189 or ₹79,692.49).
 */
export function formatPaise(
  p: Paise,
  options: {
    showPaise?: boolean;
    prefix?: string;
    isEstimated?: boolean;
  } = {}
): string {
  const { showPaise = false, prefix = '₹', isEstimated = false } = options;
  const isNegative = p < 0;
  const absPaise = Math.abs(p);
  const rupees = Math.floor(absPaise / 100);
  const remainingPaise = absPaise % 100;

  let formattedRupees = rupees.toLocaleString('en-IN');
  if (showPaise || remainingPaise > 0) {
    formattedRupees += '.' + remainingPaise.toString().padStart(2, '0');
  }

  const sign = isNegative ? '−' : '';
  const est = isEstimated ? ' est.' : '';
  return `${sign}${prefix}${formattedRupees}${est}`;
}

/**
 * Compact Indian currency format (e.g., ₹1.26 Cr, ₹2.4L, ₹50,000).
 */
export function formatCompactPaise(p: Paise, prefix = '₹'): string {
  const isNegative = p < 0;
  const absPaise = Math.abs(p);
  const rupees = absPaise / 100;
  const sign = isNegative ? '−' : '';

  if (absPaise >= 10_000_000_00) {
    // >= 1 Crore (10^7 rupees = 10^9 paise)
    const cr = (rupees / 10_000_000).toFixed(2).replace(/\.?0+$/, '');
    return `${sign}${prefix}${cr} Cr`;
  }

  if (absPaise >= 100_000_00) {
    // >= 1 Lakh (10^5 rupees = 10^7 paise)
    const l = (rupees / 100_000).toFixed(2).replace(/\.?0+$/, '');
    return `${sign}${prefix}${l}L`;
  }

  return `${sign}${prefix}${rupees.toLocaleString('en-IN')}`;
}


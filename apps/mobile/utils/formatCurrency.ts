// apps/mobile/utils/formatCurrency.ts
export type CurrencyCode = "BDT" | "INR";

export const CURRENCY_SYMBOL_MAP: Record<CurrencyCode, string> = {
  BDT: "৳",
  INR: "₹",
};

export function getCurrencySymbol(code: CurrencyCode = "BDT"): string {
  return CURRENCY_SYMBOL_MAP[code] ?? "৳";
}

/**
 * 1. Rounds an amount to 2 decimal places using symmetric round-half-up
 * before saving to the database or finalizing calculator results.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  return sign * (Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100);
}

/**
 * 2. Safely checks whether a balance is effectively zero (Settled Up).
 */
export function isSettled(balance: number): boolean {
  return Math.abs(balance) < 0.005;
}

/**
 * 3. Display formatter with en-IN grouping and ISO CurrencyCode.
 * Example: formatCurrency(4203148, 'BDT') -> "৳ 42,03,148"
 * Example: formatCurrency(1250.5, 'BDT')  -> "৳ 1,250.50"
 */
export function formatCurrency(
  amount: number,
  currencyCode: CurrencyCode = "BDT",
  showAbsolute: boolean = true,
): string {
  const symbol = getCurrencySymbol(currencyCode);
  const rounded = roundMoney(isSettled(amount) ? 0 : amount);
  const target = showAbsolute ? Math.abs(rounded) : rounded;
  const hasFraction = Math.abs(target % 1) > 0.001;

  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(target);

  return `${symbol} ${formatted}`;
}

/**
 * 4. Formats a balance with an explicit leading "+ " or "- " sign when non-zero.
 * - Positive (> 0): "+ ৳ 2,500"
 * - Negative (< 0): "- ৳ 1,200"
 * - Zero / Settled: "৳ 0"
 */
export function formatSignedCurrency(
  amount: number,
  currencyCode: CurrencyCode = "BDT",
): string {
  const base = formatCurrency(amount, currencyCode, true);
  if (isSettled(amount)) {
    return base;
  }
  return amount > 0 ? `+ ${base}` : `- ${base}`;
}

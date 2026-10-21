import { PLAYER_EXCHANGE_LIMITS } from '../config';

export type HalfUnits = number & { readonly unit: 'half-ore' };
export type CreditMinor = number & { readonly unit: 'credit-hundredth' };

const safeNonnegative = (value: number) => Number.isSafeInteger(value) && value >= 0;

/** Use strings at the database boundary for SQL bigint values. */
export function parseNonnegativeSqlInteger(value: unknown): number | null {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) return null;
  const parsed = Number(value);
  return safeNonnegative(parsed) ? parsed : null;
}

export function halfUnitsFromOre(oreUnits: number): HalfUnits | null {
  const halves = oreUnits * 2;
  return safeNonnegative(halves) ? halves as HalfUnits : null;
}

export function listingHalfUnits(value: unknown): HalfUnits | null {
  return typeof value === 'number' && Number.isSafeInteger(value) &&
    value >= PLAYER_EXCHANGE_LIMITS.minQuantityHalfUnits &&
    value <= PLAYER_EXCHANGE_LIMITS.maxQuantityHalfUnits ? value as HalfUnits : null;
}

export function oreFromHalfUnits(value: HalfUnits): number { return value / 2; }

export function priceMinorFromWholeCredits(value: unknown): CreditMinor | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) ||
    value < PLAYER_EXCHANGE_LIMITS.minPriceCreditsPerOre ||
    value > PLAYER_EXCHANGE_LIMITS.maxPriceCreditsPerOre) return null;
  return value * 100 as CreditMinor;
}

/** A half ore costs half the price for a full ore, exactly. */
export function tradeTotalMinor(quantity: HalfUnits, pricePerOreMinor: CreditMinor): CreditMinor | null {
  if (!Number.isSafeInteger(quantity) || quantity <= 0 ||
    !safeNonnegative(pricePerOreMinor) || pricePerOreMinor % 100 !== 0 ||
    pricePerOreMinor < PLAYER_EXCHANGE_LIMITS.minPriceCreditsPerOre * 100 ||
    quantity > PLAYER_EXCHANGE_LIMITS.maxQuantityHalfUnits ||
    pricePerOreMinor > PLAYER_EXCHANGE_LIMITS.maxPriceCreditsPerOre * 100) return null;
  const total = quantity * (pricePerOreMinor / 2);
  return Number.isSafeInteger(total) && total <= PLAYER_EXCHANGE_LIMITS.maxListingTotalCreditMinor
    ? total as CreditMinor : null;
}

export function formatHalfUnits(value: HalfUnits): string {
  return Number.isSafeInteger(value) && value >= 0 ? `${Math.floor(value / 2)}${value % 2 ? '.5' : ''}` : 'Invalid';
}

export function formatCreditMinor(value: CreditMinor): string {
  if (!safeNonnegative(value)) return 'Invalid';
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;
}

export function conservedHalfUnits(before: readonly HalfUnits[], after: readonly HalfUnits[], minted = 0, consumed = 0): boolean {
  const valid = [...before, ...after, minted, consumed].every(value => safeNonnegative(value));
  const source = before.reduce<number>((sum, value) => sum + value, 0) + minted;
  const destination = after.reduce<number>((sum, value) => sum + value, 0) + consumed;
  return valid && Number.isSafeInteger(source) && Number.isSafeInteger(destination) && source === destination;
}

export function conservedCreditMinor(before: readonly CreditMinor[], after: readonly CreditMinor[], issued = 0, sunk = 0): boolean {
  const valid = [...before, ...after, issued, sunk].every(value => safeNonnegative(value));
  const source = before.reduce<number>((sum, value) => sum + value, 0) + issued;
  const destination = after.reduce<number>((sum, value) => sum + value, 0) + sunk;
  return valid && Number.isSafeInteger(source) && Number.isSafeInteger(destination) && source === destination;
}

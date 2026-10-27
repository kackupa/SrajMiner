import { ONLINE_RULESET, ORE_KEYS, type Ore } from '../config';
import { listingHalfUnits, priceMinorFromWholeCredits, tradeTotalMinor, type CreditMinor, type HalfUnits } from './MarketUnits';

export const ONLINE_ERROR_CODES = [
  'AUTH_REQUIRED', 'CAMPAIGN_MODE', 'STALE_REVISION', 'SESSION_CONFLICT',
  'INSUFFICIENT_ORE', 'INSUFFICIENT_CREDITS', 'HOLD_FULL', 'LISTING_CHANGED',
  'LISTING_CLOSED', 'SELF_TRADE', 'ACCESS_REQUIRED', 'RATE_LIMITED',
  'INVALID_COMMAND', 'RULESET_MISMATCH', 'OPERATION_CONFLICT', 'CREDIT_LIMIT',
] as const;
export type OnlineErrorCode = typeof ONLINE_ERROR_CODES[number];

export type MarketSource = 'miner' | 'ship' | 'planet';
export type MarketCommand =
  | { kind: 'create_sell_listing'; source: MarketSource; ore: Ore; quantity_half_units: HalfUnits; price_credits_per_ore: number }
  | { kind: 'purchase_listing'; listing_id: string; quantity_half_units: HalfUnits; expected_listing_revision: number; quoted_price_minor: CreditMinor }
  | { kind: 'cancel_listing'; listing_id: string }
  | { kind: 'claim_return'; return_id: string; target: MarketSource; quantity_half_units: HalfUnits };

export type MarketOperation = {
  campaign_id: string;
  ruleset_version: typeof ONLINE_RULESET;
  expected_revision: number;
  operation_id: string;
  command: MarketCommand;
};

export type OperationReceipt = {
  operation_id: string;
  campaign_id: string;
  kind: MarketCommand['kind'];
  revision: number;
  occurred_at: string;
  debits: readonly { location: MarketSource | 'escrow' | 'returns' | 'wallet'; ore?: Ore; quantity_half_units?: HalfUnits; credit_minor?: CreditMinor }[];
  credits: readonly { location: MarketSource | 'escrow' | 'returns' | 'wallet'; ore?: Ore; quantity_half_units?: HalfUnits; credit_minor?: CreditMinor }[];
};

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const uuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const revision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const source = (value: unknown): value is MarketSource => value === 'miner' || value === 'ship' || value === 'planet';
const ore = (value: unknown): value is Ore => typeof value === 'string' && ORE_KEYS.includes(value as Ore);

/** Strict wire parser: claimed balances, user IDs, yields or extra fields are rejected. */
export function parseMarketOperation(value: unknown): MarketOperation | null {
  if (!object(value) || !exact(value, ['campaign_id', 'ruleset_version', 'expected_revision', 'operation_id', 'command']) ||
    !uuid(value.campaign_id) || value.ruleset_version !== ONLINE_RULESET || !revision(value.expected_revision) ||
    !uuid(value.operation_id) || !object(value.command)) return null;
  const command = value.command;
  switch (command.kind) {
    case 'create_sell_listing': {
      if (!exact(command, ['kind', 'source', 'ore', 'quantity_half_units', 'price_credits_per_ore']) ||
        !source(command.source) || !ore(command.ore)) return null;
      const quantity = listingHalfUnits(command.quantity_half_units);
      const price = priceMinorFromWholeCredits(command.price_credits_per_ore);
      if (quantity === null || price === null || tradeTotalMinor(quantity, price) === null) return null;
      break;
    }
    case 'purchase_listing': {
      if (!exact(command, ['kind', 'listing_id', 'quantity_half_units', 'expected_listing_revision', 'quoted_price_minor']) ||
        !uuid(command.listing_id) || !revision(command.expected_listing_revision)) return null;
      const quantity = listingHalfUnits(command.quantity_half_units);
      if (quantity === null || typeof command.quoted_price_minor !== 'number' ||
        !Number.isSafeInteger(command.quoted_price_minor) || command.quoted_price_minor < 100 ||
        command.quoted_price_minor > 10_000_000 || command.quoted_price_minor % 100 !== 0 ||
        tradeTotalMinor(quantity, command.quoted_price_minor as CreditMinor) === null) return null;
      break;
    }
    case 'cancel_listing':
      if (!exact(command, ['kind', 'listing_id']) || !uuid(command.listing_id)) return null;
      break;
    case 'claim_return':
      if (!exact(command, ['kind', 'return_id', 'target', 'quantity_half_units']) ||
        !uuid(command.return_id) || !source(command.target) || listingHalfUnits(command.quantity_half_units) === null) return null;
      break;
    default:
      return null;
  }
  return value as MarketOperation;
}

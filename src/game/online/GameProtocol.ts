import { ONLINE_INPUT_LIMITS, ONLINE_RULESET, type Ore } from '../config';
import type { HalfUnits } from './MarketUnits';

export type InputSegment = {
  sequence: number;
  duration_ms: number;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  drill: boolean;
  aim_cell: { column: number; row: number } | null;
};

export type SubmitGameCommands = {
  campaign_id: string;
  ruleset_version: typeof ONLINE_RULESET;
  expected_revision: number;
  operation_id: string;
  session_id: string;
  segments: readonly InputSegment[];
};

export type GameReceipt = {
  operation_id: string;
  campaign_id: string;
  revision: number;
  last_sequence: number;
  canonical_position: { x: number; y: number; vx: number; vy: number };
  destroyed_cells: readonly string[];
  cargo_delta: readonly { ore: Ore; quantity_half_units: HalfUnits }[];
  occurred_at: string;
};

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const integer = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;

/** Only ordered inputs and bounded duration are sent; position and rewards are server outputs. */
export function parseGameCommandBatch(value: unknown): SubmitGameCommands | null {
  if (!object(value) || !exact(value, ['campaign_id', 'ruleset_version', 'expected_revision', 'operation_id', 'session_id', 'segments']) ||
    !uuid(value.campaign_id) || value.ruleset_version !== ONLINE_RULESET || !integer(value.expected_revision, 0, Number.MAX_SAFE_INTEGER) ||
    !uuid(value.operation_id) || !uuid(value.session_id) || !Array.isArray(value.segments) ||
    value.segments.length < 1 || value.segments.length > ONLINE_INPUT_LIMITS.maxSegmentsPerBatch) return null;
  let totalMs = 0;
  let previousSequence = -1;
  for (const segment of value.segments as unknown[]) {
    if (!object(segment) || !exact(segment, ['sequence', 'duration_ms', 'left', 'right', 'up', 'down', 'drill', 'aim_cell']) ||
      !integer(segment.sequence, 0, Number.MAX_SAFE_INTEGER) || segment.sequence <= previousSequence ||
      !integer(segment.duration_ms, ONLINE_INPUT_LIMITS.fixedStepMs, ONLINE_INPUT_LIMITS.maxSegmentMs) ||
      segment.duration_ms % ONLINE_INPUT_LIMITS.fixedStepMs !== 0 ||
      !['left', 'right', 'up', 'down', 'drill'].every(key => typeof segment[key] === 'boolean')) return null;
    if (segment.aim_cell !== null && (!object(segment.aim_cell) || !exact(segment.aim_cell, ['column', 'row']) ||
      !integer(segment.aim_cell.column, 0, 10_000) || !integer(segment.aim_cell.row, 0, 1_000_000))) return null;
    previousSequence = segment.sequence;
    totalMs += segment.duration_ms;
    if (totalMs > ONLINE_INPUT_LIMITS.maxBatchMs) return null;
  }
  return value as SubmitGameCommands;
}

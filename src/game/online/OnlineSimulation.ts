import { CORE, CORE_RELICS, FRONTIER, ONLINE_INPUT_LIMITS, ORE_KEYS, STARTER_PLANET_CHART, WORLD, type Levels, type MapId, type Ore } from '../config';
import { collectCoreRelic } from '../campaign/Records';
import { coreExtractionStep } from '../campaign/RenewableFuel';
import { Progress } from '../economy/Progress';
import { MiningSystem, podWithinPickupReach } from '../mining/MiningSystem';
import { PlayerPod } from '../player/PlayerPod';
import { planetCameraFrameAngle } from '../world/Projection';
import { TileWorld, keyOf } from '../world/TileWorld';
import type { InputSegment } from './GameProtocol';

export type OnlineDrop = { id: string; x: number; y: number; ore: Ore; quantity_half_units: number };
export type OnlineSimulationState = {
  world_seed: number;
  levels: Levels;
  destroyed_cells: string[];
  pod: { x: number; y: number; vx: number; vy: number; docked: boolean };
  fuel_milli: number;
  hull_milli: number;
  core_fuel: number;
  core_relics: string[];
  core_extraction_elapsed_ms: number;
  cargo_half_units: Partial<Record<Ore, number>>;
  drops: OnlineDrop[];
  drill_target: { x: number; y: number } | null;
  drill_elapsed_ms: number;
  last_sequence: number;
  input_budget_ms: number;
  observed_at_ms: number;
};
export type OnlineSimulationReceipt = {
  state: OnlineSimulationState;
  destroyed_cells: string[];
  cargo_delta_half_units: Partial<Record<Ore, number>>;
};

/** Trusted server state only. Never take this object from a browser request. */
export function freshOnlineSimulation(worldSeed: number, serverNowMs: number): OnlineSimulationState {
  if (!Number.isSafeInteger(worldSeed) || worldSeed < 0 || worldSeed > 0xffffffff ||
    !Number.isSafeInteger(serverNowMs) || serverNowMs < 0) throw new Error('INVALID_STATE');
  return {
    world_seed: worldSeed,
    levels: { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1, scanner: 1, grapple: 1 },
    destroyed_cells: [],
    pod: { x: 680, y: WORLD.spawnY, vx: 0, vy: 0, docked: true },
    fuel_milli: 140_000,
    hull_milli: 100_000,
    core_fuel: 0,
    core_relics: [],
    core_extraction_elapsed_ms: 0,
    cargo_half_units: {},
    drops: [],
    drill_target: null,
    drill_elapsed_ms: 0,
    last_sequence: -1,
    input_budget_ms: ONLINE_INPUT_LIMITS.maxBatchMs,
    observed_at_ms: serverNowMs,
  };
}

/** Replays only ordered controls against the canonical chart, collision and ore rules. */
export function advanceOnlineSimulation(
  stored: OnlineSimulationState,
  segments: readonly InputSegment[],
  serverNowMs: number,
  planet: MapId = 'cryo-shelf',
): OnlineSimulationReceipt {
  if (!FRONTIER.worlds.includes(planet)) throw new Error('INVALID_STATE');
  if (!Number.isSafeInteger(serverNowMs) || serverNowMs < stored.observed_at_ms ||
    segments.length < 1 || segments.length > ONLINE_INPUT_LIMITS.maxSegmentsPerBatch) throw new Error('INVALID_COMMAND');
  const duration = segments.reduce((total, segment) => total + segment.duration_ms, 0);
  const budget = Math.min(ONLINE_INPUT_LIMITS.maxBatchMs,
    stored.input_budget_ms + serverNowMs - stored.observed_at_ms);
  if (duration > budget || duration > ONLINE_INPUT_LIMITS.maxBatchMs) throw new Error('RATE_LIMITED');
  let sequence = stored.last_sequence;
  for (const segment of segments) {
    if (segment.sequence !== ++sequence || segment.aim_cell !== null ||
      !Number.isSafeInteger(segment.duration_ms) ||
      segment.duration_ms < ONLINE_INPUT_LIMITS.fixedStepMs ||
      segment.duration_ms > ONLINE_INPUT_LIMITS.maxSegmentMs ||
      segment.duration_ms % ONLINE_INPUT_LIMITS.fixedStepMs !== 0 ||
      !['left', 'right', 'up', 'down', 'drill'].every(key => typeof segment[key as keyof InputSegment] === 'boolean'))
      throw new Error('INVALID_COMMAND');
  }

  const world = new TileWorld(stored.world_seed, stored.destroyed_cells, [], planet, STARTER_PLANET_CHART);
  const localCore = CORE_RELICS.find(relic => relic.mapId === planet);
  world.miningOnly = true;
  const progress = new Progress();
  progress.levels = { ...stored.levels };
  progress.grappleOwned = stored.levels.grapple > 1;
  progress.money = 0;
  progress.coreFuel = stored.core_fuel;
  progress.milestones = [...stored.core_relics];
  progress.fuel = stored.fuel_milli / 1000;
  progress.hull = stored.hull_milli / 1000;
  for (const ore of ORE_KEYS) progress.cargo[ore] = (stored.cargo_half_units[ore] ?? 0) / 2;
  const pod = new PlayerPod(world, progress);
  Object.assign(pod, stored.pod);
  const mining = new MiningSystem(world, progress);
  if (stored.drill_target) mining.target = world.get(stored.drill_target.x, stored.drill_target.y);
  mining.elapsed = stored.drill_elapsed_ms / 1000;
  const drops = stored.drops.map(drop => ({ ...drop }));
  const priorDestroyed = new Set(stored.destroyed_cells);
  const priorCargo = { ...stored.cargo_half_units };
  let coreExtractionElapsedMs = stored.core_extraction_elapsed_ms;

  if (progress.fuel <= 0 || progress.hull <= 0) throw new Error('INVALID_COMMAND');
  let stranded = false;
  for (const segment of segments) {
    for (let ms = 0; ms < segment.duration_ms; ms += ONLINE_INPUT_LIMITS.fixedStepMs) {
      const dt = ONLINE_INPUT_LIMITS.fixedStepMs / 1000;
      const frame = planetCameraFrameAngle(pod.x / WORLD.tile, pod.y / WORLD.tile, STARTER_PLANET_CHART) ?? 0;
      const input = { left: segment.left, right: segment.right, up: segment.up, down: segment.down, grappleEnabled: false };
      const target = pod.update(dt, input, damage => { progress.hull = Math.max(0, progress.hull - damage); }, frame);
      if (progress.fuel <= 0 || progress.hull <= 0) { stranded = true; break; }
      mining.update(dt, segment.drill && !segment.up ? target : undefined, (tile, _collected, dropped) => {
        if (tile.coreRelicId) collectCoreRelic(progress, tile.coreRelicId);
        if (dropped > 0 && tile.ore) drops.push({
          id: keyOf(tile.x, tile.y), x: tile.x, y: tile.y,
          ore: tile.ore, quantity_half_units: Math.round(dropped * 2),
        });
      }, segment.down ? 'vertical' : 'horizontal');
      const extraction = coreExtractionStep(coreExtractionElapsedMs / 1000, dt,
        !!localCore && progress.milestones.includes(localCore.id),
        world.get(WORLD.homeColumn, STARTER_PLANET_CHART.radiusRows).type === 'empty',
        Math.abs(pod.y - STARTER_PLANET_CHART.radiusRows * WORLD.tile) <= CORE.drillAssistReach &&
          (segment.down || segment.drill), progress.coreFuel);
      coreExtractionElapsedMs = Math.round(extraction.elapsed * 1000);
      progress.coreFuel += extraction.reward;
      for (const drop of drops) {
        if (drop.quantity_half_units <= 0 ||
          !podWithinPickupReach(pod.x, pod.y, (drop.x + 0.5) * WORLD.tile, (drop.y + 0.5) * WORLD.tile, world)) continue;
        const collected = progress.collectUnits(drop.ore, drop.quantity_half_units / 2);
        drop.quantity_half_units -= Math.round(collected * 2);
      }
    }
    if (stranded) break;
  }
  const cargo_half_units: Partial<Record<Ore, number>> = {};
  const cargo_delta_half_units: Partial<Record<Ore, number>> = {};
  for (const ore of ORE_KEYS) {
    const count = Math.round(progress.cargo[ore] * 2);
    if (count > 0) cargo_half_units[ore] = count;
    if (count !== (priorCargo[ore] ?? 0)) cargo_delta_half_units[ore] = count - (priorCargo[ore] ?? 0);
  }
  const destroyed_cells = [...world.destroyed].sort();
  return {
    state: {
      world_seed: stored.world_seed,
      levels: { ...stored.levels },
      destroyed_cells,
      pod: { x: pod.x, y: pod.y, vx: pod.vx, vy: pod.vy, docked: pod.docked },
      fuel_milli: Math.round(progress.fuel * 1000),
      hull_milli: Math.round(progress.hull * 1000),
      core_fuel: progress.coreFuel,
      core_relics: CORE_RELICS.map(relic => relic.id).filter(id => progress.milestones.includes(id)),
      core_extraction_elapsed_ms: coreExtractionElapsedMs,
      cargo_half_units,
      drops: drops.filter(drop => drop.quantity_half_units > 0),
      drill_target: mining.target ? { x: mining.target.x, y: mining.target.y } : null,
      drill_elapsed_ms: Math.round(mining.elapsed * 1000),
      last_sequence: sequence,
      input_budget_ms: budget - duration,
      observed_at_ms: serverNowMs,
    },
    destroyed_cells: destroyed_cells.filter(cell => !priorDestroyed.has(cell)),
    cargo_delta_half_units,
  };
}

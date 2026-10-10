import { ORES, type MapId } from '../config';
import type { Cargo } from './Progress';

/** One permanent, planet-specific standing order gives each colony a reason to trade locally. */
export const MARKET_CONTRACTS = {
  'cryo-shelf': { id: 'contract-cryo', ore: 'copper', units: 3, reward: 120 },
  'mars-frontier': { id: 'contract-mars', ore: 'iron', units: 2, reward: 150 },
  'hull-graveyard': { id: 'contract-hull', ore: 'iron', units: 3, reward: 210 },
  'prism-fault': { id: 'contract-prism', ore: 'silver', units: 2, reward: 260 },
  'cinder-vale': { id: 'contract-cinder', ore: 'gold', units: 2, reward: 340 },
  'vesper-9': { id: 'contract-vesper', ore: 'diamond', units: 1, reward: 420 },
} as const satisfies Record<MapId, { id: string; ore: keyof Cargo; units: number; reward: number }>;

const order = <T extends keyof Cargo>(id: string, ore: T, units: number, reward: number) => ({ id, ore, units, reward });
export const MARKET_CONTRACT_CHAINS = {
  'cryo-shelf': [MARKET_CONTRACTS['cryo-shelf'], order('contract-cryo-2', 'iron', 2, 180), order('contract-cryo-3', 'silver', 1, 260)],
  'mars-frontier': [MARKET_CONTRACTS['mars-frontier'], order('contract-mars-2', 'copper', 4, 180), order('contract-mars-3', 'gold', 1, 320)],
  'hull-graveyard': [MARKET_CONTRACTS['hull-graveyard'], order('contract-hull-2', 'silver', 2, 260), order('contract-hull-3', 'gold', 1, 360)],
  'prism-fault': [MARKET_CONTRACTS['prism-fault'], order('contract-prism-2', 'gold', 2, 360), order('contract-prism-3', 'diamond', 1, 520)],
  'cinder-vale': [MARKET_CONTRACTS['cinder-vale'], order('contract-cinder-2', 'silver', 2, 320), order('contract-cinder-3', 'diamond', 1, 500)],
  'vesper-9': [MARKET_CONTRACTS['vesper-9'], order('contract-vesper-2', 'gold', 2, 420), order('contract-vesper-3', 'diamond', 2, 700)],
} as const satisfies Record<MapId, readonly { id: string; ore: keyof Cargo; units: number; reward: number }[]>;

export const MARKET_CONTRACT_IDS = Object.values(MARKET_CONTRACT_CHAINS).flat().map(({ id }) => id);

/** Local stations rotate demand after each paid sale, creating a small reason to revisit with a mixed haul. */
export const MARKET_DEMANDS = {
  'cryo-shelf': ['copper', 'silver', 'iron', 'gold'],
  'mars-frontier': ['iron', 'gold', 'copper', 'diamond'],
  'hull-graveyard': ['iron', 'copper', 'diamond', 'silver'],
  'prism-fault': ['silver', 'diamond', 'gold', 'iron'],
  'cinder-vale': ['gold', 'silver', 'copper', 'diamond'],
  'vesper-9': ['diamond', 'gold', 'silver', 'iron'],
} as const satisfies Record<MapId, readonly (keyof Cargo)[]>;
export const MARKET_DEMAND_BONUS_RATE = 0.2;
export const MARKET_DEMAND_IDS = Object.keys(MARKET_DEMANDS).flatMap((mapId) =>
  MARKET_DEMANDS[mapId as MapId].slice(0, -1).map((_, index) => `demand-${mapId}-${index + 1}`));

export function marketDemand(mapId: MapId, milestones: readonly string[] = []) {
  const cycle = MARKET_DEMANDS[mapId], stage = cycle.slice(0, -1).filter((_, index) => milestones.includes(`demand-${mapId}-${index + 1}`)).length;
  return { ore: cycle[stage]!, stage: stage + 1, total: cycle.length };
}

export function marketDemandBonus(cargo: Cargo, mapId: MapId, milestones: readonly string[], atTradingPost: boolean) {
  if (!atTradingPost) return 0;
  const ore = marketDemand(mapId, milestones).ore;
  return Math.floor(cargo[ore] * ORES[ore].value * MARKET_DEMAND_BONUS_RATE);
}

export function advanceMarketDemand(milestones: string[], mapId: MapId, atTradingPost: boolean, saleValue: number) {
  if (!atTradingPost || saleValue <= 0) return false;
  const demand = marketDemand(mapId, milestones);
  if (demand.stage >= demand.total) {
    for (const id of MARKET_DEMANDS[mapId].slice(0, -1).map((_, index) => `demand-${mapId}-${index + 1}`)) {
      const index = milestones.indexOf(id);
      if (index >= 0) milestones.splice(index, 1);
    }
  } else milestones.push(`demand-${mapId}-${demand.stage}`);
  return true;
}

export function marketContract(mapId: MapId, milestones: readonly string[] = []) {
  const chain = MARKET_CONTRACT_CHAINS[mapId];
  const index = chain.findIndex((entry) => !milestones.includes(entry.id));
  const complete = index < 0;
  return { order: chain[complete ? chain.length - 1 : index]!, stage: complete ? chain.length : index + 1, total: chain.length, complete };
}

export function contractCompleted(milestones: readonly string[], mapId: MapId) {
  return marketContract(mapId, milestones).complete;
}

export function contractReady(cargo: Cargo, milestones: readonly string[], mapId: MapId, atTradingPost: boolean) {
  const current = marketContract(mapId, milestones);
  return atTradingPost && !current.complete && cargo[current.order.ore] >= current.order.units;
}

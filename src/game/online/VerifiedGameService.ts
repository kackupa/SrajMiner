import { CORE_FUEL, CORE_RELICS, FRONTIER, ONLINE_INPUT_LIMITS, ORE_KEYS, UPGRADE_KEYS, upgradeValue, type MapId, type Ore } from '../config';
import { parseGameCommandBatch, type SubmitGameCommands } from './GameProtocol';
import { advanceOnlineSimulation, type OnlineSimulationState } from './OnlineSimulation';

export type CanonicalCampaign = {
  id: string;
  owner_id: string;
  ruleset_version: string;
  revision: number;
  active_planet: string;
};
export type CanonicalInventoryRow = { ore: string; quantity_half_units: number | string };
export type OnlineGameRepository = {
  hasOperation(ownerId: string, operationId: string): Promise<boolean>;
  campaign(campaignId: string): Promise<CanonicalCampaign | null>;
  simulation(campaignId: string): Promise<unknown>;
  minerInventory(campaignId: string): Promise<CanonicalInventoryRow[]>;
  commit(args: {
    owner_id: string;
    campaign_id: string;
    expected_revision: number;
    operation_id: string;
    session_id: string;
    input: SubmitGameCommands;
    new_state: Record<string, unknown>;
  }): Promise<unknown>;
};

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function trustedState(value: unknown, inventory: CanonicalInventoryRow[]): OnlineSimulationState {
  if (!object(value) || !Number.isSafeInteger(value.world_seed) ||
    (value.world_seed as number) < 0 || (value.world_seed as number) > 0xffffffff ||
    !object(value.levels) || !UPGRADE_KEYS.every(key =>
      Number.isSafeInteger((value.levels as Record<string, unknown>)[key]) &&
      Number((value.levels as Record<string, unknown>)[key]) >= 1 &&
      Number((value.levels as Record<string, unknown>)[key]) <= 5) ||
    !Array.isArray(value.destroyed_cells) || !value.destroyed_cells.every(cell => typeof cell === 'string') ||
    !object(value.pod) || !['x', 'y', 'vx', 'vy'].every(key => finite((value.pod as Record<string, unknown>)[key])) ||
    typeof value.pod.docked !== 'boolean' ||
    !Number.isSafeInteger(value.fuel_milli) || !Number.isSafeInteger(value.hull_milli) ||
    !Number.isSafeInteger(value.core_fuel) || (value.core_fuel as number) < 0 ||
    (value.core_fuel as number) > CORE_RELICS.length * CORE_FUEL.unitsPerCore ||
    !Array.isArray(value.core_relics) ||
    !value.core_relics.every(id => typeof id === 'string' && CORE_RELICS.some(relic => relic.id === id)) ||
    new Set(value.core_relics).size !== value.core_relics.length ||
    !Number.isSafeInteger(value.core_extraction_elapsed_ms) ||
    (value.core_extraction_elapsed_ms as number) < 0 ||
    (value.core_extraction_elapsed_ms as number) >= 10000 ||
    !Array.isArray(value.drops) ||
    !Number.isSafeInteger(value.drill_elapsed_ms) ||
    !Number.isSafeInteger(value.last_sequence) ||
    !Number.isSafeInteger(value.input_budget_ms) ||
    (value.input_budget_ms as number) < 0 ||
    (value.input_budget_ms as number) > ONLINE_INPUT_LIMITS.maxBatchMs ||
    !Number.isSafeInteger(value.observed_at_ms)) throw new Error('INVALID_STATE');
  const levels = value.levels as Record<string, number>;
  if ((value.fuel_milli as number) < 0 ||
    (value.fuel_milli as number) > upgradeValue('fuel',levels.fuel)*1000 ||
    (value.hull_milli as number) < 0 ||
    (value.hull_milli as number) > upgradeValue('hull',levels.hull)*1000) throw new Error('INVALID_STATE');
  const cargo_half_units: Partial<Record<Ore, number>> = {};
  for (const row of inventory) {
    if (!ORE_KEYS.includes(row.ore as Ore) || Object.hasOwn(cargo_half_units, row.ore)) throw new Error('INVALID_STATE');
    const count = Number(row.quantity_half_units);
    if (!Number.isSafeInteger(count) || count < 0 || count > upgradeValue('cargo',levels.cargo)*2)
      throw new Error('INVALID_STATE');
    if (count > 0) cargo_half_units[row.ore as Ore] = count;
  }
  if (Object.values(cargo_half_units).reduce((total,count) => total + count,0) >
      upgradeValue('cargo',levels.cargo)*2) throw new Error('INVALID_STATE');
  return { ...value, cargo_half_units } as OnlineSimulationState;
}

/** The caller must verify authUserId using the Auth server, never decode an unsigned JWT. */
export async function executeVerifiedGameBatch(
  raw: unknown,
  authUserId: string,
  repository: OnlineGameRepository,
  serverNowMs: number,
): Promise<unknown> {
  const command = parseGameCommandBatch(raw);
  if (!command || !authUserId || !Number.isSafeInteger(serverNowMs)) throw new Error('INVALID_COMMAND');
  const args = {
    owner_id: authUserId,
    campaign_id: command.campaign_id,
    expected_revision: command.expected_revision,
    operation_id: command.operation_id,
    session_id: command.session_id,
    input: command,
  };
  // The SQL commit checks the stored input hash before it checks revision/state.
  // A retry needs no second simulation and can recover after a lost response.
  if (await repository.hasOperation(authUserId, command.operation_id)) {
    return repository.commit({ ...args, new_state: {} });
  }
  const campaign = await repository.campaign(command.campaign_id);
  if (!campaign || campaign.owner_id !== authUserId) throw new Error('ACCESS_REQUIRED');
  if (campaign.ruleset_version !== command.ruleset_version) throw new Error('RULESET_MISMATCH');
  if (!FRONTIER.worlds.includes(campaign.active_planet as MapId)) throw new Error('INVALID_STATE');
  if (campaign.revision !== command.expected_revision) throw new Error('STALE_REVISION');
  const [snapshot, inventory] = await Promise.all([
    repository.simulation(command.campaign_id),
    repository.minerInventory(command.campaign_id),
  ]);
  const state = trustedState(snapshot, inventory);
  const next = advanceOnlineSimulation(state, command.segments, serverNowMs, campaign.active_planet as MapId).state;
  return repository.commit({ ...args, new_state: next });
}

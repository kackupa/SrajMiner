import { FunctionsHttpError } from '@supabase/supabase-js';
import { onlineAuthClient } from './AuthClient';
import type { CivilisationId, OnlineBasicUpgrade, Ore } from '../config';
import { parseGameCommandBatch, type SubmitGameCommands } from './GameProtocol';
import type { OnlineSimulationState } from './OnlineSimulation';
import { ONLINE_ERROR_CODES } from './Protocol';

export type OnlineCampaignStart = {
  operation_id: string;
  campaign_id: string;
  ruleset_version: 'online-1';
  revision: number;
  active_planet: string;
  credit_minor: number;
};
export type OnlineGameState = {
  campaign_id: string;
  ruleset_version: 'online-1';
  revision: number;
  active_planet: string;
  credit_minor: number;
  ship_cargo_half_units?: Partial<Record<Ore, number>>;
  ship_capacity_half_units?: number;
  market_uplink_online?: boolean;
  snapshot: OnlineSimulationState;
};
export type OnlineSessionClaim = {
  campaign_id: string;
  session_id: string;
  revision: number;
  expires_at: string;
};
export type OnlineTransferReceipt = {
  operation_id: string;
  campaign_id: string;
  kind: 'transfer_ore';
  revision: number;
  source: 'miner' | 'ship';
  target: 'miner' | 'ship';
  ore: Ore;
  quantity_half_units: number;
  source_after_half_units: number;
  target_after_half_units: number;
  occurred_at: string;
};
export type OnlineBuildReceipt = {
  operation_id: string;
  campaign_id: string;
  kind: 'build_market_uplink';
  revision: number;
  planet: 'cryo-shelf' | 'mars-frontier';
  material_debits: readonly { ore: Ore; miner_half_units: number; ship_half_units: number }[];
  occurred_at: string;
};
export type OnlineCivilianQuote = {
  campaign_id: string;
  revision: number;
  source: 'miner' | 'ship';
  buyer: CivilisationId;
  ore: Ore;
  quantity_half_units: number;
  gross_credit_minor: number;
  bonus_credit_minor: number;
  total_credit_minor: number;
  project: string | null;
  source_available_half_units: number;
};
export type OnlineCivilianSaleReceipt = Omit<OnlineCivilianQuote, 'source_available_half_units'> & {
  operation_id: string;
  kind: 'sell_to_civilian';
  wallet_after_minor: number;
  occurred_at: string;
};
export type OnlinePodServiceReceipt = {
  operation_id: string;
  campaign_id: string;
  kind: 'service_pod';
  service_kind: 'fuel' | 'hull' | 'both';
  revision: number;
  cost_minor: number;
  wallet_after_minor: number;
  fuel_before_milli: number;
  fuel_after_milli: number;
  hull_before_milli: number;
  hull_after_milli: number;
  occurred_at: string;
};
export type OnlineUpgradeReceipt = {
  operation_id: string;
  campaign_id: string;
  kind: 'install_rig_upgrade';
  upgrade_key: OnlineBasicUpgrade;
  level_before: number;
  level_after: number;
  material_debits: readonly { ore: Ore; miner_half_units: number; ship_half_units: number }[];
  revision: number;
  fuel_after_milli: number;
  hull_after_milli: number;
  occurred_at: string;
};
export type OnlineRecoveryReceipt = {
  operation_id: string;
  campaign_id: string;
  kind: 'recover_stranded_pod';
  revision: number;
  forfeited_cargo_half_units: Partial<Record<Ore, number>>;
  wallet_after_minor: number;
  fuel_before_milli: number;
  fuel_after_milli: number;
  hull_before_milli: number;
  hull_after_milli: number;
  occurred_at: string;
};
export type OnlineTravelReceipt = {
  operation_id: string;
  campaign_id: string;
  kind: 'travel';
  revision: number;
  source: 'cryo-shelf' | 'mars-frontier';
  destination: 'cryo-shelf' | 'mars-frontier';
  core_fuel_after: number;
  occurred_at: string;
};

function configured() {
  const client = onlineAuthClient();
  if (!client) throw new Error('Verified Online is not configured.');
  return client;
}

/** Campaign issuance is idempotent even when a retry uses a new operation ID. */
export async function startVerifiedCampaign(operationId: string): Promise<OnlineCampaignStart> {
  const { data, error } = await configured().rpc('start_online_campaign', {
    p_ruleset_version: 'online-1', p_operation_id: operationId,
  });
  if (error || !data) throw new Error(error?.message ?? 'Campaign start failed.');
  return data as OnlineCampaignStart;
}

export async function claimVerifiedSession(campaignId: string, sessionId: string,
  takeover = false): Promise<OnlineSessionClaim> {
  const { data, error } = await configured().rpc('claim_online_session', {
    p_campaign_id: campaignId, p_session_id: sessionId, p_takeover: takeover,
  });
  if (error || !data) throw new Error(error?.message ?? 'Session claim failed.');
  return data as OnlineSessionClaim;
}

/** Owner-scoped SQL read; browser caches are never sources of balances. */
export async function readVerifiedGameState(campaignId: string): Promise<OnlineGameState> {
  const { data, error } = await configured().rpc('read_online_game_state', { p_campaign_id: campaignId });
  if (error || !data) throw new Error(error?.message ?? 'Online state unavailable.');
  return data as OnlineGameState;
}

/** A jump is an owner/session-scoped SQL transaction; the client supplies only a destination. */
export async function travelVerifiedCampaign(input: {
  campaign_id: string;
  expected_revision: number;
  operation_id: string;
  session_id: string;
  destination: 'cryo-shelf' | 'mars-frontier';
}): Promise<OnlineTravelReceipt> {
  const { data, error } = await configured().rpc('travel_online_campaign', {
    p_campaign_id: input.campaign_id,
    p_expected_revision: input.expected_revision,
    p_operation_id: input.operation_id,
    p_session_id: input.session_id,
    p_destination: input.destination,
  });
  if (error || !data) throw new Error(error?.message ?? 'Travel failed.');
  return data as OnlineTravelReceipt;
}

/** Only bounded controls cross the wire. Keep operation ID stable until a receipt arrives. */
export async function submitVerifiedControls(raw: unknown): Promise<unknown> {
  const batch: SubmitGameCommands | null = parseGameCommandBatch(raw);
  if (!batch) throw new Error('INVALID_COMMAND');
  const { data, error } = await configured().functions.invoke('verified-game', { body: batch });
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    let code: unknown;
    try {
      const payload = await error.context.json() as { code?: unknown };
      code = payload.code;
    } catch { /* Relay response was not our JSON error envelope. */ }
    if (typeof code === 'string' && ONLINE_ERROR_CODES.includes(code as typeof ONLINE_ERROR_CODES[number]))
      throw new Error(code);
  }
  if (error) throw new Error(error.message);
  return data;
}

/** SQL verifies canonical stock, pod access, capacity, session and revision. */
export async function transferVerifiedOre(input: {
  campaign_id: string;
  expected_revision: number;
  operation_id: string;
  session_id: string;
  source: 'miner' | 'ship';
  target: 'miner' | 'ship';
  ore: Ore;
  quantity_half_units: number;
}): Promise<OnlineTransferReceipt> {
  const { data, error } = await configured().rpc('transfer_online_ore', {
    p_campaign_id: input.campaign_id,
    p_expected_revision: input.expected_revision,
    p_operation_id: input.operation_id,
    p_session_id: input.session_id,
    p_source: input.source,
    p_target: input.target,
    p_ore: input.ore,
    p_quantity_half_units: input.quantity_half_units,
  });
  if (error || !data) throw new Error(error?.message ?? 'Ore transfer failed.');
  return data as OnlineTransferReceipt;
}

/** Server checks fixed uplink cost, canonical materials, dock access and session. */
export async function buildVerifiedMarketUplink(input: {
  campaign_id: string;
  expected_revision: number;
  operation_id: string;
  session_id: string;
}): Promise<OnlineBuildReceipt> {
  const { data, error } = await configured().rpc('build_online_market_uplink', {
    p_campaign_id: input.campaign_id,
    p_expected_revision: input.expected_revision,
    p_operation_id: input.operation_id,
    p_session_id: input.session_id,
  });
  if (error || !data) throw new Error(error?.message ?? 'Market uplink build failed.');
  return data as OnlineBuildReceipt;
}

export async function quoteVerifiedCivilianSale(input: {
  campaign_id: string;
  source: 'miner' | 'ship';
  buyer: CivilisationId;
  ore: Ore;
  quantity_half_units: number;
}): Promise<OnlineCivilianQuote> {
  const { data, error } = await configured().rpc('quote_online_civilian_sale', {
    p_campaign_id: input.campaign_id,
    p_source: input.source,
    p_buyer: input.buyer,
    p_ore: input.ore,
    p_quantity_half_units: input.quantity_half_units,
  });
  if (error || !data) throw new Error(error?.message ?? 'Civilian offer unavailable.');
  return data as OnlineCivilianQuote;
}

/** Server debits only canonical stock, then issues and records exact civilian credits. */
export async function sellVerifiedOreToCivilian(input: {
  campaign_id: string;
  expected_revision: number;
  operation_id: string;
  session_id: string;
  source: 'miner' | 'ship';
  buyer: CivilisationId;
  ore: Ore;
  quantity_half_units: number;
}): Promise<OnlineCivilianSaleReceipt> {
  const { data, error } = await configured().rpc('sell_online_ore_to_civilian', {
    p_campaign_id: input.campaign_id,
    p_expected_revision: input.expected_revision,
    p_operation_id: input.operation_id,
    p_session_id: input.session_id,
    p_source: input.source,
    p_buyer: input.buyer,
    p_ore: input.ore,
    p_quantity_half_units: input.quantity_half_units,
  });
  if (error || !data) throw new Error(error?.message ?? 'Civilian sale failed.');
  return data as OnlineCivilianSaleReceipt;
}

/** Canonical dock access, rig condition and wallet determine service effects. */
export async function serviceVerifiedPod(input: {
  campaign_id: string;
  expected_revision: number;
  operation_id: string;
  session_id: string;
  service_kind: 'fuel' | 'hull' | 'both';
}): Promise<OnlinePodServiceReceipt> {
  const { data, error } = await configured().rpc('service_online_pod', {
    p_campaign_id: input.campaign_id,
    p_expected_revision: input.expected_revision,
    p_operation_id: input.operation_id,
    p_session_id: input.session_id,
    p_service_kind: input.service_kind,
  });
  if (error || !data) throw new Error(error?.message ?? 'Pod service failed.');
  return data as OnlinePodServiceReceipt;
}

/** Server debits canonical materials and installs exactly one basic rig level. */
export async function installVerifiedRigUpgrade(input: {
  campaign_id: string;
  expected_revision: number;
  operation_id: string;
  session_id: string;
  upgrade_key: OnlineBasicUpgrade;
}): Promise<OnlineUpgradeReceipt> {
  const { data, error } = await configured().rpc('install_online_rig_upgrade', {
    p_campaign_id: input.campaign_id,
    p_expected_revision: input.expected_revision,
    p_operation_id: input.operation_id,
    p_session_id: input.session_id,
    p_upgrade_key: input.upgrade_key,
  });
  if (error || !data) throw new Error(error?.message ?? 'Rig upgrade failed.');
  return data as OnlineUpgradeReceipt;
}

/** SQL alone decides whether the canonical pod is stranded and which miner ore is lost. */
export async function recoverVerifiedStrandedPod(input: {
  campaign_id: string;
  expected_revision: number;
  operation_id: string;
  session_id: string;
}): Promise<OnlineRecoveryReceipt> {
  const { data, error } = await configured().rpc('recover_online_stranded_pod', {
    p_campaign_id: input.campaign_id,
    p_expected_revision: input.expected_revision,
    p_operation_id: input.operation_id,
    p_session_id: input.session_id,
  });
  if (error || !data) throw new Error(error?.message ?? 'Stranded recovery failed.');
  return data as OnlineRecoveryReceipt;
}

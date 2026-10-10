import { ORE_KEYS, ORES, tradeNetworkPremium, type MapId } from '../config';
import type { Cargo } from './Progress';
import { contractReady, marketContract, marketDemandBonus } from './MarketContracts';

export type SaleReceipt = {
  cargo: Cargo;
  destination: MapId;
  soldAt: MapId;
  gross: number;
  networkPremium: number;
  localDemandBonus: number;
  contractReward: number;
  contractStage: number;
  contractOre: keyof Cargo;
  contractUnits: number;
  total: number;
};

/** Capture an itemized settlement before inventory and market milestones change. */
export function buildSaleReceipt(cargo: Cargo, soldAt: MapId, destination: MapId, milestones: readonly string[], connectedPosts: number, hasLocalPost: boolean, buyerIsOnline: boolean, relayOnline: boolean): SaleReceipt {
  const sold = { ...cargo }, gross = ORE_KEYS.reduce((sum, ore) => sum + sold[ore] * ORES[ore].value, 0),
    networkPremium = tradeNetworkPremium(gross, connectedPosts, hasLocalPost, relayOnline),
    localDemandBonus = marketDemandBonus(sold, destination, milestones, buyerIsOnline),
    contract = marketContract(soldAt, milestones),
    contractReward = contractReady(sold, milestones, soldAt, hasLocalPost && soldAt === destination) ? contract.order.reward : 0;
  return { cargo: sold, destination, soldAt, gross, networkPremium, localDemandBonus, contractReward,
    contractStage: contract.stage, contractOre: contract.order.ore, contractUnits: contract.order.units,
    total: gross + networkPremium + localDemandBonus + contractReward };
}

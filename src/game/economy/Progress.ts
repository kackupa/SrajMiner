import {
  ORES,
  ORE_KEYS,
  CORE_RELICS,
  SERVICE,
  SHIP_COMPONENTS,
  CHARGE,
  SALVAGE_MAGNET,
  STASIS_MODULE,
  ESCAPE_SUIT,
  RETURN_WINCH,
  upgradeCost,
  upgradeGateMet,
  POD_PAINTS,
  PILOT_SUITS,
  POD_DECALS,
  POD_PROFILES,
  SPECIALIZATIONS,
  ROUTE_FRAGMENTS,
  ROUTE_SHIP_COMPONENTS,
  ROUTE_PART_RECOVERY_BONUS,
  value,
  type Levels,
  type Ore,
  type Upgrade,
  type PodPaint,
  type PilotSuit,
  type PodDecal,
  type PodProfile,
  type Specialization,
  type MapId,
} from '../config';
import { contractReady, marketContract } from './MarketContracts';
export type Cargo = Record<Ore, number>;
export const emptyCargo = (): Cargo => ({ copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 });
export class Progress {
  money = 80;
  levels: Levels = { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1, scanner: 1, grapple: 1 };
  grappleOwned = false;
  fuel = 140;
  hull = 100;
  cargo = emptyCargo();
  maxDepth = 0;
  specialization: Specialization = 'balanced';
  artifact = false;
  milestones: string[] = [];
  shipComponents: string[] = [];
  routeFragments: string[] = [];
  charges = 0;
  salvageMagnet = false;
  stasisModule = false;
  returnWinch = false;
  escapeSuit = false;
  pilotEscaping = false;
  buyEscapeSuit() {
    if (this.escapeSuit || this.money < ESCAPE_SUIT.cost) return false;
    this.money -= ESCAPE_SUIT.cost;
    this.escapeSuit = true;
    return true;
  }
  buyStasisModule() {
    if (this.stasisModule || this.money < STASIS_MODULE.cost) return false;
    this.money -= STASIS_MODULE.cost;
    this.stasisModule = true;
    return true;
  }
  buyReturnWinch() {
    if (this.returnWinch || this.money < RETURN_WINCH.cost) return false;
    this.money -= RETURN_WINCH.cost;
    this.returnWinch = true;
    return true;
  }
  buySalvageMagnet() {
    if (this.salvageMagnet || this.money < SALVAGE_MAGNET.cost) return false;
    this.money -= SALVAGE_MAGNET.cost;
    this.salvageMagnet = true;
    return true;
  }
  ownedPaints: PodPaint[] = ['hab'];
  selectedPaint: PodPaint = 'hab';
  ownedSuits: PilotSuit[] = ['hab'];
  selectedSuit: PilotSuit = 'hab';
  ownedDecals: PodDecal[] = ['standard'];
  selectedDecal: PodDecal = 'standard';
  ownedProfiles: PodProfile[] = ['standard'];
  selectedProfile: PodProfile = 'standard';
  buyProfile(key: PodProfile) {
    const profile = POD_PROFILES[key];
    if (this.ownedProfiles.includes(key) || this.money < profile.cost) return false;
    this.money -= profile.cost;
    this.ownedProfiles.push(key);
    this.selectedProfile = key;
    return true;
  }
  selectProfile(key: PodProfile) {
    if (!this.ownedProfiles.includes(key)) return false;
    this.selectedProfile = key;
    return true;
  }
  selectSpecialization(key: Specialization) {
    if (!Object.hasOwn(SPECIALIZATIONS, key)) return false;
    const cargoLimit = Math.round(value(this.levels, 'cargo') * SPECIALIZATIONS[key].cargoMultiplier * 2) / 2;
    if (this.count > cargoLimit) return false;
    this.specialization = key;
    return true;
  }
  buyDecal(key: PodDecal) {
    const decal = POD_DECALS[key];
    if (this.ownedDecals.includes(key) || this.money < decal.cost) return false;
    this.money -= decal.cost;
    this.ownedDecals.push(key);
    this.selectedDecal = key;
    return true;
  }
  selectDecal(key: PodDecal) {
    if (!this.ownedDecals.includes(key)) return false;
    this.selectedDecal = key;
    return true;
  }
  buySuit(key: PilotSuit) {
    const suit = PILOT_SUITS[key];
    if (this.ownedSuits.includes(key) || this.money < suit.cost) return false;
    this.money -= suit.cost;
    this.ownedSuits.push(key);
    this.selectedSuit = key;
    return true;
  }
  selectSuit(key: PilotSuit) {
    if (!this.ownedSuits.includes(key)) return false;
    this.selectedSuit = key;
    return true;
  }
  buyPaint(key: PodPaint) {
    const paint = POD_PAINTS[key];
    if (this.ownedPaints.includes(key) || this.money < paint.cost) return false;
    this.money -= paint.cost;
    this.ownedPaints.push(key);
    this.selectedPaint = key;
    return true;
  }
  selectPaint(key: PodPaint) {
    if (!this.ownedPaints.includes(key)) return false;
    this.selectedPaint = key;
    return true;
  }
  buyCharges() {
    if (this.money < CHARGE.packCost) return false;
    this.money -= CHARGE.packCost;
    this.charges += CHARGE.packSize;
    return true;
  }
  useCharge() {
    if (this.charges <= 0) return false;
    this.charges--;
    return true;
  }
  collectRouteFragment(id: string) {
    const fragment = ROUTE_FRAGMENTS.find((entry) => entry.id === id);
    if (!fragment || this.routeFragments.includes(id)) return false;
    this.routeFragments.push(id);
    const component = ROUTE_SHIP_COMPONENTS[fragment.id];
    if (!this.shipComponents.includes(component)) this.shipComponents.push(component);
    this.money += ROUTE_PART_RECOVERY_BONUS;
    return true;
  }
  get shipComplete() {
    return Object.keys(SHIP_COMPONENTS).every((key) => this.shipComponents.includes(key));
  }
  get count() {
    return ORE_KEYS.reduce((n, k) => n + this.cargo[k], 0);
  }
  get cargoValue() {
    return ORE_KEYS.reduce((n, k) => n + this.cargo[k] * ORES[k].value, 0);
  }
  max(key: Upgrade) {
    const base = value(this.levels, key);
    return key === 'cargo'
      ? Math.round(base * SPECIALIZATIONS[this.specialization].cargoMultiplier * 2) / 2
      : base;
  }
  drillTime(hardness: number) {
    const bonus = hardness >= 0.8 ? SPECIALIZATIONS[this.specialization].rockDrillMultiplier : 1;
    return hardness / (this.max('drill') * bonus);
  }
  collect(ore: Ore) {
    if (this.count >= this.max('cargo')) return false;
    this.cargo[ore]++;
    return true;
  }
  collectUnits(ore: Ore, units: number) {
    const room = Math.max(0, this.max('cargo') - this.count);
    const collected = Math.min(room, units);
    if (collected > 0) this.cargo[ore] += collected;
    return collected;
  }
  sell() {
    const amount = this.cargoValue;
    this.money += amount;
    this.cargo = emptyCargo();
    return amount;
  }
  claimMarketContract(mapId: MapId, atTradingPost: boolean) {
    const current = marketContract(mapId, this.milestones), order = current.order;
    if (current.complete || !contractReady(this.cargo, this.milestones, mapId, atTradingPost)) return 0;
    this.milestones.push(order.id);
    this.money += order.reward;
    return order.reward;
  }
  cost(key: Upgrade) {
    return upgradeCost(key, this.levels[key]);
  }
  canBuyUpgrade(key: Upgrade) {
    const coreRecords = CORE_RELICS.filter((relic) => this.milestones.includes(relic.id)).map((relic) => relic.id);
    return upgradeGateMet(this.levels[key] + 1, { shipComplete: this.shipComplete, coreRelics: coreRecords });
  }
  buy(key: Upgrade) {
    const cost = this.cost(key);
    if (this.money < cost || !Number.isSafeInteger(this.levels[key] + 1) || !this.canBuyUpgrade(key)) return false;
    const old = this.max(key);
    this.money -= cost;
    this.levels[key]++;
    if (key === 'grapple') this.grappleOwned = true;
    if (key === 'fuel') this.fuel += this.max(key) - old;
    if (key === 'hull') this.hull += this.max(key) - old;
    return true;
  }
  serviceCost(key: 'fuel' | 'hull') {
    return Math.ceil(
      (this.max(key) - this[key]) * SERVICE[key === 'fuel' ? 'fuelPrice' : 'hullPrice'],
    );
  }
  service(key: 'fuel' | 'hull') {
    const cost = this.serviceCost(key);
    if (this.money < cost) return false;
    this.money -= cost;
    this[key] = this.max(key);
    return true;
  }
  serviceAll() {
    const cost = this.serviceCost('fuel') + this.serviceCost('hull');
    if (this.money < cost) return false;
    this.money -= cost;
    this.fuel = this.max('fuel');
    this.hull = this.max('hull');
    return true;
  }
  rescue() {
    this.cargo = emptyCargo();
    this.fuel = this.max('fuel');
    this.hull = this.max('hull');
  }
}

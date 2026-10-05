import {
  ORES,
  ORE_KEYS,
  UPGRADES,
  SERVICE,
  value,
  type Levels,
  type Ore,
  type Upgrade,
} from '../config';
export type Cargo = Record<Ore, number>;
export const emptyCargo = (): Cargo => ({ copper: 0, iron: 0, silver: 0, gold: 0, diamond: 0 });
export class Progress {
  money = 80;
  levels: Levels = { drill: 1, fuel: 1, cargo: 1, hull: 1, engine: 1 };
  fuel = 140;
  hull = 100;
  cargo = emptyCargo();
  maxDepth = 0;
  artifact = false;
  get count() {
    return ORE_KEYS.reduce((n, k) => n + this.cargo[k], 0);
  }
  get cargoValue() {
    return ORE_KEYS.reduce((n, k) => n + this.cargo[k] * ORES[k].value, 0);
  }
  max(key: Upgrade) {
    return value(this.levels, key);
  }
  collect(ore: Ore) {
    if (this.count >= this.max('cargo')) return false;
    this.cargo[ore]++;
    return true;
  }
  sell() {
    const amount = this.cargoValue;
    this.money += amount;
    this.cargo = emptyCargo();
    return amount;
  }
  cost(key: Upgrade) {
    return UPGRADES[key].costs[this.levels[key] - 1] ?? Infinity;
  }
  buy(key: Upgrade) {
    const cost = this.cost(key);
    if (this.money < cost || this.levels[key] >= 5) return false;
    const old = this.max(key);
    this.money -= cost;
    this.levels[key]++;
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

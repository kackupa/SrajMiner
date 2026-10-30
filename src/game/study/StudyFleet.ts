import { FLEET_STUDY as F, UNIFORM_PLANET_STUDY as C, STUDY_WEAPONS } from '../config';
import type { Point, UniformPlanet } from './UniformPlanet';

export const fleetOres = ['copper', 'iron', 'silver'] as const;
export type FleetOre = (typeof fleetOres)[number];
export type FleetCargo = Record<FleetOre, number>;
export type FleetModule = (typeof F.modules)[number]['id'];
export type FleetSale = { ore: FleetOre; units: number; value: number };
const empty = (): FleetCargo => ({ copper: 0, iron: 0, silver: 0 });
export const cargoTotal = (cargo: FleetCargo) => fleetOres.reduce((n, ore) => n + cargo[ore], 0);
const deltaAngle = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/** In-memory expedition economy. Never reads or writes campaign data. */
export class StudyFleet {
  constructor(private readonly world?:UniformPlanet) {}
  readonly miner = empty();
  readonly storage = empty();
  readonly modules = new Set<FleetModule>();
  credits = 0;
  readonly weapons = new Set(['machine-gun', 'rocket']);
  primary = 'machine-gun';
  secondary = 'rocket';
  canBuyWeapon(id:string) {
    const w=STUDY_WEAPONS.find(w=>w.id===id);
    return !!w&&!this.weapons.has(id)&&this.credits>=w.credits&&fleetOres.every(o=>this.available(o)>=w[o]);
  }
  buyWeapon(id:string) {
    if(!this.canBuyWeapon(id))return false;
    const w=STUDY_WEAPONS.find(w=>w.id===id)!;
    for(const o of fleetOres)this.spend(o,w[o]);
    this.credits-=w.credits;this.weapons.add(id);return this.equipWeapon(id);
  }
  equipWeapon(id:string) {
    const w=STUDY_WEAPONS.find(w=>w.id===id);
    if(!w||!this.weapons.has(id))return false;
    this[w.slot]=id;return true;
  }
  angle = Math.atan2(-440, 1704);
  flight?: { from: number; to: number; elapsed: number; duration: number };
  testSuppliesUsed = false;

  get capacity() {
    return this.modules.has('rack') ? F.rackCapacity : C.cargoCapacity;
  }
  get drillSeconds() {
    return C.drillSeconds / (this.modules.has('drill') ? F.drillMultiplier : 1);
  }
  get position(): Point {
    const flight = this.flight,
      q = flight ? Math.min(1, flight.elapsed / flight.duration) : 0;
    const ease = q * q * (3 - 2 * q);
    const angle = flight ? flight.from + deltaAngle(flight.from, flight.to) * ease : this.angle;
    const radius = (this.world?.surfaceRadius(angle)??C.radius) + 8 + (flight ? Math.sin(q * Math.PI) * F.flightHeight : 0);
    return { x: Math.sin(angle) * radius, y: -Math.cos(angle) * radius };
  }
  near(p: Point) {
    return (
      !this.flight && Math.hypot(p.x - this.position.x, p.y - this.position.y) <= F.serviceRange
    );
  }
  available(ore: FleetOre) {
    return this.miner[ore] + this.storage[ore];
  }
  collect(ore: FleetOre) {
    if (cargoTotal(this.miner) >= this.capacity) return false;
    this.miner[ore]++;
    return true;
  }
  unload() {
    const units = cargoTotal(this.miner);
    for (const ore of fleetOres) {
      this.storage[ore] += this.miner[ore];
      this.miner[ore] = 0;
    }
    return units;
  }
  quote(ore: FleetOre, units = this.available(ore)): FleetSale | undefined {
    if (!Number.isSafeInteger(units) || units <= 0 || units > this.available(ore)) return;
    return { ore, units, value: units * F.prices[ore] };
  }
  sell(quote: FleetSale) {
    if (!fleetOres.includes(quote.ore)) return false;
    const current = this.quote(quote.ore, quote.units);
    if (!current || current.value !== quote.value) return false;
    this.spend(quote.ore, quote.units);
    this.credits += quote.value;
    return true;
  }
  private spend(ore: FleetOre, units: number) {
    const carried = Math.min(this.miner[ore], units);
    this.miner[ore] -= carried;
    this.storage[ore] -= units - carried;
  }
  canBuy(id: FleetModule) {
    const item = F.modules.find((item) => item.id === id);
    return (
      !!item &&
      !this.modules.has(id) &&
      this.credits >= item.credits &&
      fleetOres.every((ore) => this.available(ore) >= item.ore[ore])
    );
  }
  buy(id: FleetModule) {
    if (!this.canBuy(id)) return false;
    const item = F.modules.find((item) => item.id === id)!;
    for (const ore of fleetOres) this.spend(ore, item.ore[ore]);
    this.credits -= item.credits;
    this.modules.add(id);
    return true;
  }
  loadTestSupplies() {
    if (this.testSuppliesUsed) return false;
    this.testSuppliesUsed = true;
    this.storage.copper += 40;
    this.storage.iron += 40;
    this.storage.silver += 12;
    this.credits += F.testCredits;
    return true;
  }
  landing(world: UniformPlanet, angle: number) {
    if (!Number.isFinite(angle)) return false;
    // The full footprint needs intact crust. Never pave a shaft or fill a tunnel.
    const base=world.surfaceRadius(angle);
    for (let offset = -240; offset <= 240; offset += 12) {
      const a = angle + offset / C.radius;
      const radius=world.surfaceRadius(a);
      if (Math.abs(radius-base)>28 || !world.solidAt({ x: Math.sin(a) * (radius - 8), y: -Math.cos(a) * (radius - 8) }))
        return false;
    }
    return true;
  }
  relocate(world: UniformPlanet, angle: number) {
    if (
      this.flight ||
      !this.landing(world, angle) ||
      Math.abs(deltaAngle(this.angle, angle)) * C.radius < 280
    )
      return false;
    this.flight = {
      from: this.angle,
      to: angle,
      elapsed: 0,
      duration: F.flightSeconds * (this.modules.has('thrusters') ? F.upgradedFlightMultiplier : 1),
    };
    return true;
  }
  update(dt: number) {
    if (!this.flight) return false;
    this.flight.elapsed += Math.max(0, Math.min(0.1, dt));
    if (this.flight.elapsed < this.flight.duration) return false;
    this.angle = this.flight.to;
    this.flight = undefined;
    return true;
  }
}

import { CORE_FUEL, CORE_RELICS, FRONTIER, type MapId } from '../config';
export const coreRecovered = (world: MapId, milestones: readonly string[]) => CORE_RELICS.some(core => core.mapId === world && milestones.includes(core.id));
export function travelQuote(source: MapId, destination: MapId, fuel: number, milestones: readonly string[]) {
  const allowed = FRONTIER.worlds.includes(destination), same = source === destination;
  const cost = same ? 0 : CORE_FUEL.jumpCost, reserve = same || coreRecovered(destination, milestones) ? 0 : CORE_FUEL.jumpCost;
  const required = cost + reserve;
  return { allowed, cost, reserve, required, balance: fuel - cost,
    canDepart: allowed && !same && Number.isFinite(fuel) && fuel >= required };
}
/** No economic callbacks belong to the presentation. Candidate is detached from source. */
export function commitTravel<T>(source: T, candidate: T, write: (candidate: T) => boolean): T | undefined {
  const durable = structuredClone(candidate);
  try { if (write(durable)) return durable; } catch {}
  return undefined;
}
/** A monotonic watermark prevents clock rollback from replaying production. */
export function productionInterval(previous: number, now: number, capSeconds: number) {
  return Number.isFinite(now) && now >= previous ? { seconds: Math.min(capSeconds, (now - previous) / 1000), watermark: now } : { seconds: 0, watermark: previous };
}

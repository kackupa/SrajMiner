import { EXTRACTION_SEAMS, EXTRACTOR_TIERS, PLANET_EXCLUSIVE_ORES, type MapId, type Ore } from '../config';
import type { UndergroundStructure } from '../building/UndergroundStructures';

export type ExtractionLedger = Record<string, number>;
/** Deep seams are independent of the shallow blocks excavated by the rig. */
export function extractionSeam(map: MapId, site: Pick<UndergroundStructure, 'x' | 'y'>, ledger: ExtractionLedger) {
  const sector = Math.floor(site.x / EXTRACTION_SEAMS.width), side = site.y > 0 ? 'far' : 'near',
    key = `${map}:${side}:${sector}`, ores: Ore[] = ['copper', 'iron', 'copper', 'silver', 'iron', PLANET_EXCLUSIVE_ORES[map]],
    ore = ores[((sector % ores.length) + ores.length) % ores.length];
  return { key, ore, remaining: Math.max(0, EXTRACTION_SEAMS.units - (ledger[key] ?? 0)), capacity: EXTRACTION_SEAMS.units };
}
export function extractorStatus(map: MapId, structure: UndergroundStructure, ledger: ExtractionLedger, stored: number, capacity: number) {
  const seam = extractionSeam(map, structure, ledger), tier = EXTRACTOR_TIERS[Math.max(0, Math.min(EXTRACTOR_TIERS.length - 1, (structure.level ?? 1) - 1))],
    supported = (tier.ores as readonly Ore[]).includes(seam.ore),
    state = !supported ? 'Upgrade required' : seam.remaining <= 0 ? 'Deposit exhausted' : capacity - stored < 0.5 ? 'Storage full' : 'Mining';
  return { ...seam, state, rate: state === 'Mining' ? tier.rate : 0, tierRate: tier.rate, supported };
}

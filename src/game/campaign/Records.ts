import { CORE_RELICS, CORE_SURVEY_CONCLUSION, MAPS, NAVIGATION_HASHES, ROUTE_FRAGMENTS, type CoreRelicId, type MapId } from '../config';

export type CampaignMapRecord = {
  id: MapId;
  name: string;
  visited: boolean;
  deepestMeters: number;
  routeRecovered: number;
  routeTotal: number;
  hashesRecovered: number;
  hashTotal: number;
  coreName: string;
  coreRecovered: boolean;
};

/** Derive archive records from the existing per-map save data; no save migration is needed. */
export function campaignMapRecords(
  depths: Partial<Record<MapId, number>>,
  routeFragments: readonly string[],
  milestones: readonly string[],
): CampaignMapRecord[] {
  return (Object.keys(MAPS) as MapId[]).map((id) => {
    const mapFragments = id === 'cryo-shelf' ? ROUTE_FRAGMENTS : [];
    const mapHashes = NAVIGATION_HASHES.filter((hash) => hash.mapId === id);
    const coreRelic = CORE_RELICS.find((relic) => relic.mapId === id)!;
    return {
      id,
      name: MAPS[id].name,
      visited: depths[id] !== undefined,
      deepestMeters: Math.floor(depths[id] ?? 0),
      routeRecovered: mapFragments.filter((fragment) => routeFragments.includes(fragment.id)).length,
      routeTotal: mapFragments.length,
      hashesRecovered: mapHashes.filter((hash) => milestones.includes(hash.id)).length,
      hashTotal: mapHashes.length,
      coreName: coreRelic.name,
      coreRecovered: milestones.includes(coreRelic.id),
    };
  });
}

/** Record a mined planetary core once and award its fixed archive salvage claim. */
export function collectCoreRelic(
  progress: { milestones: string[]; money: number },
  id: CoreRelicId,
) {
  const relic = CORE_RELICS.find((entry) => entry.id === id);
  if (!relic || progress.milestones.includes(id)) return undefined;
  progress.milestones.push(id);
  progress.money += relic.bounty;
  return relic;
}

/** Reveal each core record only after recovery, and the complete finding only when all four are logged. */
export function coreSurveyProgress(milestones: readonly string[]) {
  const records = CORE_RELICS.map((relic) => ({ relic, recovered: milestones.includes(relic.id) }));
  const complete = records.every((entry) => entry.recovered);
  return {
    records,
    complete,
    conclusion: complete ? CORE_SURVEY_CONCLUSION : undefined,
  } as const;
}

/** The four optional regional logs close the crew mystery; their existing milestone IDs are the durable state. */
export function crewArchiveRestored(milestones: readonly string[]): boolean {
  return NAVIGATION_HASHES.every((hash) => milestones.includes(hash.id));
}

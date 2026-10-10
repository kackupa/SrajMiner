import type { MapId } from '../config';

/** Stable orbital map positions, shared by route rendering and destination UI. */
export const VESPER_SYSTEM_POSITIONS: Readonly<Record<MapId, { x: number; y: number }>> = {
  'mars-frontier': { x: 16, y: 72 },
  'cryo-shelf': { x: 29, y: 38 },
  'hull-graveyard': { x: 74, y: 23 },
  'prism-fault': { x: 86, y: 64 },
  'cinder-vale': { x: 50, y: 82 },
  'vesper-9': { x: 50, y: 14 },
};

/** Builds a deterministic nearest-neighbor tree connecting every online colony. */
export function tradeRouteEdges(postedMaps: readonly MapId[]) {
  const unique = [...new Set(postedMaps)].filter((id) => id in VESPER_SYSTEM_POSITIONS);
  if (unique.length < 2) return [] as { from: MapId; to: MapId }[];
  const root = unique.includes('cryo-shelf') ? 'cryo-shelf' as MapId : unique[0]!;
  const connected = [root], remaining = unique.filter((id) => id !== root), edges: { from: MapId; to: MapId }[] = [];
  while (remaining.length) {
    let best: { from: MapId; to: MapId; distance: number } | undefined;
    for (const to of remaining) for (const from of connected) {
      const a = VESPER_SYSTEM_POSITIONS[from], b = VESPER_SYSTEM_POSITIONS[to], distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (!best || distance < best.distance || distance === best.distance && `${from}:${to}` < `${best.from}:${best.to}`)
        best = { from, to, distance };
    }
    if (!best) break;
    edges.push({ from: best.from, to: best.to });
    connected.push(best.to);
    remaining.splice(remaining.indexOf(best.to), 1);
  }
  return edges;
}

import { WORLD, PHYSICS, UNDERGROUND_BUILDING, coreWorldYFor, farSurfaceRowFor } from '../config';
import type { UndergroundStructure } from '../building/UndergroundStructures';
import type { TileWorld } from '../world/TileWorld';

export type WinchPoint = { x: number; y: number };
type Node = { x: number; y: number; cost: number; estimate: number };

/** Find a tile-clear tunnel route to the Hab 07 surface yard on this crust. */
export function findSurfaceWinchRoute(world: TileWorld, x: number, y: number, structures: readonly UndergroundStructure[] = [], maxVisited = 16000): WinchPoint[] | undefined {
  const tile = WORLD.tile, chart = world.planetChart, columns = world.widthTiles,
    start = { x: Math.floor(x / tile), y: Math.floor(y / tile) };
  if (!Number.isFinite(x) || !Number.isFinite(y) || y <= 0 || start.x < 0 || start.x >= columns) return undefined;

  const far = !!chart && y >= coreWorldYFor(chart), surfaceRow = far ? farSurfaceRowFor(chart) : 0,
    goalRow = far ? surfaceRow - 1 : 0,
    minRow = chart && far ? coreWorldYFor(chart) / tile : 0,
    maxRow = chart ? (far ? surfaceRow - 1 : coreWorldYFor(chart) / tile - 1) : start.y,
    firstGoalX = Math.max(0, Math.ceil((560 - tile / 2) / tile)),
    lastGoalX = Math.min(columns - 1, Math.floor((1410 - tile / 2 - 1) / tile));
  if (start.y < minRow || start.y > maxRow || firstGoalX > lastGoalX) return undefined;

  const structureClear = (tileX: number, tileY: number) => {
    const px = (tileX + 0.5) * tile, py = (tileY + 0.5) * tile;
    return structures.every((structure) => {
      if (structure.kind !== 'platform' && structure.kind !== 'service' && structure.kind !== 'turret') return true;
      const halfWidth = UNDERGROUND_BUILDING[structure.kind].widthTiles * tile / 2 + PHYSICS.halfWidth,
        outwardReach = structure.kind === 'service' ? 54 : structure.kind === 'turret' ? 26 : 0,
        outwardDistance = (structure.y - py) * world.gravitySign(structure.y);
      return Math.abs(px - structure.x) > halfWidth || outwardDistance <= -(PHYSICS.halfHeight + 4) ||
        outwardDistance >= outwardReach + PHYSICS.halfHeight;
    });
  };

  const keyOf = (point: Pick<WinchPoint, 'x' | 'y'>) => `${point.x},${point.y}`,
    heuristic = (nodeX: number, nodeY: number) => Math.abs(nodeY - goalRow) +
      (nodeX < firstGoalX ? firstGoalX - nodeX : nodeX > lastGoalX ? nodeX - lastGoalX : 0),
    heap: Node[] = [],
    push = (node: Node) => {
      heap.push(node);
      let index = heap.length - 1;
      while (index > 0) {
        const parent = (index - 1) >> 1;
        if (heap[parent]!.estimate <= node.estimate) break;
        heap[index] = heap[parent]!;
        index = parent;
      }
      heap[index] = node;
    },
    pop = () => {
      const first = heap[0]!, last = heap.pop()!;
      if (heap.length) {
        let index = 0;
        while (true) {
          const left = index * 2 + 1, right = left + 1;
          if (left >= heap.length) break;
          const child = right < heap.length && heap[right]!.estimate < heap[left]!.estimate ? right : left;
          if (heap[child]!.estimate >= last.estimate) break;
          heap[index] = heap[child]!;
          index = child;
        }
        heap[index] = last;
      }
      return first;
    },
    costs = new Map<string, number>([[keyOf(start), 0]]),
    previous = new Map<string, string>(),
    points = new Map<string, WinchPoint>([[keyOf(start), start]]),
    startKey = keyOf(start);
  push({ ...start, cost: 0, estimate: heuristic(start.x, start.y) });
  let goalKey: string | undefined, visited = 0;

  while (heap.length && visited++ < maxVisited) {
    const current = pop(), currentKey = keyOf(current);
    if (current.cost !== costs.get(currentKey)) continue;
    if (current.y === goalRow && current.x >= firstGoalX && current.x <= lastGoalX) {
      goalKey = currentKey;
      break;
    }
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
      const next = { x: current.x + dx, y: current.y + dy }, nextKey = keyOf(next), nextCost = current.cost + 1;
      if (next.x < 0 || next.x >= columns || next.y < minRow || next.y > maxRow || nextCost >= (costs.get(nextKey) ?? Infinity)) continue;
      if (world.get(next.x, next.y).type !== 'empty' || !structureClear(next.x, next.y)) continue;
      costs.set(nextKey, nextCost);
      previous.set(nextKey, currentKey);
      points.set(nextKey, next);
      push({ ...next, cost: nextCost, estimate: nextCost + heuristic(next.x, next.y) });
    }
  }
  if (!goalKey) return undefined;

  const route: WinchPoint[] = [];
  let traceKey: string | undefined = goalKey, reachedStart = false;
  while (traceKey) {
    const point = points.get(traceKey)!;
    route.push({ x: (point.x + 0.5) * tile, y: (point.y + 0.5) * tile });
    if (traceKey === startKey) { reachedStart = true; break; }
    traceKey = previous.get(traceKey);
  }
  if (!reachedStart) return undefined;
  route.reverse();
  route[0] = { x, y };
  route.push({ x: route[route.length - 1]!.x, y: far ? surfaceRow * tile + 34 : -34 });
  return route.length > 1 ? route : undefined;
}

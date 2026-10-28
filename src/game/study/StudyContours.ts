export type StudyPoint = { x: number; y: number };
export type StudyEdge = { a: StudyPoint; b: StudyPoint };
const key = (p: StudyPoint) => `${p.x},${p.y}`;
const lerp = (a: StudyPoint, b: StudyPoint, t: number) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
/** Round joined boundary edges, not individual tile decorations. Coordinates
 * are tile units; shaving is bounded to 0.45 tiles at a corner (6.4px diagonal
 * deviation from the collision corner with a 40px tile). Straight walls retain
 * their true collision line and narrow passages never become impassable. */
export function studyContourGeometry(edges: readonly StudyEdge[]) {
  const incoming = new Map<string, StudyEdge[]>(),
    outgoing = new Map<string, StudyEdge[]>();
  for (const e of edges) {
    const a = key(e.a),
      b = key(e.b);
    outgoing.set(a, [...(outgoing.get(a) ?? []), e]);
    incoming.set(b, [...(incoming.get(b) ?? []), e]);
  }
  const corners = new Map<
    string,
    { entry: StudyPoint; exit: StudyPoint; curve: StudyPoint[]; cut: boolean; vertex: StudyPoint }
  >();
  for (const [id, ins] of incoming) {
    const outs = outgoing.get(id);
    if (ins.length !== 1 || outs?.length !== 1) continue;
    const prev = ins[0],
      next = outs[0],
      p = prev.b;
    const cross = (p.x - prev.a.x) * (next.b.y - p.y) - (p.y - prev.a.y) * (next.b.x - p.x);
    if (!cross) continue;
    const r = 0.29 + (Math.sin(p.x * 17.13 + p.y * 9.71) * 0.5 + 0.5) * 0.16,
      entry = lerp(p, prev.a, r),
      exit = lerp(p, next.b, r);
    const curve = Array.from({ length: 9 }, (_, i) => {
      const t = i / 8,
        s = 1 - t;
      return {
        x: s * s * entry.x + 2 * s * t * p.x + t * t * exit.x,
        y: s * s * entry.y + 2 * s * t * p.y + t * t * exit.y,
      };
    });
    corners.set(id, { entry, exit, curve, cut: cross > 0, vertex: p });
  }
  return {
    corners: [...corners.values()],
    segments: edges.map((e) => ({
      a: corners.get(key(e.a))?.exit ?? e.a,
      b: corners.get(key(e.b))?.entry ?? e.b,
    })),
  };
}

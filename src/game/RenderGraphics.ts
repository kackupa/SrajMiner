import Phaser from 'phaser';

/** Bound circle chord error to about a third of a local pixel rather than
 * tessellating every subpixel particle into Phaser's fixed 100-segment arc. */
export class RenderGraphics extends Phaser.GameObjects.Graphics {
  override fillPoints(points: Phaser.Types.Math.Vector2Like[], closeShape?: boolean, closePath?: boolean, endIndex?: number): this {
    const count = endIndex ?? points.length;
    // Terrain cells, mechanical details and tessellated circles are convex.
    // Emit their known triangle fan directly; retain Phaser's general path
    // tessellator for concave or unusually large shapes.
    if (count >= 3 && count <= 128) {
      let direction = 0, convex = true;
      for (let i = 0; i < count; i++) {
        const a = points[i], b = points[(i + 1) % count], c = points[(i + 2) % count];
        const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
        if (Math.abs(cross) < 1e-8) continue;
        const sign = Math.sign(cross);
        if (direction && direction !== sign) { convex = false; break; }
        direction = sign;
      }
      if (convex && direction) {
        for (let i = 1; i < count - 1; i++) {
          this.fillTriangle(points[0].x, points[0].y, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
        }
        return this;
      }
    }
    return super.fillPoints(points, closeShape, closePath, endIndex);
  }
  private circleSegments(radius: number) {
    return Math.max(8, Math.ceil(Math.PI * Math.sqrt(Math.abs(radius) / 0.6)));
  }
  override fillCircle(x: number, y: number, radius: number): this {
    return this.fillEllipse(x, y, radius * 2, radius * 2, this.circleSegments(radius));
  }
  override strokeCircle(x: number, y: number, radius: number): this {
    return this.strokeEllipse(x, y, radius * 2, radius * 2, this.circleSegments(radius));
  }
}

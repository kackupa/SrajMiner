import Phaser from 'phaser';
import type { Progress } from '../economy/Progress';
import { mechanicalFootstep, restingVehiclePose, type VehiclePose } from './VehiclePose';
import {
  minerBodyOffset,
  minerGunSocket,
  minerLampSocket,
  rigidDrillDirection,
} from './ConceptMiner';
import { minerLocalLook, minerPartPoint, minerPoint } from './MinerArt';
import atlasUrl from '../../assets/forge/forge-parts.png';
import weaponsUrl from '../../assets/forge/forge-weapons.png';
import turnUrl from '../../assets/forge/forge-turn.png';

type Point = { x: number; y: number };
type Frame = { rect: [number, number, number, number]; mask?: number[][] };
// Source rectangles are measured on the original transparent atlas. The shin
// mask separates its extended toe from the neighbouring drill sprite.
const FRAMES: Record<string, Frame> = {
  torso: { rect: [48, 0, 390, 492] },
  arm: { rect: [475, 30, 242, 445] },
  gun: { rect: [739, 154, 515, 224] },
  thigh: { rect: [96, 489, 244, 411] },
  shin: {
    rect: [419, 482, 349, 411],
    mask: [
      [0, 0],
      [290, 0],
      [290, 292],
      [349, 335],
      [349, 411],
      [0, 411],
    ],
  },
  drill: { rect: [730, 577, 524, 243] },
  lamp: { rect: [65, 924, 348, 279] },
  engine: { rect: [484, 886, 239, 350] },
  shoulder: { rect: [823, 870, 385, 376] },
};
// The generated layout is not an exact grid. Measured bounds prevent a
// neighbouring barrel or drill from leaking into another item's thumbnail.
const WEAPON_FRAMES: Record<string, Frame> = {
  minigun: { rect: [15, 120, 400, 260] },
  autocannon: { rect: [416, 125, 432, 260] },
  'beam-laser': { rect: [848, 130, 400, 265] },
  arc: { rect: [12, 470, 402, 285] },
  grenade: { rect: [430, 470, 408, 320] },
  missile: { rect: [845, 470, 405, 320] },
  rocket: { rect: [12, 850, 395, 302] },
  rack: { rect: [420, 850, 388, 310] },
  excavator: { rect: [813, 875, 441, 294] },
};
const TAU = Math.PI * 2;

/** Real textured skeletal artwork. Presentation only: no saved state or physics. */
export class ForgeSpriteRig {
  readonly image: Phaser.GameObjects.Image;
  private secondary: Phaser.GameObjects.Image;
  private secondaryTextures = new Map<string, string>();
  private texture: Phaser.Textures.CanvasTexture;
  private parts = new Map<string, HTMLCanvasElement>();
  private portraits = new Map<string, string>();
  private thumbnails = new Map<string, string>();
  private bodyViews: HTMLCanvasElement[] = [];
  static preload(scene: Phaser.Scene) {
    if (!scene.textures.exists('forge-parts')) scene.load.image('forge-parts', atlasUrl);
    if (!scene.textures.exists('forge-weapons')) scene.load.image('forge-weapons', weaponsUrl);
    if (!scene.textures.exists('forge-turn')) scene.load.image('forge-turn', turnUrl);
  }
  constructor(private scene: Phaser.Scene) {
    const source = scene.textures.get('forge-parts').getSourceImage() as HTMLImageElement;
    for (const [id, frame] of Object.entries(FRAMES)) this.extract(id, source, frame);
    const weapons = scene.textures.get('forge-weapons').getSourceImage() as HTMLImageElement;
    for (const [id, frame] of Object.entries(WEAPON_FRAMES)) this.extract(id, weapons, frame);
    const turns = scene.textures.get('forge-turn').getSourceImage() as HTMLImageElement;
    const cell = turns.width / 3;
    for (let i = 0; i < 3; i++)
      this.extract('turn-' + i, turns, {
        rect: [Math.round(i * cell), 0, Math.round(cell), turns.height],
      });
    // Opaque directional keyframes: blending different armour silhouettes causes
    // double edges. Joint motion provides the in-between movement instead.
    for (let i = 0; i < 3; i++) {
      const frame = document.createElement('canvas');
      frame.width = 288;
      frame.height = 368;
      const ctx = frame.getContext('2d')!;
      ctx.drawImage(this.parts.get('turn-' + i)!, 0, 0, 288, 368);
      this.bodyViews.push(frame);
    }
    const key = 'forge-rig-' + Phaser.Utils.String.UUID();
    this.texture = scene.textures.createCanvas(key, 384, 384)!;
    this.image = scene.add.image(0, 0, key).setDepth(2).setVisible(false);
    this.secondary = scene.add.image(0, 0, key).setDepth(1.9).setVisible(false);
  }
  private extract(id: string, source: HTMLImageElement, frame: Frame) {
    const [x, y, w, h] = frame.rect,
      c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    if (frame.mask) {
      ctx.beginPath();
      frame.mask.forEach(([u, v], i) => (i ? ctx.lineTo(u, v) : ctx.moveTo(u, v)));
      ctx.closePath();
      ctx.clip();
    }
    ctx.drawImage(source, x, y, w, h, 0, 0, w, h);
    // Trim transparent gutters at load time; keep the source PNG untouched.
    const data = ctx.getImageData(0, 0, w, h).data;
    let l = w,
      t = h,
      r = 0,
      b = 0;
    for (let v = 0; v < h; v++)
      for (let u = 0; u < w; u++)
        if (data[(v * w + u) * 4 + 3] > 48) {
          l = Math.min(l, u);
          r = Math.max(r, u);
          t = Math.min(t, v);
          b = Math.max(b, v);
        }
    if (r < l) throw new Error('Empty Forge sprite: ' + id);
    const part = document.createElement('canvas');
    part.width = r - l + 1;
    part.height = b - t + 1;
    part
      .getContext('2d')!
      .drawImage(c, l, t, part.width, part.height, 0, 0, part.width, part.height);
    this.parts.set(id, part);
  }
  thumbnail(id: string) {
    const key =
      id === 'machine-gun'
        ? 'gun'
        : id === 'drill'
          ? 'excavator'
          : id === 'thrusters'
            ? 'engine'
            : id;
    if (!this.thumbnails.has(key))
      this.thumbnails.set(key, (this.parts.get(key) ?? this.parts.get('gun')!).toDataURL());
    return `<img class="forge-item-art" src="${this.thumbnails.get(key)}" alt="" draggable="false">`;
  }
  portrait(p: Progress) {
    const key = [p.loadout.fitted.hull, p.loadout.fitted.drill, p.loadout.fitted.weapon].join(':');
    if (!this.portraits.has(key)) {
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 640;
      this.paint(
        c.getContext('2d')!,
        640,
        p,
        { ...restingVehiclePose(), yaw: 0, walkPhase: 0 },
        undefined,
        undefined,
        100,
      );
      this.portraits.set(key, c.toDataURL());
    }
    return `<img class="forge-portrait" src="${this.portraits.get(key)}" alt="Forge combat miner with your fitted equipment" draggable="false">`;
  }
  draw(
    x: number,
    y: number,
    scale: number,
    p: Progress,
    pose: VehiclePose,
    aim?: Point,
    unload?: { age: number; count: number },
  ) {
    this.paint(this.texture.context, 384, p, pose, aim, unload, 128);
    this.texture.refresh();
    this.image
      .setVisible(true)
      .setPosition(x, y)
      .setDisplaySize(128 * scale, 128 * scale);
  }
  hide() {
    this.image.setVisible(false);
    this.secondary.setVisible(false);
  }
  drawSecondary(base: Point, direction: Point, scale: number, id: string, length: number) {
    if (!this.secondaryTextures.has(id)) {
      const key = 'forge-secondary-' + Phaser.Utils.String.UUID();
      this.scene.textures.addCanvas(key, this.parts.get(id)!);
      this.secondaryTextures.set(id, key);
    }
    this.secondary
      .setTexture(this.secondaryTextures.get(id)!)
      .setVisible(true)
      .setPosition(base.x, base.y)
      .setOrigin(0.28, 0.5)
      .setDisplaySize((length / 0.72) * scale, 12 * scale)
      .setRotation(Math.atan2(direction.y, direction.x))
      .setFlipY(direction.x < 0);
  }
  destroy() {
    this.image.destroy();
    this.secondary.destroy();
    this.texture.destroy();
    for (const key of this.secondaryTextures.values()) this.scene.textures.remove(key);
    this.parts.clear();
    this.portraits.clear();
    this.bodyViews = [];
  }
  private paint(
    ctx: CanvasRenderingContext2D,
    size: number,
    p: Progress,
    pose: VehiclePose,
    aim: Point | undefined,
    unload: { age: number; count: number } | undefined,
    span: number,
  ) {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.scale(size / span, size / span);
    ctx.translate(span / 2, span / 2 + (span === 100 ? 5 : 0));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const look = minerLocalLook(pose, false),
      body = minerBodyOffset(p, pose),
      face = Math.cos(pose.yaw ?? 0) < 0 ? -1 : 1;
    const at = (x: number, y: number, z = 0) => minerPoint(0, 0, 1, pose, false, x, y, z);
    const part = (
      id: string,
      point: Point,
      w: number,
      h: number,
      rotation = 0,
      ox = 0.5,
      oy = 0.5,
      flip = 1,
      alpha = 1,
      flipX = 1,
    ) => {
      const img = this.parts.get(id)!;
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(rotation);
      ctx.scale(flipX, flip);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, -w * ox, -h * oy, w, h);
      ctx.restore();
    };
    const segment = (
      id: string,
      a: Point,
      b: Point,
      w: number,
      top = 0.12,
      bottom = 0.88,
      alpha = 1,
    ) => {
      const len = Math.hypot(b.x - a.x, b.y - a.y),
        height = len / (bottom - top);
      part(
        id,
        a,
        w,
        height,
        Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2,
        0.4,
        top,
        1,
        alpha,
        face,
      );
    };
    const glow = (point: Point, r: number, color: string) => {
      const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, r);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, r, 0, TAU);
      ctx.fill();
    };
    // Rear equipment attaches high on the spine and is occluded by the cabin.
    // Painting a cargo rack after the torso made it look like an extra hip/limb.
    if (p.loadout.fitted.hull === 'hauler') {
      const rack = at(-12, -19 + body, -5);
      part('rack', rack, 19, 23, pose.bank, 0.5, 0.5, 1, 1, face);
    }
    // Compact engines sit on the back frame; their nozzles stay above the hips.
    for (const side of [-1, 1]) {
      const q = at(side * 11, -11 + body, side * 3);
      part('engine', q, 8, 18, pose.bank, 0.5, 0.5, 1, 1, face);
      const nozzle = at(side * 11, -2 + body, side * 3),
        lift = Math.max(0, pose.lift - 0.35) * 1.5;
      if (lift > 0.02) {
        ctx.save();
        ctx.translate(nozzle.x, nozzle.y);
        ctx.rotate(pose.bank);
        const len = 9 + lift * 18 + Math.sin(pose.phase * 39 + side) * 2;
        const g = ctx.createLinearGradient(0, 0, 0, len);
        g.addColorStop(0, '#eaffff');
        g.addColorStop(0.25, '#77d9f5b0');
        g.addColorStop(1, '#65bdff00');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, len / 2, 2.8 * lift, len / 2, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
        glow(nozzle, 7 * lift, '#6ddfff50');
      }
      if ((pose.dive ?? 0) > 0.03) {
        const q = at(side * 17, -29 + body);
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(pose.bank);
        const len = 16 * pose.dive!;
        const g = ctx.createLinearGradient(0, 0, 0, -len);
        g.addColorStop(0, '#dfffff');
        g.addColorStop(1, '#66ccff00');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, -len / 2, 2, len / 2, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
    const order = face > 0 ? [-1, 1] : [1, -1];
    for (const side of order) {
      const gait = mechanicalFootstep(pose, side < 0 ? 0 : 1),
        rear = side !== face;
      const pivot = pose.forge?.pivot ?? 0,
        step = side === (pose.forge?.pivotSide ?? 1) ? pivot : 0;
      const hips = { ...pose, yaw: pose.forge?.hipsYaw ?? pose.yaw };
      const hip = minerPoint(
        0,
        0,
        1,
        hips,
        false,
        side * 7,
        body + side * (pose.forge?.hipRoll ?? 0) * 7,
        side * 5,
      );
      const knee = at(
        side * 9 + gait.x * 0.55 * (1 - pivot) + step * side * 2,
        12 - pose.gear * 5 + body * 0.45 - step * 2,
        side * 5,
      );
      const foot = at(
        side * 12 + gait.x * (1 - pivot * 0.8),
        25 - pose.gear * 10 - gait.lift * (1 - pivot) - step * 4,
        side * 5,
      );
      // Opaque far limbs are shaded by their source art, never translucent ghosts.
      segment('thigh', hip, knee, 12, 0.12, 0.87);
      segment('shin', knee, foot, 17, 0.1, 0.93);
    }
    const bodyView = (yaw: number) =>
      this.bodyViews[yaw < Math.PI*.32 ? 0 : yaw > Math.PI*.68 ? 2 : 1];
    // The pelvis follows the planted feet; the upper cabin leads and settles
    // independently. Their shared waist seam is hidden by the hip armour.
    const hipView = bodyView(pose.forge?.hipsYaw ?? pose.yaw ?? 0),
      hip = at(0, body);
    ctx.save();
    ctx.translate(hip.x, hip.y);
    ctx.rotate(pose.bank + (pose.forge?.hipRoll ?? 0));
    ctx.drawImage(hipView, 0, 276, 288, 92, -18, -6, 36, 12);
    ctx.restore();
    const cabin = at(0, -21 + body),
      view = bodyView(pose.yaw ?? 0);
    const chestWidth = 36 + 3 * Math.sin(pose.yaw ?? 0);
    ctx.save();
    ctx.translate(cabin.x, cabin.y);
    ctx.rotate(pose.bank + (pose.forge?.chestRoll ?? 0));
    ctx.drawImage(view, 0, 0, 288, 276, -chestWidth / 2, -20, chestWidth, 35);
    ctx.restore();
    // Drill elbow and cutting head use the same aimed direction as excavation.
    const bank = pose.bank,
      cs = Math.cos(bank),
      sn = Math.sin(bank);
    const active = Math.max(0, Math.min(1, pose.drill));
    // Fold the idle cutter alongside the hip, rather than leaving a rigid arm
    // sticking out behind the cabin. Deploy along the actual mining direction.
    const restSwing = Math.sin(pose.walkPhase ?? 0) * pose.stride;
    const parked = Math.atan2(1, (0.22 + restSwing * 0.08) * face);
    const target = aim
      ? { x: aim.x * cs + aim.y * sn, y: -aim.x * sn + aim.y * cs }
      : { x: Math.cos(parked), y: Math.sin(parked) };
    const d = rigidDrillDirection(target, active, parked);
    const tuckedReach = 13 - pose.gear * 2 + restSwing * 1.1 + Math.sin(pose.phase * 2) * 0.25;
    const reach = tuckedReach + (30 - tuckedReach) * active;
    const shoulder = at(-18, -24 + body, -3),
      joint = { x: -18, y: -24 + body };
    const wrist = minerPartPoint(
      0,
      0,
      1,
      pose,
      false,
      -18 + d.x * reach,
      -24 + body + d.y * reach,
      joint,
      -3,
    );
    const elbow = {
      x: (shoulder.x + wrist.x) * 0.5 - (3 + active * 2) * face,
      y: (shoulder.y + wrist.y) * 0.5 + 2 + restSwing * (1 - active),
    };
    segment('arm', shoulder, elbow, 12, 0.12, 0.9);
    segment('arm', elbow, wrist, 9, 0.35, 0.9);
    const da = Math.atan2(d.y, d.x) + bank,
      wide = p.loadout.fitted.drill === 'excavator';
    ctx.save();
    ctx.filter = pose.drill > 0.1 ? `brightness(${1 + Math.sin(pose.phase * 48) * 0.07})` : 'none';
    part(
      wide ? 'excavator' : 'drill',
      wrist,
      wide ? 24 : 20,
      wide ? 12 : 9,
      da,
      0.28,
      0.5,
      Math.cos(da) < 0 ? -1 : 1,
    );
    ctx.restore();
    // Ballistic sprite origin and muzzle match the existing aiming solver exactly.
    const socket = minerGunSocket(p, look),
      origin = minerPartPoint(0, 0, 1, pose, false, socket.origin.x, socket.origin.y, socket.pivot),
      sg = at(18, -24 + body, 3);
    const ge = { x: (sg.x + origin.x) * 0.5 + 3 * face, y: (sg.y + origin.y) * 0.5 + 4 };
    segment('arm', sg, ge, 12, 0.12, 0.9);
    segment('arm', ge, origin, 8, 0.35, 0.9);
    const ga = Math.atan2(pose.lookY, pose.lookX),
      weapon = p.loadout.fitted.weapon;
    part(
      this.parts.has(weapon) ? weapon : 'gun',
      origin,
      socket.length / 0.72,
      weapon === 'arc' ? 12 : 10,
      ga,
      0.28,
      0.5,
      Math.cos(ga) < 0 ? -1 : 1,
    );
    if (pose.fire > 0.05) {
      const muzzle = {
        x: origin.x + Math.cos(ga) * socket.length,
        y: origin.y + Math.sin(ga) * socket.length,
      };
      glow(muzzle, 6 * pose.fire, weapon === 'beam-laser' ? '#91ffffdd' : '#ffe7acdd');
    }
    // Actual motorised lamp follows the same socket that emits the fog-of-war beam.
    const lamp = minerLampSocket(p, look),
      lp = minerPartPoint(0, 0, 1, pose, false, lamp.pivot.x, lamp.pivot.y, lamp.pivot);
    part('lamp', lp, 14, 11, ga, 0.18, 0.5, Math.cos(ga) < 0 ? -1 : 1);
    const lens = minerPartPoint(0, 0, 1, pose, false, lamp.lens.x, lamp.lens.y, lamp.pivot);
    glow(lens, 4, '#ffe8a03a');
    if (unload && unload.age < 1.5) {
      const hatch = at(16, -15 + body);
      part('rack', hatch, 12, 9, -Math.min(1, unload.age / 0.2) * 0.5, 0.5, 1);
      glow(hatch, 5, '#90f1c54f');
    }
    ctx.restore();
  }
}

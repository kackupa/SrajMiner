import Phaser from 'phaser';
import type { Progress } from '../economy/Progress';
import { mechanicalFootstep, restingVehiclePose, type VehiclePose } from './VehiclePose';
import {
  minerBodyOffset,
  minerGunSocket,
  minerLampSocket,
} from './ConceptMiner';
import { minerLocalLook, minerPartPoint, minerPoint } from './MinerArt';
import atlasUrl from '../../assets/forge/forge-parts.png';
import { forgeElbow,forgeGunFold,forgeCutterGoals } from './ForgeArm';
import { advanceForgeMotion } from './ForgeMotion';
import {drawForgeClaw,forgeCargoHatch} from './ForgeClaw';
import weaponsUrl from '../../assets/forge/forge-weapons.png';
import turnUrl from '../../assets/forge/forge-turn.png';

type Point = { x: number; y: number };
type Frame = { rect: [number, number, number, number]; mask?: number[][]; joints?:[Point,Point] };
// Source rectangles are measured on the original transparent atlas. The shin
// mask separates its extended toe from the neighbouring drill sprite.
const FRAMES: Record<string, Frame> = {
  torso: { rect: [48, 0, 390, 492] },
  arm: { rect: [475, 30, 242, 445],joints:[{x:57,y:87},{x:104,y:354}] },
  // The elbow casing and pistons form a compact forearm, without duplicating
  // the large shoulder plate. Joint coordinates are in the untrimmed crop.
  forearm: {rect:[538,232,169,188],joints:[{x:41,y:152},{x:71,y:15}]},
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
// Helmet masks in the normalized 288x368 directional frames. The neck stays
// attached to the chassis; only the helmet and its antenna articulate.
const HEADS=[
  {pivot:[158,104],outline:[[96,0],[214,0],[214,94],[204,106],[149,110],[118,101],[96,80]]},
  {pivot:[146,104],outline:[[100,0],[196,0],[196,98],[180,110],[108,110],[100,90]]},
  {pivot:[130,104],outline:[[74,0],[192,0],[192,80],[173,105],[120,111],[76,99]]},
];

/** Real textured skeletal artwork. Presentation only: no saved state or physics. */
export class ForgeSpriteRig {
  readonly image: Phaser.GameObjects.Image;
  private secondary: Phaser.GameObjects.Image;
  private secondaryTextures = new Map<string, string>();
  private texture: Phaser.Textures.CanvasTexture;
  private parts = new Map<string, HTMLCanvasElement>();
  private boneJoints=new Map<string,[Point,Point]>();
  private portraits = new Map<string, string>();
  private thumbnails = new Map<string, string>();
  private bodyViews: HTMLCanvasElement[] = [];
  private headViews: HTMLCanvasElement[] = [];
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
      const head=document.createElement('canvas');head.width=288;head.height=368;
      const h=head.getContext('2d')!;h.drawImage(frame,0,0);
      for(const [context,operation] of [[h,'destination-in'],[ctx,'destination-out']] as const){
        context.save();context.globalCompositeOperation=operation;context.beginPath();
        HEADS[i].outline.forEach(([x,y],j)=>j?context.lineTo(x,y):context.moveTo(x,y));
        context.closePath();context.fill();context.restore();
      }
      this.headViews.push(head);
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
    if(frame.joints)this.boneJoints.set(id,frame.joints.map(p=>({x:p.x-l,y:p.y-t})) as [Point,Point]);
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
        { ...restingVehiclePose(), yaw: 0, walkPhase: 0,forge:advanceForgeMotion(undefined,restingVehiclePose(),1,0,0) },
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
    this.boneJoints.clear();
    this.portraits.clear();
    this.bodyViews = [];
    this.headViews = [];
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
      const joints=this.boneJoints.get(id);
      if(joints){
        // Map the actual painted hinge centres, not the rectangular sprite bounds.
        // Mirroring around the bone axis keeps both ends attached in either facing.
        const img=this.parts.get(id)!;
        const [{x:ax,y:ay},{x:bx,y:by}]=joints;
        const sourceAngle=Math.atan2(by-ay,bx-ax),sourceLength=Math.hypot(bx-ax,by-ay);
        ctx.save();ctx.translate(a.x,a.y);ctx.rotate(Math.atan2(b.y-a.y,b.x-a.x));
        ctx.scale(len/sourceLength,face*w/img.width);ctx.rotate(-sourceAngle);
        ctx.globalAlpha=alpha;ctx.drawImage(img,-ax,-ay);ctx.restore();return;
      }
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
    // Visible vent, hot core and tapered cyan exhaust. Direction is thrust's
    // opposite, independent of which way the cabin is looking.
    const jet=(point:Point,angle:number,power:number,phase:number)=>{
      if(power<.025)return;
      ctx.save();ctx.translate(point.x,point.y);ctx.rotate(angle);
      const length=(17+power*12)*(1+Math.sin(pose.phase*42+phase)*.07),width=2.5+power;
      ctx.fillStyle='#20363d';ctx.beginPath();ctx.ellipse(-1,0,2.7,width+1,0,0,TAU);ctx.fill();
      ctx.strokeStyle='#9bb7b4';ctx.lineWidth=.7;ctx.stroke();
      const plume=ctx.createLinearGradient(0,0,length,0);plume.addColorStop(0,'#eeffff');plume.addColorStop(.2,'#94eeffdd');plume.addColorStop(.6,'#48bded90');plume.addColorStop(1,'#2387df00');
      ctx.globalAlpha=Math.min(1,power*1.8);ctx.fillStyle=plume;ctx.beginPath();ctx.moveTo(0,-width);ctx.bezierCurveTo(length*.35,-width*1.4,length*.65,-width*.3,length,0);ctx.bezierCurveTo(length*.65,width*.3,length*.35,width*1.4,0,width);ctx.closePath();ctx.fill();
      ctx.fillStyle='#edffff';ctx.beginPath();ctx.moveTo(0,-width*.45);ctx.lineTo(length*.45,0);ctx.lineTo(0,width*.45);ctx.closePath();ctx.fill();
      ctx.fillStyle='#c5f6ff99';for(let i=1;i<3;i++){const x=length*(.2+i*.2);ctx.beginPath();ctx.moveTo(x-1.4,0);ctx.lineTo(x,-1.2);ctx.lineTo(x+1.4,0);ctx.lineTo(x,1.2);ctx.closePath();ctx.fill();}
      ctx.restore();glow(point,8*power,'#6ddfff65');
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
        // Engine glow remains behind the hull; the main lift plumes are under
        // the feet so the torso and folded legs cannot hide them.
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
    const trail=pose.forge?.legTrail??0;
    const flightFold=pose.gear*(.3+.7*pose.lift);
    const liftLoad=pose.gear*(Math.max(0,(pose.lift-.35)/.65)*2.5-(pose.dive??0)*2);
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
        side * 9 + gait.x * 0.55 * (1 - pivot) + step * side * 2 + trail*.45,
        12 - flightFold * 5 + body * 0.45 - step * 2 + side*flightFold+liftLoad*.35,
        side * 5,
      );
      const foot = at(
        side * 12 + gait.x * (1 - pivot * 0.8) + trail,
        25 - flightFold * 10 - gait.lift * (1 - pivot) - step * 4 + side*flightFold*2+liftLoad,
        side * 5,
      );
      // Opaque far limbs are shaded by their source art, never translucent ghosts.
      segment('thigh', hip, knee, 12, 0.12, 0.87);
      segment('shin', knee, foot, 17, 0.1, 0.93);
      const lift=Math.max(0,pose.lift-.35)/.65;
      jet({x:foot.x-Math.sin(pose.bank)*3,y:foot.y+Math.cos(pose.bank)*3},Math.PI/2+pose.bank,lift,side*2);
    }
    const drawGun = () => {
    // Ballistic sprite origin and muzzle match the existing aiming solver exactly.
    const socket = minerGunSocket(p, look),
      origin = minerPartPoint(0, 0, 1, pose, false, socket.origin.x, socket.origin.y, socket.pivot),
      sg = minerPartPoint(0,0,1,pose,false,socket.pivot.x,socket.pivot.y,socket.pivot);
    const mount=at(16*Math.cos(pose.yaw??0),-23+body);
    // Telescopic roof hardpoint, not a third arm. Armour hides the stowed barrel.
    ctx.lineCap='round';ctx.strokeStyle='#203437';ctx.lineWidth=7;
    ctx.beginPath();ctx.moveTo(mount.x,mount.y);ctx.lineTo(sg.x,sg.y);ctx.stroke();
    ctx.strokeStyle='#9ba9a3';ctx.lineWidth=3;ctx.stroke();
    glow(sg,2,'#80dfe588');
    const ga = Math.atan2(socket.dy,socket.dx)+pose.bank,
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
    };
    // The retracting assembly slides behind the solid chest armour.
    drawGun();
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
    const headIndex=(pose.yaw??0)<Math.PI*.32?0:(pose.yaw??0)>Math.PI*.68?2:1;
    const [neckX,neckY]=HEADS[headIndex].pivot;
    const hx=(neckX/288-.5)*chestWidth,hy=-20+neckY/276*35;
    // A small rotary neck fills the exposed seam when the helmet pitches.
    ctx.fillStyle='#263a3d';ctx.beginPath();ctx.ellipse(hx,hy,3.3,1.6,0,0,TAU);ctx.fill();
    ctx.translate(hx,hy);ctx.rotate(pose.forge?.headTilt??0);ctx.translate(-hx,-hy);
    ctx.drawImage(this.headViews[headIndex],0,0,288,276,-chestWidth/2,-20,chestWidth,35);
    ctx.restore();
    const hatch=forgeCargoHatch(p,pose),open=pose.clawHandling?.hatch??0;
    const lateral=pose.strafe??0;
    for(const side of [-1,1]){
      const mount=at(side*21,-7+body,side*2);
      ctx.save();ctx.translate(mount.x,mount.y);ctx.rotate(pose.bank);
      ctx.fillStyle='#536d71';ctx.fillRect(-3,-3,6,6);ctx.fillStyle='#18313a';ctx.fillRect(side>0?1:-3,-2,2,4);ctx.restore();
      if(side*lateral<0)jet(mount,(side>0?0:Math.PI)+pose.bank,Math.abs(lateral),side*3);
    }
    ctx.save();ctx.translate(hatch.x,hatch.y);ctx.rotate(pose.bank);
    ctx.fillStyle='#10242b';ctx.fillRect(-5,-4,10,8);
    ctx.strokeStyle='#9a7b43';ctx.lineWidth=1;ctx.strokeRect(-5,-4,10,8);
    ctx.fillStyle='#40565a';ctx.fillRect(-4,-3,8,6);
    ctx.fillStyle='#0b1920';ctx.fillRect(-4,-3,8,6*open);
    ctx.fillStyle='#c89443';ctx.fillRect(-4,-3+6*open,8,6*(1-open));
    ctx.fillStyle=open>.2?'#8fe1d6':'#597572';ctx.fillRect(-3,-3,2,1);
    ctx.restore();
    // Solve both rigid links before rotating them with the shoulder. Turning must
    // never flatten the elbow or scale one bone to fill an unreachable target.
    const cutters=pose.forge?.cutters??forgeCutterGoals(pose);
    for(const [index,armSide] of [-1,1].entries()) {
    const cutter=cutters[index];
    const drillShoulderX=armSide*18*Math.cos(pose.yaw??0);
    const shoulder = at(drillShoulderX, -24 + body, armSide*3),
      joint = { x: drillShoulderX, y: -24 + body };
    const localWrist={x:cutter.x,y:cutter.y};
    const localElbow=forgeElbow({x:0,y:0},localWrist,-armSide);
    const project=(q:Point)=>minerPartPoint(0,0,1,pose,false,joint.x+q.x,joint.y+q.y,joint,armSide*3);
    const wrist=project(localWrist),elbow=project(localElbow);
    segment('arm', shoulder, elbow, 12, 0.12, 0.9);
    segment('forearm', elbow, wrist, 8, 0.35, 0.9);
    // Exposed elbow hub and ram make the bend readable at gameplay scale.
    ctx.strokeStyle='#182d34';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(shoulder.x,shoulder.y);ctx.lineTo(elbow.x,elbow.y);ctx.stroke();
    ctx.strokeStyle='#91a6a5';ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle='#bd873e';ctx.beginPath();ctx.arc(elbow.x,elbow.y,2.4,0,TAU);ctx.fill();
    ctx.fillStyle='#24383e';ctx.beginPath();ctx.arc(elbow.x,elbow.y,1.2,0,TAU);ctx.fill();
    const da = cutter.angle + pose.bank,
      wide = p.loadout.fitted.drill === 'excavator';
    if(index===1){
      const grip=pose.clawHandling?(pose.clawHandling.held?.12:.8):pose.clawAction?(pose.clawAction.bracing?.48:pose.clawAction.holding?.18:1):pose.drill>.1?.75:.3+Math.sin(pose.phase*1.5)*.035;
      drawForgeClaw(ctx,wrist.x,wrist.y,da,pose.yaw??0,grip,pose.clawAction?.holding,pose.clawHandling?.held?pose.clawHandling.material:undefined);
      continue;
    }
    ctx.save();
    ctx.filter = pose.drill > 0.1 ? `brightness(${1 + Math.sin(pose.phase * 48) * 0.07})` : 'none';
    part(
      wide ? 'excavator' : 'drill',
      wrist,
      wide ? 27 : 23,
      wide ? 13 : 10,
      da,
      0.28,
      0.5,
      Math.cos(da) < 0 ? -1 : 1,
    );
    ctx.restore();
    }
    const ga=Math.atan2(pose.lookY,pose.lookX);
    // Actual motorised lamp follows the same socket that emits the fog-of-war beam.
    const lamp = minerLampSocket(p, look),
      lp = minerPartPoint(0, 0, 1, pose, false, lamp.pivot.x, lamp.pivot.y, lamp.pivot);
    const lampBase=at(-16*Math.cos(pose.yaw??0),-27+body);
    ctx.strokeStyle='#203437';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(lampBase.x,lampBase.y);ctx.lineTo(lp.x,lp.y);ctx.stroke();
    ctx.strokeStyle='#a7b4aa';ctx.lineWidth=2;ctx.stroke();
    glow(lp,2,'#eecf8588');
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

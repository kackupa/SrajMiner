import { PILOT_STUDY as C } from '../config';
import type { Point, UniformPlanet } from './UniformPlanet';

/** Player-controlled ship. Radial/tangential thrust; no miner wind or save access. */
export class StudyPilot {
  spaceHeading?:number;
  get inSpace(){return this.spaceHeading!==undefined;}
  get frameAngle(){return this.spaceHeading??this.angle;}
  sideSpeed = 0;
  riseSpeed = 0;
  grounded = true;
  landing = false;
  bank = 0;
  yaw = 0;
  facing = 1;
  thrust = 0;
  gear = 0;
  boostRemaining = 0;
  boostCooldown = 0;
  boost() {
    if(this.grounded || this.landing || this.boostCooldown>0)return false;
    this.boostRemaining=C.boostDuration;
    this.boostCooldown=C.boostDuration+C.boostCooldown;
    return true;
  }
  constructor(public position: Point) {
    this.position = { ...position };
  }
  get angle() {
    return Math.atan2(this.position.x, -this.position.y);
  }
  altitude(world: UniformPlanet) {
    return Math.hypot(this.position.x, this.position.y) - world.surfaceRadius(this.angle) - 8;
  }
  private floor(world: UniformPlanet, angle: number) {
    let radius = world.surfaceRadius(angle) + 8;
    for (let x = -C.footprint; x <= C.footprint; x += 16) {
      const da = x / world.surfaceRadius(angle);
      radius = Math.max(radius, world.surfaceRadius(angle + da) * Math.cos(da) + 8);
    }
    return radius;
  }
  step(
    world: UniformPlanet,
    side: number,
    rise: number,
    dt: number,
    canLand: (a: number) => boolean,
    boost=1,
  ) {
    // Sweep the wide hull in short time steps, even during fast orbital flight.
    for (let left = Math.min(0.1, Math.max(0, dt)); left > 1e-8;) {
      const h = Math.min(left, 1 / 120);
      left -= h;
      this.boostCooldown=Math.max(0,this.boostCooldown-h);
      this.boostRemaining=Math.max(0,this.boostRemaining-h);
      if(side && !this.grounded)this.facing=side>0?1:-1;
      const wanted=this.facing>0?0:Math.PI;
      this.yaw+=Math.max(-C.turnRate*h,Math.min(C.turnRate*h,wanted-this.yaw));
      const drive=this.grounded?0:Math.max(0,side*Math.cos(this.yaw));
      this.thrust+=(drive-this.thrust)*(1-Math.exp(-h*6));
      const power=boost*(this.boostRemaining>0?C.boostMultiplier:1);
      this.gear+=(Number(!this.grounded)-this.gear)*(1-Math.exp(-h*5));
      const lean=this.grounded?0:Math.max(-C.bankLimit,Math.min(C.bankLimit,this.sideSpeed/C.surfaceSpeed*C.bankLimit));
      this.bank+=(lean-this.bank)*(1-Math.exp(-h*3));
      if (this.grounded) {
        if (rise <= 0) continue;
        this.grounded = false;
      }
      if (rise > 0 || side) this.landing = false;
      const altitude = this.altitude(world);
      if(!this.inSpace&&altitude>=C.orbitHeight)this.spaceHeading=this.angle;
      const cruise = this.inSpace?1: Math.max(0, Math.min(1, (altitude - 250) / C.orbitHeight));
      const speed = (C.surfaceSpeed + (C.cruiseSpeed - C.surfaceSpeed) * cruise)*power;
      const approach = (v: number, to: number) =>
        v + Math.max(-C.acceleration * h*power, Math.min(C.acceleration * h*power, to - v));
      this.sideSpeed = approach(this.sideSpeed, side * speed);
      this.riseSpeed = approach(
        this.riseSpeed,
        this.landing ? -100 : rise * (C.riseSpeed + (C.cruiseSpeed - C.riseSpeed) * cruise)*power,
      );
      if(this.inSpace){
        const a=this.spaceHeading!,c=Math.cos(a),s=Math.sin(a);
        const vx=c*this.sideSpeed+s*this.riseSpeed,vy=s*this.sideSpeed-c*this.riseSpeed;
        this.position={x:this.position.x+vx*h,y:this.position.y+vy*h};
        if(this.altitude(world)<C.reentryHeight){
          const a=this.angle;
          this.sideSpeed=vx*Math.cos(a)+vy*Math.sin(a);
          this.riseSpeed=vx*Math.sin(a)-vy*Math.cos(a);
          this.spaceHeading=undefined;
        }
        continue;
      }
      const radius = Math.hypot(this.position.x, this.position.y);
      const angle = this.angle + (this.sideSpeed * h) / Math.max(radius, 1);
      const floor = this.floor(world, angle);
      let next = radius + this.riseSpeed * h;
      if (next < floor) {
        next = floor;
        this.riseSpeed = Math.max(0, this.riseSpeed);
      }
      if ((this.landing || rise < 0) && next <= floor + 1 && canLand(angle)) {
        next = world.surfaceRadius(angle) + 8;
        this.grounded = true;
        this.landing = false;
        this.sideSpeed = 0;
        this.riseSpeed = 0;
      }
      this.position = { x: Math.sin(angle) * next, y: -Math.cos(angle) * next };
    }
  }
  requestLanding(world: UniformPlanet, canLand: (a: number) => boolean) {
    if (this.altitude(world) > C.landingHeight || !canLand(this.angle)) return false;
    this.landing = true;
    this.boostRemaining=0;
    return true;
  }
  rebase(offset: Point) {
    this.spaceHeading=undefined;
    this.position = { x: this.position.x + offset.x, y: this.position.y + offset.y };
    this.sideSpeed = 0;
    this.riseSpeed = 0;
    this.grounded = false;
    this.landing = false;
  }
}

/** Same hull-centred bank and 1.5x coordinates used by MothershipArt. */
export function shipLocalPoint(x:number,y:number,z=0,bank=0,yaw?:number):Point {
 // Orthographic depth projection: the hull retains physical width at mid-turn.
 const turn=yaw??0,depth=z-16;
 const X=yaw===undefined?x-z*.5:x*Math.cos(turn)+depth*Math.sin(turn);
 const Y=yaw===undefined?y+z*.38:y+(-x*Math.sin(turn)+depth*Math.cos(turn))*.12;
 const a=bank*.45,c=Math.cos(a),s=Math.sin(a);
 return {x:X*c-(Y+58)*s,y:-58+X*s+(Y+58)*c};
}
export function shipDeckPoint(ship:Point,x:number,y:number,bank=0,yaw?:number,frameAngle?:number):Point {
 const q=shipLocalPoint(x/1.5,y/1.5,0,bank,yaw),u=q.x*1.5,v=q.y*1.5,r=Math.hypot(ship.x,ship.y)||1;
 const a=frameAngle??Math.atan2(ship.x,-ship.y);
 return {x:ship.x+Math.cos(a)*u-Math.sin(a)*v,y:ship.y+Math.sin(a)*u+Math.cos(a)*v};
}

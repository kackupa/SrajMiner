type Point = { x: number; y: number };
import type { VehiclePose } from './VehiclePose';

export type ForgeCutter = Point & { vx:number; vy:number; angle:number };
export type ForgeCutters = [ForgeCutter,ForgeCutter];

/** Shoulder-relative wrist goals; cutter orientation is independent of elbow extension. */
export function forgeCutterGoals(pose:VehiclePose):ForgeCutters {
  const face=Math.cos(pose.yaw??0),air=pose.gear,active=Math.max(0,Math.min(1,pose.drill));
  const aim=pose.drillAim??{x:pose.lookX,y:pose.lookY};
  const c=Math.cos(pose.bank),s=Math.sin(pose.bank);
  const dx=aim.x*c+aim.y*s,dy=-aim.x*s+aim.y*c;
  const length=Math.hypot(dx,dy),a=length>.001?Math.atan2(dy,dx):Math.PI/2;
  return [-1,1].map(side=>{
    if(side===1&&pose.clawAction)return {...pose.clawAction,vx:0,vy:0};
    const swing=Math.sin((pose.walkPhase??0)+side*.7)*pose.stride;
    const lag=pose.forge?.armLag??0;
    const liftLoad=Math.max(0,(pose.lift-.35)/.65);
    const rest={x:-side*(6+air*2)+face*1.5+swing*1.1+lag*.75,y:13-air*6+air*(liftLoad*2.5-(pose.dive??0)*2)+Math.cos(pose.phase*1.8+side)*.35};
    // Reach remains short of a locked elbow, with staggered pressure strokes.
    // The utility hand supports the drill from beside the chest. Only charge
    // placement explicitly asks it to reach all the way out to the terrain.
    const utility=side===1;
    const reach= utility
      ? Math.max(12,Math.min(17,length*.23))+Math.sin(pose.phase*9)*active*.2
      : Math.max(18,Math.min(28,length*.45))+Math.sin(pose.phase*17+side*1.3)*active*.65;
    const spread=side*.07,angle=a+spread+(side===1?-.18:0);
    const extension=active*(utility?.4:1);
    const x=rest.x+(Math.cos(angle)*reach-rest.x)*extension;
    const y=rest.y+(Math.sin(angle)*reach-rest.y)*extension;
    const parked=utility?Math.atan2(1-air*.35,-face*(.12+air*.5)):Math.atan2(.9-air*.45,face*.75||.001);
    const delta=Math.atan2(Math.sin(angle-parked),Math.cos(angle-parked));
    return {x,y,vx:0,vy:0,angle:parked+delta*active};
  }) as ForgeCutters;
}

/** Damped wrist suspension gives the heavy cutters a brief, bounded follow-through. */
export function advanceForgeCutters(previous:ForgeCutters|undefined,pose:VehiclePose,dt:number,reduced=false):ForgeCutters {
  const goals=forgeCutterGoals(pose);
  if(!previous||reduced)return goals;
  if(dt<=0)return previous;
  return previous.map((old,i)=>{
    const next={...old},goal=goals[i];
    for(let left=Math.min(.05,dt);left>1e-8;){
      const h=Math.min(left,1/120);left-=h;
      const bracing=i===1&&pose.clawAction?.bracing;
      const stiffness=bracing?260:pose.drill>.1||pose.clawAction?150:85,damping=bracing?28:19;
      next.vx+=(stiffness*(goal.x-next.x)-damping*next.vx)*h;
      next.vy+=(stiffness*(goal.y-next.y)-damping*next.vy)*h;
      next.x+=next.vx*h;next.y+=next.vy*h;
      const delta=Math.atan2(Math.sin(goal.angle-next.angle),Math.cos(goal.angle-next.angle));
      next.angle+=delta*(1-Math.exp(-h*16));
    }
    // Prevent a mid-turn spring stroke from exceeding the two physical links.
    const r=Math.hypot(next.x,next.y),bounded=Math.max(8,Math.min(29,r));
    if(r>0){next.x*=bounded/r;next.y*=bounded/r;}
    else {next.x=0;next.y=8;}
    return next;
  }) as ForgeCutters;
}

/** Leave a fully-deployed band so firing resumes only from the aimed pose. */
export function forgeGunFold(drill:number, deployment=1){
  const t=Math.max(0,Math.min(1,(Math.max(drill,1-deployment)-.05)/.95));
  return t*t*(3-2*t);
}

/** Quick mechanical extension, slower return; bounded and reversible mid-stroke. */
export function advanceForgeGun(deployment:number, firing:boolean, drilling:boolean, dt:number){
  const step=Math.max(0,Math.min(.05,dt));
  return Math.max(0,Math.min(1,deployment+(firing&&!drilling?5:-3.5)*step));
}

/** Cursor wins over walking direction; a small centre band prevents aim jitter. */
export function forgeFacing(current: number, aimX: number, hasAim: boolean, walking: number) {
  if (hasAim) return Math.abs(aimX) > 12 ? Math.sign(aimX) : current;
  return walking || current;
}

/** Two connected links. The bend foreshortens as the shoulder rotates through front view. */
export function forgeElbow(
  shoulder: Point,
  wrist: Point,
  bend: number,
  upper = 18,
  lower = 14,
): Point {
  const dx = wrist.x - shoulder.x,
    dy = wrist.y - shoulder.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(
    upper + lower - 0.001,
    Math.max(Math.abs(upper - lower) + 0.001, distance),
  );
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  return {
    x: shoulder.x + (dx / distance) * along - (dy / distance) * height * bend,
    y: shoulder.y + (dy / distance) * along + (dx / distance) * height * bend,
  };
}

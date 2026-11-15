import type Phaser from 'phaser';
import type { CombatBody } from './UniformCombat';
import type { Point } from './UniformPlanet';

/** Original raider silhouette: armoured nose, swept wings, twin engines and a
 * separately aimed belly cannon. A narrow side face stays visible in a turn. */
export function drawRaider(g:Phaser.GameObjects.Graphics,b:CombatBody,at:(x:number,y:number)=>Point,project:(p:Point)=>Point,time:number,scale:number){
 const yaw=b.heading??0,c=Math.cos(yaw),depth=Math.sin(yaw)*7;
 const p=(x:number,y:number)=>at(x*c,y+depth*x/45);
 const poly=(color:number,points:number[][])=>{g.fillStyle(b.flash?0xf8dcc0:color);g.fillPoints(points.map(([x,y])=>p(x,y)),true);};
 const flame=12+b.moving*16+Math.sin(time*42)*3;
 for(const y of [-10,10]){
  poly(0x122833,[[-27,y-5],[-12,y-5],[-10,y+5],[-28,y+5]]);
  poly(0x78d6df,[[-28,y-3],[-28-flame,y],[-28,y+3]]);
  poly(0xedffff,[[-29,y-1.5],[-28-flame*.65,y],[-29,y+1.5]]);
 }
 poly(0x1b303c,[[-22,-7],[-30,-22],[-8,-17],[6,-5],[2,13],[-24,21],[-17,7]]);
 poly(0x6f858a,[[-29,-21],[-9,-16],[2,-7],[-16,-10]]);
 poly(0x43565f,[[-23,20],[-14,7],[3,5],[0,12]]);
 poly(0x142632,[[-26,-10],[8,-12],[32,-3],[35,3],[16,12],[-22,10]]);
 poly(0x955d49,[[-23,-9],[8,-10],[31,-2],[14,5],[-19,5]]);
 poly(0xbd9473,[[-20,-9],[7,-10],[23,-4],[0,-4]]);
 poly(0x4b626b,[[-19,5],[14,5],[31,-2],[34,3],[15,11],[-22,9]]);
 poly(0x112b36,[[7,-8],[19,-4],[9,1],[0,-1]]);
 poly(0x91cbd0,[[8,-7],[17,-4],[9,-2],[3,-2]]);
 for(const x of [-17,-10,-3]){const q=p(x,2);g.fillStyle(0x172d37);g.fillRect(q.x-1.5*scale,q.y-2*scale,3*scale,4*scale);}
 const lamp=p(-10,-13);g.fillStyle(b.phase==='windup'?0xffc47d:0xd96559);g.fillCircle(lamp.x,lamp.y,(b.phase==='windup'?3:1.5)*scale);
 if(b.aim){
  const d=Math.hypot(b.aim.x-b.x,b.aim.y-b.y)||1,dx=(b.aim.x-b.x)/d,dy=(b.aim.y-b.y)/d;
  const base=project(b),muzzle=project({x:b.x+dx*30,y:b.y+dy*30});
  g.lineStyle(6*scale,0x172b35);g.strokePoints([base,muzzle]);g.lineStyle(2*scale,0xa9b8b2);g.strokePoints([base,muzzle]);
  g.fillStyle(0x5d747c);g.fillCircle(base.x,base.y,5*scale);
  if(b.muzzle){g.fillStyle(0xffd58b,.9);g.fillCircle(muzzle.x,muzzle.y,7*scale);g.fillStyle(0xfffae2);g.fillCircle(muzzle.x,muzzle.y,3*scale);}
  if(b.phase==='windup'){
   const target=project(b.aim);g.lineStyle(scale,0xe7936b,.35);g.strokePoints([muzzle,target]);
   g.lineStyle(1.5*scale,0xffbd79,.8);g.strokeCircle(target.x,target.y,11*scale);
  }
 }
}

export function drawSalvageWreck(g:Phaser.GameObjects.Graphics,point:Point,project:(p:Point)=>Point,scale:number,time:number,claimed:boolean){
 const r=Math.hypot(point.x,point.y),out={x:point.x/r,y:point.y/r};
 const at=(x:number,y:number)=>project({x:point.x-out.y*x-out.x*y,y:point.y+out.x*x-out.y*y});
 const poly=(color:number,points:number[][])=>{g.fillStyle(color);g.fillPoints(points.map(([x,y])=>at(x,y)),true);};
 poly(0x182b34,[[-71,0],[-59,-25],[-15,-31],[18,-19],[42,-24],[70,-4],[58,8],[-49,10]]);
 poly(0x6c7d7c,[[-68,-1],[-57,-22],[-17,-28],[8,-17],[-13,-9],[-53,4]]);
 poly(0x9a7752,[[-49,-22],[-18,-26],[5,-17],[-14,-13],[-47,-7]]);
 poly(0x354d59,[[15,-16],[43,-22],[68,-4],[56,6],[20,3],[29,-5]]);
 poly(0xa5bab3,[[42,-22],[68,-4],[57,-9],[35,-16]]);
 for(let i=0;i<4;i++){const q=at(-14+i*9,-12);g.lineStyle(2*scale,0x172b35);g.strokePoints([q,at(-9+i*9,2)]);}
 for(let i=0;i<3;i++){const q=at(12+Math.sin(time+i)*5,-20-((time*14+i*12)%48));g.fillStyle(0x789088,.09);g.fillCircle(q.x,q.y,(5+i*2)*scale);}
 const cache=at(-26,-5);g.fillStyle(claimed?0x41585c:0xd3a563);g.fillRoundedRect(cache.x-9*scale,cache.y-8*scale,18*scale,12*scale,2*scale);
 g.lineStyle(2*scale,claimed?0x6c8987:0x99dfcc);g.strokeRect(cache.x-6*scale,cache.y-6*scale,12*scale,8*scale);
 if(!claimed){const q=at(-26,-42-Math.sin(time*3)*3);g.lineStyle(2*scale,0x99dfcc);g.strokePoints([{x:q.x-5*scale,y:q.y-5*scale},q,{x:q.x+5*scale,y:q.y-5*scale}]);}
}

import type Phaser from 'phaser';
import type { SurfaceRaiderState } from './SurfaceRaid';
import type { TileWorld } from './TileWorld';
import { humanMuzzle } from './HumanRaider';
import { HUMAN_RAID } from '../config';
type Point={x:number;y:number};
/** Original rival machinery: slate armour, rust panels, amber cockpit and red IFF lamps. */
export function drawHumanRaider(g:Phaser.GameObjects.Graphics,project:(x:number,y:number)=>Point,body:SurfaceRaiderState,world:TileWorld,time:number,reduced:boolean){
 const h=body.human!,gravity=world.gravitySign(body.y),p=(x:number,y:number)=>project(body.x+x,body.y-gravity*y);
 const poly=(points:number[][],color:number)=>{g.fillStyle(body.hitFlash>0?0xffe4be:color,1);g.fillPoints(points.map(([x,y])=>p(x,y)),true);};
 const line=(a:Point,b:Point,color:number,width=2)=>{g.lineStyle(width,color,1);g.lineBetween(a.x,a.y,b.x,b.y);};
 if(h.kind==='ground'){
  // Articulated crawler bogies, with rolling tread pads and suspension movement.
  for(const side of [-1,1]){
   const bounce=reduced?0:Math.sin(time*10+side)*h.moving*1.8;
   poly([[side*12-12,-18+bounce],[side*12+12,-18+bounce],[side*12+15,-8+bounce],[side*12-14,-7+bounce]],0x182a32);
   for(let i=0;i<4;i++){const wheel=p(side*12-8+i*5,-12+bounce);g.fillStyle(0x7c9294,1);g.fillCircle(wheel.x,wheel.y,3);}
   for(let i=0;i<4;i++){const x=side*12-11+((i*6+(reduced?0:time*22*h.moving))%24);line(p(x,-19+bounce),p(x+3,-19+bounce),0xc2b290,2);}
  }
  poly([[-27,-6],[-19,11],[17,14],[29,0],[22,-10],[-19,-10]],0x52676b);
  poly([[-20,4],[-12,22],[6,24],[14,8]],0xa46a45);
  poly([[-12,9],[-9,19],[3,20],[8,9]],0x102b38);
  poly([[-9,11],[-7,17],[1,18],[4,11]],0x8cbec0);
  const pilot=p(-3,14);g.fillStyle(0xffd392,1);g.fillCircle(pilot.x,pilot.y,2);
 }else{
  const bank=reduced?0:Math.sin(time*2)*2;
  poly([[-39,-3],[-23,12],[12,15],[37,3],[25,-10],[-24,-11]],0x52676b);
  poly([[-29,8],[-17,24],[6,20],[18,7]],0xa46a45);
  poly([[-16,10],[-12,19],[3,16],[9,9]],0x9ac5c0);
  poly([[-40,2],[-48,15],[-33,12],[-22,1]],0x263c48);
  for(const side of [-1,1]){
   poly([[side*25-7,-5],[side*25+7,-5],[side*25+5,-12],[side*25-5,-12]],0x172d38);
   if(!reduced){g.fillStyle(0xffc17a,.8);g.fillPoints([p(side*25-4,-12),p(side*25+4,-12),p(side*25,-23-Math.sin(time*24+side)*4-bank)],true);}
  }
 }
 // Layered armour, service hatches, rivets and a short communications mast.
 poly([[-20,-3],[-6,-3],[-6,4],[-17,6]],0x2c424c);
 for(const x of [-18,-8,15,23]){const bolt=p(x,0);g.fillStyle(0xb9b8a4,1);g.fillCircle(bolt.x,bolt.y,1.2);}
 line(p(-20,11),p(-23,29),0x8b9d9d,1.5);
 poly([[17,-4],[26,-3],[24,1],[16,0]],0xd4a15e);
 // Gun pivots independently. Muzzle coordinates are shared with the projectile simulation.
 const base=p(0,12),worldMuzzle=humanMuzzle(body,world),muzzle=project(worldMuzzle.x,worldMuzzle.y);
 const dx=muzzle.x-base.x,dy=muzzle.y-base.y,len=Math.hypot(dx,dy)||1,recoil=reduced?0:h.recoil*15;
 const tip={x:muzzle.x-dx/len*recoil,y:muzzle.y-dy/len*recoil};
 line(base,tip,0x12212a,8);line(base,tip,0xa7b1a0,3);g.fillStyle(0x7b8b89,1);g.fillCircle(base.x,base.y,7);
 const lamp=p(20,5);g.fillStyle(0xff7968,1);g.fillCircle(lamp.x,lamp.y,2.5);
 if(h.recoil>.12&&!reduced){g.fillStyle(0xffdb96,.9);g.fillCircle(muzzle.x,muzzle.y,5);line(muzzle,{x:muzzle.x+dx/len*12,y:muzzle.y+dy/len*12},0xfff1bb,3);}
 if(h.shot){const a=project(h.shot.from.x,h.shot.from.y),b=project(h.shot.to.x,h.shot.to.y),t=Math.min(1,h.shot.age/HUMAN_RAID.shotSeconds),tail=Math.max(0,t-.08);line({x:a.x+(b.x-a.x)*tail,y:a.y+(b.y-a.y)*tail},{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},0xffc487,3);}
}

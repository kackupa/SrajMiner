import type Phaser from 'phaser';
import type {Point} from './UniformPlanet';
import {CLAW_CHARGE_STUDY} from '../config';
export type StudyExplosion={point:Point;age:number;radius:number;kind:string};
const noise=(n:number)=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};
/** Brief hot core, lobed fire, dimensional ash, and independent ballistic fragments. */
export function drawStudyExplosion(g:Phaser.GameObjects.Graphics,e:StudyExplosion,project:(p:Point)=>Point,zoom:number){
 const age=e.age,life=2,fade=Math.max(0,1-age/life),seed=e.point.x*.01+e.point.y*.023;
 const centre=project(e.point),r=e.radius*zoom;
 const charge=e.kind==='charge',grenade=e.kind==='grenade';
 const length=Math.hypot(e.point.x,e.point.y)||1,out={x:e.point.x/length,y:e.point.y/length};
 // Soot rises away from the local gravity, with lit edges and darker inner cores.
 for(let i=0;i<9;i++){
  const a=noise(i+seed)*Math.PI*2,spread=(9+noise(i+22)*e.radius*.4)*Math.min(1,age*4);
  const p=project({x:e.point.x+Math.cos(a)*spread+out.x*age*25,y:e.point.y+Math.sin(a)*spread+out.y*age*25});
  const size=(8+noise(i+8)*13+age*12)*zoom;
  g.fillStyle(charge?0x89958e:0x626c6e,fade*.17);g.fillCircle(p.x,p.y,size*1.3);
  g.fillStyle(0x26343c,fade*.48);g.fillCircle(p.x+size*.12,p.y+size*.15,size);
  g.fillStyle(charge?0xb5aca0:0x87999a,fade*.22);g.fillEllipse(p.x-size*.22,p.y-size*.38,size*1.35,size*.65);
 }
 const fire=Math.max(0,1-age/(charge?.38:grenade?.3:.55));
 if(fire>0){
  g.fillStyle(0xff8e42,fire*.08);g.fillCircle(centre.x,centre.y,r*1.3);
  for(let i=0;i<10;i++){
   const a=i*Math.PI*.2+noise(seed+i),d=r*(.12+age*1.15)*( .6+noise(i)*.6),size=r*(.12+noise(i+6)*.14)*fire;
   const x=centre.x+Math.cos(a)*d,y=centre.y+Math.sin(a)*d;
   g.fillStyle(0xb84220,fire*.6);g.fillCircle(x,y,size*1.25);
   g.fillStyle(0xff9e49,fire*.88);g.fillCircle(x-size*.1,y-size*.15,size);
   g.fillStyle(0xffdf9a,fire*.9);g.fillCircle(x-size*.2,y-size*.28,size*.55);
  }
 }
 if(age<.13){const flash=1-age/.13;g.fillStyle(0xfff4cc,flash*.9);g.fillEllipse(centre.x,centre.y,r*(.5+age*5),r*(.28+age*3));}
 for(let i=0;i<(grenade?30:22);i++){
  const a=noise(i+seed+80)*Math.PI*2,speed=(35+noise(i+19)*125)*(grenade?1.3:1),t=age;
  const world={x:e.point.x+Math.cos(a)*speed*t-out.x*60*t*t,y:e.point.y+Math.sin(a)*speed*t-out.y*60*t*t};
  const p=project(world),size=(1.2+noise(i+34)*2.6)*zoom*fade;
  if(i%3===0&&age<.7){const tail=project({x:world.x-Math.cos(a)*speed*.035,y:world.y-Math.sin(a)*speed*.035});g.lineStyle(Math.max(.7,size*.5),0xffcb80,fade);g.lineBetween(tail.x,tail.y,p.x,p.y);}
  else {g.fillStyle(charge?0x6d7e87:0x494e4d,fade);g.fillTriangle(p.x-size,p.y+size*.5,p.x+size*.8,p.y+size,p.x+size*.3,p.y-size);g.lineStyle(.6,0xb2b3a0,fade*.6);g.lineBetween(p.x-size,p.y+size*.5,p.x+size*.3,p.y-size);}
 }
}

export function drawPlacedCharge(g:Phaser.GameObjects.Graphics,point:Point,normal:Point,fuse:number,project:(p:Point)=>Point,zoom:number){
 const p=project(point),n=project({x:point.x+normal.x,y:point.y+normal.y}),a=Math.atan2(n.y-p.y,n.x-p.x);
 const P=(x:number,y:number)=>({x:p.x+(Math.cos(a)*x-Math.sin(a)*y)*zoom,y:p.y+(Math.sin(a)*x+Math.cos(a)*y)*zoom});
 const poly=(color:number,pts:Point[])=>{g.fillStyle(color);g.fillPoints(pts,true);};
 poly(0x122b32,[P(-2,-6),P(4,-6),P(6,-4),P(6,4),P(4,6),P(-2,6)]);
 poly(0x889a92,[P(0,-5),P(3,-5),P(4,5),P(0,5)]);
 poly(0xd6a04c,[P(3,-4),P(5,-3),P(5,3),P(3,4)]);
 const light=P(6,0),blink=Math.sin((CLAW_CHARGE_STUDY.fuse-fuse)*(fuse<.8?45:15))>0;
 g.fillStyle(blink?0xff7857:0xa3533b);g.fillCircle(light.x,light.y,1.5*zoom);
 if(blink){g.fillStyle(0xffaf64,.13);g.fillCircle(light.x,light.y,7*zoom);}
}

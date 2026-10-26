import type Phaser from 'phaser';
type Point={x:number;y:number};
export const PICKUP_SECONDS=4.2;
const mix=(a:Point,b:Point,t:number)=>{t=Math.max(0,Math.min(1,t));t=t*t*(3-2*t);return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};};
/** Original cargo tug. All motion is cosmetic; the sale commits before dispatch. */
export function drawCargoPickup(g:Phaser.GameObjects.Graphics,point:(x:number,y:number)=>Point,source:Point,age:number,reduced:boolean){
 const dock=point(0,90),inbound=point(-170,230),outbound=point(190,300),hover={x:source.x,y:source.y-46};
 const p=reduced?dock:age<1?mix(inbound,hover,age):age<1.9?hover:age<3?mix(hover,dock,(age-1.9)/1.1):mix(dock,outbound,(age-3)/1.2);
 const scale=Math.max(.65,Math.min(1.4,Math.hypot(point(20,90).x-dock.x,point(20,90).y-dock.y)/20));
 const rect=(x:number,y:number,w:number,h:number,color:number)=>{g.fillStyle(color,1);g.fillRect(p.x+x*scale,p.y+y*scale,w*scale,h*scale);};
 // Twin ducted thrusters, armoured centre pod and underslung cargo clamp.
 for(const side of [-1,1]){
  rect(side*25-7,-6,14,13,0x142a32);rect(side*25-5,-7,10,4,0xd9b676);
  g.lineStyle(2*scale,0x769c9f,1);g.strokeCircle(p.x+side*25*scale,p.y,8*scale);
  const flame=reduced?5:7+Math.sin(age*37+side)*3;
  g.fillStyle(0x8ee6df,.6);g.fillTriangle(p.x+(side*25-4)*scale,p.y+8*scale,p.x+(side*25+4)*scale,p.y+8*scale,p.x+side*25*scale,p.y+(8+flame)*scale);
 }
 rect(-24,-3,48,6,0x6c8587);rect(-14,-11,28,21,0xb5bda4);rect(-11,-8,22,7,0x203b47);rect(-7,-6,14,3,0x8ee6df);
 rect(-17,2,6,8,0xc58c4e);rect(11,2,6,8,0xc58c4e);
 if(age>=1){
  const crate=reduced?{x:p.x,y:p.y+20*scale}:age<1.9?mix(source,{x:p.x,y:p.y+23*scale},(age-1)/.9):{x:p.x,y:p.y+23*scale};
  g.lineStyle(2,0xc5d3c2,1);g.lineBetween(p.x-9*scale,p.y+9*scale,crate.x-7*scale,crate.y-6*scale);g.lineBetween(p.x+9*scale,p.y+9*scale,crate.x+7*scale,crate.y-6*scale);
  g.fillStyle(0xb98143,1);g.fillRect(crate.x-10*scale,crate.y-7*scale,20*scale,14*scale);g.fillStyle(0xf1c27c,1);g.fillRect(crate.x-2*scale,crate.y-7*scale,4*scale,14*scale);
 }
 if(age>=1&&age<1.9&&!reduced){g.lineStyle(1,0x8ee6df,.4);g.lineBetween(p.x-12,p.y+12,source.x-15,source.y);g.lineBetween(p.x+12,p.y+12,source.x+15,source.y);}
 const lamp=point(34,87);g.lineStyle(2,0x8ee6df,.5);g.strokeCircle(lamp.x,lamp.y,reduced?12:8+(age*22)%28);
}

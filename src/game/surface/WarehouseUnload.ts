import type Phaser from 'phaser';
import { cargoPhase } from './CargoHandling';
type Point={x:number;y:number};
/** Cosmetic receiver: transfer is saved before the first crate launches. */
export function drawWarehouseUnload(g:Phaser.GameObjects.Graphics,point:(x:number,y:number)=>Point,sources:Point[],age:number,count:number,reduced:boolean){
 const line=(a:Point,b:Point,color:number,width=2)=>{g.lineStyle(width,color,1);g.lineBetween(a.x,a.y,b.x,b.y);};
 const box=(x:number,y:number,w:number,h:number,color:number)=>{const p=[point(x-w/2,y),point(x+w/2,y),point(x+w/2,y+h),point(x-w/2,y+h)];g.fillStyle(color,1);g.fillPoints(p,true);};
 // Receiving apron and powered rollers follow the building's planetary orientation.
 box(-45,10,58,5,0x182b32);line(point(-74,15),point(-16,15),0xb7c6b0,3);
 for(let i=0;i<8;i++)box(-72+i*7+(reduced?0:(age*15)%7),11,3,3,0x638b91);
 box(-8,12,27,29,0x091b24);box(-8,39,30,3,0x8ee0cd);
 for(let i=0;i<count;i++){
  const phase=cargoPhase(age,i);if(phase.stage==='waiting'||phase.stage==='stacked')continue;
  const landing=point(-62,24);let p=landing;
  if(!reduced&&phase.stage==='flight'){
   const start=sources[i];if(!start)continue;
   const lift=point(-62,24+Math.sin(phase.t*Math.PI)*35);
   p={x:start.x+(landing.x-start.x)*phase.t+lift.x-landing.x,y:start.y+(landing.y-start.y)*phase.t+lift.y-landing.y};
  }else if(phase.stage==='handling')p=point(-62+phase.t*54,24);
  g.fillStyle(0xc58c4e,1);g.fillRect(p.x-6,p.y-6,12,12);g.lineStyle(2,0xf0c47f,1);g.lineBetween(p.x,p.y-5,p.x,p.y+5);
 }
 // Loader robot shuttles along the apron and reaches toward the intake.
 const slide=reduced?0:Math.sin(Math.min(age,2.8)*Math.PI)*10;
 box(-32+slide,17,12,12,0x879e9b);const eye=point(-32+slide,25);g.fillStyle(0x9af1dd,1);g.fillCircle(eye.x,eye.y,2);
 line(point(-26+slide,23),point(-17,30),0xcab77d,3);line(point(-17,30),point(-12,23),0xcab77d,2);
 if(age>2.8){const p=point(0,64);g.lineStyle(2,0x8ee0cd,Math.max(0,1-(age-2.8)/.6));g.strokeCircle(p.x,p.y,reduced?10:10+(age-2.8)*22);}
}

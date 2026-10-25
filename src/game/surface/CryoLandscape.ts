import type Phaser from 'phaser';
import { random } from '../world/TileWorld';

type Point={x:number;y:number};
/** Geometric ice relief anchored to the globe, never to a screen-space horizon. */
export function drawCryoLandscape(g:Phaser.GameObjects.Graphics,project:(x:number,y:number)=>Point,columns:number,tile:number,time:number,reduced:boolean,altitude:number){
 const count=144,circumference=columns*tile*2;
 const layers=[{height:230,base:28,color:0x34566b,light:0x7291a1},
 {height:145,base:16,color:0x28475b,light:0x53788b},
 {height:62,base:4,color:0x192f40,light:0x345266}];
 for(let layer=0;layer<layers.length;layer++){
   const l=layers[layer];
   // Broad mesas and split escarpments, with flatter shelves between formations.
   const heights=Array.from({length:count},(_,i)=>{
     const group=Math.floor(i/6),v=random(731,group,layer),step=i%6;
     // Alternate broken glacier walls, narrow split peaks and low shelf valleys.
     const profiles=[[.12,.62,.66,.61,.37,.15],[.14,.32,.92,.28,.65,.19],[.1,.25,.29,.27,.21,.12]];
     const profile=profiles[Math.floor(random(199,group,layer)*profiles.length)];
     return l.height*profile[step]*(.65+v*.55);

   });
   const outer=heights.map((height,i)=>project(i/count*circumference,l.base-height));
   g.fillStyle(l.color);g.fillPoints(outer,true);
   for(let i=0;i<count;i++){
     const j=(i+1)%count,x=i/count*circumference,next=(i+1)/count*circumference;
     const p=outer[i],q=outer[j],foot=project(x+(next-x)*.55,l.base-heights[i]*.15);
     if(heights[i]>l.height*.22&&heights[j]>l.height*.22){
       g.fillStyle(l.light,.34);g.fillPoints([p,q,foot],true);
       g.lineStyle(1,l.light,.5);g.strokePoints([p,q],false);
       // Thin snow caps and fractured strata use the same faceted language as ore.
       const capP={x:p.x+(foot.x-p.x)*.07,y:p.y+(foot.y-p.y)*.07};
       const capQ={x:q.x+(foot.x-q.x)*.07,y:q.y+(foot.y-q.y)*.07};
       g.fillStyle(0xabc5cc,layer===0?.28:.15);g.fillPoints([p,q,capQ,capP],true);
       for(const depth of [.32,.57]){
         const a={x:p.x+(foot.x-p.x)*depth,y:p.y+(foot.y-p.y)*depth};
         const b={x:q.x+(foot.x-q.x)*depth,y:q.y+(foot.y-q.y)*depth};
         g.lineStyle(1,l.light,.18);g.strokePoints([a,b],false);
       }
       for(let crack=1;crack<4;crack++){
         const f=crack/4,start={x:p.x+(q.x-p.x)*f,y:p.y+(q.y-p.y)*f};
         const end={x:start.x+(foot.x-start.x)*.5,y:start.y+(foot.y-start.y)*.65};
         g.lineStyle(1,l.light,.17);g.strokePoints([start,end],false);
       }
     }
   }
 }
 // Sparse low ice clusters create a closer scale reference, always behind actors.
 for(let i=0;i<32;i++){
   const u=(i+.35)*circumference/32;
   for(let shard=0;shard<3;shard++){
     const at=u+shard*11,height=12+random(129,i,shard)*25;
     const left=project(at-6,3),tip=project(at+2,-height),right=project(at+8,3),split=project(at+1,1);
     g.fillStyle(0x395c70);g.fillPoints([left,tip,right],true);
     g.fillStyle(0x91b5c3,.3);g.fillPoints([tip,right,split],true);
   }
 }
 // Fine near-surface frost belongs to the world, so it drops away during ascent.
 const atmosphere=Math.max(0,1-altitude/360);
 if(!reduced&&atmosphere>0)for(let i=0;i<48;i++){
   const u=((i/48+time*.0003)%1)*circumference;
   const p=project(u,-12-random(81,i,0)*120+Math.sin(time*.4+i)*7);
   g.fillStyle(0xb9d5df,.25*atmosphere);g.fillCircle(p.x,p.y,1);
   if(i%4===0){const tail=project(u-7,-12-random(81,i,0)*120+Math.sin(time*.4+i)*7);g.lineStyle(1,0xb9d5df,.1*atmosphere);g.strokePoints([tail,p],false);}
 }
}

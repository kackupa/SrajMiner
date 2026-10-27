import { surfaceNests } from '../world/SurfaceTerrain';
import type Phaser from 'phaser';
import {MOTHERSHIP,MAPS,WORLD} from '../config';
import type {TileWorld} from '../world/TileWorld';
import {random} from '../world/TileWorld';
import type {UndergroundStructure} from '../building/UndergroundStructures';
/** Low foreground scenery follows the globe and disappears when its supporting tile is mined. */
export function drawSurfaceGround(g:Phaser.GameObjects.Graphics,world:TileWorld,project:(x:number,y:number)=>{x:number;y:number},visible:(x:number,y:number,pad:number)=>boolean,structures:UndergroundStructure[],time:number,reduced:boolean){
 const T=WORLD.tile,palette=MAPS[world.mapId].surface;
 for(const far of [false,true]){
  const sign=far?-1:1,baseRow=far?world.farSurfaceRow-1:0;
  for(let cell=2;cell<world.widthTiles-2;cell+=3){
   const r=random(world.seed,cell,baseRow,9831),x=(cell+.2+r*1.3)*T;
   const y=world.surfaceHeight(x,far?world.farSurfaceY:0),row=Math.floor((y+sign*2)/T);
   if(r<.12)continue;
   if(!visible(x,y,100)||!world.solid(Math.floor(x/T),row)||(!far&&Math.abs(x-MOTHERSHIP.x)<245)||
      structures.some(s=>Math.abs(s.y-y)<100&&Math.abs(s.x-x)<110))continue;
   const at=(u:number,v:number)=>project(x+u,y-v*sign);
   const poly=(color:number,p:number[][],alpha=1)=>{g.fillStyle(color,alpha);g.fillPoints(p.map(([a,b])=>at(a,b)),true);};
   const line=(color:number,p:number[][],w=1)=>{g.lineStyle(w,color);g.strokePoints(p.map(([a,b])=>at(a,b)),false);};
   const ice=world.mapId==='cryo-shelf',crystal=world.mapId==='prism-fault',wreck=world.mapId==='hull-graveyard';
   const height=8+r*20;
   // Scattered pebbles and a weathered bed anchor every group to the crust.
   for(let n=0;n<4;n++){
    const dx=-24+n*13,h=2+random(world.seed,cell,n,9832)*4;
    poly(palette.mountains[1],[[dx-4,0],[dx-2,h],[dx+3,h*.6],[dx+5,0]]);
    line(palette.edge,[[dx-2,h],[dx+3,h*.6]],.7);
   }
   if(wreck&&r>.4){
    poly(0x344850,[[-16,0],[-13,height],[9,height+4],[17,3]]);
    poly(0x758580,[[-13,height],[9,height+4],[13,height],[0,height-2]]);
    for(let n=0;n<3;n++)line(0xa6966b,[[-9+n*7,3],[-7+n*7,height-2]],1.5);
    line(0x233942,[[-9,3],[12,height-3]],2);
   }else if(ice&&r>.72){
    // Broad fractured slabs break up the sharper crystal clusters.
    poly(0x44626e,[[-25,0],[-22,height*.6],[-5,height],[17,height*.7],[25,0]]);
    poly(0x92b2b7,[[-22,height*.6],[-5,height],[17,height*.7],[3,height*.5]]);
    line(0x243f4b,[[3,0],[3,height*.5],[-5,height]],1.5);
    line(0xb5cbca,[[-22,height*.6],[-5,height],[17,height*.7]],1);
   }else if(ice||crystal){
    for(let n=0;n<3;n++){
     const dx=-12+n*11,h=height*(n===1?1.3:.65);
     poly(ice?0x547782:0x6e6485,[[dx-7,0],[dx-5,h*.6],[dx+1,h],[dx+7,3]]);
     poly(ice?0x9bbabd:0xb8a4cb,[[dx-5,h*.6],[dx+1,h],[dx+2,h*.25],[dx-3,2]],.8);
     line(palette.edge,[[dx+1,h],[dx+7,3]],.8);
    }
   }else{
    poly(palette.mountains[1],[[-18,0],[-15,height*.65],[-5,height],[11,height*.8],[19,3]]);
    poly(palette.mountains[2]??palette.mountains[0],[[-15,height*.65],[-5,height],[11,height*.8],[1,height*.5]]);
    line(palette.edge,[[-15,height*.65],[-5,height],[11,height*.8]],1);
    line(0x263b43,[[-2,2],[1,height*.5],[11,height*.8]],1);
   }
   // Short wind-bent growth adds motion without covering the walking line.
   if(r<.4)for(let n=0;n<3;n++){
    const sway=reduced?0:Math.sin(time*1.7+cell+n)*2,dx=22+n*4;
    line(ice?0x7da4a5:0x87987a,[[dx,0],[dx-1+sway,6+n*2],[dx+2+sway,10+n*2]],1);
   }
  }
 }
 // Chitin bowls and bone spires use the same faceted language as creatures and rock.
 for(const nest of surfaceNests(world)){
  if(!visible(nest.x,nest.y,160))continue;
  const sign=world.gravitySign(nest.y),cleared=world.clearedTerritories.has(nest.id);
  const at=(x:number,y:number)=>project(nest.x+x,nest.y-y*sign);
  const poly=(c:number,p:number[][])=>{g.fillStyle(c);g.fillPoints(p.map(([x,y])=>at(x,y)),true);};
  poly(0x263d46,[[-48,0],[-36,14],[-23,8],[0,4],[23,8],[36,14],[48,0]]);
  for(const d of [-1,1]){
   poly(0x596d6c,[[d*38,0],[d*43,22],[d*33,43],[d*35,19],[d*24,5]]);
   poly(0x9eaa8d,[[d*43,22],[d*33,43],[d*35,26]]);
  }
  if(!cleared)for(let n=0;n<3;n++){
   const x=(n-1)*14,h=12+(reduced?0:Math.sin(time*1.5+n)*1.5);
   poly(0x708878,[[x-7,4],[x-6,h],[x,h+5],[x+7,h],[x+8,4]]);
   g.fillStyle(0xdba064,.65);g.fillCircle(at(x,h).x,at(x,h).y,2);
  }
 }

}

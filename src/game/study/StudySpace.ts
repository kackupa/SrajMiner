import type Phaser from 'phaser';
import { PILOT_STUDY as C, UNIFORM_PLANET_STUDY as P } from '../config';
import type { Point } from './UniformPlanet';

const hash=(x:number,y:number)=>{const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v);};
/** Fixed stars at several depths: motion comes from the ship, never a scrolling photograph. */
export function drawSpaceStars(g:Phaser.GameObjects.Graphics,w:number,h:number,position:Point,angle:number){
 const ca=Math.cos(angle),sa=Math.sin(angle);
 for(let i=15;i>0;i--){g.fillStyle(0x21475c,.012);g.fillEllipse(w*.7-position.x*.006,h*.3-position.y*.004,w*(.35+i*.05),h*(.12+i*.025));}
 for(let layer=0;layer<3;layer++){
  const factor=[.015,.045,.11][layer],spacing=140;
  const px=position.x*factor,py=position.y*factor;
  const extent=Math.ceil(Math.hypot(w,h)/spacing/2)+2;
  for(let x=Math.floor(px/spacing)-extent;x<=Math.floor(px/spacing)+extent;x++)for(let y=Math.floor(py/spacing)-extent;y<=Math.floor(py/spacing)+extent;y++){
   const dx=(x+hash(x,y))*spacing-px,dy=(y+hash(y,x+71))*spacing-py;
   const X=w/2+dx*ca+dy*sa,Y=h*.52-dx*sa+dy*ca;
   if(X<0||X>w||Y<0||Y>h)continue;
   const bright=hash(x+19,y+layer*83);
   g.fillStyle(layer===2?0xd0e7e9:0x7795b0,.2+bright*.55);g.fillCircle(X,Y,.45+bright*(layer===2?1.2:.6));
   if(bright>.97&&layer===2){g.lineStyle(1,0xc6e9ed,.22);g.lineBetween(X-4,Y,X+4,Y);g.lineBetween(X,Y-4,X,Y+4);}
  }
 }
}
const shade=(color:number,k:number)=>{
 const c=(shift:number)=>Math.min(255,Math.round(((color>>shift)&255)*k));
 return (c(16)<<16)|(c(8)<<8)|c(0);
};
/** Original spherical terrain shading, clipped mathematically to the visible hemisphere. */
export function drawSpacePlanet(g:Phaser.GameObjects.Graphics,center:Point,r:number,index:number,w:number,h:number){
 if(center.x+r<0||center.x-r>w||center.y+r<0||center.y-r>h)return;
 const color=C.worlds[index].color;
 for(let halo=4;halo>0;halo--){g.lineStyle(halo*3,color,.035);g.strokeCircle(center.x,center.y,r+halo*3);}
 g.fillStyle(0x10212b);g.fillCircle(center.x,center.y,r);
 const rows=r<50?12:36,cols=r<50?20:64,at=(lat:number,lon:number)=>({x:center.x+Math.cos(lat)*Math.sin(lon)*r,y:center.y+Math.sin(lat)*r});
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const lat=-Math.PI/2+row*Math.PI/rows,lon=-Math.PI/2+col*Math.PI/cols;
  const midLat=lat+Math.PI/rows/2,midLon=lon+Math.PI/cols/2;
  const nx=Math.cos(midLat)*Math.sin(midLon),ny=Math.sin(midLat),nz=Math.cos(midLat)*Math.cos(midLon);
  const light=.16+Math.max(0,-nx*.5-ny*.4+nz*.65)*.95;
  const vein=Math.sin(midLon*9+Math.sin(midLat*11)*.8)+Math.cos(midLat*17+midLon*4)*.5;
  const base=index===0?(Math.abs(midLat)>.85?0xb1cdd0:vein>.25?0x8ba9b3:vein<-.55?0x294b63:0x527d92):(vein>.6?0xc18a58:vein<-.65?0x493a39:0x906346);
  g.fillStyle(shade(base,light));g.fillPoints([at(lat,lon),at(lat,lon+Math.PI/cols),at(lat+Math.PI/rows,lon+Math.PI/cols),at(lat+Math.PI/rows,lon)],true);
 }
 g.lineStyle(1.5,color,.65);g.strokeCircle(center.x,center.y,r);
}
export function spaceMap(position:Point,selected:number){
 const points=[...C.worlds,position],minX=Math.min(...points.map(p=>p.x))-P.radius,maxX=Math.max(...points.map(p=>p.x))+P.radius,minY=Math.min(...points.map(p=>p.y))-P.radius,maxY=Math.max(...points.map(p=>p.y))+P.radius;
 const scale=330/Math.max(maxX-minX,maxY-minY),at=(p:Point)=>({x:200+(p.x-(minX+maxX)/2)*scale,y:200+(p.y-(minY+maxY)/2)*scale});
 const ship=at(position);
 return `<svg viewBox="0 0 400 400" role="img" aria-label="Space chart with both planets and your mothership">${C.worlds.map((p,i)=>{const q=at(p);return `<circle cx="${q.x}" cy="${q.y}" r="${P.radius*scale}" fill="${i?'#805838':'#3d697e'}" stroke="${i===selected?'#efc687':'#6e929e'}" stroke-width="2"/><text x="${q.x}" y="${q.y+P.radius*scale+18}" text-anchor="middle" fill="#c4d9de" font-size="12">${p.name}</text>`;}).join('')}<circle cx="${ship.x}" cy="${ship.y}" r="6" fill="#8cf0d8"/><circle cx="${ship.x}" cy="${ship.y}" r="11" fill="none" stroke="#8cf0d8"/></svg>`;
}

/** One recovery per in-memory expedition, independent of the current planet. */
export class SpaceCache {
 claimed=false;
 near(position:Point){return !this.claimed&&Math.hypot(position.x-C.spaceCache.x,position.y-C.spaceCache.y)<=C.spaceCache.range;}
 take(position:Point){
  if(!this.near(position))return;
  this.claimed=true;
  return {copper:C.spaceCache.copper,iron:C.spaceCache.iron,silver:C.spaceCache.silver,kredits:C.spaceCache.kredits};
 }
}

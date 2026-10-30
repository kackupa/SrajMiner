import { OPENING_EXPEDITION, CAVE_CREATURES, WORLD, depthAtWorldY } from '../config';
import type { TileWorld } from './TileWorld';
const T=WORLD.tile;
export function caveClear(world:TileWorld,x:number,y:number,r:number=CAVE_CREATURES.bodyRadius):boolean {
 if(world.terrain && world.atTerrainSurface(x,y))return false;
 if(x<r || x>world.widthTiles*T-r || y<r || y>world.farSurfaceY-r)return false;
 for(const dx of [-r,0,r])for(const dy of [-r,0,r])if(world.solid(Math.floor((x+dx)/T),Math.floor((y+dy)/T)))return false;
 return true;
}
export function caveSight(world:TileWorld,a:{x:number;y:number},b:{x:number;y:number}):boolean {
 const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/6);
 for(let i=0;i<=n;i++){const k=n?i/n:0;if(!caveClear(world,a.x+(b.x-a.x)*k,a.y+(b.y-a.y)*k,0))return false;}return true;
}
/** Homes use unmodified generation, so mining new tunnels never creates inhabitants. */
export function caveHome(world:TileWorld,sx:number,sy:number) {
 if(world.studyHabitats) return world.studyHabitats.find(h=>Math.floor(h.x/T/CAVE_CREATURES.sectorColumns)===sx&&Math.floor(h.y/T/CAVE_CREATURES.sectorRows)===sy);
 if(world.openingLayout) {
  const a=OPENING_EXPEDITION;
  if(sx===Math.floor(a.nestColumn/CAVE_CREATURES.sectorColumns)&&sy===Math.floor(a.nestRow/CAVE_CREATURES.sectorRows))
   return {id:a.nestColumn+','+a.nestRow,x:(a.nestColumn+.5)*T,y:(a.nestRow+.5)*T};
 }
 for(let y=sy*CAVE_CREATURES.sectorRows+1;y<(sy+1)*CAVE_CREATURES.sectorRows-1;y++)
 for(let x=sx*CAVE_CREATURES.sectorColumns+1;x<(sx+1)*CAVE_CREATURES.sectorColumns-1;x++){
  if(world.openingLayout && x>=12 && x<=47 && y<=22)continue;
  if(x<1||x>=world.widthTiles-1||depthAtWorldY(y*T,world.planetChart)<(world.terrain?40:CAVE_CREATURES.minimumDepth))continue;
  let natural=true;
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)if(world.generate(x+dx,y+dy).type!=='empty')natural=false;
  if(natural&&caveClear(world,(x+.5)*T,(y+.5)*T))return {id:x+','+y,x:(x+.5)*T,y:(y+.5)*T};
 }
 return undefined;
}
/** Bounded four-neighbour route; never cuts a diagonal through a rock corner. */
export function caveStep(world:TileWorld,from:{x:number;y:number},to:{x:number;y:number}) {
 const start={x:Math.floor(from.x/T),y:Math.floor(from.y/T)},goal={x:Math.floor(to.x/T),y:Math.floor(to.y/T)};
 const key=(x:number,y:number)=>x+','+y, queue=[start], previous=new Map<string,string|undefined>([[key(start.x,start.y),undefined]]);
 let found:string|undefined;
 for(let i=0;i<queue.length&&i<CAVE_CREATURES.pathLimit;i++){
  const p=queue[i],k=key(p.x,p.y);
  if(p.x===goal.x&&p.y===goal.y){found=k;break;}
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=p.x+dx,y=p.y+dy,n=key(x,y);
   if(previous.has(n)||!caveClear(world,(x+.5)*T,(y+.5)*T))continue;
   previous.set(n,k);queue.push({x,y});
  }
 }
 if(!found)return undefined;
 const root=key(start.x,start.y);
 while(previous.get(found)&&previous.get(found)!==root)found=previous.get(found)!;
 if(found===root)return to;
 const [x,y]=found.split(',').map(Number);
 return {x:(x+.5)*T,y:(y+.5)*T};
}
export function caveMove(world:TileWorld,body:{x:number;y:number;vx:number;vy:number},x:number,y:number) {
 const dx=x-body.x,dy=y-body.y,n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/4));
 let blocked=false;
 for(let i=0;i<n;i++){
  if(caveClear(world,body.x+dx/n,body.y))body.x+=dx/n;else{body.vx=0;blocked=true;}
  if(caveClear(world,body.x,body.y+dy/n))body.y+=dy/n;else{body.vy=0;blocked=true;}
 }
 return blocked;
}

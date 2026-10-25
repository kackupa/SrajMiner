import { MOTHERSHIP, SURFACE_TERRAIN, WORLD } from '../config';
import type { TileWorld } from './TileWorld';
export type SurfaceTerrain = { heights: number[]; caves: number[]; nests: number[] };
/** Freeze the profile at first load. Never regenerate it from later excavation. */
export function createSurfaceTerrain(world: TileWorld, structures: readonly {x:number;y:number}[] = []): SurfaceTerrain {
 const n=world.widthTiles, heights:number[]=[], protectedCells=new Set<number>();
 const protect=(x:number,far:boolean,radius:number)=>{for(let d=-radius;d<=radius;d++)protectedCells.add(((Math.floor(x/WORLD.tile)+d+(far?n:0))%(n*2)+n*2)%(n*2));};
 protect(MOTHERSHIP.x,false,Math.ceil(SURFACE_TERRAIN.padRadius/WORLD.tile));
 for(const s of structures)protect(s.x,s.y>world.coreWorldY,6);
 // Preserve the complete columns around old workings, not just the empty cells.
 for(const key of world.destroyed){const [x,y]=key.split(',').map(Number);protect((x+.5)*WORLD.tile,y>world.farSurfaceRow/2,3);}
 for(let i=0;i<n*2;i++){
  const wave=(Math.sin(i*Math.PI*2/(n*2)*7+world.seed%19)+Math.sin(i*Math.PI*2/(n*2)*3))*.5;
  heights.push(protectedCells.has(i)?0:Math.max(0,Math.min(SURFACE_TERRAIN.maxRelief,Math.round(2+wave*2))));
 }
 // One-tile transitions, with generous flat shelves for construction.
 for(let pass=0;pass<5;pass++)for(let i=0;i<n*2;i++)heights[i]=Math.min(heights[i],heights[(i+1)%(n*2)]+1,heights[(i+n*2-1)%(n*2)]+1);
 const caves:number[]=[],nests:number[]=[];
 for(let i=30;i<n*2-10;i+=SURFACE_TERRAIN.caveSpacing){
  if(Array.from({length:17},(_,d)=>i+d-8).some(c=>protectedCells.has(c)))continue;
  if(i%n<9||i%n>n-10)continue;
  caves.push(i);nests.push(i+7);
 }
 return {heights,caves,nests};
}
export function terrainIndex(world:TileWorld,x:number,y:number){
 const n=world.widthTiles, crossings=Math.floor(x/WORLD.tile/n), far=(y>world.coreWorldY)!==(Math.abs(crossings)%2===1);
 return ((Math.floor(x/WORLD.tile)%n)+n)%n+(far?n:0);
}
export function terrainHeight(world:TileWorld,x:number,y:number){return world.terrain?.heights[terrainIndex(world,x,y)]??0;}
export function naturalCave(world:TileWorld,x:number,y:number){
 if(!world.terrain)return false;
 const far=y>=world.farSurfaceRow/2, arc=x+(far?world.widthTiles:0), depth=far?world.farSurfaceRow-1-y:y;
 return world.terrain.caves.some(c=>{
  const h=world.terrain!.heights[c],dx=arc-c;
  // A broad open mouth descends into a roofed chamber beside the shaft.
  return (Math.abs(dx)<=1 && depth>=h && depth<=h+7) || ((dx-3)**2/16+(depth-h-7)**2/4<=1);
 });
}
export function surfaceNests(world:TileWorld){return (world.terrain?.nests??[]).map(i=>{
 const x=(i%world.widthTiles+.5)*WORLD.tile, far=i>=world.widthTiles;
 return {id:String(i),x,y:world.surfaceHeight(x,far?world.farSurfaceY:0)};
});}

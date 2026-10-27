import { WORLD, WORK_LAMP } from '../config';
import type { TileWorld } from './TileWorld';
import { planetChartToCartesian, planetCartesianToChart } from './PlanetChart';
type Point={x:number;y:number};
/** Rays reveal open space and the first rock face, never ore behind a wall. */
export function traceWorkLamp(world:TileWorld,from:Point,aim:Point,range=WORK_LAMP.range) {
 const chart=world.planetChart,T=WORLD.tile;
 const cart=(p:Point)=>chart?planetChartToCartesian({u:p.x/T,v:p.y/T},chart.columns,chart.radiusRows,T):p;
 const uncart=(p:Point)=>{if(!chart)return p;const q=planetCartesianToChart(p,chart.columns,chart.radiusRows,T);return {x:q.u*T,y:q.v*T};};
 const origin=cart(from),target=cart(aim),angle=Math.atan2(target.y-origin.y,target.x-origin.x);
 const lit=new Set<string>(),ends:Point[]=[];
 for(let r=0;r<=WORK_LAMP.rays;r++){
  const a=angle-WORK_LAMP.halfAngle+r/WORK_LAMP.rays*WORK_LAMP.halfAngle*2;
  let end=from;
  for(let d=WORK_LAMP.step;d<=range;d+=WORK_LAMP.step){
   end=uncart({x:origin.x+Math.cos(a)*d,y:origin.y+Math.sin(a)*d});
   const tile=world.get(Math.floor(end.x/T),Math.floor(end.y/T));
   if(tile.y>=0 && tile.y<world.farSurfaceRow && tile.type!=='boundary')lit.add(tile.x+','+tile.y);
   if(tile.type!=='empty')break;
  }
  ends.push(end);
 }
 return {lit,ends};
}

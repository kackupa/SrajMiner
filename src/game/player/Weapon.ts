import { WORLD } from '../config';
import type { TileWorld } from '../world/TileWorld';
import { planetChartToCartesian, planetCartesianToChart } from '../world/PlanetChart';
type Point = { x: number; y: number };
export function weaponRay(world: TileWorld, from: Point, aim: Point, range: number, targets: Point[]) {
 const chart=world.planetChart;
 const cart=(p: Point)=>chart?planetChartToCartesian({u:p.x/WORLD.tile,v:p.y/WORLD.tile},chart.columns,chart.radiusRows,WORLD.tile):p;
 const uncart=(p: Point)=>{if(!chart)return p;const q=planetCartesianToChart(p,chart.columns,chart.radiusRows,WORLD.tile);return {x:q.u*WORLD.tile,y:q.v*WORLD.tile};};
 const origin=cart(from), dest=cart(aim), len=Math.hypot(dest.x-origin.x,dest.y-origin.y)||1, dx=(dest.x-origin.x)/len,dy=(dest.y-origin.y)/len;
 const enemies=targets.map(cart); let end=from;
 for(let step=6;step<=range;step+=6){
  const point={x:origin.x+dx*step,y:origin.y+dy*step};end=uncart(point);
  if(world.solid(Math.floor(end.x/WORLD.tile),Math.floor(end.y/WORLD.tile)))return {end,hit:-1};
  const hit=enemies.findIndex(e=>Math.hypot(e.x-point.x,e.y-point.y)<20);
  if(hit>=0)return {end,hit};
 }
 return {end,hit:-1};
}

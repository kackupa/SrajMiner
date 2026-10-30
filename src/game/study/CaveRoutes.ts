import { SURFACE_EXPEDITION as E, UNIFORM_COMBAT as C } from '../config';
import type { Point, UniformPlanet } from './UniformPlanet';

export function clearCreaturePath(world:UniformPlanet,a:Point,b:Point){
 const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/4));
 for(let i=1;i<=n;i++)if(world.collides({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},C.enemyRadius))return false;
 return true;
}
/** Bounded search through real open space, constrained to floors and short
 * vaults. Rebuilt after excavation; never tunnels through solid cells. */
export function caveRoute(world:UniformPlanet,start:Point,goal:Point):Point[]{
 type Node=Point&{key:string;parent?:Node};
 const first:Node={...start,key:'0,0'},queue=[first],seen=new Set([first.key]);
 let best=first,bestDistance=Math.hypot(goal.x-start.x,goal.y-start.y);
 for(let head=0;head<queue.length&&head<1300;head++){
  const node=queue[head],distance=Math.hypot(goal.x-node.x,goal.y-node.y);
  if(distance<bestDistance){best=node;bestDistance=distance;}if(distance<28)break;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const next={x:node.x+dx*E.routeStep,y:node.y+dy*E.routeStep},r=Math.hypot(next.x,next.y);
   const key=`${Math.round((next.x-start.x)/E.routeStep)},${Math.round((next.y-start.y)/E.routeStep)}`;
   if(seen.has(key)||Math.hypot(next.x-start.x,next.y-start.y)>E.routeRange)continue;
   seen.add(key);
   if(r>world.surfaceRadiusAt(next)-10||!clearCreaturePath(world,node,next))continue;
   // Don't plan floating routes across tall shafts. Short unsupported arcs are vaults.
   if(![16,32,48,64].some(d=>world.collides({x:next.x-next.x/r*d,y:next.y-next.y/r*d},C.enemyRadius)))continue;
   queue.push({...next,key,parent:node});
  }
 }
 const path:Point[]=[];let n:Node|undefined=best;
 while(n?.parent){path.unshift({x:n.x,y:n.y});n=n.parent;}
 return path;
}

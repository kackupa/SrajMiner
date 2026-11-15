import type { UniformCell } from './UniformPlanet';

/** Stable, branching impact scars, contained inside the real rock polygon. */
export function studyFractures(cell:UniformCell,weakening:number) {
 if(weakening<=0)return [];
 const vertices=cell.polygon,centre={x:vertices.reduce((n,p)=>n+p.x,0)/vertices.length,y:vertices.reduce((n,p)=>n+p.y,0)/vertices.length};
 const count=Math.min(6,Math.ceil(weakening*8));
 return Array.from({length:count},(_,i)=>{
  const a=vertices[(i+Math.abs(cell.x+cell.y))%vertices.length],b=vertices[(i+1+Math.abs(cell.x+cell.y))%vertices.length];
  const end={x:a.x*.7+b.x*.3,y:a.y*.7+b.y*.3},length=Math.min(.94,.3+weakening);
  return [centre,{x:centre.x+(end.x-centre.x)*.45+(b.x-a.x)*.07,y:centre.y+(end.y-centre.y)*.45+(b.y-a.y)*.07},{x:centre.x+(end.x-centre.x)*length,y:centre.y+(end.y-centre.y)*length}];
 });
}

type Point={x:number;y:number};
const smooth=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};

/** Closest point on the real clipped cell boundary, not its buried centre. */
export function clawRockContact(polygon:Point[],origin:Point):Point {
 let nearest={...origin},distance=Infinity;
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],dx=b.x-a.x,dy=b.y-a.y;
  const t=Math.max(0,Math.min(1,((origin.x-a.x)*dx+(origin.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  const p={x:a.x+dx*t,y:a.y+dy*t},d=Math.hypot(p.x-origin.x,p.y-origin.y);
  if(d<distance){distance=d;nearest=p;}
 }
 return nearest;
}

/** Reach, close the fingers, then load the elbow against the rock. No mining rules. */
export function clawTearGoal(contact:Point&{angle:number},progress:number){
 const pull=smooth((progress-.4)/.6),open=1-.88*smooth((progress-.12)/.35);
 const reach=Math.hypot(contact.x,contact.y),withdraw=Math.min(5,Math.max(0,reach-8))*pull;
 return {goal:{x:contact.x-Math.cos(contact.angle)*withdraw,y:contact.y-Math.sin(contact.angle)*withdraw,angle:contact.angle,holding:false},pull,open,angle:contact.angle};
}

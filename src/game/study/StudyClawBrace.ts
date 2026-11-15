import type {Point} from './UniformPlanet';
type Rock={solidAt:(p:Point)=>boolean};
type Contact={point:Point;support:Point;latched:boolean};
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
/** A world-space support point. Never moves terrain or constrains the miner. */
export class StudyClawBrace {
 contact?:Contact;
 update(rock:Rock,origin:Point,direction:Point,active:boolean){
  if(!active){this.contact=undefined;return;}
  if(this.contact){
   const d=distance(origin,this.contact.point);
   if(d>=16&&d<=32&&rock.solidAt(this.contact.support)&&this.clear(rock,origin,this.contact.point))return this.contact;
   this.contact=undefined;
  }
  if(rock.solidAt(origin))return;
  const a=Math.atan2(direction.y,direction.x);
  // Prefer support beside the cut; stop at the first rock on each ray.
  for(const offset of [.28,-.28,.55,-.55,0,.9,-.9,1.3,-1.3]){
   const dx=Math.cos(a+offset),dy=Math.sin(a+offset);
   for(let d=2;d<=32;d++){
    const support={x:origin.x+dx*d,y:origin.y+dy*d};
    if(!rock.solidAt(support))continue;
    if(d>=17)this.contact={point:{x:support.x-dx*1.1,y:support.y-dy*1.1},support,latched:false};
    break;
   }
   if(this.contact)return this.contact;
  }
 }
 private clear(rock:Rock,a:Point,b:Point){
  const n=Math.ceil(distance(a,b));
  for(let i=1;i<n;i++)if(rock.solidAt({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;
  return true;
 }
}

import { POD_PAINTS, PILOT_SUITS, POD_PROFILES, POD_DECALS } from '../config';
import type { Progress } from '../economy/Progress';
import { restingVehiclePose, type VehiclePose } from './VehiclePose';

export type RigMark =
 | {kind:'poly';color:number;points:number[][];alpha:number}
 | {kind:'line';color:number;points:number[][];width:number;alpha:number}
 | {kind:'circle';color:number;x:number;y:number;r:number;alpha:number};

export function minerBodyOffset(p:Progress,pose:VehiclePose) {
 return pose.landing*4+pose.drill*1.8+Math.sin(pose.phase*2)*.25+Math.abs(Math.sin(pose.phase*10))*pose.stride*.9+pose.fire*.6+(p.loadout.fitted.hull==='bastion'?2:p.loadout.fitted.hull==='scout'?-2:0);
}

export function minerLampSocket(p:Progress,pose:VehiclePose) {
 const length=Math.hypot(pose.lookX,pose.lookY)||1,dx=pose.lookX/length,dy=pose.lookY/length;
 const pivot={x:-16,y:-26+minerBodyOffset(p,pose)};
 return {pivot,dx,dy,lens:{x:pivot.x+dx*6,y:pivot.y+dy*6}};
}

/** Original articulated interpretation of the approved lamp/cockpit concept.
 * Coordinates are presentation only; fitting never changes the collision body. */
export function conceptMiner(p: Progress, pose: VehiclePose = restingVehiclePose(), aim?: {x:number;y:number}, unload?:{age:number;kick:number}, emptyCockpit=false): RigMark[] {
 const out:RigMark[]=[];
 const poly=(color:number,points:number[][],alpha=1)=>out.push({kind:'poly',color,points,alpha});
 const line=(color:number,points:number[][],width=1,alpha=1)=>out.push({kind:'line',color,points,width,alpha});
 const dot=(color:number,x:number,y:number,r:number,alpha=1)=>out.push({kind:'circle',color,x,y,r,alpha});
 const box=(c:number,x:number,y:number,w:number,h:number)=>poly(c,[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
 const paint=POD_PAINTS[p.selectedPaint], suit=PILOT_SUITS[p.selectedSuit], f=p.loadout.fitted;
 const amber=p.selectedPaint==='hab'?0xd99a3b:paint.hull, light=p.selectedPaint==='hab'?0xf5c86e:paint.trim;
 const profile=POD_PROFILES[p.selectedProfile], decal=POD_DECALS[p.selectedDecal];
 const dark=0x102431, metal=0x55717a, steel=0xb3c2bb, cream=0xf1dfb1;
 const heavy=f.hull==='bastion', cargo=f.hull==='hauler', scout=f.hull==='scout';
 const bounce=pose.landing*4;
 const bodyY=minerBodyOffset(p,pose);
 const body=(pts:number[][])=>pts.map(([x,y])=>[x,y+bodyY]);
 // Back-mounted stock and exposed engine block.
 box(dark,-12,-17,25,31);
 if(cargo) {
  for(const [x,y] of [[-23,-21],[-23,-10],[16,-24]]) {
   box(dark,x-1,y-1,12,12);box(amber,x,y,10,10);box(cream,x+3,y,2,10);line(0x76532c,[[x,y+7],[x+10,y+7]],1);
  }
 }
 if(f.battery!=='standard-cell') {
  const count=f.battery==='industrial-cell'?3:2;
  for(let i=0;i<count;i++){box(dark,-4+i*5,-26,5,10);box(metal,-3+i*5,-25,3,8);box(0x80d8cc,-3+i*5,-24,3,3);}
 }
 // Independent hip, knee and ankle articulation: brace, fold, compress.
 for(const side of [-1,1]) {
  const hipX=side*(heavy?11:9), hipY=6+bodyY;
  const step=pose.stride*Math.sin(pose.phase*10+side*Math.PI);
  const kneeX=side*((heavy?18:scout?14:16)+pose.drill*1.5), kneeY=14-pose.gear*5+bounce*.4+step*1.6;
  const footX=side*((heavy?23:scout?18:21)+pose.drill*2)-pose.gear*side*7+step*3;
  const footY=(scout?28:heavy?23:25)-pose.gear*9-Math.max(0,step)*4;
  line(dark,[[hipX,hipY],[kneeX,kneeY],[footX,footY]],8);
  line(steel,[[kneeX,kneeY],[footX,footY-2]],2.8);
  line(0x243c48,[[hipX-side*2,hipY+2],[footX-side*2,footY-2]],2);
  poly(amber,[[hipX-5,hipY-3],[hipX+5,hipY-3],[kneeX+4,kneeY+2],[kneeX-4,kneeY+3]]);
  line(light,[[hipX-3,hipY-3],[hipX+4,hipY-3],[kneeX+3,kneeY]],1);
  dot(dark,hipX,hipY,5);dot(metal,hipX,hipY,3.6);dot(steel,hipX,hipY,1.4);
  dot(dark,kneeX,kneeY,3.8);dot(amber,kneeX,kneeY,2.5);dot(steel,kneeX,kneeY,1);
  poly(dark,[[footX-6,footY-3],[footX+4,footY-3],[footX+8,footY],[footX+8,footY+2],[footX-7,footY+2]]);
  poly(metal,[[footX-5,footY-3],[footX+3,footY-3],[footX+6,footY],[footX-6,footY]]);
  line(cream,[[footX-4,footY-2],[footX+2,footY-2]],1);
  if(pose.lift>.45) {
   const flame=(pose.lift-.4)*18, flutter=Math.sin(pose.phase*37+side)*2;
   const color=f.engine==='efficient-engine'?0x79dfc9:0xffb65e;
   poly(color,[[kneeX-3,kneeY+3],[kneeX+3,kneeY+3],[kneeX+2,kneeY+8],[kneeX,kneeY+8+flame+flutter],[kneeX-2,kneeY+8]],.8);
   poly(0xf0ffff,[[kneeX-1.5,kneeY+3],[kneeX+1.5,kneeY+3],[kneeX,kneeY+9+flame*.4]]);
  }
  if(f.engine==='lift-engine'){box(dark,kneeX-4,kneeY-3,8,7);box(steel,kneeX-3,kneeY-2,6,2);box(amber,kneeX-3,kneeY+1,6,2);}
  else if(f.engine==='efficient-engine')for(let n=0;n<3;n++)line(0x7dcbbd,[[kneeX-3,kneeY-3+n*2],[kneeX+3,kneeY-3+n*2]],1);
 }
 // Asymmetric sloped pressure cabin, offset right of the drive chassis.
 poly(dark,body([[-17,-16],[-10,-23],[7,-23],[17,-15],[20,1],[14,12],[-8,12],[-17,4]]));
 poly(amber,body([[-15,-15],[-9,-21],[5,-21],[15,-14],[17,1],[12,9],[-7,10],[-15,3]]));
 poly(light,body([[-14,-15],[-9,-21],[5,-21],[10,-17],[-5,-17],[-9,-10]]));
 poly(0x9b672e,body([[-15,-5],[-8,-7],[-4,9],[-9,9],[-15,3]]));
 poly(cream,body([[-13,-10],[-8,-10],[-4,3],[-9,3]]));
 line(dark,body([[-11,6],[-5,6],[-3,9]]),1.5);
 // Dark inset panoramic cockpit, chamfered hood rather than a square face.
 poly(dark,body([[-1,-19],[7,-18],[14,-12],[16,-1],[11,5],[0,4],[-4,-3],[-4,-14]]));
 poly(0x345466,body([[0,-17],[6,-16],[12,-11],[14,-2],[10,3],[1,2],[-2,-4],[-2,-13]]));
 poly(profile.cabin,body([[0,-16],[5,-15],[8,-12],[0,-8]]),.7);
 // Visible operator and controls follow travel.
 const look=pose.lookX*1.8, lean=pose.bank*5-pose.fire*1.5;
 if(!emptyCockpit){
 poly(suit.body,body([[3+look,-4],[7+look,-4],[10+lean,1],[1+lean,1]]));
 dot(suit.trim,5+look,-8+bodyY+pose.lookY*1.3,3.2);
 poly(dark,body([[3+look,-9+pose.lookY*1.3],[7+look,-9+pose.lookY*1.3],[8+look,-6+pose.lookY*1.3],[3+look,-6+pose.lookY*1.3]]));
 line(0xc6ece8,body([[3.5+look,-8.5+pose.lookY*1.3],[6+look,-8.5+pose.lookY*1.3]]),.7);
 line(suit.trim,body([[3,-2],[0+lean,-3],[0+lean,-5]]),1.6);
 line(suit.trim,body([[7,-2],[10+lean,-3],[10+lean,-5]]),1.6);
 }
 line(steel,body([[0,-5],[0,-2],[10,-2],[10,-5]]),.8);
 line(cream,body([[-1,-18],[7,-17],[13,-11],[15,-1],[11,4]]),1.1);
 poly(0xe1f5eb,body([[0,-15],[2,-14],[6,-4],[4,-5]]),.15);
 // Grilles, rivets, restrained wear and fleet stripe.
 box(dark,-2,6+bodyY,10,3);box(0x78d8d1,-1,6.5+bodyY,7,1.5);
 for(let n=0;n<3;n++)line(dark,body([[-12+n*2,-2],[-11+n*2,2]]),.9);
 for(const [u,v]of [[-12,-13],[-8,7],[12,6],[8,-20]]){dot(dark,u,v+bodyY,.8);dot(steel,u-.2,v-.2+bodyY,.35);}
 line(cream,body([[-12,-17],[-9,-19]]),.7);
 line(dark,body([[-12,4],[-10,5],[-8,4]]),.7);
 if(decal.style==='stripe')line(decal.color,body([[-12,-11],[-8,-11],[-5,-4]]),1.5);
 else if(decal.style==='crest')poly(decal.color,body([[-9,-12],[-6,-10],[-9,-7],[-12,-10]]));
 else if(decal.style==='arrow')line(decal.color,body([[-12,-10],[-7,-10],[-9,-12],[-7,-10],[-9,-8]]),1.2);
 else {dot(decal.color,-10,-10+bodyY,1);dot(decal.color,-7,-7+bodyY,1);}
 if(profile.style==='armor')line(steel,body([[-15,-7],[-12,3],[-7,7]]),2);
 if(profile.style==='stabilizers')poly(metal,body([[14,-17],[23,-22],[19,-8],[16,-6]]));
 if(profile.style==='antenna'){line(steel,body([[9,-21],[9,-31],[13,-32]]),1);dot(paint.light,13,-32+bodyY,1);}
 if(p.grappleOwned){dot(dark,17,-12+bodyY,3);line(steel,body([[17,-14],[20,-12],[17,-9]]),1);}
 if(p.salvageMagnet)line(0x83d9c5,body([[-11,9],[-11,13],[-6,13],[-6,9]]),1.5);
 if(p.returnWinch){dot(dark,-7,6+bodyY,3);dot(steel,-7,6+bodyY,1.6);}
 if(p.stasisModule)dot(0x80dcf0,12,7+bodyY,1.6);
 // Motorised yoke and cylindrical lamp rotate as one assembly with the beam.
 const lamp=minerLampSocket(p,pose);
 const lampAt=(along:number,across:number)=>[lamp.pivot.x+lamp.dx*along-lamp.dy*across,lamp.pivot.y+lamp.dy*along+lamp.dx*across];
 line(dark,body([[-11,-18],[-16,-23]]),4);
 line(steel,body([[-11,-18],[-16,-23]]),1.5);
 dot(dark,lamp.pivot.x,lamp.pivot.y,4);
 poly(dark,[lampAt(-7,-6),lampAt(5,-8),lampAt(8,-6),lampAt(8,6),lampAt(5,8),lampAt(-7,6)]);
 poly(amber,[lampAt(-6,-5),lampAt(4,-7),lampAt(6,-5),lampAt(6,5),lampAt(4,7),lampAt(-6,5)]);
 line(light,[lampAt(-5,-5),lampAt(4,-6)],1.3);
 // An elliptical lens exposes the barrel's pitch clearly even at gameplay scale.
 const lensRing=(depth:number,height:number)=>Array.from({length:16},(_,i)=>lampAt(6+Math.cos(i*Math.PI/8)*depth,Math.sin(i*Math.PI/8)*height));
 poly(metal,lensRing(3,7));
 poly(0xffd782,lensRing(2.2,5.8));
 poly(0xfff2c9,lensRing(1.3,4));
 line(0x97764c,[lampAt(6,-6),lampAt(6,6)],.8);
 line(0x97764c,[lampAt(4,-2),lampAt(8,-2)],.8);
 line(0x97764c,[lampAt(4,2),lampAt(8,2)],.8);
 dot(dark,lamp.pivot.x-2,lamp.pivot.y+3,2.2);
 dot(steel,lamp.pivot.x-2,lamp.pivot.y+3,1.1);
 if(heavy) {
  poly(dark,body([[-20,-13],[-14,-17],[-9,-10],[-6,8],[-15,13],[-22,3]]));
  poly(0x6e8184,body([[-19,-12],[-15,-14],[-11,-9],[-8,6],[-15,10],[-20,2]]));
  poly(amber,body([[-19,-12],[-15,-14],[-11,-9],[-13,-4],[-21,-3]]));
  poly(metal,body([[13,3],[21,0],[21,10],[12,14],[4,11]]));
  line(cream,body([[14,5],[19,4]]),1.5);
 }
 if(scout){line(metal,body([[12,-20],[13,-33]]),1);dot(cream,13,-33+bodyY,1);}
 if(f.utility==='cargo-rack'){box(dark,-10,9+bodyY,19,6);for(let n=0;n<3;n++){box(amber,-9+n*6,10+bodyY,5,4);box(cream,-7+n*6,10+bodyY,1,4);}}
 if(f.utility==='survey-array'){
  line(steel,body([[12,-18],[13,-36]]),1.3);
  const sweep=Math.sin(pose.phase*1.8)*3;
  poly(amber,body([[7,-36],[20,-36],[16+sweep,-31],[12+sweep,-31]]));
  line(cream,body([[7,-36],[20,-36]]),1);
 }
 // Small modular opposite arm. Each weapon has a distinct silhouette.
 line(dark,body([[15,-7],[23,-3],[23,6]]),5);dot(metal,20,-4+bodyY,3);
 if(f.weapon==='unarmed'){
  box(amber,20,-2+bodyY,6,6);line(steel,body([[21,4],[20,9],[22,10]]),1.6);line(steel,body([[25,4],[27,8],[25,10]]),1.6);
 }else{
  const len=Math.hypot(pose.lookX,pose.lookY)||1, wx=pose.lookX/len,wy=pose.lookY/len;
  const origin=[21+wx*4-wx*pose.fire*3,-3+bodyY+wy*7-wy*pose.fire*3];
  const elbow=[22-wy*3,2+bodyY+wy*3];
  line(dark,[[15,-7+bodyY],elbow,origin],6);
  line(metal,[[15,-7+bodyY],elbow,origin],3);
  dot(amber,elbow[0],elbow[1],2.5);
  dot(steel,origin[0],origin[1],2);
  const gun=(along:number,across:number)=>[origin[0]+wx*along-wy*across,origin[1]+wy*along+wx*across];
  poly(dark,[gun(-4,-5),gun(7,-5),gun(9,4),gun(-4,4)]);
  poly(amber,[gun(-3,-4),gun(5,-4),gun(5,3),gun(-3,3)]);
  const length=f.weapon==='autocannon'?19:16;
  for(const offset of f.weapon==='machine-gun'?[-2,2]:[0]){
   line(f.weapon==='beam-laser'?0x91efdf:steel,[gun(4,offset),gun(length,offset)],f.weapon==='autocannon'?4:1.8);
  }
  line(dark,[gun(length,-3),gun(length,3)],2);
  if(pose.fire>.2)dot(f.weapon==='beam-laser'?0x91efdf:0xffd78d,...gun(length+2,0) as [number,number],2+pose.fire*2,.85);

 }
 // Shoulder -> elbow -> wrist, followed by the actual aimed rotary cutting head.
 const target=aim??{x:-.5,y:.866}, active=pose.drill;
 const dir={x:-.5*(1-active)+target.x*active,y:.866*(1-active)+target.y*active}, norm=Math.hypot(dir.x,dir.y)||1;
 const dx=dir.x/norm,dy=dir.y/norm,px=-dy,py=dx;
 const shoulder=[-15,-7+bodyY], elbow=[-23+dx*4,3+bodyY+pose.drill*2];
 const reach=17+pose.drill*7-pose.gear*4;
 const wrist=[dx*reach,dy*reach+bodyY];
 line(dark,[shoulder,elbow,wrist],7);line(metal,[shoulder,elbow,wrist],4);
 line(steel,[[shoulder[0]+2,shoulder[1]+2],[elbow[0]+2,elbow[1]+2],[wrist[0]+px*2,wrist[1]+py*2]],1.3);
 for(const pt of [shoulder,elbow,wrist]){dot(dark,pt[0],pt[1],4);dot(amber,pt[0],pt[1],2.8);dot(steel,pt[0],pt[1],1.1);}
 const wide=f.drill==='excavator'?7:f.drill==='precision'?3:5;
 const length=f.drill==='precision'?17:f.drill==='excavator'?16:14;
 const drill=(along:number,across:number)=>[wrist[0]+dx*along+px*across,wrist[1]+dy*along+py*across];
 poly(dark,[drill(-2,-wide-1),drill(-2,wide+1),drill(length+2,0)]);
 poly(f.drill==='precision'?0x86cfc7:steel,[drill(0,-wide),drill(0,wide),drill(length,0)]);
 const rotation=pose.drill>0.01?(pose.phase*14)%1:0;
 for(let i=0;i<4;i++){
  const t=(i+rotation)/4, a=t*length, w=wide*(1-t);
  line(i%2?cream:metal,[drill(a-1,-w),drill(a+2,w)],1.7);
 }
 if(unload && unload.age<1.5){
   const open=Math.min(1,unload.age/.22,Math.max(0,(1.5-unload.age)/.25));
   box(dark,9,-22+bodyY,15,12);box(metal,11,-20+bodyY,10,8);
   poly(amber,[[9,-22+bodyY],[24,-22+bodyY],[24+open*6,-22+bodyY-open*10],[9+open*3,-22+bodyY-open*10]]);
   line(steel,[[10,-20+bodyY],[12+open*3,-25+bodyY-open*5]],1.5);
   box(cream,13,-17+bodyY-unload.kick*3,7,5);dot(0x8ce2bc,23,-16+bodyY,1.5);
 }
 return out;
}

export function conceptSvg(p:Progress) {
 const hex=(v:number)=>'#'+v.toString(16).padStart(6,'0');
 return conceptMiner(p).map(s=>s.kind==='circle'
  ? `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${hex(s.color)}" opacity="${s.alpha}"/>`
  : s.kind==='line'
  ? `<polyline points="${s.points.map(pt=>pt.join(',')).join(' ')}" fill="none" stroke="${hex(s.color)}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${s.alpha}"/>`
  : `<polygon points="${s.points.map(pt=>pt.join(',')).join(' ')}" fill="${hex(s.color)}" opacity="${s.alpha}"/>`).join('');
}

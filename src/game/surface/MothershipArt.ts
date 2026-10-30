import { cargoPhase, UNLOAD_DURATION } from './CargoHandling';
import { drawStudyTurret } from '../study/StudyTurret';
import { drawVolume } from '../study/StudyVolume';
import type Phaser from 'phaser';
import type { VehiclePose } from '../player/VehiclePose';
import { landingFoot, type LandingSurface } from './LandingGear';
export type ShipActivity = { landingSurface?:LandingSurface; dimensional?:boolean; vectorThrusters?:boolean; unload?: {age:number;source:{x:number;y:number};count:number;sources?:{x:number;y:number}[]}; time: number; target?: {x:number;y:number}; firing?: boolean; shotAge?: number; reduced?: boolean };
/** Workhorse: asymmetric expedition carrier. Shared by world and transit presentation. */
export function drawMothership(g: Phaser.GameObjects.Graphics, project:(x:number,y:number)=>{x:number;y:number}, thrust:boolean, motion?:VehiclePose, activity?:ShipActivity) {
 const t=activity?.reduced?0:activity?.time??motion?.phase??0, gear=motion?.gear??0;
 const docked=1-gear;
 const bank=(motion?.bank??0)*.45,c=Math.cos(bank),s=Math.sin(bank);
 const at=(x:number,y:number)=>project((x*c-(y+58)*s)*1.5,(-58+x*s+(y+58)*c)*1.5);
 const poly=(color:number,p:number[][],a=1)=>{g.fillStyle(color,a);g.fillPoints(p.map(([x,y])=>at(x,y)),true);};
 const box=(x:number,y:number,w:number,h:number,color:number)=>poly(color,[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
 const solid=(color:number,p:number[][],depth:number,sideColor=color)=>{
   if(activity?.dimensional)drawVolume(g,p,depth,(x,y,z)=>at(x-z*.5,y+z*.38),sideColor);
   poly(color,p);
 };
 const module=(x:number,y:number,w:number,h:number,color:number,depth=8)=>solid(color,[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],depth);
 const line=(p:number[][],color:number,w=1,a=1)=>{g.lineStyle(w,color,a);g.strokePoints(p.map(([x,y])=>at(x,y)),false);};
 const dot=(x:number,y:number,r:number,color:number,a=1)=>{const p=at(x,y);g.fillStyle(color,a);g.fillCircle(p.x,p.y,r*1.5);};
 const dark=0x10232d, steel=0x586e70, edge=0xa8b6a7, amber=0xb77a32, gold=0xe7b65e;
 // Exhaust rises independently from the hull, with a bounded number of particles.
 for(const x of [-110,65])for(let i=0;i<5;i++){const q=(t*.22+i/5)%1;dot(x+Math.sin(q*5+x)*5,-86-q*45,3+q*9,0x97abb1,(1-q)*.11);}
 poly(0x020e16,[[-145,0],[-94,-9],[105,-9],[154,2],[92,8],[-100,7]],.45);
 for(const x of [-102,-64,65,106]){
 const landing=landingFoot(x,gear,activity?.landingSurface),foot=landing.x,y=landing.y;
 line([[x,-47],[foot-8,-23],[foot,y]],dark,10);line([[x,-43],[foot,y]],edge,3);
 poly(steel,[[x-9,-48],[x+8,-48],[foot+6,-23],[foot-7,-25]]);
 if(activity?.landingSurface){poly(dark,[landing.pad(-13,-5),landing.pad(14,-5),landing.pad(14,0),landing.pad(-13,0)]);line([landing.pad(-12,-5),landing.pad(12,-5)],gold,2);}
 else {box(foot-13,y,27,5,dark);line([[foot-12,y],[foot+12,y]],gold,2);}
 dot(x,-42,3.4,dark);dot(x,-42,1.5,edge);
 line([[x+3,-38],[foot+3,y-5]],0xd4d2bb,1.5);
 if(!activity?.landingSurface){box(foot-9,y+2,5,2,steel);box(foot+5,y+2,5,2,steel);}
 }
 // Articulated landing struts show piston sleeves, clevis joints and broad foot pads.
 for(const x of [-102,106]){
   const landing=landingFoot(x,gear,activity?.landingSurface),foot=landing.x,y=landing.y;
   line([[x,-37],[foot,y-6]],dark,7);
   line([[x,-37],[x+(foot-x)*.55,-37+(y+31)*.55]],steel,5);
   line([[x+(foot-x)*.5,-37+(y+31)*.5],[foot,y-6]],0xd4d2bb,2);
   dot(foot,y-5,3,dark);dot(foot,y-5,1.5,gold);
   if(activity?.landingSurface){
     poly(edge,[landing.pad(-15,-5),landing.pad(-11,-8),landing.pad(18,-8),landing.pad(14,-5)]);
     poly(steel,[landing.pad(-15,-5),landing.pad(14,-5),landing.pad(18,0),landing.pad(-18,0)]);
     line([landing.pad(-18,0),landing.pad(18,0)],dark,1.5);
     for(let n=-10;n<=10;n+=5)line([landing.pad(n,-4),landing.pad(n-2,-1)],dark,1);
   }else{
     solid(steel,[[foot-15,y],[foot+14,y],[foot+18,y+5],[foot-18,y+5]],9);
     for(let n=-10;n<=10;n+=5)line([[foot+n,y+1],[foot+n-2,y+4]],dark,1);
   }
 }
 // Cargo spine and angular amber bow preserve the selected concept's silhouette.
 solid(dark,[[-143,-75],[-117,-93],[85,-91],[148,-72],[134,-31],[-126,-31]],30,steel);
 if(activity?.dimensional){
   line([[-102,-104],[100,-102],[162,-83]],edge,1.3);
   for(let i=0;i<6;i++){const x=-76+i*28;line([[x,-92],[x+13,-102]],0x263e48,2);line([[x+2,-92],[x+15,-102]],0x8c9d92,1);}
   // Two recessed ducts across the upper deck, with grilles inside their rims.
   for(const x of [-57,23]){poly(0x233b43,[[x,-95],[x+27,-95],[x+36,-101],[x+9,-101]]);for(let j=0;j<5;j++)line([[x+3+j*5,-96],[x+9+j*5,-100]],steel,1);}
 }
 poly(steel,[[-139,-73],[-115,-88],[85,-86],[137,-69],[123,-39],[-124,-38]]);
 poly(edge,[[-115,-88],[85,-86],[116,-77],[-130,-77]]);
 poly(amber,[[78,-87],[123,-83],[151,-67],[138,-41],[110,-35],[95,-61]]);
 poly(gold,[[80,-87],[123,-83],[151,-67],[143,-64],[117,-77],[84,-78]]);
 line([[101,-70],[135,-64],[124,-48],[111,-46]],dark,3);
 for(let i=0;i<5;i++){const x=-69+i*29;module(x,-75,25,28,i%2?0x657b78:0x485e60,8);line([[x,-75],[x+24,-75],[x+24,-49]],edge);box(x+3,-58,17,6,dark);dot(x+20,-69,1,gold);}
 // Recessed panel joints, bolted ribs, service vents and worn edge strips.
 for(let i=0;i<5;i++){
   const x=-69+i*29;
   line([[x+2,-72],[x+21,-72],[x+21,-62]],0x20383d,1);
   for(const y of [-71,-52])for(const dx of [3,22])dot(x+dx,y,.75,0xc8c8ad);
   for(let v=0;v<4;v++)box(x+5+v*4,-56,2,3,0x82958c);
   line([[x+4,-47],[x+23,-47]],0x1a3037,2);
   box(x+3,-74,8,1,0xc4bd99);
 }
 line([[-126,-35],[-86,-35],[-80,-42],[25,-42]],0x263b40,5);
 line([[-125,-35],[-87,-35],[-80,-42],[25,-42]],0x8b9e93,1.5);
 for(const x of [-104,-61,67,106]){box(x-5,-34,11,8,0x293e43);dot(x,-30,2,0xc7bb95);}
 poly(0x826139,[[99,-77],[119,-74],[139,-65],[135,-61],[115,-68],[104,-64]]);
 line([[109,-43],[124,-48],[134,-62]],0xe5bb72,1);
 for(const [x,y] of [[87,-78],[110,-74],[134,-65],[122,-46]])dot(x,y,1,0xf1d39c);
 // Layered service spine, amber identification stripe and cargo door hardware.
 poly(0x263c44,[[-73,-84],[71,-84],[77,-76],[-76,-76]]);
 for(let i=0;i<5;i++){
   const x=-69+i*29;
   box(x+1,-67,23,3,i===2?gold:amber);
   box(x+10,-62,4,9,dark);box(x+11,-61,1,5,edge);
   line([[x,-46],[x+24,-46]],0x8f9c8d,1);
   box(x-3,-76,3,34,0x233941);box(x-2,-73,1,23,0x829689);
   if(i===1||i===3){box(x+3,-72,8,3,0xd0c4a0);box(x+14,-72,6,3,0x344f57);}
 }
 // Container doors: corrugated shells, locking bars and lifting corners.
 for(let i=0;i<3;i++){
   const x=-69+i*29;
   for(let rib=0;rib<4;rib++)line([[x+5+rib*5,-64],[x+5+rib*5,-51]],0x344d52,1.2);
   line([[x+6,-71],[x+6,-49]],edge,1.5);line([[x+19,-71],[x+19,-49]],edge,1.5);
   for(const dx of [5,18]){box(x+dx,-62,3,4,dark);box(x+dx,-60,4,1,gold);}
   for(const dx of [1,21]){box(x+dx,-74,3,3,dark);box(x+dx,-50,3,3,dark);}
 }
 // Exposed starboard power module replaces a repeated cargo panel.
 box(19,-75,25,28,dark);
 for(let row=0;row<3;row++){
   const y=-71+row*8;
   poly(steel,[[22,y],[38,y],[41,y+3],[38,y+6],[22,y+6],[20,y+3]]);
   line([[24,y+1],[37,y+1]],edge,1);
   box(24,y+2,11,2,0x2e5359);dot(39,y+3,1,0x8cdebf);
 }
 line([[20,-77],[16,-77],[16,-46],[42,-46]],amber,2);
 // Small lower service passage with a maintenance technician behind its glass.
 box(-66,-44,47,11,dark);box(-63,-42,41,7,0x658e8c);
 const worker=-60+(Math.sin(t*.25)*.5+.5)*32;
 dot(worker,-40,1.3,dark);box(worker-1.4,-39,2.8,4,dark);
 for(let x=-54;x<-20;x+=11)box(x,-43,1.5,10,steel);
 // Exposed engine and cycling heat vanes.
 module(-126,-69,48,30,dark,12);
 for(let i=0;i<3;i++){box(-122+i*14,-65,10,20,steel);box(-120+i*14,-61,6,11,0x81ccb1);dot(-117+i*14,-55,7,0x81ccb1,.08+.04*Math.sin(t*2+i));}
 for(const x of [-135,68]){box(x,-89,10,23,dark);for(let k=0;k<4;k++)box(x+2,-85+k*4,6,1.5+Math.sin(t*.7+k)*.5,edge);}
 for(let i=0;i<3;i++){
   const x=-122+i*14;
   line([[x+1,-67],[x+1,-71],[x+12,-71],[x+12,-45]],0x9bafa5,1.4);
   box(x+2,-47,7,3,amber);dot(x+5,-60,1.4,0xd3ffe9,.65+.2*Math.sin(t*1.7+i));
 }
 // External aft propulsion pod: flared nozzle, recessed throat and cooling ribs.
 solid(dark,[[-150,-79],[-128,-78],[-122,-59],[-130,-40],[-152,-43],[-159,-51],[-159,-70]],18,steel);
 poly(steel,[[-150,-75],[-132,-74],[-127,-59],[-133,-45],[-150,-47]]);
 poly(edge,[[-150,-75],[-132,-74],[-129,-70],[-148,-70]]);
 poly(dark,[[-155,-70],[-146,-67],[-146,-53],[-155,-49]]);
 line([[-154,-67],[-154,-53]],thrust?0xc2fff0:0x5b9f99,3);
 for(let n=0;n<4;n++)line([[-143+n*4,-71],[-140+n*4,-49]],0x2a4148,2);
 if(thrust)poly(0x8eddd4,[[-156,-67],[-185-Math.sin(t*23)*8,-60],[-156,-53]],.6);
 if(activity?.vectorThrusters){
   for(const x of [-140,110]){
     module(x-8,-50,19,13,steel,10);box(x-5,-47,13,5,dark);line([[x-4,-45],[x+7,-45]],0x9ce9df,3);
     if(thrust)poly(0x9ce9df,[[x-4,-37],[x+8,-37],[x+2,-18+Math.sin(t*25)*4]],.8);
   }
 }
 // Lift thrusters have bell mouths and separate hydraulic lines.
 for(const x of [-111,102]){
   box(x-5,-43,23,10,0x263e48);
   solid(dark,[[x-3,-34],[x+14,-34],[x+19,-23],[x-8,-23]],12,steel);
   poly(steel,[[x,-34],[x+11,-34],[x+15,-26],[x-4,-26]]);
   line([[x-6,-23],[x+17,-23]],edge,2);
   line([[x-10,-46],[x-13,-39],[x-13,-29]],amber,2);
 }
 // Raised port bridge, warm glass and individually moving crew silhouettes.
 module(-108,-114,47,27,steel,22);
 solid(dark,[[-132,-124],[-109,-137],[-61,-134],[-45,-120],[-55,-104],[-122,-106]],24,steel);
 if(activity?.dimensional){
   line([[-97,-146],[-49,-143],[-33,-129]],edge,1.2);
   for(const x of [-93,-78,-63])line([[x,-136],[x+11,-144]],0x354d55,1);
 }
 poly(edge,[[-132,-124],[-109,-137],[-61,-134],[-45,-120],[-61,-122],[-117,-124]]);
 poly(gold,[[-124,-121],[-61,-119],[-54,-115],[-60,-108],[-119,-110]]);
 for(let i=0;i<3;i++){
 const x=-115+i*23,y=-111,lean=Math.sin(t*.45+i)*1.2;
 box(x-4,-110,9,2,dark);dot(x+lean,y-5,1.6,dark);line([[x+lean,y-3],[x,y],[x+4,y]],dark,2);
 box(x+3,-112,3,1,0xb0ffe0);
 }
 const crew=-111+(Math.sin(t*.24)*.5+.5)*42;
 dot(crew,-115,1.6,dark);box(crew-1.5,-113,3,4,dark);
 line([[crew,-110],[crew+Math.sin(t*2)*2,-108]],dark,1);
 poly(0xffefbe,[[-122,-121],[-63,-119],[-62,-117],[-120,-119]],.25);

 for(let x=-110;x<-58;x+=16)line([[x,-121],[x,-108]],steel,2);
 box(-113,-101,45,3,amber);box(-98,-96,18,5,dark);
 line([[-124,-105],[-116,-103],[-59,-102]],edge,1);
 box(-76,-101,11,12,dark);for(let y=-99;y<-90;y+=3)box(-74,y,7,1,steel);
 for(const x of [-120,-55])dot(x,-106,1.4,gold,.65+.15*Math.sin(t));
 // Radar sweeps; aerial beacon breathes rather than strobing.
 line([[-89,-136],[-89,-149]],edge,2);
 const sweep=Math.sin(t*.65)*9;
 if(activity?.dimensional){
   // A curved dish yaws on its mast: rim and ribs foreshorten together.
   const yaw=t*.45,cs=Math.cos(yaw),sn=Math.sin(yaw);
   const dish=(u:number,v:number,z=0)=>at(-88+u*cs+z*sn*.6,-153+v+u*sn*.22-z*.25);
   const rim=Array.from({length:24},(_,i)=>{const a=i*Math.PI/12;return [Math.cos(a)*15,Math.sin(a)*6];});
   drawVolume(g,rim,4,dish,steel);
   g.fillStyle(steel);g.fillPoints(rim.map(([u,v])=>dish(u,v)),true);
   g.lineStyle(1,edge);g.strokePoints(rim.map(([u,v])=>dish(u,v)),true);
   const hub=dish(0,1,3);for(let n=0;n<6;n++){const a=n*Math.PI/3,p=dish(Math.cos(a)*14,Math.sin(a)*5);g.lineStyle(1,dark);g.lineBetween(hub.x,hub.y,p.x,p.y);}
   const feed=dish(0,0,16);g.lineStyle(2,gold);g.lineBetween(hub.x,hub.y,feed.x,feed.y);g.fillStyle(edge);g.fillCircle(feed.x,feed.y,2);
 }else{poly(steel,[[-102+sweep,-153],[-88,-145],[-76+sweep,-153],[-88,-157]]);line([[-88,-149],[-85+sweep,-157]],gold);}
 line([[-124,-127],[-124,-147]],edge);dot(-124,-147,1.7,gold,.65+.25*Math.sin(t*2));
 // Suspended cargo crane and boarding ramp.
 const hoist= Math.sin(t*.45)*3*docked-gear*12;
 line([[-39,-39],[-39,-23],[13,-23]],edge,3);line([[7,-23],[7,-13+hoist]],dark,2);
 module(-1,-14+hoist,16,10,amber,8);line([[2,-13+hoist],[2,-5+hoist]],gold);
 box(4,-13+hoist,3,8,0x554d37);dot(7,-23,2,amber);
 line([[-39,-25],[-34,-20],[8,-20]],dark,1.5);
 box(28,-44,30,28,0x273c43);box(30,-42,26,24,dark);box(33,-39,20,4,gold);
 box(33,-34,4,15,0x3c555b);box(48,-34,5,15,0x3c555b);
 if(gear>0)box(31,-36,24,18*gear,steel);
 for(const x of [28,56]){box(x,-33,2,14,amber);dot(x+1,-35,1,0x9ce8ca);}
 if(docked>.5){poly(gold,[[34,-34],[51,-34],[61,-17],[25,-17]],.055);}

 solid(steel,[[31,-18],[55,-18],[66-gear*11,-2-gear*16],[21+gear*10,-2-gear*16]],5);
 for(let i=0;i<4;i++){
 const y=-15+i*4*docked-gear*3;
 line([[29-i*2*docked,y],[57+i*2*docked,y]],edge,1);
 dot(28-i*2*docked,y, .8,gold,.5+.2*Math.sin(t*2-i));
 }
 poly(gold,[[33,-35],[53,-35],[73,-3],[12,-3]],.045);
 for(const x of [-108,104]){box(x,-38,18,9,dark);if(thrust){const f=20+Math.sin(t*31+x)*4;poly(0x8ee3da,[[x+2,-29],[x+16,-29],[x+9,f]],.65);poly(0xffdfad,[[x+6,-29],[x+12,-29],[x+9,f*.6]]);}}
 // Ramp handrails hinge with the deck instead of floating above it.
 if(docked>.1)for(const side of [-1,1]){
   const a=43+side*12,b=43+side*(22-gear*10);
   line([[a,-20],[a,-28],[b,-12-gear*10],[b,-3-gear*16]],dark,3);
   line([[a,-28],[b,-12-gear*10]],edge,1.4);
 }
 // Two physical gun mounts track the actual projected target; flashes follow muzzle positions.
 for(const [i,x] of [-24,60].entries()){
 if(activity?.dimensional){box(x-13,-96,26,10,dark);box(x-10,-94,20,7,steel);line([[x-10,-88],[x+10,-88]],edge,2);const pivot=at(x,-99),horizon=at(x+20,-99);drawStudyTurret(g,pivot,Math.atan2(horizon.y-pivot.y,horizon.x-pivot.x),t,i,activity.target,activity.firing?activity.shotAge:undefined);continue;}
 box(x-12,-91,25,6,dark);box(x-9,-95,19,5,steel);
 line([[x-9,-94],[x+9,-94]],edge,1.5);
 box(x-5,-103,10,10,dark);dot(x,-95,4,amber);
 const pivot=at(x,-95),target=activity?.target;
 const horizon=at(x+20,-95),base=Math.atan2(horizon.y-pivot.y,horizon.x-pivot.x);
 const sweep=(Math.sin(t*.42+i*2.1)+1)/2;
 const angle=target?Math.atan2(target.y-pivot.y,target.x-pivot.x):base-(.25+sweep*2.6);
 const age=activity?.shotAge??0;
 const recoil=activity?.firing?5*Math.max(0,1-age/.18):0,len=40-recoil;
 const end={x:pivot.x+Math.cos(angle)*len,y:pivot.y+Math.sin(angle)*len};
 const ux=Math.cos(angle),uy=Math.sin(angle);
 const gun=(a:number,b:number)=>({x:pivot.x+ux*(a-recoil)-uy*b,y:pivot.y+uy*(a-recoil)+ux*b});
 const armor=(color:number,points:number[][])=>{g.fillStyle(color);g.fillPoints(points.map(([a,b])=>gun(a,b)),true);};
 const stroke=(color:number,width:number,points:number[][])=>{g.lineStyle(width,color);g.strokePoints(points.map(([a,b])=>gun(a,b)),false);};
 // Rotating armored breech, ammunition box and an exposed recoil cylinder.
 armor(dark,[[-16,-9],[6,-9],[14,-4],[14,7],[-13,9],[-18,4]]);
 armor(steel,[[-13,-7],[5,-7],[10,-3],[9,5],[-12,6]]);
 stroke(edge,1.5,[[-12,-7],[5,-7],[10,-3]]);
 armor(amber,[[-14,2],[-5,2],[-5,10],[-14,10]]);
 for(let n=0;n<3;n++)stroke(dark,1,[[-12+n*3,4],[-12+n*3,8]]);
 stroke(dark,6,[[6,0],[35,0]]);stroke(edge,3,[[8,-1],[35,-1]]);
 stroke(dark,4,[[-6,-6],[21,-6]]);stroke(0xc3c9b7,1.5,[[0,-6],[22,-6]]);
 // Cooling jacket with visible slots, followed by a broad muzzle brake.
 armor(steel,[[10,-4],[27,-4],[27,4],[10,4]]);
 for(let n=0;n<4;n++)stroke(dark,2,[[12+n*4,-3],[12+n*4,2]]);
 armor(dark,[[33,-5],[40,-5],[43,-3],[43,3],[40,5],[33,5]]);
 stroke(edge,1.5,[[34,-5],[40,-5],[43,-3]]);
 stroke(0x050f18,3,[[40,-2],[40,2]]);
 g.fillStyle(gold);g.fillCircle(pivot.x,pivot.y,2);
 // Keep the shot origin on the muzzle, including recoil.
 end.x=gun(43,0).x;end.y=gun(43,0).y;
 if(activity?.firing&&target){
   const dx=target.x-end.x,dy=target.y-end.y;
   if(age<.12){g.fillStyle(gold,.2);g.fillCircle(end.x,end.y,12);g.fillStyle(0xffefd1,.95);g.fillCircle(end.x,end.y,4);}
   // Both visible tracers start at their own physical barrel tips.
   const progress=Math.min(1,age/.25),tail=Math.max(0,progress-.22);
   g.lineStyle(3,0xffcc82,.95);g.strokePoints([{x:end.x+dx*tail,y:end.y+dy*tail},{x:end.x+dx*progress,y:end.y+dy*progress}],false);
   if(progress===1){g.lineStyle(2,gold,Math.max(0,1-(age-.25)/.13));g.strokeCircle(target.x,target.y,6+(age-.25)*65);}
 }
 }
 // A gimballed working lamp casts a small apron light.
 const lx=116,ly=-44,angle=.9+Math.sin(t*.4)*.28;
 const lens=[lx+Math.cos(angle)*7,ly+Math.sin(angle)*7];
 line([[lx,ly],lens],edge,3);dot(lens[0],lens[1],2,0xffe8b0);
 poly(0xffdc91,[lens,[lens[0]+Math.cos(angle-.18)*40,lens[1]+Math.sin(angle-.18)*40],[lens[0]+Math.cos(angle+.18)*40,lens[1]+Math.sin(angle+.18)*40]],.055);
 // Telescoping intake, roller bed and a visibly articulated cargo handler.
 const unload=activity?.unload;
 if(unload){
   const age=unload.age,quiet=activity?.reduced;
   const extend=quiet?1:Math.max(0,Math.min(1,age/.28,(UNLOAD_DURATION-age)/.3));
   const done=age>2.65,signal=done?0x8ce2bc:gold;
   box(24,-76,47,33,dark);box(26,-74,43,28,0x294850);
   line([[24,-76],[71,-76],[71,-43],[24,-43]],steel,2);
   // Structural tracks, back wall and operator station stay legible inside the bay.
   for(const x of [30,45,61])line([[x,-72],[x,-48]],0x39585c,1);
   box(27,-65,5,12,steel);dot(29.5,-68,2.5,gold);box(27,-69,5,2,0x9ce6d4);
   line([[30,-60],[34,-57],[37,-61]],gold,2);
   line([[29,-72],[65,-72]],edge,2);
   // The receiving lip slides out on two hydraulic rails.
   const lip=67+18*extend;
   line([[61,-46],[lip,-46]],dark,6);line([[61,-46],[lip,-46]],edge,2);
   poly(steel,[[58,-50],[lip,-50],[lip+2,-46],[58,-46]]);
   for(let x=60;x<lip;x+=4){line([[x,-49],[x+2,-47]],dark,1.5);}
   for(const x of [26,69])dot(x,-73,1.6,signal,quiet||done?1:.65+.35*Math.sin(age*15));
   const crate=(x:number,y:number,size:number,angle=0)=>{
     const c=Math.cos(angle),s=Math.sin(angle),pt=(u:number,v:number)=>({x:x+u*c-v*s,y:y+u*s+v*c});
     const face=(color:number,p:number[][])=>{g.fillStyle(color);g.fillPoints(p.map(([u,v])=>pt(u,v)),true);};
     const r=size/2;
     if(activity?.dimensional)drawVolume(g,[[-r,-r],[r,-r],[r,r],[-r,r]],size*.32,(u,v,z)=>pt(u-z*.5,v+z*.38),0xc79250);
     face(dark,[[-r-1,-r-1],[r+1,-r-1],[r+1,r+1],[-r-1,r+1]]);
     face(0xc79250,[[-r,-r],[r,-r],[r,r],[-r,r]]);
     face(0xf0c27c,[[-r,-r],[r,-r],[r,-r+3],[-r,-r+3]]);
     face(0x405854,[[-r+3,-r],[-r+6,-r],[-r+6,r],[-r+3,r]]);
     face(0x9edac5,[[r-4,-2],[r-1,-2],[r-1,1],[r-4,1]]);
   };
   let hand={x:68,y:-59};
   for(let i=0;i<unload.count;i++){
     const phase=quiet?{stage:'stacked',t:1}:cargoPhase(age,i);
     const stack={x:39+(i%2)*10,y:-53-Math.floor(i/2)*10};
     if(phase.stage==='waiting')continue;
     if(phase.stage==='flight'){
       const q=phase.t,source=unload.sources?.[i]??unload.source,end=at(78,-57);
       crate(source.x+(end.x-source.x)*q,source.y+(end.y-source.y)*q-Math.sin(q*Math.PI)*48,13,Math.sin(q*Math.PI)*(.5+i*.13));
     }else if(phase.stage==='landing'){
       const q=phase.t,pos=at(78,-57-Math.sin(q*Math.PI)*3);
       crate(pos.x,pos.y,13);
       const a=at(73-q*5,-49),b=at(82+q*5,-49);g.lineStyle(1.5,gold,1-q);g.lineBetween(a.x,a.y,b.x,b.y);
       hand={x:78,y:-63};
     }else if(phase.stage==='handling'){
       const q=phase.t,e=q*q*(3-2*q),x=78+(stack.x-78)*e,y=-57+(stack.y+57)*e-Math.sin(q*Math.PI)*13;
       const pos=at(x,y);crate(pos.x,pos.y,13);hand={x,y:y-5};
     }else{const pos=at(stack.x,stack.y);crate(pos.x,pos.y,13);}
   }
   // Large shoulder, elbow, wrist and gripping jaws follow the handled crate.
   const shoulder={x:64,y:-40},elbow={x:64+9*extend,y:-40-29*extend};
   hand={x:64+(hand.x-64)*extend,y:-40+(hand.y+40)*extend};
   box(57,-43,15,8,steel);box(59,-36,11,3,dark);
   line([[shoulder.x,shoulder.y],[elbow.x,elbow.y],[hand.x,hand.y]],dark,6);
   line([[shoulder.x,shoulder.y],[elbow.x,elbow.y],[hand.x,hand.y]],gold,3.5);
   line([[62,-42],[70,-65]],edge,1.5);
   for(const p of [shoulder,elbow,hand]){dot(p.x,p.y,2.7,dark);dot(p.x,p.y,1.4,edge);}
   line([[hand.x-5,hand.y+5],[hand.x-5,hand.y],[hand.x+5,hand.y],[hand.x+5,hand.y+5]],edge,1.5);
   // Shutter closes over the stored stack; green indicates a completed transfer.
   box(26,-74,43,28*(1-extend),steel);
   line([[26,-74+28*(1-extend)],[69,-74+28*(1-extend)]],signal,2);
 }
}

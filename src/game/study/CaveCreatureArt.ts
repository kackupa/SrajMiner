import type Phaser from 'phaser';
import type { CombatBody } from './UniformCombat';
import type { Point } from './UniformPlanet';

/** Compact cave fauna. Feet end at the collision circle's floor, with no tall spines. */
export function drawCaveDweller(g: Phaser.GameObjects.Graphics, at: (x:number,y:number)=>Point,
  b: CombatBody, time:number, scale:number) {
  const face=b.face, armored=b.kind==='armored', moving=b.moving;
  const wind=b.phase==='windup', bite=b.phase==='attack';
  const shell=armored?0x80796a:0x526f69, rim=armored?0xb7a58b:0x8ea79a;
  const p=(x:number,y:number)=>at(x*face,y);
  const shape=(pts:number[][],color:number,alpha=1)=>{
    g.fillStyle(b.flash>0?0xffe4ba:color,alpha);g.fillPoints(pts.map(([x,y])=>p(x,y)),true);
  };
  const stroke=(pts:number[][],color:number,width:number)=>{
    g.lineStyle(width*scale,color);g.strokePoints(pts.map(([x,y])=>p(x,y)),false);
  };
  // Alternating short legs plant at y=13; the body rides low between them.
  for(const far of [true,false])for(let i=0;i<3;i++){
    const x=-8+i*7, phase=time*10+i*2.1+(far?Math.PI:0);
    const step=Math.sin(phase)*3*moving, lift=Math.max(0,Math.cos(phase))*3*moving;
    stroke([[x,3],[x-3+step,8],[x+step,13-lift]],0x14272b,3.5);
    stroke([[x,3],[x-3+step,8],[x+step,13-lift]],far?0x3a4d4b:rim,1.4);
  }
  const breath=Math.sin(time*2+b.id)*.25, crouch=wind?2:0;
  shape([[-14,3],[-13,-3],[-9,-8],[-2,-10+crouch],[7,-8],[12,-3],[13,4],[6,8],[-6,8]],0x17282c);
  // Overlapping rounded carapace segments, with one continuous low silhouette.
  for(let i=0;i<3;i++){
    const x=-11+i*7, y=breath+crouch;
    shape([[x,3],[x-1,-2+y],[x+1,-6+y],[x+5,-8+y],[x+9,-6+y],[x+10,-1+y],[x+7,5],[x+2,6]],shell);
    stroke([[x+1,-5+y],[x+5,-7+y],[x+8,-5+y]],rim,1);
    stroke([[x+8,-4+y],[x+9,0],[x+7,4]],0x293e3c,1);
    if(armored)stroke([[x+2,-3+y],[x+5,-4+y]],0xc3b297,1.2);
  }
  const jaw=bite?3:wind?1.5:0;
  shape([[7,-3],[12,-4],[15,-1],[14,4],[9,5],[7,2]],0x344b48);
  stroke([[12,2],[16,3+jaw],[14,6+jaw]],rim,2);
  stroke([[11,1],[15,-1-jaw],[14,-3-jaw]],rim,1.5);
  const eye=p(12,-1);g.fillStyle(wind?0xff9165:0xe5c18a);g.fillCircle(eye.x,eye.y,1.1*scale);
}

/** Low stone-and-resin burrow seated on the same floor used by nest collision. */
export function drawCaveNest(g:Phaser.GameObjects.Graphics,at:(x:number,y:number)=>Point,
  b:CombatBody,time:number,scale:number){
  const poly=(pts:number[][],color:number)=>{g.fillStyle(b.flash?0xffe4ba:color);g.fillPoints(pts.map(([x,y])=>at(x,y)),true);};
  poly([[-24,16],[-22,9],[-16,4],[-12,-3],[-4,-6],[5,-5],[13,0],[18,7],[24,16]],0x23373c);
  // Irregular stone lip, darker interior and a few warm egg sacs tucked inside.
  poly([[-19,15],[-16,6],[-10,0],[-3,-2],[6,0],[14,6],[18,15]],0x60716b);
  poly([[-13,15],[-12,8],[-7,3],[0,1],[7,4],[12,10],[13,16]],0x0c2027);
  for(let i=0;i<3;i++){
    const p=at(-6+i*6,12+Math.sin(i*3)*1.5);
    g.fillStyle(0x8e7855);g.fillEllipse(p.x,p.y,5*scale,6*scale);
    g.fillStyle(0xc8ad7e,.5+Math.sin(time*1.4+i)*.08);g.fillCircle(p.x-scale,p.y-scale,scale);
  }
  for(const pts of [[[-23,16],[-19,10],[-14,8],[-15,16]],[[10,3],[17,8],[22,16],[15,15]],[[-13,1],[-6,-4],[0,-3],[-5,0]]])poly(pts,0x78847a);
  for(let i=0;i<5;i++){
    const x=-21+i*10;g.lineStyle(.8*scale,0x9e9e7d,.5);
    g.strokePoints([at(x,15),at(x+3,12),at(x+6,16)],false);
  }
}

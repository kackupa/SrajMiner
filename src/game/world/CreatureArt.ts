import type Phaser from 'phaser';
export type CreatureFrame={x:number;y:number;kind:'flyer'|'rock-swimmer'|'shard-manta'|'hull-scrapper';angle:number;time:number;moving:number;mode?:string;attack?:number;hit?:boolean;reduced?:boolean};
/** Original articulated fauna. All limbs share world projection with their body. */
export function drawCreature(g:Phaser.GameObjects.Graphics,project:(x:number,y:number)=>{x:number;y:number},f:CreatureFrame){
 const t=f.reduced?0:f.time,a=f.angle,c=Math.cos(a),s=Math.sin(a),attack=f.attack??0;
 const at=(x:number,y:number)=>project(f.x+x*c-y*s,f.y+x*s+y*c);
 const poly=(color:number,p:number[][],alpha=1)=>{g.fillStyle(f.hit?0xfff3d3:color,alpha);g.fillPoints(p.map(([x,y])=>at(x,y)),true);};
 const line=(color:number,p:number[][],width=1,alpha=1)=>{g.lineStyle(width,color,alpha);g.strokePoints(p.map(([x,y])=>at(x,y)),false);};
 const dot=(color:number,x:number,y:number,r:number,alpha=1)=>{const p=at(x,y);g.fillStyle(color,alpha);g.fillCircle(p.x,p.y,r);};
 const dark=0x15252b,bone=0xd6c7a5,glow=f.mode==='windup'?0xffb860:0x8de1c5;
 if(f.kind==='flyer'||f.kind==='shard-manta'){
  const flyer=f.kind==='flyer',charge=f.mode==='charge',fold=f.mode==='windup'?.52:charge?.3:1;
  const flap=Math.sin(t*(flyer?10:5))*6*(charge?.15:1),span=(flyer?29:25)*fold;
  const skin=flyer?0x936b52:0x725e88,light=flyer?0xc19a6b:0xae92bf;
  // Jointed wing fingers stretch a scalloped membrane, folding for the strike.
  for(const side of [-1,1]){
   const root=[0,side*5],elbow=[-2,side*(span*.65+flap)],tip=[-16,side*(span+flap)];
   poly(dark,[root,[8,side*9],elbow,tip,[-21,side*10],[-15,side*3]]);
   poly(skin,[root,[6,side*9],elbow,tip,[-15,side*12],[-12,side*5]]);
   poly(light,[[0,side*5],elbow,[-10,side*(span*.65)]],.6);
   line(bone,[root,elbow,tip],1.4);
   for(let n=0;n<3;n++)line(dark,[elbow,[-17+n*4,side*(6+n*3)]],1);
   dot(bone,elbow[0],elbow[1],1.5);
  }
  const tail=Math.sin(t*4)*3;
  line(dark,[[-9,0],[-21,tail],[-30,tail+3]],4);
  line(light,[[-9,0],[-21,tail],[-30,tail+3]],1.5);
  poly(dark,[[-12,-5],[4,-8],[13,-4],[16,0],[11,6],[-7,7]]);
  poly(skin,[[-10,-4],[4,-6],[11,-3],[12,3],[4,5],[-8,5]]);
  for(let i=0;i<4;i++){const x=-8+i*4;line(light,[[x,-4],[x+2,0],[x,4]],1.4);}
  // Crest, beak and throat inflate during the warning, then extend in the dive.
  poly(bone,[[2,-6],[-1,-13],[8,-8],[12,-3]]);
  poly(light,[[7,-4],[14+attack*3,-2],[18+attack*4,0],[12,2],[8,4]]);
  line(dark,[[12,0],[18+attack*4,0]],1);
  dot(dark,8,-3,2.4);dot(glow,8.5,-3.5,1.1);
  for(const side of [-1,1])line(bone,[[-5,side*5],[-2+attack*5,side*10],[3+attack*8,side*10]],1.3);
  if(!flyer)for(let n=0;n<3;n++)poly(0xbca7d0,[[-8+n*5,-3],[-12+n*5,-10-n%2*3],[-5+n*5,-3]]);
 }else{
  const crab=f.kind==='hull-scrapper',shell=crab?0x82918a:0x507b73,edge=crab?0xc1c6ae:0x92b7a0;
  // Alternating articulated legs push against the cave floor.
  for(const side of [-1,1])for(let i=0;i<3;i++){
   const x=-10+i*7,stride=Math.sin(t*(4+f.moving*5)+i*1.8+side)*3;
   const knee=[x-4+stride,side*(crab?15:10)],foot=[x+2-stride,side*(crab?20:15)];
   line(dark,[[x,side*4],knee,foot],3.5);line(edge,[[x,side*4],knee,foot],1.4);
   dot(shell,knee[0],knee[1],1.8);line(bone,[foot,[foot[0]+3,foot[1]-side*2]],1.2);
  }
  for(let i=4;i>=0;i--){
   const x=-i*6,wiggle=crab?0:Math.sin(t*5-i*.8)*i*.6;
   const w=crab?9-i*.7:7-i*.8;
   poly(dark,[[x+5,-w+wiggle],[x-3,-w-1+wiggle],[x-6,wiggle],[x-2,w+wiggle],[x+5,w+wiggle]]);
   poly(shell,[[x+4,-w+1+wiggle],[x-2,-w+wiggle],[x-4,wiggle],[x-1,w-1+wiggle],[x+4,w-1+wiggle]]);
   line(edge,[[x-2,-w+wiggle],[x+1,-w+2+wiggle],[x+2,w-2+wiggle]],1);
   if(i%2===0)dot(glow,x,wiggle,1.2);
  }
  poly(dark,[[0,-9],[11,-8],[17,-2],[17,4],[9,9],[0,7]]);
  poly(shell,[[2,-7],[10,-6],[14,-1],[13,4],[8,7],[2,5]]);
  if(crab){poly(edge,[[6,-7],[14,-3],[16,1],[7,0]]);line(dark,[[7,-5],[11,-2]],1.5);}
  for(const side of [-1,1]){
   dot(dark,10,side*3,2.6);dot(0xffcf83,11,side*3,1.2);
   const jaw=3+attack*5;
   line(dark,[[13,side*4],[18+attack*4,side*jaw],[21+attack*5,side*2]],4);
   line(bone,[[13,side*4],[18+attack*4,side*jaw],[21+attack*5,side*2]],1.6);
   line(edge,[[7,side*6],[12,side*12],[19+Math.sin(t*3+side)*2,side*14]],.9);
   if(crab){
    line(dark,[[0,side*7],[9,side*18],[19+attack*5,side*16]],5);
    poly(shell,[[16,side*13],[25+attack*5,side*12],[22+attack*5,side*17],[26+attack*5,side*21],[17,side*20],[13,side*16]]);
    line(bone,[[20+attack*5,side*15],[25+attack*5,side*12]],1.2);
   }
  }
 }
 if(f.mode==='windup'){
  const p=at(0,0);g.lineStyle(1.5,0xffc386,.65);g.strokeCircle(p.x,p.y,27+(f.reduced?0:Math.sin(t*10)*2));
 }
}

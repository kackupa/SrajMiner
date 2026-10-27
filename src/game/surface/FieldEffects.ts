import type Phaser from 'phaser';
export function drawWreck(g:Phaser.GameObjects.Graphics,x:number,y:number,age?:number,reduced=false){
 g.fillStyle(0x091a21,.6);g.fillEllipse(x,y+14,48,12);
 g.fillStyle(0x796646,1);g.fillPoints([{x:x-21,y:y+9},{x:x-12,y:y-10},{x:x+12,y:y-6},{x:x+21,y:y+13},{x:x-12,y:y+16}],true);
 g.fillStyle(0x162a33,1);g.fillRect(x-10,y-6,18,12);g.lineStyle(3,0x9d996f,1);g.lineBetween(x-26,y+16,x-12,y+11);g.lineBetween(x+14,y+12,x+25,y+18);
 g.lineStyle(2,0xe3ac60,1);g.lineBetween(x-17,y+4,x-10,y-7);g.lineBetween(x+10,y-3,x+16,y+7);
 if(age!==undefined){
  const lift=reduced?25:Math.min(age*35,100);g.fillStyle(0xd7ded0,1);g.fillCircle(x,y-lift-8,5);g.fillStyle(0x35575e,1);g.fillRect(x-5,y-lift-3,10,13);
  if(!reduced){g.fillStyle(0x90e5df,.65);g.fillTriangle(x-5,y-lift+11,x+5,y-lift+11,x,y-lift+23);for(let i=0;i<7;i++){const a=i*2.4;g.fillStyle(i%2?0xffb369:0x667c80,Math.max(0,1-age/3.2));g.fillCircle(x+Math.cos(a)*age*17,y+Math.sin(a)*age*13-age*8,4+age*2);}}
 }
}
export function drawRepairDrones(g:Phaser.GameObjects.Graphics,x:number,y:number,age:number,reduced:boolean){
 for(const side of [-1,1]){const dx=x+side*(28+(reduced?0:Math.sin(age*3)*7)),dy=y-32+(reduced?0:Math.sin(age*4+side)*6);
 g.fillStyle(0x9cae9e,1);g.fillRoundedRect(dx-10,dy-5,20,10,3);g.fillStyle(0xffb36b,1);g.fillRect(dx-15,dy-2,5,5);g.fillRect(dx+10,dy-2,5,5);g.lineStyle(2,0x8ce6e1,.8);g.lineBetween(dx,dy+5,x+side*12,y-5);
 g.fillStyle(0xb8ffff,1);g.fillCircle(x+side*12,y-5, reduced?2:2+Math.sin(age*30)**2*3);
 if(!reduced)for(let i=0;i<3;i++){g.lineStyle(1,0xffd190,.9);g.lineBetween(x+side*12,y-5,x+side*12+Math.sin(age*23+i)*12,y-5+Math.cos(age*29+i)*10);}
 }
}

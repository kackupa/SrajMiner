import { readFileSync, writeFileSync } from 'node:fs';
import { conceptSvg } from '../src/game/player/ConceptMiner';
import { drawMothership } from '../src/game/surface/MothershipArt';
import { Progress } from '../src/game/economy/Progress';
import type Phaser from 'phaser';
// Export the actual game models so menu artwork can be regenerated after design changes.
const hex=(n:number)=>'#'+n.toString(16).padStart(6,'0');
const marks:string[]=[];let fill='',stroke='',alpha=1,lineAlpha=1,width=1;
const points=(p:{x:number;y:number}[])=>p.map(v=>`${v.x.toFixed(2)},${v.y.toFixed(2)}`).join(' ');
const g={
 fillStyle(c:number,a=1){fill=hex(c);alpha=a;},
 lineStyle(w:number,c:number,a=1){width=w;stroke=hex(c);lineAlpha=a;},
 fillPoints(p:{x:number;y:number}[]){marks.push(`<polygon points="${points(p)}" fill="${fill}" opacity="${alpha}"/>`);},
 strokePoints(p:{x:number;y:number}[]){marks.push(`<polyline points="${points(p)}" fill="none" stroke="${stroke}" stroke-width="${width}" opacity="${lineAlpha}" stroke-linejoin="round" stroke-linecap="round"/>`);},
 fillCircle(x:number,y:number,r:number){marks.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${alpha}"/>`);},
};
drawMothership(g as unknown as Phaser.GameObjects.Graphics,(x,y)=>({x,y}),false,undefined,{time:2,reduced:true});
let svg=readFileSync('public/frontier.svg','utf8');
const start=svg.indexOf('<g transform="translate(1130 760)');
if(start>=0){const end=svg.indexOf('</g>',start)+4;svg=svg.slice(0,start)+svg.slice(end);}
svg=svg.replace(/<g id="current-expedition-art">[\s\S]*?<\/svg>/,'</svg>');
const art=`<g id="current-expedition-art"><path d="M820 810H1500L1580 860H800Z" fill="#112c3b"/><g transform="translate(1180 810) scale(1.35)">${marks.join('')}</g><ellipse cx="1120" cy="901" rx="90" ry="12" fill="#061725" opacity=".6"/><g transform="translate(1120 828) scale(2.7)">${conceptSvg(new Progress())}</g></g>`;
writeFileSync('public/frontier.svg',svg.replace('</svg>',art+'</svg>'));
writeFileSync("public/miner-avatar.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-48 -50 96 96"><title>Ore Frontier miner</title><rect x="-48" y="-50" width="96" height="96" rx="16" fill="#081723"/><g transform="translate(0 -2)">${conceptSvg(new Progress())}</g></svg>`);
writeFileSync("public/frontier-mobile.svg", readFileSync("public/frontier.svg", "utf8").replace("0 0 1600 1000", "800 400 800 600"));

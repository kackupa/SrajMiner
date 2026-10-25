/** Shared timing keeps the rig ejector and carrier loader in sync. Cosmetic only. */
export const UNLOAD_DURATION = 3.4;
export const crateLaunchTime = (index:number) => .3+index*.18;
export function cargoPhase(age:number,index:number) {
 const elapsed=age-crateLaunchTime(index);
 if(elapsed<0)return {stage:'waiting' as const,t:0};
 if(elapsed<.65)return {stage:'flight' as const,t:elapsed/.65};
 if(elapsed<.8)return {stage:'landing' as const,t:(elapsed-.65)/.15};
 if(elapsed<1.55)return {stage:'handling' as const,t:(elapsed-.8)/.75};
 return {stage:'stacked' as const,t:1};
}
export function ejectorKick(age:number,count:number){
 let kick=0;
 for(let i=0;i<count;i++){const d=age-crateLaunchTime(i);if(d>=0&&d<.14)kick=Math.max(kick,Math.sin(d/.14*Math.PI));}
 return kick;
}

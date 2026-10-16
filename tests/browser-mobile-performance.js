async page => {
 const ctx=await page.context().browser().newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const p=await ctx.newPage();
 try {
 await p.goto('http://127.0.0.1:5174/');await p.getByRole('button',{name:'BEGIN EXPEDITION'}).tap();await p.waitForTimeout(400);await p.bringToFront();
 const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await p.evaluate(()=>{window.frameTimes=[];window.stopFrames=false;let last=performance.now();function frame(t){window.frameTimes.push(t-last);last=t;if(!window.stopFrames)requestAnimationFrame(frame);}requestAnimationFrame(frame);});
 const hold=async label=>{const b=await p.getByRole('button',{name:label,exact:true}).boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});};
 const end=()=>cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await hold('Drill down');try{await p.waitForFunction(()=>window.__mars.cargo.iron>=2,{}, {timeout:30000});}finally{await end();}
 await hold('Thrust upward');try{await p.waitForFunction(()=>window.__mars.depth===0,{}, {timeout:20000});}finally{await end();}
 await p.waitForTimeout(1000);
 const result=await p.evaluate(()=>{window.stopFrames=true;const a=window.frameTimes.sort((a,b)=>a-b);return {frames:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],over50:a.filter(n=>n>50).length,hull:window.__mars.hull,cargo:window.__mars.cargo,overlaps:window.__mars.overlaps};});
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});return result;
 }finally{await ctx.close();}
}

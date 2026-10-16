async originalPage => {
 const context=await originalPage.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 try {
 await page.goto('http://127.0.0.1:5174/');
 await page.setViewportSize({width:390,height:844});await page.bringToFront();
 await page.addInitScript(key=>{if(!sessionStorage.getItem(key)){localStorage.removeItem('mars-miner.v1');sessionStorage.setItem(key,'1');}},'webkit-fresh-'+Date.now());
 await page.reload();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.getByRole('button',{name:'BEGIN EXPEDITION'}).tap();await page.waitForTimeout(500);
 const hold=async label=>{const b=await page.getByRole('button',{name:label,exact:true}).boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();};
 await hold('Drill down');try{await page.waitForFunction(()=>window.__mars.cargo.iron>=2,{}, {timeout:20000});}finally{await page.mouse.up();}
 await page.screenshot({path:'output/playwright/webkit-mobile-mining.png',scale:'css'});
 // Windows WebKit may omit the WebGL layer from page screenshots. Inspect the
 // actual drawing buffer as well; this does not certify physical Safari display.
 const rendered=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{
   const source=document.querySelector('#game canvas'), copy=document.createElement('canvas');
   copy.width=source.width;copy.height=source.height;
   const ctx=copy.getContext('2d');ctx.drawImage(source,0,0);
   const pixels=ctx.getImageData(0,0,copy.width,copy.height).data, colors=new Set();
   for(let i=0;i<pixels.length;i+=400)colors.add(Array.from(pixels.slice(i,i+4)).join(','));
   resolve({colors:colors.size,png:copy.toDataURL()});
 })));
 if(rendered.colors<64)throw Error('Game drawing buffer is blank or lacks terrain detail');
 const mined=await page.evaluate(()=>({cargo:window.__mars.cargo,depth:window.__mars.depth,hull:window.__mars.hull}));
 await hold('Thrust upward');try{await page.waitForFunction(()=>window.__mars.depth===0,{}, {timeout:20000});}finally{await page.mouse.up();}await page.waitForTimeout(700);
 await page.getByRole('button',{name:'Open ship',exact:true}).tap();await page.getByRole('button',{name:/03 \/ MOTHERSHIP/}).tap();await page.getByRole('button',{name:'Manage Copper'}).tap();await page.getByRole('button',{name:'Set Copper amount to 0.5'}).tap();await page.locator('#warehouse-store-copper').tap();
 const saved=await page.evaluate(()=>({cargo:window.__mars.cargo,warehouse:window.__mars.maps['cryo-shelf'].warehouse,overlaps:window.__mars.overlaps}));
 await page.screenshot({path:'output/playwright/webkit-mobile-storage.png',scale:'css'});
 await page.setViewportSize({width:844,height:390});await page.getByLabel('Choose ship service').selectOption('service');await page.screenshot({path:'output/playwright/webkit-mobile-service.png',scale:'css'});
 await page.reload();await page.getByRole('button',{name:'CONTINUE EXPEDITION'}).tap();
 const loaded=await page.evaluate(()=>({cargo:window.__mars.cargo,warehouse:window.__mars.maps['cryo-shelf'].warehouse,overlaps:window.__mars.overlaps}));
 if(JSON.stringify(saved)!==JSON.stringify(loaded)||errors.length)throw Error(JSON.stringify({saved,loaded,errors}));
 const imagePage=await context.newPage();
 await imagePage.setContent('<style>body{margin:0}</style><img src="'+rendered.png+'">');
 await imagePage.locator('img').screenshot({path:'output/playwright/webkit-mobile-buffer.png'});
 return {mined,saved,loaded,renderedColors:rendered.colors,errors};
 } finally { await context.close(); }
}


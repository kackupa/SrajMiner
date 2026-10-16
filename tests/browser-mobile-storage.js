async page => {
 const seed=await page.evaluate(()=>JSON.parse(localStorage.getItem('mars-miner.v1')));
 seed.cargo.copper=.5;seed.cargo.iron=15.5;seed.maps[seed.activeMap].warehouse.copper=16;seed.maps[seed.activeMap].warehouse.iron=8;
 const context=await page.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(s=>{if(!sessionStorage.getItem('fixture')){localStorage.setItem('mars-miner.v1',JSON.stringify(s));sessionStorage.setItem('fixture','1');}},seed);
 const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 try {
 await p.goto('http://127.0.0.1:5174/');await p.getByRole('button',{name:'CONTINUE EXPEDITION'}).tap();await p.waitForTimeout(400);
 await p.getByRole('button',{name:'Open ship',exact:true}).tap();await p.getByRole('button',{name:/03 \/ MOTHERSHIP/}).tap();
 await p.getByRole('button',{name:'Manage Iron',exact:true}).tap();
 if(!await p.locator('#warehouse-store-iron').isDisabled())throw Error('Full storage accepts store');
 await p.locator('#warehouse-units-iron').fill('5.5');await p.locator('#warehouse-units-iron').blur();
 // Supply deterministic confirmation responses; the native prompt is covered separately.
 await p.evaluate(()=>window.confirm=()=>false);await p.locator('#warehouse-discard-iron').tap();
 if(await p.evaluate(()=>window.__mars.cargo.iron)!==15.5)throw Error('Cancelled discard changed ore');
 await p.evaluate(()=>window.confirm=()=>true);await p.locator('#warehouse-discard-iron').tap();
 if(await p.locator('#warehouse-units-iron').inputValue()!=='5.5'||await p.locator('.storage-expanded').count()!==1)throw Error('Transfer lost row state');
 await p.getByRole('button',{name:'Manage Copper',exact:true}).tap();await p.locator('#warehouse-units-copper').fill('5.5');await p.locator('#warehouse-withdraw-copper').tap();
 const expected=await p.evaluate(()=>({cargo:window.__mars.cargo,stock:window.__mars.maps['cryo-shelf'].warehouse}));
 if(expected.cargo.copper!==6||expected.cargo.iron!==10||expected.stock.copper!==10.5||expected.stock.iron!==8)throw Error('Wrong transfer totals');
 const layouts=[];
 for(const [width,height] of [[320,740],[390,844],[844,390]]) {
   await p.setViewportSize({width,height});await p.waitForTimeout(120);
   const measure=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,expanded:document.querySelector('.storage-expanded input')?.value,nav:document.querySelector('.panel-pages')?.textContent}));
   if(measure.overflow||measure.expanded!=='5.5')throw Error('Rotation lost state or overflow');
   await p.screenshot({path:'output/playwright/mobile-full-storage-'+width+'.png',scale:'css'});layouts.push({width,height,...measure});
 }
 await p.reload();await p.getByRole('button',{name:'CONTINUE EXPEDITION'}).tap();
 const loaded=await p.evaluate(()=>({cargo:window.__mars.cargo,stock:window.__mars.maps['cryo-shelf'].warehouse}));
 if(JSON.stringify(expected)!==JSON.stringify(loaded))throw Error('Reload duplicated/lost ore');
 if(errors.length)throw Error(errors.join('\n'));
 return {expected,loaded,layouts,errors};
 } finally {await context.close();}
}

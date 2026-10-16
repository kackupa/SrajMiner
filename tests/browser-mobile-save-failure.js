async page => {
 const seed=await page.evaluate(()=>JSON.parse(localStorage.getItem('mars-miner.v1')));
 seed.cargo.copper=3;seed.maps[seed.activeMap].warehouse.copper=2;seed.maps[seed.activeMap].warehouse.iron=0;
 const ctx=await page.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await ctx.addInitScript(s=>{if(!sessionStorage.getItem('fixture')){localStorage.setItem('mars-miner.v1',JSON.stringify(s));sessionStorage.setItem('fixture','1');}},seed);
 const p=await ctx.newPage();const read=()=>p.evaluate(()=>({cargo:window.__mars.cargo,stock:window.__mars.maps['cryo-shelf'].warehouse}));
 try {
 await p.goto('http://127.0.0.1:5174/');await p.getByRole('button',{name:'CONTINUE EXPEDITION'}).tap();await p.waitForTimeout(400);await p.getByRole('button',{name:'Open ship',exact:true}).tap();await p.getByRole('button',{name:/03 \/ MOTHERSHIP/}).tap();await p.getByRole('button',{name:'Manage Copper'}).tap();
 const before=await read();
 await p.evaluate(()=>{window.restoreStorage=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='mars-miner.v1')throw new DOMException('Test quota','QuotaExceededError');return window.restoreStorage.call(this,key,value);};window.confirm=()=>true;});
 const notices=[];
 for(const id of ['warehouse-store-copper','warehouse-withdraw-copper','warehouse-discard-copper']){
   await p.locator('#'+id).tap();
   if(JSON.stringify(await read())!==JSON.stringify(before))throw Error(id+' lost ore on failed save');
   const notice=await p.locator('#camp-notice').innerText();notices.push(notice);
   if(!/FAILED|not saved/i.test(notice))throw Error('Save failure obscured: '+notice);
 }
 await p.evaluate(()=>Storage.prototype.setItem=window.restoreStorage);
 await p.locator('#warehouse-discard-copper').tap();
 const discarded=await read();if(discarded.cargo.copper!==2)throw Error('Retry did not discard exactly once');
 await p.reload();await p.getByRole('button',{name:'CONTINUE EXPEDITION'}).tap();if(JSON.stringify(await read())!==JSON.stringify(discarded))throw Error('Reload changed retry');
 return {before,notices,discarded};
 }finally{await ctx.close();}
}

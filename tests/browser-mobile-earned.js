async original => {
 const context=await original.context().browser().newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const page=await context.newPage(), checkpoints=[]; let stage='start';
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try {
  await page.goto('http://127.0.0.1:5174/');await page.bringToFront();await page.getByRole('button',{name:'BEGIN EXPEDITION'}).tap();await page.waitForTimeout(500);
  const cdp=await context.newCDPSession(page);
  const release=()=>cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const heldUntil=async(label,predicate,arg,timeout=25000)=>{
   const b=await page.getByRole('button',{name:label,exact:true}).boundingBox();
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});
   try{await page.waitForFunction(predicate,arg,{timeout});}finally{await release();}
  };
  const read=()=>page.evaluate(()=>({cargo:window.__mars.cargo,hull:window.__mars.hull,fuel:window.__mars.fuel,money:window.__mars.money,levels:window.__mars.levels,structures:window.__mars.structures,overlaps:window.__mars.overlaps}));
  const record=async name=>{const state=await read();if(state.overlaps||state.hull<99.9)throw Error(name+' unsafe return '+JSON.stringify(state));checkpoints.push({name,...state});};
  const home=async()=>{await heldUntil('Thrust upward',()=>window.__mars.depth===0);await page.waitForTimeout(700);};
  const move=async x=>{const current=await page.evaluate(()=>window.__mars.x);if(Math.abs(current-x)<10)return;await heldUntil(current<x?'Move right':'Move left',({x,right})=>right?window.__mars.x>=x-10:window.__mars.x<=x+10,{x,right:current<x},8000);await page.waitForTimeout(400);};
  const mine=async cargo=>{
   const point=async(name,id)=>{const b=await page.getByRole('button',{name,exact:true}).boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2,id};};
   const drill=await point('Drill down',1), thrust=await point('Thrust upward',2);
   let braking=false;const deadline=Date.now()+60000;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[drill]});
   try {
    while(Date.now()<deadline){
     const state=await page.evaluate(()=>({cargo:window.__mars.cargo,speed:window.__mars.descentSpeed}));
     if(Object.entries(cargo).every(([ore,n])=>state.cargo[ore]>=n))return;
     if(!braking&&state.speed>80){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[drill,thrust]});braking=true;}
     else if(braking&&state.speed<25){await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[thrust]});braking=false;}
     await page.waitForTimeout(80);
    }
    throw Error('Mining did not collect target ore');
   }finally{await release();}
  };
  const ship=async service=>{await page.getByRole('button',{name:'Open ship',exact:true}).tap();await page.getByLabel('Choose ship service').selectOption(service);};
  stage='first shaft';await mine({iron:2});await home();await record(stage);
  stage='second shaft';await move(740);await mine({copper:6,iron:4});await home();await record(stage);
  await page.getByRole('button',{name:'Build camp',exact:true}).tap();await page.locator('#build-habitat').tap();
  if(!await page.evaluate(()=>window.__mars.placement?.valid))throw Error('Default camp site invalid');
  await page.getByRole('button',{name:'PLACE',exact:true}).tap();await page.waitForFunction(()=>window.__mars.structures.some(s=>s.kind==='habitat'));
  stage='camp built';await record(stage);
  await ship('service');await page.locator('#service-fuel').tap();await page.getByRole('button',{name:'Return to mine',exact:true}).tap();
  stage='uplink silver shaft';await move(780);await mine({copper:3,iron:2,silver:2});await home();await record(stage);
  stage='uplink iron shaft';await move(660);await mine({copper:6,iron:4,silver:2});await home();await record(stage);
  await ship('construction');await page.locator('#build-trade-post').tap();
  if(!await page.evaluate(()=>window.__mars.placement?.valid))throw Error('Default uplink site invalid');
  await page.getByRole('button',{name:'PLACE',exact:true}).tap();await page.waitForFunction(()=>window.__mars.structures.some(s=>s.kind==='trade-post'));
  stage='uplink built';await record(stage);
  stage='upgrade silver shaft';await move(700);await mine({silver:2});await home();await record(stage);
  await ship('sell');
  for(const ore of ['copper','iron','silver']){const button=page.getByRole('button',{name:'Select all carried '+ore,exact:true});if(await button.count())await button.tap();}
  await page.locator('#ship-selected').tap();stage='sale';await record(stage);
  await page.getByLabel('Choose ship service').selectOption('upgrades');await page.getByLabel('Choose miner component').selectOption('choose-drill');await page.locator('#buy-drill').tap();
  const saved=await read();if(saved.levels.drill!==2)throw Error('Upgrade not installed');
  await page.screenshot({path:'output/playwright/mobile-earned-complete.png',scale:'css'});
  await page.reload();await page.getByRole('button',{name:'CONTINUE EXPEDITION'}).tap();const loaded=await read();
  for(const key of ['cargo','money','levels','structures'])if(JSON.stringify(saved[key])!==JSON.stringify(loaded[key]))throw Error('Reload changed '+key);
  if(errors.length)throw Error(errors.join('\n'));
  return {checkpoints,saved,loaded,errors};
 }catch(error){await page.screenshot({path:'output/playwright/mobile-earned-failure.png',scale:'css'});throw Error(stage+': '+error.message+' '+await page.evaluate(()=>JSON.stringify(window.__mars)));}
 finally {await context.close();}
}

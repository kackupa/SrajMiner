async page => {
 await page.goto('http://127.0.0.1:5180',{waitUntil:'domcontentloaded',timeout:60000});
 await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(async()=>{
  const {SolarView,planetPosition}=await import('/src/game/campaign/SolarSystem.ts');
  const {MAPS}=await import('/src/game/config.ts');
  const intel=Object.fromEntries(Object.keys(MAPS).map(id=>[id,{visited:id==='cryo-shelf',tradingPost:false,warehouse:null,facilities:0}]));
  const preview=new SolarView(()=>{});
  preview.draw(planetPosition('cryo-shelf'),4,['core-cryo'],'cryo-shelf',true,intel,{credits:0,cargo:0,cargoCapacity:16});
 });
 await page.locator('.expedition-flight [data-world="mars-frontier"]').click();
 const layout=await page.locator('.flight-route').evaluate(node=>{
  const outer=node.getBoundingClientRect();return {height:outer.height,contained:[...node.children].every(child=>{const r=child.getBoundingClientRect();return r.top>=outer.top&&r.bottom<=outer.bottom;})};
 });
 if(!layout.contained)throw Error('Flight checkout contents overflow');
 await page.screenshot({path:'output/playwright/expedition-flight-final.png'});
 await page.locator('[data-civil-world="helion"]').click();await page.screenshot({path:'output/playwright/expedition-civilisation.png'});
 return layout;
}

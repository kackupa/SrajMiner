async page => {
 page.setDefaultTimeout(60000);
 await page.goto('http://127.0.0.1:5180',{waitUntil:'domcontentloaded',timeout:60000});
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('#intro-atlas').click();
 await page.screenshot({path:'output/playwright/expedition-atlas-final.png'});
 await page.locator('#intro-back').click();
 const fixture=await page.evaluate(()=>JSON.parse(localStorage.getItem('mars-miner.v1')));
 fixture.coreFuel=4;fixture.milestones=[...new Set([...fixture.milestones,'core-cryo'])];fixture.mothershipBoarded=true;fixture.solarPosition=null;
 fixture.maps[fixture.activeMap].x=555;fixture.maps[fixture.activeMap].y=-22;
 await page.addInitScript(fixture=>{if(!sessionStorage.getItem('polish-flight-fixture')){localStorage.setItem('mars-miner.v1',JSON.stringify(fixture));sessionStorage.setItem('polish-flight-fixture','1');}},fixture);
 await page.reload({waitUntil:'domcontentloaded',timeout:60000});await page.locator('#launch').click();
 if(await page.evaluate(()=>window.__mars?.paused))await page.keyboard.press('Escape');
 await page.keyboard.down('w');await page.locator('.expedition-flight').waitFor({timeout:60000});await page.keyboard.up('w');
 const current=await page.evaluate(()=>window.__mars.mapId);
 const destination=current==='mars-frontier'?'cryo-shelf':'mars-frontier';
 await page.locator('.expedition-flight [data-world="'+destination+'"]').click();
 if(await page.locator('.expedition-flight [data-world="'+current+'"] small').innerText()!=='CURRENT WORLD')throw Error('Current-world label moved');
 if(await page.locator('.expedition-flight [data-world="'+destination+'"] small').innerText()==='CURRENT WORLD')throw Error('Destination labelled current');
 await page.screenshot({path:'output/playwright/expedition-flight-final.png'});
 await page.locator('[data-civil-world="helion"]').click();
 await page.screenshot({path:'output/playwright/expedition-civilisation.png'});
 return {current,destination,labels:true};
}

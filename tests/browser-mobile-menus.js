async page => {
 await page.bringToFront();
 const launch=page.getByRole('button',{name:/CONTINUE EXPEDITION|BEGIN EXPEDITION/});
 if(await launch.count()) { await launch.tap(); await page.waitForTimeout(400); }
 if(await page.getByRole('button',{name:'Open ship',exact:true}).count())await page.getByRole('button',{name:'Open ship',exact:true}).tap();
 const results=[];
 for(const [width,height] of [[320,740],[390,844],[844,390]]) {
  await page.setViewportSize({width,height});
  for(const screen of ['hub','warehouse','construction','service','upgrades','sell','more']) {
   const select=page.getByLabel('Choose ship service');
   if(await select.isVisible()) await select.selectOption(screen);
   else await page.locator('#camp-nav-'+screen).tap();
   const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,small:[...document.querySelectorAll('.modal button,.modal input,.modal select')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.height<43&&getComputedStyle(el).visibility!=='hidden';}).map(el=>({text:el.textContent?.trim().slice(0,45),height:el.getBoundingClientRect().height})),pages:document.querySelector('.panel-pages')?.textContent}));
   await page.screenshot({path:'output/playwright/mobile-menu-'+screen+'-'+width+'.png',scale:'css'});
   if(layout.overflow || layout.small.length) throw Error(JSON.stringify({width,screen,...layout}));
   if(!layout.pages?.includes('1 /')) throw Error('New panel did not start on page one: '+screen);
   results.push({width,screen,...layout});
  }
 }
 return results;
}

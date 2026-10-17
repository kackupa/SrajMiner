/** Fit complete content blocks into explicit pages. Never scroll the panel. */
export function panelPages(root: HTMLElement) {
 if(root.querySelector('.intro-step-title,.star-map-screen,.build-catalogue,.rig-workshop,.colony-screen,.orders-screen,.building-inspector,.cargo-screen,.codex-screen,.discard-screen'))return()=>{};
 const panel=root.querySelector<HTMLElement>('.camp-main')??root.querySelector<HTMLElement>('.modal');if(!panel)return()=>{};
 const content=panel.querySelector<HTMLElement>('.camp-content,.modal-body,.intro-screen')??panel;
 const nav=document.createElement('nav');nav.className='panel-pages';nav.setAttribute('aria-label','Panel pages');nav.innerHTML='<button aria-label="Previous page">Previous</button><span></span><button aria-label="Next page">Next</button>';root.querySelector('.modal')!.append(nav);
 const [previous,next]=Array.from(nav.querySelectorAll('button'));
 const containers:HTMLElement[]=[],units:HTMLElement[]=[];
 const collect=(parent:HTMLElement)=>{for(const child of Array.from(parent.children)){if(!(child instanceof HTMLElement)||child===nav)continue;if(child.matches('.hub-grid,.ore-list,.upgrade-list,.camp-service-grid,.region-record-grid,.paint-grid,.trade-terminal,.manifest-table')){containers.push(child);collect(child);}else units.push(child);}};
 collect(content);
 const styles=new Map<HTMLElement,string>();[...units,...containers].forEach(e=>styles.set(e,e.style.display));
 let pages:HTMLElement[][]=[],current=0,frame=0;
 const show=(items:HTMLElement[])=>{
  units.forEach(e=>e.style.setProperty('display',items.includes(e)?styles.get(e)!:'none',items.includes(e)?'':'important'));
  containers.forEach(e=>{const visible=items.some(item=>e.contains(item));e.style.setProperty('display',visible?styles.get(e)!:'none',visible?'':'important');});
  panel.scrollTop=0;
 };
 const draw=()=>{show(pages[current]??[]);nav.hidden=pages.length<2;previous.disabled=current===0;next.disabled=current>=pages.length-1;nav.querySelector('span')!.textContent=`${current+1} / ${Math.max(1,pages.length)}`;};
 const measure=()=>{
  pages=[];let group:HTMLElement[]=[];nav.hidden=false;
  for(const item of units){if(item.hidden)continue;group.push(item);show(group);if(panel.scrollHeight>panel.clientHeight+2&&group.length>1){group.pop();pages.push(group);group=[item];}}
  if(group.length)pages.push(group);current=Math.min(current,Math.max(0,pages.length-1));draw();
 };
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
 previous.onclick=()=>{current=Math.max(0,current-1);draw();};next.onclick=()=>{current=Math.min(pages.length-1,current+1);draw();};
 panel.style.overflow='hidden';content.style.overflow='visible';
 const observer=new ResizeObserver(schedule);observer.observe(panel);
 panel.addEventListener('click',schedule);window.addEventListener('resize',measure);measure();
 return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',measure);panel.removeEventListener('click',schedule);nav.remove();styles.forEach((value,e)=>e.style.display=value);};
}

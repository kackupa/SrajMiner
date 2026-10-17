import { ORE_KEYS, ORES, type Ore } from '../config';

/** Explicit ore cards select one transfer panel; no accordion or dropdown. */
export function mobileStorage(selected: Ore | undefined, select: (ore: Ore | undefined) => void) {
 if (!matchMedia('(any-pointer: coarse)').matches) return;
 const rows=Array.from(document.querySelectorAll<HTMLElement>('.warehouse-ore-row'));
 if(!rows.length)return;
 const tabs=document.createElement('nav');tabs.className='storage-ore-tabs';tabs.setAttribute('aria-label','Choose ore');
 const choose=(ore:Ore)=>{select(ore);for(const [i,row] of rows.entries())row.hidden=ORE_KEYS[i]!==ore;tabs.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ore===ore)));};
 for(const [index,row] of rows.entries()){
  const ore=ORE_KEYS[index];row.classList.add('mobile-storage-row','storage-expanded');
  const button=document.createElement('button');button.type='button';button.dataset.ore=ore;button.id='storage-open-'+ore;button.textContent=ORES[ore].name;button.onclick=()=>choose(ore);tabs.append(button);
  const presets=document.createElement('div');presets.className='storage-presets';presets.setAttribute('aria-label',ORES[ore].name+' amount presets');
  for(const amount of [.5,1,5]){const b=document.createElement('button');b.textContent=String(amount);b.setAttribute('aria-label','Set '+ORES[ore].name+' amount to '+amount);b.onclick=()=>{const input=row.querySelector('input')!;input.value=String(amount);input.dispatchEvent(new Event('change',{bubbles:true}));};presets.append(b);}
  row.querySelector('.warehouse-row-amount')!.after(presets);
  const discard=row.querySelector<HTMLButtonElement>('.discard-ore');if(discard)discard.textContent='Discard from miner';
 }
 const list=rows[0].parentElement!, view=document.createElement('section');view.className='storage-card-view';list.before(view);view.append(tabs,list);list.closest('.camp-content')?.prepend(view);choose(selected??'copper');
}

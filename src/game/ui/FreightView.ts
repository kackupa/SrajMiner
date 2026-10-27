import { podPortrait } from './PodPortrait';
import { shipStoreArt } from './MenuArt';
import { buildingArt } from './BuildingArt';
import { CIVILISATIONS, CIVILISATION_KEYS, FRONTIER, MAPS, ORE_KEYS, ORES, type MapId, type Ore } from '../config';
import { cargoTotal, type InventorySource } from '../economy/Freight';
import { quoteCivilianShipment } from '../economy/Civilisations';
import { emptyCargo, type Cargo, type Progress } from '../economy/Progress';
export type FreightSelection = { source: InventorySource; target: InventorySource; ore: Ore; amount: number; notice: string; selling?: boolean; page?: number; advanced?: boolean };
export const initialFreight = (): FreightSelection => ({ source:'miner', target:'ship', ore:'copper', amount:1, notice:'' });
export const inventoryNames = {miner:'Miner',ship:'Mothership',planet:'Planet warehouse'};
export function bestOreOffer(p:Progress, stock:Cargo, state:FreightSelection) {
 const request={...emptyCargo(),[state.ore]:state.amount};
 return CIVILISATION_KEYS.map(buyer=>quoteCivilianShipment(stock,request,buyer,p.deliveries)).sort((a,b)=>b.total-a.total)[0];
}
function simpleFreight(p:Progress,planet:Cargo,capacity:number,map:MapId,state:FreightSelection,access:boolean,shipAccess:boolean,sellAccess:boolean,uplink:boolean) {
 const stores={miner:p.cargo,ship:p.shipCargo,planet},caps={miner:p.max('cargo'),ship:FRONTIER.shipCapacity,planet:capacity};
 const held=ORE_KEYS.filter(ore=>stores[state.source][ore]>0), size=innerHeight<500?1:innerHeight<650?2:innerWidth<701?3:innerHeight>=900?5:3;
 const pages=Math.max(1,Math.ceil(held.length/size)),page=Math.min(state.page??0,pages-1);
 const available=state.source==='miner'||state.source==='ship'&&shipAccess||state.source==='planet'&&access;
 const saleReason=!uplink?'Build a Market uplink to sell ore.':!sellAccess?'Visit the surface or your Market uplink to sell.':!available?'Visit this storage to use its ore.':'Selling uses the best available buyer.';
 const transferTarget=state.source!=='miner'?'miner':shipAccess&&caps.ship-cargoTotal(stores.ship)>=.5?'ship':'planet';
 const transferAccess=access&&available&&(transferTarget!=='ship'||shipAccess);
 const room=Math.max(0,caps[transferTarget]-cargoTotal(stores[transferTarget]));
 return `<section class="modal freight-screen simple-ore" role="dialog" aria-modal="true" aria-label="Your ore">
 <header><div><h1>My ore</h1><small>${p.money.toLocaleString()} Kredits</small></div><nav><button id="freight-complexity">Advanced</button><button id="close">Return to mine</button></nav></header>
 <nav class="simple-stores" aria-label="Where your ore is">${(['miner','ship','planet'] as const).map(key=>`<button data-freight-source="${key}" aria-pressed="${state.source===key}"><span class="store-picture" aria-hidden="true">${key==='miner'?podPortrait(p):key==='ship'?shipStoreArt():buildingArt('warehouse')}</span><b>${inventoryNames[key]}</b><strong>${cargoTotal(stores[key])}<small> / ${caps[key]}</small></strong><span>${key==='miner'?'What you carry':key==='ship'?'Stored on your ship':'Stored on this planet'}</span></button>`).join('')}</nav>
 <div class="simple-explainer"><b>${inventoryNames[state.source]}</b><span>${state.source==='miner'?'Store ore to free cargo space.':state.source==='ship'?'This ore is already stored on your mothership.':'This ore stays on '+MAPS[map].name+'.'} Building and buying parts use ore from all three stores.</span></div>
 <section class="simple-ore-list" aria-label="Ore in selected location">${held.length?held.slice(page*size,(page+1)*size).map(ore=>{
 const amount=stores[state.source][ore],move=Math.min(amount,room),offer=bestOreOffer(p,stores[state.source],{...state,ore,amount});
 return `<article class="simple-ore-row"><div><i style="background:${ORES[ore].hex}"></i><h2>${ORES[ore].name}</h2><strong>${amount} <small>ore</small></strong></div><nav>
 <button data-simple-ore="${ore}" data-simple-action="store" data-target="${transferTarget}" data-amount="${move}" ${!transferAccess||move<.5?'disabled':''}>${state.source==='miner'?'Store':'Take'} ${move>0?move:amount} ore<small>${state.source==='miner'?'in '+inventoryNames[transferTarget]:'into Miner'}</small></button>
 <button class="simple-sell" data-simple-ore="${ore}" data-simple-action="sell" data-amount="${amount}" ${!uplink||!sellAccess||!available||offer.total<=0?'disabled':''}>Sell → +${offer.total} Kredits<small>${amount} ${ORES[ore].name}</small></button></nav></article>`;
 }).join(''):`<div class="simple-empty"><h2>${state.source==='miner'?'Your miner is empty.':'Nothing stored here yet.'}</h2><p>${state.source==='miner'?cargoTotal(p.shipCargo)>0?'Your ore is on the mothership. Select Mothership above to use or sell it.':cargoTotal(planet)>0?'Your ore is in the planet warehouse. Select it above to use or sell it.':'Mine ore, then press F near the mothership or an ore warehouse to unload.':'Choose Miner above to store the ore you are carrying.'}</p></div>`}</section>
 ${pages>1?`<nav class="simple-pages"><button id="inventory-prev" ${page===0?'disabled':''}>← Previous</button><span>${page+1} / ${pages}</span><button id="inventory-next" ${page===pages-1?'disabled':''}>Next →</button></nav>`:''}
 <output role="status">${state.notice||(!transferAccess?'Visit the mothership or a warehouse to move ore. ':room<.5?'Storage is full. Sell ore or use Advanced to move it elsewhere. ':'')+saleReason}</output>
 <footer><span>Need exact quantities or different destinations? Use Advanced.</span><button id="cargo-discard">Discard miner ore</button></footer></section>`;
}

export function freightView(p: Progress, planet: Cargo, planetCapacity: number, map: MapId, state: FreightSelection, docked: boolean, shipAccess = true, sellAccess=false, uplink=false) {
 if(!state.advanced)return simpleFreight(p,planet,planetCapacity,map,state,docked,shipAccess,sellAccess,uplink);
 const compact=matchMedia('(max-width:700px), (max-height:500px)').matches, pageSize=compact?(innerWidth<=700&&innerHeight<650?2:3):9, pageCount=Math.ceil(ORE_KEYS.length/pageSize), page=Math.min(state.page??0,pageCount-1);
 const stores={miner:p.cargo,ship:p.shipCargo,planet}, capacities={miner:p.max('cargo'),ship:FRONTIER.shipCapacity,planet:planetCapacity};
 const source=stores[state.source],room=Math.max(0,capacities[state.target]-cargoTotal(stores[state.target])),offer=bestOreOffer(p,source,state);
 const sourceAccess=state.source==='miner'||state.source==='ship'&&shipAccess||state.source==='planet'&&docked;
 const reason=state.selling ? !uplink?'Build a Market uplink to sell ore.':!sellAccess?'Return to the surface or your Market uplink to sell.':!sourceAccess?'Visit the mothership or warehouse to sell this stock.':offer.total<=0?'Choose ore and a quantity to sell.':'' : !docked?'Return to the mothership or a warehouse to transfer.':(state.source==='ship'||state.target==='ship')&&!shipAccess?'Visit the mothership to transfer its cargo.':state.source===state.target?'Choose a different destination.':source[state.ore]<=0?'No selected ore in this inventory.':room<.5?'Destination full.':state.amount<=0?'Choose a quantity.':'';
 return `<section class="modal freight-screen" role="dialog" aria-modal="true" aria-label="Cargo and selling"><header><div><h1>Cargo & selling</h1><small>${MAPS[map].name} · ${p.money.toLocaleString()} Kredits</small></div><nav class="inventory-header-actions"><button id="freight-complexity">Simple view</button><button id="cargo-discard">Discard miner ore</button><button id="close">Return to mine</button></nav></header><div class="inventory-summary">${(['miner','ship','planet'] as const).map(key=>`<button data-freight-source="${key}" aria-pressed="${state.source===key}"><b>${inventoryNames[key]}</b><strong>${cargoTotal(stores[key])} / ${capacities[key]}</strong><small>${key==='miner'?'Travels with your rig':key==='ship'?'Travels between worlds':'Stays on '+MAPS[map].name}</small></button>`).join('')}</div><div class="inventory-layout"><section class="inventory-table" style="--inventory-rows:${pageSize}" aria-label="All ore by location"><div class="inventory-row inventory-heading"><span>Ore</span><span>Miner</span><span>Ship</span><span>Planet</span></div>${ORE_KEYS.slice(page*pageSize,(page+1)*pageSize).map(ore=>`<div class="inventory-row"><span><i style="background:${ORES[ore].hex}"></i>${ORES[ore].name}</span>${(['miner','ship','planet'] as const).map(key=>`<button data-stock="${key}:${ore}" aria-label="${ORES[ore].name} in ${inventoryNames[key]}: ${stores[key][ore]}" aria-pressed="${state.source===key&&state.ore===ore}">${stores[key][ore]}</button>`).join('')}</div>`).join('')}${pageCount>1?`<nav class="inventory-pages"><button id="inventory-prev" ${page===0?'disabled':''}>Previous</button><span>${page+1} / ${pageCount}</span><button id="inventory-next" ${page===pageCount-1?'disabled':''}>Next</button></nav>`:''}</section><section class="inventory-actions"><nav class="inventory-modes"><button data-inventory-mode="transfer" aria-pressed="${!state.selling}">Transfer</button><button data-inventory-mode="sell" aria-pressed="${!!state.selling}">Sell for Kredits</button></nav><h2>${ORES[state.ore].name} <small>from ${inventoryNames[state.source]}</small></h2>${state.selling?`<p>Best buyer: ${CIVILISATIONS[offer.buyer].name} · includes any project bonus</p>`:`<nav class="freight-targets" aria-label="Transfer destination">${(['miner','ship','planet'] as const).filter(key=>key!==state.source).map(key=>`<button data-freight-target="${key}" aria-pressed="${state.target===key}">To ${inventoryNames[key]}</button>`).join('')}</nav>`}<div class="freight-amounts" aria-label="Quantity">${[.5,1,5].map(n=>`<button data-freight-amount="${n}" aria-pressed="${state.amount===n}">${n}</button>`).join('')}<button id="freight-max">Max</button></div><button id="freight-transfer" class="primary" ${reason?'disabled':''}>${state.selling?`Sell ${offer.shipment[state.ore]} ${ORES[state.ore].name} · +${offer.total} Kredits`:`Move ${Math.max(0,Math.min(state.amount,source[state.ore],room))} ${ORES[state.ore].name} to ${inventoryNames[state.target]}`}</button><output role="status">${reason||state.notice||'Select a number in the table to choose ore and its source.'}</output></section></div><footer><span>${cargoTotal(planet)>planetCapacity?'Legacy stock retained above capacity. Withdraw or use it to free space.':'Building materials are shared locally. Selling removes ore only from the named inventory.'}</span></footer></section>`;
}
export function bindFreight(root: Element, state: FreightSelection, refresh:()=>void, transfer:()=>number, max:()=>number) {
 root.querySelector<HTMLButtonElement>('#freight-complexity')?.addEventListener('click',()=>{state.advanced=!state.advanced;state.page=0;state.notice='';refresh();});
 root.querySelectorAll<HTMLButtonElement>('[data-simple-ore]').forEach(button=>button.onclick=()=>{
  state.ore=button.dataset.simpleOre as Ore;state.selling=button.dataset.simpleAction==='sell';
  state.amount=Number(button.dataset.amount);if(button.dataset.target)state.target=button.dataset.target as InventorySource;
  const moved=transfer();
  state.notice=moved?state.selling?`Sold ${state.amount} ${ORES[state.ore].name} from ${inventoryNames[state.source]}. +${moved} Kredits.`:`Moved ${moved} ${ORES[state.ore].name} to ${inventoryNames[state.target]}.`:'Could not save that action. Your ore was retained.';
  refresh();
 });
 root.querySelector<HTMLButtonElement>('#inventory-prev')?.addEventListener('click',()=>{state.page=Math.max(0,(state.page??0)-1);refresh();});
 root.querySelector<HTMLButtonElement>('#inventory-next')?.addEventListener('click',()=>{state.page=(state.page??0)+1;refresh();});
 const selectSource=(source:InventorySource)=>{state.source=source;state.page=0;if(state.target===source)state.target=source==='miner'?'ship':'miner';state.notice='';};
 for(const key of ['source','target'] as const) root.querySelectorAll<HTMLButtonElement>(`[data-freight-${key}]`).forEach(b=>b.onclick=()=>{const value=b.getAttribute(`data-freight-${key}`) as InventorySource;if(key==='source')selectSource(value);else state.target=value;state.notice='';refresh();});
 root.querySelectorAll<HTMLButtonElement>('[data-stock]').forEach(b=>b.onclick=()=>{const [source,ore]=b.dataset.stock!.split(':');selectSource(source as InventorySource);state.ore=ore as Ore;refresh();});
 root.querySelectorAll<HTMLButtonElement>('[data-inventory-mode]').forEach(b=>b.onclick=()=>{state.selling=b.dataset.inventoryMode==='sell';state.notice='';refresh();});
 root.querySelectorAll<HTMLButtonElement>('[data-freight-amount]').forEach(b=>b.onclick=()=>{state.amount=Number(b.dataset.freightAmount);state.notice='';refresh();});
 if(!state.advanced)return;
 root.querySelector<HTMLButtonElement>('#freight-max')!.onclick=()=>{state.amount=max();refresh();};
 root.querySelector<HTMLButtonElement>('#freight-transfer')!.onclick=()=>{const moved=transfer();state.notice=moved?state.selling?`Sold from ${inventoryNames[state.source]}. +${moved} Kredits saved.`:`Moved ${moved} ${ORES[state.ore].name}.`:'Action failed. Ore retained.';refresh();};
}

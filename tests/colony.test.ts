import assert from 'node:assert/strict';
import { dismantleBuilding, dismantleRefund } from '../src/game/building/ColonyManagement';
import { emptyCargo } from '../src/game/economy/Progress';
import type { UndergroundStructure } from '../src/game/building/UndergroundStructures';
const extractor: UndergroundStructure={id:'extractor:test',kind:'extractor',x:500,y:0,level:2,productionFraction:.25};
assert.deepEqual(dismantleRefund(extractor),{copper:1.5,iron:.5});
for(const save of [()=>false,()=>{throw new Error('disk full')}]) {
 const buildings=[{...extractor}],stock={...emptyCargo(),copper:2.5};const before=JSON.stringify({buildings,stock});
 assert.equal(dismantleBuilding(buildings,stock,extractor.id,50,save).ok,false);
 assert.equal(JSON.stringify({buildings,stock}),before,'failed save restores exact state');
}
const buildings=[{...extractor}],stock=emptyCargo();
assert.equal(dismantleBuilding(buildings,stock,extractor.id,50,()=>true).ok,true);
assert.equal(buildings.length,0);assert.equal(stock.copper,1.5);assert.equal(stock.iron,.5);
assert.equal(dismantleBuilding(buildings,stock,extractor.id,50,()=>true).ok,false,'repeat cannot duplicate refund');
const depot:UndergroundStructure={id:'depot',kind:'warehouse',x:0,y:0};
const full={...emptyCargo(),copper:50};let writes=0;
assert.equal(dismantleBuilding([depot],full,'depot',50,()=>{writes++;return true}).ok,false);
assert.equal(writes,0,'capacity failure does not save or remove warehouse');
console.log('PASS colony dismantling: fractional refunds, capacity protection, duplicate prevention and save rollback');

// Deep-seam depletion is shared by colocated extractors and survives reconstruction.
const { extractionSeam, extractorStatus } = await import('../src/game/economy/ExtractionSeams');
const { accumulateAutomatedProduction } = await import('../src/game/economy/Warehouse');
const ledger:Record<string,number>={}, seamRig:UndergroundStructure={id:'seam',kind:'extractor',x:100,y:0,level:1};
const seamStock=emptyCargo();
accumulateAutomatedProduction([seamRig],seamStock,'cryo-shelf',3600,100,ledger);
assert.equal(seamStock.copper,24);assert.equal(extractionSeam('cryo-shelf',seamRig,ledger).remaining,36);
const key=extractionSeam('cryo-shelf',seamRig,ledger).key;ledger[key]=59.5;
accumulateAutomatedProduction([seamRig,{...seamRig,id:'second'}],seamStock,'cryo-shelf',3600,100,ledger);
assert.equal(seamStock.copper,24.5);assert.equal(ledger[key],60);
assert.equal(extractorStatus('cryo-shelf',{...seamRig,id:'rebuilt'},JSON.parse(JSON.stringify(ledger)),0,100).state,'Deposit exhausted');
const fullStock={...emptyCargo(),copper:100}, beforeLedger=JSON.stringify(ledger);
accumulateAutomatedProduction([{...seamRig,x:400}],fullStock,'cryo-shelf',3600,100,ledger);
assert.equal(JSON.stringify(ledger),beforeLedger,'full storage never consumes seam');
assert.equal(extractorStatus('cryo-shelf',{...seamRig,x:1100},ledger,0,100).state,'Upgrade required');
console.log('PASS finite seams: shared depletion, exhaustion, storage pause, tier eligibility and reload persistence');

const { Progress } = await import('../src/game/economy/Progress');
const { colonyOrders, deliverColonyOrder } = await import('../src/game/economy/ColonyOrders');
const order=colonyOrders('cryo-shelf')[0];
for(const save of [()=>false,()=>{throw new Error('disk full')}]){
 const p=new Progress();p.cargo.copper=.5;const store={...emptyCargo(),copper:20};const before=JSON.stringify({p,store});
 assert.equal(deliverColonyOrder(p,store,'cryo-shelf',order.id,save),false);assert.equal(JSON.stringify({p,store}),before);
}
const buyerProgress=new Progress();buyerProgress.cargo.copper=.5;const buyerStore={...emptyCargo(),copper:20};const oldMoney=buyerProgress.money;
assert.equal(deliverColonyOrder(buyerProgress,buyerStore,'cryo-shelf',order.id,()=>true),true);
assert.equal(buyerProgress.cargo.copper,0);assert.equal(buyerStore.copper,8.5);assert.equal(buyerProgress.money,oldMoney+order.reward);
assert.equal(deliverColonyOrder(buyerProgress,buyerStore,'cryo-shelf',order.id,()=>true),false);
assert.equal(deliverColonyOrder(buyerProgress,buyerStore,'mars-frontier',order.id,()=>true),false);
assert.equal(buyerProgress.money,oldMoney+order.reward);
console.log('PASS optional orders: pooled exact delivery, one-time reward, planet scope and save rollback');

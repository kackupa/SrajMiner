import assert from 'node:assert/strict';
import { Progress } from '../src/game/economy/Progress';
import { quickRepair } from '../src/game/economy/QuickRepair';
const p=new Progress();p.money=1000;p.hull=40;p.fuel=20;p.cargo.iron=4;
const cost=p.serviceCost('hull')+p.serviceCost('fuel'),before=p.money,loadout=JSON.stringify(p.loadout);let saves=0;
assert.equal(quickRepair(p,()=>{saves++;return true;}),true);
assert.equal(p.hull,p.max('hull'));assert.equal(p.fuel,p.max('fuel'));assert.equal(p.money,before-cost);assert.equal(p.cargo.iron,4);assert.equal(JSON.stringify(p.loadout),loadout);
assert.equal(quickRepair(p,()=>{saves++;return true;}),false);assert.equal(saves,1);
p.hull=30;p.fuel=10;const snap={money:p.money,hull:p.hull,fuel:p.fuel};
for(const save of [()=>false,()=>{throw Error('disk');}]){assert.equal(quickRepair(p,save),false);assert.deepEqual({money:p.money,hull:p.hull,fuel:p.fuel},snap);}
p.money=0;assert.equal(quickRepair(p,()=>{throw Error('should not save');}),false);assert.equal(p.hull,30);
console.log('PASS quick repair: price, full service, cargo/loadout retention, duplicate prevention, insufficient funds and rollback');

import assert from 'node:assert/strict';
import { Progress, emptyCargo } from '../src/game/economy/Progress';
import { installRigUpgrade } from '../src/game/economy/RigUpgrade';
import { PREBUILD, UPGRADE_KEYS, rigMaterialCost, COMMON_ORES } from '../src/game/config';
for(const key of UPGRADE_KEYS){
 const p=new Progress(),stock={...emptyCargo(),copper:100,iron:100,silver:100};p.money=0;p.cargo={...emptyCargo(),copper:.5};
 const before={...stock},cost=rigMaterialCost(key,p.levels[key]),old=p.max(key),fuel=p.fuel,hull=p.hull;
 assert.ok(installRigUpgrade(p,stock,key,()=>true));assert.equal(p.levels[key],2);assert.equal(p.money,0);
 for(const ore of COMMON_ORES)assert.equal(p.cargo[ore]+stock[ore],before[ore]+(ore==='copper'?.5:0)-(cost[ore]??0));
 if(key==='fuel')assert.equal(p.fuel,fuel+p.max(key)-old);
 if(key==='hull')assert.equal(p.hull,hull+p.max(key)-old);
 if(key==='grapple')assert.equal(p.grappleOwned,true);
}
for(const save of [()=>false,()=>{throw new Error('storage failure')}]){
 const p=new Progress(),stock={...emptyCargo(),copper:40,iron:40,silver:40};p.cargo.copper=.5;
 for(const key of UPGRADE_KEYS){const before=JSON.stringify({p,stock});assert.equal(installRigUpgrade(p,stock,key,save),false);assert.equal(JSON.stringify({p,stock}),before);}
}
const p=new Progress(),stock=emptyCargo();assert.equal(installRigUpgrade(p,stock,'drill',()=>true),false);
p.levels.drill=12;stock.iron=999;stock.copper=999;assert.equal(installRigUpgrade(p,stock,'drill',()=>true),false);assert.equal(p.levels.drill,12);
for(const key of UPGRADE_KEYS)for(let level=1;level<5;level++)for(const ore of Object.keys(rigMaterialCost(key,level)))assert.ok((COMMON_ORES as readonly string[]).includes(ore));
assert.equal(PREBUILD.travelEnabled,false);
console.log('PASS material rig upgrades: zero-credit purchase, pooled ore conservation, bonuses, rollback, shortages and preserved legacy levels');

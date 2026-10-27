import assert from 'node:assert/strict';
import { Progress, emptyCargo } from '../src/game/economy/Progress';
import { sellInventory } from '../src/game/economy/InventorySale';
for(const source of ['miner','ship','planet'] as const){
 const p=new Progress(),planet={...emptyCargo(),copper:7};p.money=0;p.cargo.copper=3;p.shipCargo.copper=5;
 const stocks={miner:p.cargo,ship:p.shipCargo,planet},before=JSON.stringify(stocks);
 for(const save of [()=>false,()=>{throw Error('quota')}]){assert.equal(sellInventory(p,stocks[source],'helion',{...emptyCargo(),copper:1},save),0);assert.equal(JSON.stringify(stocks),before);assert.equal(p.money,0);assert.deepEqual(p.deliveries,{});}
 const original={miner:3,ship:5,planet:7},paid=sellInventory(p,stocks[source],'helion',{...emptyCargo(),copper:1},()=>true);
 assert.ok(paid>0);assert.equal(p.money,paid);for(const key of ['miner','ship','planet'] as const)assert.equal(stocks[key].copper,original[key]-(key===source?1:0));
 assert.equal(sellInventory(p,stocks[source],'helion',{...emptyCargo(),copper:-1},()=>true),0);
}
console.log('PASS named-inventory sales conserve other stores and roll back false/throw saves');
import {quoteQuickSale} from '../src/game/economy/InventorySale';
const quick=new Progress();quick.cargo={...emptyCargo(),copper:3.5,iron:6};
const offer=quoteQuickSale(quick),moneyBefore=quick.money,unitsBefore={...quick.cargo};
assert.ok(offer.total>0);assert.deepEqual(quick.cargo,unitsBefore,'quote does not sell');
const amount=sellInventory(quick,quick.cargo,offer.buyer,offer.shipment,()=>true);
assert.equal(amount,offer.total);assert.equal(quick.money-moneyBefore,offer.total);assert.deepEqual(quick.cargo,emptyCargo());
assert.equal(sellInventory(quick,quick.cargo,offer.buyer,offer.shipment,()=>true),0,'repeated sale cannot pay twice');
assert.equal(quoteQuickSale(quick).total,0);
console.log('PASS quick-sale quote equals exact payout and repeat sale cannot duplicate Kredits');

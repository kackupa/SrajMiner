# Living Frontier implementation plan

Approved scope, 24 October 2026. Ore Frontier remains a mining empire sandbox. Kredits are ordinary game currency. No token integration or new multiplayer authority is included.

1. Introduce an owned, interchangeable equipment catalogue. Slots: hull, drill, engine, battery, weapon and utility. Buy models directly with shared planetary materials, never prerequisite levels. Preserve legacy upgrades and inventories. Fixed equipment power requirements consume battery fitting capacity; battery charge remains a separate runtime resource. Reject overcapacity fits and cargo-reducing swaps that would destroy ore. Save transactions must roll back on failure.
2. Replace the local rig workshop with a fullscreen visual loadout, illustrated equipment and a live rig preview. Show costs, trade-offs, fitted power percentage and ownership. Explicit item pages, no scrollbars, checkboxes or selects. Preserve access to existing equipment. Desktop and mobile must keep the purchase action visible.
3. Add separate weapons: start unarmed, Shift + left mouse fires toward the cursor. Mobile has a hold-to-fire button with enemy aiming assistance. Machine gun, autocannon and laser use charge, cooldowns and distinct visual/audio feedback. Weapons must not drill terrain or fire through solid rock.
4. Keep enemy territories separate. Surface raiders withdraw when the miner hides below ground. Underground predators withdraw on reaching the surface or entering a shelter. Visible retreat, cooldown before another encounter and no camping the door.
5. Upgrade the existing underground service structure into a shelter. Build in cleared underground space, enter/exit with E, freeze the rig rather than the world. Gradual automatic hull repair and charge recovery with live percentages. Exit at any time; prevent firing/mining/building from shelter. Multiple shelters supported. Loadout fitting available there. Persist recovery through ordinary saves, no invulnerability after departure.
6. Give mining and fighting expressive original effects: articulated rig attachments, muzzle flashes, shot traces, impact debris, distinct charge effects, shelter light pulses. Respect reduced motion and bounded particle lifetimes.
7. Verify migration, fit constraints, transactions, terrain occlusion, retreat and recovery with tests. Run npm install, npm test and npm run build. Browser-play desktop and mobile layouts, reload and check inventories. Record actual findings in README and this document. Do not claim physical Android testing or online parity without evidence.

Release gate: buy a model without intermediate purchases, fit it, see it on the rig, mine, fire safely at creatures, build/enter a shelter, recover while world time advances, leave and reload without losing or duplicating resources.

Existing verified-online rules remain isolated from local sandbox changes. Porting new equipment and combat to authoritative online simulation is a separate release requirement before advertising these mechanics as online multiplayer.

## Implementation and verification

Implemented locally: equipment catalogue and visual fitting, save v33 migration, three weapons, terrain occlusion, separate creature territories, four-second shelter deployment, live shelter recovery/refit, three charge modes and original action effects. Existing online rules remain separate. No commit, push or production deployment was performed for this update.

Chromium findings:
- Directly purchased/fitted a hauler and machine gun; all tested loadout viewport sizes retained visible controls.
- Real keyboard drilling changed terrain and consumed charge. Shift firing consumed charge without drilling additional terrain.
- Aimed machine-gun fire repelled an underground creature.
- Shelter recovery increased charge from 65 to 79.12 and hull from 41.35 to 48.40 in the observed interval; recovery continued during refitting.
- Four-second deployment created a shelter; fitted equipment, ore and the shelter survived reload.
- Mobile held FIRE consumed charge; releasing stopped consumption. Shelter entry and fullscreen loadout worked in Chromium touch emulation.
- Compact tools show illustrated items with explicit previous/next navigation and three charge choices.

npm install, npm test and npm run build passed. Physical Android testing, long-run economy/combat tuning and authoritative multiplayer implementation of these new mechanics remain outstanding. The production bundle retains Vite's size warning.

Approved miner art implementation: shared ConceptMiner geometry now supplies the workshop and gameplay renderers. The offset pilot cockpit and caged lamp remain visible across hulls. Animated channels cover leg folding, surface stride, drilling brace/rotating teeth, banking and touchdown suspension. Browser checks exercised keyboard flight, landing and mining, plus touch firing/refitting and reduced motion. No collision or save schema changes were made by this art pass.

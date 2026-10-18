# Ore Frontier: Beyond the First Colony

Status: M0–M6 implemented and locally verified. Not committed, pushed, deployed or released.
Prepared: 2026-10-18. Audience: GPT-6.1 Sol in a new Codex chat.
Owner approval: user approved the expansion direction and requested this detailed plan. Numerical tuning and new recovery rules below are proposed implementation defaults, not previously playtested or separately user-approved designs. Implement these defaults; report evidence-driven adjustments in the decision log rather than quietly changing scope.

## 1. Outcome and scope

Deliver a complete two-world mining operation: mine Cryo Shelf, recover its core, load construction ore, depart in the mothership, land on Mars Frontier, establish an independent colony, mine nickel, return, and use imported resources. Repeat this loop without losing inventory, exhausting the only possible travel supply, or erasing either world.

The game is Ore Frontier. Mars Frontier is an existing planet name, never the product name. Domain: playorefrontier.xyz. CREDIT is the future token name; Robinhood chain remains the intended direction, tokenomics TBD. In-game credits are not a live token. No wallet or token integration in this installment.

Roadmap: current colony sandbox -> this two-world expansion -> server-authoritative player ore trading -> combat. Combat design is deferred; existing raid/creature/defence code is not permission to expand it now. Multiplayer remains visibly coming soon. Do not fabricate live players, orders or activity.

In scope: two destinations; persistent colonies; physical freight; one travel interface; renewable core fuel; two optional specialist installations; honest website copy; release-specific gameplay recording and X draft.
Out of scope: more playable worlds, inhabited-world landings, refined metals, crafting chains, new buildings unrelated to the loop, combat additions, PvP, accounts/backend, tokenomics, token launch, paid services, automated freight fleets, research tree, extensive scene rewrite.

## 2. Verified code baseline and traps

Inspect git status, AGENTS.md and current files again before editing. The repository can change between chats. Preserve unrelated edits, including the compact welcome-screen work. No assumptions about branch or deployment state.

| Existing system | Actual entry points | Reuse / necessary change |
| --- | --- | --- |
| Balance/geography | src/game/config.ts | PREBUILD.travelEnabled is false; common ores and exclusives already exist; CORE_FUEL gives 4/core and jumpCost 1; mothership storage is 50. |
| Travel | src/game/MiningScene.ts: travelFromSolar, travelToMap, landFromSolar; campaign/SolarSystem.ts; campaign/Orbit.ts | Legacy orbital travel exists. Fuel currently changes before destination switch; final save result is not handled as a travel transaction. Do not simply flip the flag. |
| Attractive map | ui/StarMap.ts and StarMap.css | Preview-only map is separate from SolarView. Make this the single travel surface. |
| World persistence | campaign/MapState.ts, save/SaveManager.ts | Save schema 31, key mars-miner.v1; per-world structures, warehouse, mined state; global extraction ledger and productionUpdatedAt. Preserve all. |
| Construction | building/PlanetaryMaterials.ts, ColonyManagement.ts, UndergroundStructures.ts | Pools miner and current warehouse; transactions generally rollback. Extend with explicit local ship source, no remote inventory. |
| Automation | economy/Warehouse.ts, ExtractionSeams.ts; scene applyAutomatedProduction | Finite shared seams, rates 24/48/96 per hour, 12-hour catch-up. Active warehouse gets an additional 50 capacity, currently conflating ship and planet. |
| Remote inventory | scene transferWarehouse; economy/SystemProjects.ts remoteWarehouseAccess | Cargo Tug can permit remote withdrawals. This conflicts with meaningful freight; gate remote withdrawals in this release while preserving earned milestones. |
| Rig | economy/Progress.ts, RigUpgrade.ts, ui/RigWorkshop.ts | Material-funded basic upgrades through 5; specialist cards are previews. Use existing effective-stat calculations. |
| UX | HUD.ts, MobileStorage.ts, TouchControls.ts, PanelPages.ts | Retain established full-screen cards, touch WASD and explicit paging. Welcome must remain one screen. |
| Existing threats | world/SurfaceRaid.ts, RockSwimmer.ts | Preserve existing behaviour; no new combat work in this update. Audit destinations for accidentally re-enabled threats. |

README records a historical core-crossing return obstruction. Treat this as an unresolved release risk until a fresh real-time return passes. Earlier fixture travel tests are not evidence this new earned-resource loop works.

## 3. Locked player experience

### Worlds and resources
- Start on Cryo Shelf. Second live destination: Mars Frontier, contrasting warm rock/red dust against Cryo ice. Reuse procedural art and geology; no imported game assets.
- Both supply copper, iron and silver. Cryo supplies cryocrystal; Mars supplies nickel. Preserve other worlds' geology and saved data, but mark them Coming soon.
- Existing saves on another world remain playable there. Provide a one-time, free relocation into Cryo via the map, retaining rig cargo, ship cargo and old planetary state. Show that returning to that legacy world is unavailable in this release. Do not silently relocate or discard its warehouse.
- Do not regenerate mined cells or change stored planet geometry. For newly generated Mars, use the compact starter chart size for a manageable second-world loop; existing Mars chart dimensions remain unchanged. Check depth-based ore eligibility against this size.
- Basic construction and all basic rig upgrades remain possible with common ores. Exclusive resources buy optional benefits, never the ability to return home.

### Travel, fuel and repeatability
- Open Star map from the mothership. Browse anywhere, but Depart requires the rig safely docked at its mothership, no active placement/charge or unresolved transaction.
- No mandatory manual ascent or second flight map. Depart performs departure/transit/landing automatically; legacy W-to-orbit paths must not bypass policy or charge fuel twice.
- Two-world route costs exactly 1 core fuel each way. Use a single config-backed quote for UI and transaction; the legacy distance formula does not apply to this release.
- First recovery of each planetary core awards the existing 4 units exactly once. Browsing, selecting, cancelling and returning to the same world cost nothing.
- Before leaving for a world without its core recovered, require 2 fuel: one outward and one reserved for return. Show '1 outward + 1 return reserve'. Returning to a world with a recovered core requires only 1. Do not create a second spendable reserve balance.
- Renewable supply: after recovering a planet's core, its exposed core deposit can be mined again for fuel. Each completed 10-second extraction adds 1 core fuel, up to a renewable top-up ceiling of 4; initial/legacy balances above 4 remain untouched. At/above 4, show 'Fuel reserve full'. This is repeatable mining at the core, not passive currency or a refinery. Keep progress transient; interruption/reload resets unfinished extraction and cannot award partial/duplicate fuel. Store duration/ceiling in config. First recovery retains the existing milestone/4-unit reward path.
- Emergency recovery is for stranded legacy/corrupt edge states: when docked with insufficient fuel for any allowed destination and the current core is unrecovered, offer a confirmed tow to Cryo. Preserve all inventory, buildings and fuel; grant no fuel or money. If already on Cryo, show the core-mining objective instead. Normal release travel cannot enter that stranded state because of the reserve rule.
- Sequence target 2.4 seconds with Skip; reduced motion lands immediately. Visual animation has no economic side effects.
- State model: docked -> validating -> durable destination committed -> presentation -> landed. Save an already-valid destination state before animation. Reload during animation starts landed. Duplicate clicks/Skip/timer callbacks cannot repeat a transaction. On save false/throw restore the complete source snapshot and display a clear failure; do not show successful departure.

### Three inventories, no hidden teleporting
- Miner cargo: existing carried inventory and capacity.
- Ship hold: new global cargo record, 50 units, travels with the mothership.
- Planet stockpile: existing per-world warehouse record, stays on that planet, capacity from warehouse buildings only.
- Construction on the active planet pools miner -> ship -> planet, in that deterministic order. The landed ship supports the active planet's construction network across its surface. Other planets never contribute. Display the three totals on demand; no extra transfer chore before building.
- Transfers occur only while docked/at the relevant local store. Ship hold <-> local stockpile and miner <-> ship/local stockpile are explicit source/target buttons. Remote planets are read-only. Keep Cargo Tug milestones intact but label remote transfer unavailable in this release; do not silently revoke money or completion rewards.
- No auto-unload on landing/departure. Half-unit quantities; direct .5, 1, 5 and Max buttons. Clamp Max to available quantity and destination capacity. All transfer operations conserve total ore and rollback on failed saves.
- Active extractors fill local warehouse first, then free ship hold capacity while that ship is landed on this planet. Inactive extractors can only fill their local warehouse. Without a warehouse they stop while the ship is away. UI explains that specific state.
- Never use a combined 50+warehouse limit against only one inventory after this change. Update status, fill graphics, dismantle checks, salvage refunds, sales/contracts and every material-consuming call site.
- Existing contracts/sales must name their participating sources. Keep market sales miner-only unless current UI explicitly offers storage; do not silently sell ship contents. Construction, basic/specialist installations and local colony contracts may use the local three-source pool consistently.

### Optional specialist rewards
Two one-time installations, both compatible and persistent, no loadout dropdown:
- Reinforced hull: 4 nickel + 6 iron, +20% effective maximum hull. Apply once to the effective base/profile stat, not recursively. Preserve current hull percentage at purchase; no free full repair. Card shows exact before/after values.
- Efficient cooling: 4 cryocrystal + 4 copper, 10% lower battery expenditure from drilling only. No change to thrust, recharge, drill speed or existing laser overheating rules. Implement at the actual drilling energy debit. If no distinct debit exists, add one clearly bounded multiplier there rather than silently changing all fuel usage.
- No credits, level gate or other-planet ownership required beyond obtaining materials. Install at mothership; no recurring craft loop. Imported materials and ownership survive reload. Other specialist previews remain Coming soon.

## 4. Save migration and transaction design

Use next available schema version after inspecting HEAD (32 if still 31). Keep storage key. Define shipCargo and explicit specialist ownership with strict validators; every Ore key exists, finite nonnegative half-unit quantities; no arbitrary module IDs. Retain production timestamp and depletion data.

Version-31 inventory interpretation is ambiguous: storage was labelled ship hold but saved per planet. Do not invent historical provenance. Migration preserves quantities exactly:
1. Leave all old per-world warehouse quantities on their original planet. Initialize shipCargo empty and specialist ownership empty.
2. For each world, retain any stock above its real warehouse capacity as legacy overflow. This may be derived as max(0,total-capacity), not a second duplicate ore record. Never trim or move it automatically.
3. Overflow can be withdrawn/spent but cannot receive new production/deposits while over capacity. Legacy worlds without a warehouse retain a reclaimable local cache until emptied. Explain 'Legacy stock retained. Build storage or load your ship.'
4. First-use migration notice explains that old stock stayed on its planet and the new ship hold travels. Opening/closing notice is not a migration trigger; migration is idempotent.
5. Preserve all credits, levels above current limits, milestones, geometry, mined cells, drops, structures, levels/integrity, selected cosmetics, ore, core fuel and future-world state.

Prefer pure quote/validate/apply helpers for travel and inventory, with a single scene adapter. Keep MiningScene orchestration small. A durable candidate save must contain coherent activeMap, world snapshots, pod position, docked state, ship cargo, core balance, production timestamp and module ownership. Avoid retaining references into mutated old state for rollback. Test save returning false AND throwing. Include migration/export/import round-trip tests. Never edit the user's actual local save for QA.

## 5. Production accounting

Settle elapsed production once immediately before departure against the source ship location, then snapshot it. After departure, ship hold can receive output only on the destination. On return, settle the away interval against each planet's stationary capacity, never retroactively add ship capacity to the departed colony.

Reuse finite-seam accounting. Preserve fractions/depletion on move/reload, full-storage pause, shared-sector depletion and supported-tier rules. Inactive production uses timestamps, not simulated Phaser scenes. Apply the 12-hour cap once per catch-up interval. Clock rollback must not manufacture elapsed time. A summary shows actual ore delta since departure, not estimated output presented as earned. Report full/exhausted/no-warehouse status. Any new summary baselines must be durable or explicitly session-only and omitted when unavailable; do not recalculate fictitious earnings.

## 6. Screen contract and visual direction

Non-negotiable: no scrolling, scrollbars, checkboxes, native/text dropdowns. Do not hide overflow to conceal unreachable content. No giant title-only page that separates the primary action. No em dashes in new player-facing copy.

Brand: navy space backgrounds, cream condensed headings, amber main actions, cyan information; existing miner, ship, planet art and original sound. Real state drives animation. Reduced-motion mode removes movement without removing feedback.

Star map: chart occupies most of viewport; central star and orbital tracks retained. Mining planets show geology, inhabited planets city lights/stations. No dotted fake player trade route. Two live worlds; other destinations explicitly preview-only. Selected route is a restrained solid highlight. Desktop details beside map, portrait compact bottom inspector. Tabs 'Survey' and 'Colony' when needed, one fixed primary action. Show local ores, current/visited/preview status, fuel aboard, cost, required reserve and projected balance. Actual production statuses and stock totals only. Back restores previous focus and screen.

Freight: full-screen 'Miner / Ship / Planet' source buttons, explicit destination buttons; ore rows on desktop, ore cards/paged selection on phone. Show held/capacity for each inventory and clearly mark legacy overflow. Keep amount/Max/Transfer on the same screen. Disable zero/invalid transfers with a visible reason. Destructive discard is separate, names exact source/quantity and requires confirmation; preserve existing discard scope unless expanding is necessary, never silently discard.

Arrival: short planet name and exclusive ore notice, immediate deploy action. No second E press after leaving ship services. Colony overview identifies which planet it represents; remote overview is read-only, no Locate/Move/Dismantle for an inactive scene.

Workshop: two active specialist cards with cost, benefit, shortage and Install/Installed state. Other cards retain Coming soon. Common upgrades unchanged.

Mobile: WASD left, actions right; minimum 44px actionable targets, safe areas, keyboard focus, readable quantities. Rotation, blur, modal changes and travel clear held movement. Test 320x568, 390x844, 844x390, 1280x720, 1597x777. All main actions remain reachable on one screen; paginate repeated records only.

## 7. Implementation milestones

Do not start multiple competing rewrites. Each milestone ends with evidence in this file. Ask only for real blockers or material design changes; routine implementation choices are authorized.

- [x] M0 Baseline: record branch/status, test/build baseline, current scene/save/UI hooks and existing known failures. Confirm core extraction/return path and current production clock behaviour. Do not claim old findings as new tests.
- [x] M1 Data and accounting: introduce config policy/allowlist, inventory helpers, module ownership and migration. Tests prove exact conservation including overflow and legacy worlds. All existing saves still load.
- [x] M2 Freight and local material pool: ship/local UI and source-aware costs, production sink split, remote-withdraw restriction, status/refunds/capacity checks. Desktop/touch transfers and save failure browser cases pass.
- [x] M3 Reliable travel: one transactional service and one star map, fuel quote/reserve, repeat core mining, legacy tow/relocation, clear landing state. Disable/bypass all old travel backdoors. Two-world round trip and refresh mid-transition pass.
- [x] M4 Second-world payoff: contrasting Mars surface, reachable nickel, two specialist installations, persistent away production summary. No paid fixtures in the earned-resource acceptance run.
- [x] M5 Polish and consistency: full-screen responsiveness, focus/reduced motion, stale copy sweep, map/colony counts, destination markings, guide and homepage claims. Run the complete acceptance matrix.
- [x] M6 Deliverable: reviewed diff, release notes, actual gameplay video/post draft, deployment status stated accurately. Commit/push/publish only when specifically authorized in this new implementation session. Do not put marketing captures into Git.

Suggested new modules (names are flexible): campaign/Travel.ts for quotes/transactions; economy/Freight.ts for source-aware transfers; economy/SpecialistModules.ts for effective benefits. Reuse SaveManager, MapState, Progress and existing UI components. Do not create a second source of truth for ores, fuel or world IDs.

## 8. Acceptance and regression matrix

Automated tests must assert observable invariants, not restate implementation:
- 31 -> next migration retains every resource and planet; overflow, absent stores, legacy high levels and valid older saves; invalid cargo/module values rejected; repeated migration stable.
- Transfer .5/Max, zero, negative, NaN, full/overfull target, remote target, save false/throw. Sum across all inventories changes only for explicit spends/mining/sales/refunds.
- Construction/install/contract cost uses intended local pool and cannot touch another planet. Cancel/failure spends nothing.
- One outward/one return fuel; insufficient reserve disabled; no charge on select/cancel/same planet; duplicate departure/Skip; refresh before/after durable commit; failure restores source.
- First core reward once, renewable extraction only after recovery, interrupted work no reward, top-up ceiling preserves excess legacy fuel.
- Unsupported worlds cannot be reached through scene callbacks/legacy flight; legacy save remains valid and relocation preserves everything.
- Off-world production respects warehouse-only capacity, time cap, tiers, finite shared seam, full-state no banking, no replay on reload, no retroactive ship capacity.
- Specialists charge once, stat effect once, persist, no full heal, common upgrade/profile interactions stable; old saves have neutral defaults.

Browser acceptance (real inputs):
1. Fresh save: mine common ores, freely place extractor/warehouse, recover core and return alive with earned upgrades/resources only. Fix blockers in drilling/collision/return, not by granting test resources.
2. Load supplies, depart Cryo, land Mars, deploy without extra E, build warehouse/extractor, mine nickel, return and install the hull specialist. Recover/refuel at an exposed core and demonstrate another round trip remains possible.
3. Revisit both worlds: geometry/tunnels/structures/levels/stock/seams retained. Confirm away output equals elapsed-time rules. Use controlled-clock fixtures separately for long catch-up cases and label them.
4. Reload at travel start/animation/arrival; cancel map; resize/rotate/blur while holding input; insufficient fuel/storage and save failure.
5. All listed viewport sizes: no document or panel overflow; no hidden focusable controls; primary actions visible; no select/details/checkbox replacements creeping in. Screenshot and inspect, not dimensions alone.
6. Android physical test remains user-provided. Report browser emulation separately; do not block local completion pretending hardware was tested.

Run npm install, npm test and npm run build as repository instructions require. Browser-test all input/rendering changes. Store QA under ignored output/playwright/. Update README and docs/QA.md with actual results and remaining limits. Existing large-bundle warning is not a new failure, but capture any regression. Do not claim release ready with unresolved return-home, save loss or ore duplication bugs.

## 9. Progress video and X package

This is a deliverable after working gameplay exists, not permission to post now. Actual game capture only, no generated substitute gameplay. Capture isolated test save; never overwrite user's progress. Prepared saves are acceptable for promotional shots if production notes disclose them; prove earned gameplay separately. No invented multiplayer/travel availability.

25-35 seconds, readable on a phone, no emojis or em dashes:
- 0-4s existing Cryo colony, load ship supplies: 'YOUR COLONY IS JUST THE START'.
- 4-9s selected live route and departure: 'TAKE YOUR OPERATION OFF-WORLD'.
- 9-15s Mars landing and nickel mining: 'NEW WORLD. DIFFERENT RESOURCES.'
- 15-22s free-placement warehouse/extractor: 'BUILD YOUR SECOND COLONY'.
- 22-28s return, real production summary, hull installation: 'BRING THE GROWTH HOME'.
- 28-32s title/domain and accurate release status.
Use existing original/synthesized game audio, balanced under captions. Reduced rapid flashing; no placeholder screens or invalid placement shots. MP4 H.264/AAC, verify decode/duration/audio and inspect frames after export. Keep captions accurate to implemented state.

Progress post draft (maximum three lines):
Ore Frontier update in development.
Load your mothership. Build on a second world. Bring rare ore home.
Follow the build: playorefrontier.xyz

After verified production deployment, change first line to 'Ore Frontier update.' and last to 'Play the early build: playorefrontier.xyz/play'. Do not call it live based on a local build or preview URL. Save video, poster, post and production notes under ignored output/marketing/<update-folder>/, never stage them. Upload/draft on X only on explicit request; publishing is a separate action.

## 10. Review findings and resolution

This plan was reviewed against the inspected source on 2026-10-18. This is a planning/code-inspection review, not an Astra-specific or independent review and not an implementation test.

| Risk found | Resolution in this plan |
| --- | --- |
| Finite one-time cores cannot sustain repeated travel | Repeat extraction at recovered core, 4-unit top-up ceiling; reserve and legacy recovery rules. |
| Old warehouse includes fictitious ship capacity | Separate ship cargo; conserve old planetary stock via withdrawable overflow, no guessed provenance. |
| Remote Cargo Tug withdrawal bypasses shipping | Read-only remote stores for this release, earned milestones preserved. |
| Two separate map UIs / double fuel formulas | StarMap is the single interface; shared fixed quote and transaction. |
| Fuel deducted before failed world save | Durable coherent destination before visual sequence; rollback source on failure. |
| Production can use ship capacity on wrong planet | Settle before departure; active sink changes only at commit. |
| Six-world flag could unlock untested worlds | Explicit two-world allowlist plus legacy-save compatibility path. |
| New Mars depth/geometry can make ores unreachable | Compact new world with explicit eligibility checks; old geometry never overwritten. |
| Film could imply live features | In-development status until verified production deployment. |
| Combat scope can balloon | Future milestone only; preserve existing systems without new combat. |

Review verdict: implementable scoped plan with explicit defaults. Highest-risk work is inventory migration and atomic travel; do these before art polish. Fuel and module numbers are balance hypotheses to validate, not proven fun. Any alternative to the specified renewable fuel mechanic requires a recorded rationale and user agreement because it changes the player loop.

## 11. Handoff progress / decision log

No milestones implemented by writing this plan. Update each completed milestone with changed files, commands/results, screenshot paths and limitations. Record date, decision, rationale and affected acceptance checks. If blocked, describe the exact blocker and completed independent work; do not mark the release complete.

Initial decisions: Cryo + Mars; fixed 1-unit journeys; renewable exposed-core extraction; 50-unit separate ship hold; conservative legacy stock migration; two additive specialist installations; multiplayer and combat deferred.

### 2026-10-18 M0 baseline
- Branch codex/pixel-art-teaser-20261017; initial git status only untracked docs/NEXT_UPDATE_PLAN.md. Welcome work is already in HEAD and preserved.
- npm install, npm test, npm run build passed. Existing large-bundle warning only (game JS 1,883.55 kB).
- Fresh real-time browser expedition, isolated Chromium, seed 1752800979: core at 442 m, hull 100, fuel 59.503; returned docked at hull 100, fuel 48.692, four core units, zero overlaps/errors. Screenshots output/playwright/cryo-core-recovered.png and cryo-core-return.png. No granted resources or terrain.
- Hooks verified: SaveManager schema 31, MapState world snapshots, scene transferWarehouse/applyAutomatedProduction/travelToMap, HUD StarMap. Baseline production code resets timestamp backward on clock rollback; M1/M2 must prevent replay. Active warehouse has fictitious 50-unit ship allowance; remote Cargo Tug withdrawal bypasses freight. No new travel acceptance claimed.

### 2026-10-18 M1 data/accounting
- Schema 32, unchanged storage key. Old worlds/stock remain untouched; ship empty; strict named module booleans and all half-unit ore keys. Removed pre-existing excess miner cargo deletion on restore.
- Added pure Freight/Travel helpers and monotonic production interval. Tests cover v31 legacy worlds/overflow/high levels, serialized import, repeated migration, invalid cargo/modules, .5/Max conservation, false/throw rollback, local source order and route reserve.
- npm test and build passed (output/playwright/ore-m1-tests.log, ore-m1-build.log). TypeScript passed independently. UI not yet changed.

### 2026-10-18 M2 freight/local pool
- Three separate inventories; material pool order Miner → Ship → Planet applied to building/basic installs/local orders/extractor upgrades. Dismantle refunds route Planet then Ship with independent capacity checks. Sales retain miner-only scope. Cargo Tug rewards retained; remote withdrawals blocked.
- Active production now routes into Planet then Ship, away planets use warehouse capacity only. Monotonic production timestamp prevents clock rollback replay. New tests pass for sink split/full/no-warehouse pause and ship-funded false/throwing purchase rollback; TypeScript passes.
- Isolated desktop and touch fixture tests passed .5/Max, legacy cache withdrawal, storage exception rollback and reload: 3 miner + 2 planet copper became 5 ship copper, conserved exactly. All five required viewports measured no overflow/forbidden controls; screenshots ore-freight-{desktop,touch}-{width}.png in output/playwright. Inspected touch 320 screenshot. These are labelled fixtures, not earned-resource campaign evidence.

### 2026-10-18 M3 reliable travel
- StarMap is the single travel surface; legacy solar callbacks pass the same docked allowlist/reserve policy. Legacy W flight remains disabled. Detached coherent destination save commits before presentation; false/throwing adapter retains source. Skip and reduced motion affect only presentation. Compact new Mars uses existing original warm geology; old geometry preserved.
- Fixture browser round trip: 4→3→2 fuel; five ship copper retained; destination reload during transit charged once; direct arrival deployment; candidate-write failure retained source. Preview world departure disabled. All required map viewport sizes fit; inspected ore-map-320.png.
- Touch fixtures confirmed legacy relocation and emergency tow, retaining 90.5 planetary iron and two ship copper, fuel zero unchanged. No material grants.
- Earned baseline continuation (campaign seed 2331546427, Cryo world seed 1752800979) performed a round trip, mined exposed Cryo core twice for two units, and returned alive: fuel four, hull 100, battery 109.258. No ore/fuel/terrain fixtures. Screenshots ore-earned-refuel-core.png and ore-earned-refuel-home.png.
- Renewable helper tests pass: ten seconds, exposed/recovered gates, interruption/reset and >4 legacy ceiling. Build passes; full regression rerun in progress after moving CSS import to browser entrypoint (Node tests must not import CSS).

### 2026-10-18 M4 payoff
- Hull installation costs 4 nickel + 6 iron, effective hull ×1.2 once and preserves damage percentage. Cooling costs 4 cryocrystal + 4 copper and multiplies only the drilling energy debit by .9. Unit and browser fixtures cover exact costs, ownership, false/throw rollback, hull 50/100 → 60/120, both installed after reload, and all required card layouts.
- Earned continuation with controlled browser frames and real keyboard/mouse inputs (no ore, fuel, upgrade or terrain grants): Cryo warehouse/extractor built, outbound supplies mined/loaded, Mars warehouse/extractor built, five nickel mined, returned to Cryo, four nickel plus six iron paid for reinforced hull. End: hull 120, core fuel 2. Reload retains both colonies and module. Separate real-time core and renewable runs are recorded under M0/M3.
- Away summary uses session-only departure stock baselines, actual stored delta and full/exhausted/no-warehouse state. It explicitly omits unavailable historical earnings after reload.
- Screenshots output/playwright/ore-earned-{cryo-shelf,mars-frontier}-{warehouse,extractor}.png and ore-earned-hull-installed.png; specialist screenshots ore-specialist-{width}.png. npm test and build passed (ore-m4-tests.log and ore-m4-build.log). Existing bundle warning remains, game JS 1,894.14 kB.

### 2026-10-18 M5 consistency and acceptance
- 120 browser views passed across mouse and emulated touch at all five required sizes: welcome, map Survey/Colony, freight, basic/hull/cooling workshop, catalogue, colony/extractor management, cargo and discard. Checks included overflow, forbidden widgets, 44px controls, viewport bounds and hit-testing. Screenshot review caught an obscured landscape Dismantle action missed by dimensions; fixed the action grid and repeated all 120 views. Representative ore-audit-* screenshots inspected.
- First-use legacy-stock notice fits 320x568 and does not repeat after migrated save. Browser fixture retained 100.5 miner copper, 90.5 planetary iron, level 17, 9876 credits, 7.25 core fuel and a visited Mars chart of radius 150. Discard save failure retained 100.5; retry removed exactly .5; reload retained 100. Other stores unchanged.
- Touch controls: controlled frames with actual CDP touch events descended to 207m and returned at hull 120, zero overlaps. Rotation and modal entry cleared held inputs. Synthetic window blur cleared inputs; foreground-tab switching did not emit blur in this harness, so real app-switch/hardware blur is not certified.
- Controlled-clock production fixture: initial source 39.5 local copper accepted .5 locally and 23.5 aboard, while Mars earned 24 locally. After travel/one-hour interval/return, both worlds held 40 and ship 31.5, depletion Cryo 24/Mars 48; reload did not replay output. Clock rollback, 12-hour cap, shared seams, unsupported tiers, no-store pause and full-state fractions also have automated coverage.
- Kept a separate free-capacity calculation for production status so legacy planetary overflow cannot conceal empty ship space. Kept visited worlds' global chart fallback, preventing accidental resizing when per-world geometry is absent. Legacy excess battery/hull is retained and servicing cannot turn it into credits.
- Copy/guide/homepage now distinguish the local update from the current public deployment. Star map replaces the old MARKET entry and is browsable away from the ship; multiplayer remains coming soon. Discard stays Miner-only with explicit quantity confirmation; colony upgrades remain reachable.
- npm test and npm run build passed (ore-release-tests.log, ore-release-build.log). Existing bundle advisory persists: game JS 1898.03 kB, gzip 476.63 kB. No physical Android test, external publication or deployment performed.

### 2026-10-18 M6 final review and package
- Reviewed data/accounting/travel/UI diff. Froze missing per-world geometry from the original global chart before changing active charts. Browser review retained Mars/Prism radius 150, compact Cryo radius 40, inactive 91.5 stock and export/import after travel/reload. Tightened named ownership validation. Unified legacy inline storage buttons with the freight transaction so production settles before every withdrawal, preventing full-state time banking.
- Reused the existing original carrier drawing in transit, with no new art source or economic callbacks. Ten transit/arrival layouts passed all required sizes with reachable Skip/Deploy. Final transactional travel repeat passed; final freight repeat passed mouse/touch save failure, conservation and reload.
- npm test and npm run build passed after final implementation (ore-complete-tests.log, ore-complete-build.log). Existing large-bundle advisory only: game JS 1897.75 kB, gzip 476.67 kB. git diff --check passes. No staged changes.
- Video: output/marketing/ore-frontier-two-worlds/ore-frontier-two-worlds.mp4, 32.000 seconds, 720×1280 H.264/yuv420p + AAC. Full decode passed. Original game soundtrack at 25% gain with fades; audio verified non-silent. Inspected exported contact sheets and route, native-nickel, valid-build, summary/install and title frames. Replaced footage containing a rejected placement and a rough landing; final nickel capture retained hull 100. Refreshed travel footage with original carrier art.
- Poster, three-line x-post.txt, production-notes.txt, prepared promotional saves and verification metadata remain in the same ignored marketing folder. Promotional setup and controlled five-minute interval (actual 2 Copper output) are disclosed; earned play remains separately documented. All screenshots and temporary QA scripts remain under ignored output/playwright. No upload or X draft was created externally.
- README, QA and release notes updated. M0–M6 local acceptance is complete, with no known blocking return/save/resource defect. Limits: physical Android and actual app-switch blur are unverified; the complete earned expansion used controlled frame timing, and no human real-time balance certification is claimed. These supersede earlier in-progress notes. Public production unchanged; no commit, push, deploy or publish performed.

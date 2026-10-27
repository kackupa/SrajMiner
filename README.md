# Ore Frontier

An experimental, standalone Unity ship boarding prototype lives in [`unity-ship-assault/`](unity-ship-assault/README.md). It is a short original combat scenario in the same universe and does not alter this browser game's campaign or saves. Unity playtesting remains pending because the editor is unavailable in the current environment.

An original browser mining game built with TypeScript, Phaser 3 and Vite. Your mothership lands with a mining rig but no jump fuel, no camp and no credits. Mine to build an operation, connect to the market, upgrade your rig and fuel travel to other planets.

## Living Frontier local sandbox update (24 October 2026)

The local sandbox now has 20 equipment models across hull, drill, engine, battery, weapon and utility slots. Buy a model directly with shared materials: compatible purchases fit immediately. Items that exceed fitting capacity remain owned with an explicit explanation; refit owned parts for free in the fullscreen loadout. Battery fitting capacity and remaining battery charge are separate. Fits that exceed capacity or would discard carried ore are blocked. Existing level upgrades remain part of migrated saves.

Start unarmed. Equip a machine gun, autocannon or beam laser; hold **Shift + left click** to aim and fire. Touch uses **FIRE** on the right with enemy aiming assistance and WASD on the left. Rock blocks shots. Surface raiders pursue above ground and withdraw when you hide underground; underground creatures withdraw at the surface or when you enter a shelter.

Build up to four underground shelters in cleared space using iron and copper. Deployment takes four seconds; movement cancels without spending materials. Press **E** nearby to enter or leave. Hull and battery recover gradually while the world continues running, including while refitting. Mining charges offer rock breaker, excavation and repulsor modes. Original rig attachments, shot traces, recoil, impacts, drilling effects and shelter lights give actions visible feedback. In-game currency is **Kredits**.

Save version 33 migrates existing local saves and preserves legacy inventory/upgrades. These new mechanics are **local sandbox features**; the existing verified-online rules have not gained equipment/combat parity. No token integration is included.

Validation: npm install, the automated suite and production build passed. Chromium playtests covered buying/fitting, drilling, weapon fire and defeating a creature, shelter deployment/entry/recovery/refitting, and save/reload conservation. Loadout/build/equipment panels were checked at desktop, 320×568, 390×844 and 844×390 sizes without document scrolling. An isolated touch-context test checked held FIRE, release and shelter entry. Actual Android hardware and long-session balance/performance remain untested. Vite still reports its large game-bundle warning. QA captures remain ignored under output/playwright/.

The equipment art pass gives Scout fins, Hauler cargo pods, Bastion armour, distinct engine housings, battery banks, utility fittings and three weapon silhouettes. Shared geometry keeps workshop portraits and the moving rig consistent; fitted drill models also change the working drill width and colour. Chromium touch firing/shelter/refit checks passed at 390×844 without overflow; a three-loadout visual comparison is saved under ignored QA output. Physical device visual testing remains pending.

The approved miner concept is now interpreted by a shared articulated 2D model: caged work lamp, offset glazed cockpit with pilot, jointed drill arm and piston engine legs. Drill teeth rotate during cutting; legs fold under thrust, step on the surface and compress on touchdown. The workshop uses the same geometry. These are gameplay-scale drawings, not the high-detail concept bitmap. Appearance remains independent of collisions and save data. Chromium keyboard playtesting recorded thrust/gear animation, touchdown compression, three newly mined tiles and reduced-motion suppression with no Vite error overlay. Mobile firing/refitting and physical-device limitations are recorded above.

Mouse movement now steers the work lamp without holding a button. Its beam and occlusion rays originate at the animated searchlight lens, including mirrored facing, banking and suspension movement; the old drill-centred light cone has been removed. A bounded ray fan reveals open space and the first rock face, with newly discovered tiles retained by normal saving. Rock blocks the beam. The pilot looks toward aim, the chassis turns smoothly, and the articulated weapon follows aim with recoil while the drill retains its mining direction. Touch uses movement direction and firing target assistance for the lamp. Browser checks verified left/right turning, different illuminated tile sets, firing recoil and pause freeze; touch firing/refitting remained usable without overflow. Unit checks cover rock occlusion, sky filtering and pose transitions.

The searchlight now has a swivelling barrel, lens and mechanical yoke. Housing and beam share the same smoothed aim and moving lens origin, with automated alignment coverage for both facings, banking and landing. The miner also lifts its feet when stepping, braces wider while drilling, tucks its drill during flight and moves its helmet visor with its gaze. Browser playtests exercised looking/firing, flight, landing, drilling, pause and reduced motion; physical-device testing is still pending.

Cargo now opens in Simple view: Miner, Mothership and Planet warehouse cards show where ore is held, and only owned ores appear below. Each row has an explicit Store/Take quantity and Sell quantity with the quoted Kredits. The existing exact-quantity/source/destination controls remain behind Advanced; discard retains its confirmation. Simple view never automatically sells ore or combines inventories. Chromium checks verified storing 3 copper (Miner 3→0, Ship 6→9), selling 5 iron (+189 Kredits in the test fixture), switching views and resizing at 1280×720, 390×844, 320×568 and 844×390 without scrolling or clipped buttons. Existing economy transaction/rollback rules remain unchanged.

## Run locally

Use Node.js 22.12 or newer:

```sh
npm install
npm run dev
npm test
npm run build
```

Vite prints the local game URL. Saves belong to that browser origin. The production build is written to `dist/`.

## Mobile controls

When placing a camp or another surface building, drag the map sideways or hold the mouse near the left/right screen edge to pan around the planet. Arrow-key placement also brings the selected site into view. A mouse click or Enter confirms; Escape/right-click cancels. On touch screens, drag to pan, tap a site, then tap **PLACE** (or **CANCEL**). Dragging never spends materials. Completing or cancelling placement returns the camera to the miner.

The same game and save format support touch devices. Landscape is recommended; portrait remains playable. The left WASD pad steers, drills and thrusts upward; contextual actions and equipment are on the right. Sideways steering also drills against rock, just as keyboard movement does. Multiple fingers can hold thrust and drilling together. Board/Disembark, Services, Build and Map are available on screen; equipment controls appear when owned. The pause button stays in the top bar.

Touch inputs clear on rotation, menu entry, cancellation and loss of focus. Phone layouts use a compact battery/hull/cargo HUD, safe-area spacing and full-screen service panels. How to play shows touch instructions on touch devices. No mobile fork, backend or save migration is required.

Verified with Chromium mobile emulation at 844×390 and 390×844, including mining, return, transactions and reload. Real iPhone Safari/Android hardware, thermal performance and extended interplanetary play still need device testing; this is not a claim of full mobile certification.

The 2026-10-17 beta UX pass changes the mothership flight deck to fit the viewport, turns its destinations into a compact touch grid on narrow screens, hides scrollbar chrome, and replaces service/reserve/warehouse dropdowns with visible button choices. Build and automated tests pass. The deployed PR preview was browser-tested at 1536×639: the full star map and launch button fit, world selection updates the detail panel, and neither the document nor modal overflows. Physical Android testing is still pending.

## Ore Frontier teaser

The Ore Frontier teaser is the homepage at `/` and is also available at `/teaser.html`; the playable game is at `/play`. Its copy describes building a mining empire through ore collection, camp/uplink construction, rig upgrades, warehouses, automated extraction, and planetary travel. The hero and video poster use an actual gameplay capture. The feature section uses large mining, workshop, and surface-colony captures from the game instead of illustrated placeholder cards. The embedded gameplay MP4 is hosted in the public Supabase media bucket. The page identifies the official creator account and states that Ore Frontier has no official token. Unagreed seasonal expeditions, voting, and token cosmetics are not advertised.

The custom domain is `https://playorefrontier.xyz/`; canonical and social-share metadata use that URL. Cloudflare Pages rewrites `/play` to `game.html`. Branch previews update after pushing; production remains on `master` until the PR is merged.

## The mining loop

1. Deploy on Cryo Shelf and mine nearby copper, iron and silver.
2. Choose your own first building: extractor, warehouse, camp or market uplink. Each uses shared local materials; none requires another building first.
3. Install basic rig upgrades with common ores from Miner, Ship and Planet stock.
4. Build an uplink to sell carried ore to civilian buyers, or complete optional local contracts.
5. Expand, relocate extractors as seams deplete, and keep storage from filling.
6. Recover the planetary core for four fuel. Load the 50-unit ship hold, depart for Mars Frontier through the Star map, establish a second colony and bring nickel home for reinforced hull. Re-mine exposed recovered cores for ten seconds per fuel unit, up to four.
The rig runs on a **battery**, separate from mothership fuel. Return to the mothership and choose **Recharge** to fill it for free, even with zero credits. Hull repairs still cost credits. Signals, missing-crew quests and survey cash rewards are not part of the live expedition. Cores supply travel fuel, not cash.

Near the core, aim at its glowing marker and hold the mouse button to extract it. The marker remains selectable when polar tiles become narrower than a screen pixel; intervening rock still needs to be drilled first. A fresh Cryo descent, core extraction and return to the surface has been browser-tested with earned cargo and no funded upgrades. Fresh real-time core recovery and return passed on 18 October 2026 at 100 hull, followed by an earned round trip, exposed-core refueling and another safe return. Only Cryo and Mars are reachable in this update; the historical six-world campaign is outside its scope.

An earned opening campaign also passed core return with controlled browser frame timing, camp/uplink construction, first sales and the first drill upgrade, including save/reload. Shipment quantities update their quote while you type without losing focus when switching fields. These automated checks do not replace real-time navigation, raid-balance or human playtesting; see [QA](docs/QA.md).

Construction pools Miner, then Ship, then Planet stock on the active planet. Remote planets never contribute. Press B, choose any surface building, position its preview and confirm. Free placement has optional snapping. Materials are spent only when placement saves successfully; cancelling or a failed save spends nothing. Mining camp, uplink, warehouse and extractor can each be built first with materials only.

## Controls and menus

- **A/D** or **Left/Right:** move.
- **S/Down:** drill downward. **W/Up/Space:** thrust through open tunnels.
- **Mouse:** aim; hold left-click to drill.
- **E:** open the mothership or use a nearby structure. **Return to mine / Esc** closes the landed ship terminal and deploys the rig immediately.
- **B:** open the build yard. **M:** explored tunnel map. **Esc:** pause/close.
- **R:** installed surface winch. **Q:** mining charge. **X:** installed stasis module.

The **Open mothership** button and E open the same full-screen hub: recharge, build/sell, storage and upgrades. Leaving the terminal restores miner controls immediately, including Space to thrust; no second E is required. The Star map performs departure and landing while docked. A journey costs one core fuel. An unrecovered destination requires one additional unit held as return reserve. Reload during transit starts landed and cannot charge again.

The opening screen teaches movement, drilling and return flight. The fullscreen build catalogue groups Services (camp, uplink), Mining & storage (extractor, warehouse) and Defence (wall, pylon, fort) without scrolling or dropdowns. It shows exact shortages from pooled planetary materials and retains repair/upgrade management. There is no camp prerequisite for an uplink. The Star map has its own menu entry.

The game fits the viewport without browser scrollbars. Main menus use the full screen; longer panels use explicit **Previous / Next** pages rather than scrolling. Phone menus use buttons, cards and tabs, without text dropdowns or checkboxes. The original illustrated title, lander, sky and mineral treatment share the new blue/orange visual style.

The redesigned miner has a visible pilot, directional banking, gimballed thrusters, correction jets, retractable skids and drill recoil. The mothership uses a long carrier hull, raised bridge, twin engines and a closing landing bay. These animations follow movement without changing handling, collision size or saves. Pause freezes the pose; reduced motion removes banking and oscillation.

## Saves and compatibility

Campaigns remain under `mars-miner.v1`, save version 32. Version 31 stock stays on its original planets, including legacy overflow; the new ship hold and specialist ownership start empty. Overflow can be spent or withdrawn but cannot accept deposits above real warehouse capacity. Version 30 campaigns gain an empty finite-seam depletion ledger. Existing credits, upgrades, structures, cargo, stored ore and excavation are retained; only fresh expeditions start at zero credits. The internal `fuel` field represents rig battery charge. Version 29 saves gain empty slots for the four new ores and a civilian delivery ledger. Retired survey IDs remain readable for older saves, but their collectibles and quest prompts are absent from live gameplay.

Active extractors fill the local warehouse, then free landed-ship capacity. Away extractors use warehouse capacity only, and pause without a warehouse. Offline catch-up is capped at 12 hours. Full storage discards blocked production instead of banking it for an immediate payout after withdrawal. The extractor upgrade panel shows the same credit and material costs that the purchase charges. Browser fixtures cover a Cryo–Mars round trip, upgrade persistence, full-store withdrawal/reload, and v28 migration; an earned continuation also built both colonies, mined five nickel, returned and installed reinforced hull without resource grants. That longer run used controlled browser frames with actual key and mouse input.

## Worlds, customers and the Expedition Codex

The fullscreen Star map supports docked travel between Cryo and Mars, and read-only colony inspection. Other mining worlds and inhabited-world landings are coming soon. Civilian buyers remain the existing miner-only sale abstraction.

Teletrade offers four customers: Helion's municipal works, Kepler's shipyards, Verdant's growers and Lyra's research institute. Each has three development projects. Selected shipments earn a capped 35% premium on the current project's remaining ore requirement; completed projects persist and add lights to the world's artwork. Shipment quantities are separate from carried and stored inventory. Select surplus reserves materials for a chosen camp, uplink or warehouse.

Nickel, titanium and cobalt expand planetary geology; cryocrystal occurs only on Cryo Shelf. Deposits obey depth and planet restrictions in `src/game/config.ts`.

Open the Expedition Codex from pause, the mothership terminal, workshop technology links or resource names. Its 28 articles cover miner technology, resources, civilian histories and starting infrastructure, with original illustrations, related links and engineering references. Fictional technology and frontier histories are explicitly identified.

## Art and verification

All runtime artwork is original and drawn locally in Phaser/SVG. The mothership is the initial surface landmark; player buildings appear through construction. Mining camp platforms and the camp surface zone protect against fall damage. The campaign stays local-first and keeps its save separate from the online player market. The private-beta exchange uses a dedicated Supabase project and separate test-credit and ore ledgers; it does not import campaign inventory and does not connect to the CREDIT token. See [the beta market notes](docs/BETA-MARKET.md) for limits and setup status.

See [QA](docs/QA.md) for measured playtests and limitations, [architecture](docs/ARCHITECTURE.md) for save details, and [config](src/game/config.ts) for balance data. Historical QA entries describe the behavior tested on their dates and may refer to retired names or mechanics.

## Publish

The existing GitHub Actions workflow tests, builds and publishes `dist/` to GitHub Pages. `vite.config.ts` uses `/SrajMiner/` for production and `/` locally. Local changes are not a hosted deployment.

## Stackable perimeter walls

Choose Perimeter Wall in Build. Auto-stack snaps to an existing column and previews its next supported layer. Keep clicking the column or use Build block to raise a tower; use the layer buttons for manual placement and Done/Esc to finish. Drag or move the mouse toward the edge to pan while building. The camera follows rising stacks, with level lights, construction flashes and rising tones. Each block retains its $80 + 1 copper cost and the existing 12-wall limit per planet. Existing wall saves remain compatible.

Ore storage transfers are available directly in each ore row: choose a half-unit amount, then Store or Take, or use that row's Store all / Take all. Each row keeps its own amount while the panel is open; carried and stored totals update after transfers.

When both cargo and storage are full, use **Discard** beside an ore in the Warehouse screen. Enter the amount first; confirmation permanently removes only that ore from the miner, with no credits. Stored reserves are unaffected. Discard saves immediately and restores cargo if saving fails.

Mobile controls group equipment under Tools and show the nearby ship action directly. Phone Warehouse rows expand into large transfer controls with amount presets; trading has Max buttons and Workshop has a component selector. Browser tests cover the earned camp → uplink → sale → upgrade → reload sequence, multitouch, rotation and save failures. See [mobile overhaul tracking](docs/MOBILE-OVERHAUL.md) for evidence and limitations. Physical Android/iPhone comfort, keyboard behaviour and sustained performance remain unverified.

### Launch landing page update: 2026-10-17

The custom-domain landing page introduces the playable game, gameplay footage, product roadmap, and official creator account at https://x.com/Kac_Kupa_. It states that Ore Frontier has no official token; proposed token names, chains, pairs, launch details and integration promises have been removed. Gameplay and save schema are unchanged.

Validation: npm install, npm test, and npm run build passed. Local Chromium exercised Tokenomics and X section navigation at 1440×900 and 390×844 and opened the launch FAQ. Screenshots are in ignored output/playwright/launch-desktop.png and launch-mobile.png. This checks the local landing page, not a deployed custom domain or real mobile hardware. The /play hosting rewrite and expedition gameplay were not retested in this content-only pass. These edits have not been deployed.

### Star map preview
The mothership sidebar places Star map after Warehouse. A direct hub button also makes it reachable on mobile. The fullscreen chart shows two live mining destinations, four mining previews and four inhabited-world previews. One solid selected route highlights live travel. Multiplayer remains coming soon; no live activity is simulated, and tokenomics remain TBD.
The star map uses a central star and orbital tracks; planet distances are illustrative, not to scale.
Mining worlds use distinct geological features; inhabited worlds show city lights and orbital stations. The exchange preview has no dotted trade connections.

## Sandbox construction and planetary resources
The surface catalogue is open from the start, grouped by purpose: Services, Mining & storage and Defence. These are categories, not unlock requirements. Camp, uplink, warehouse and extractor have material-only entry costs; other buildings retain their credit costs and physical limits. A camp is a service option, not an uplink prerequisite. All construction draws from carried ore first, then the current planet's stored ore; other planets are never charged. Surface placement has a ghost preview, occupancy validation, optional snapping, Place and Cancel. Existing wall stacking remains available.

Copper, iron and silver occur on every world and cover building materials. Exclusive deposits are Nickel (Mars Frontier), Cryocrystal (Cryo Shelf), Titanium (Hull Graveyard), Diamond (Prism Fault), Cobalt (Cinder Vale) and Gold (Vesper-9). Local orders and surveys reflect this geography. Civilian projects can require imports; the planetary cores still supply travel fuel. Deep-core extractors can produce the local exclusive ore.

An extractor can be placed before a warehouse and uses the mothership hold while that planet is active. A warehouse allows production while away. Full storage pauses production without banking excess. Extractor upgrades also draw on shared local materials. Existing inventory, mined cells, buildings and save schema are preserved; regenerated unmined deposits use the new geography.

## Rig workshop and travel policy
Basic rig upgrades through level 5 use common ores from Miner, then Ship, then Planet stock. No uplink or credits are required. The new fullscreen workshop separates Basic rig, Specialist plans, optional credit-funded Equipment and existing free Pilot setups. Reinforced hull costs four nickel and six iron for 20% more effective maximum hull, retaining current hull percentage. Efficient cooling costs four cryocrystal and four copper for 10% less drilling battery expenditure. Both are one-time persistent installations; other plans remain previews. Purchased levels, including legacy levels above 5, remain intact.

Travel uses the Star map and a durable destination commit before animation. Manual orbital ascent remains disabled. Existing campaigns on other planets retain their active planet and all stock; a confirmed free relocation to Cryo leaves the old colony saved, with return unavailable in this release. A confirmed emergency tow handles legacy stranded Mars states without granting fuel or money.

### Mobile WASD controls
Touch gameplay uses one W/A/S/D pad at the lower left: W thrusts upward, A/D move and drill sideways, and S drills downward. Contextual actions and Tools sit at the lower right. Multiple touches support thrust and steering together.

### Your First Mining Colony update
Build catalogue > Colony opens a fullscreen, paged building overview. Surface buildings can be relocated without spending materials or resetting levels; cancelling keeps the original location. Dismantling confirms a refund of half the base construction materials into planetary storage, protects storage capacity, and rolls back on save failure. Upgrades are not refunded. Supporting wall layers must remain until the layer above is removed. Touch placement includes explicit Left and Right buttons.
The colony update is implemented and locally verified. The fresh-save mining/building/production loop, save migration, management transactions and responsive UI checks are documented in docs/QA.md. Physical Android testing and deployment are separate from this local acceptance.

Finite extraction seams were introduced in schema 31 and are preserved in schema 32. A migration preserves version-30 campaign data and adds an empty depletion ledger. Each 320-world-unit surface sector has a deep seam with 60 units; these are separate from manually excavated shallow blocks. Placement surveys ore, remaining units and tier rate. Extractors share sector depletion; dismantling/rebuilding does not replenish it. Full storage and unsupported ore tiers pause production. Relocation preserves levels and resets only the fractional work when changing seams. Working drills animate and warehouses show their real storage fill. Production rates are 24/48/96 ore per hour for basic, industrial and deep extractors.

Optional local contracts are available through Colony > Contracts: bulk copper, a planetary-exclusive survey request, and iron construction supply. All three are independent, have no expiry and pay once. Delivery consumes the stated quantity from carried ore then local storage and saves atomically. Tracking is a session-only HUD aid. Phones use three explicit tabs and one full order card; larger screens show three cards.
The top-bar Colony button marks extractor attention states. Locate opens a paused world inspection with Manage, Move and Dismantle; returning to the rig restores its camera without teleporting the player. Clicking a visible building also opens inspection.

Colony visual/feedback pass: cards now use original building silhouettes matching the world palette; working extractors animate. Rig installation shows its exact stat change with a short reduced-motion-aware effect. Production state transitions notify without pausing. Basic/industrial/deep rates are now 24/48/96 ore per hour; the first half-unit arrives after 75 seconds. Extractor placement outlines its surveyed seam area. The cargo HUD opens a fullscreen nine-ore inventory instead of a text dropdown.
Phone storage uses explicit ore cards with one transfer panel. Mobile buyer selection retains cards, and legacy generated select/details widgets were removed. Generic mothership pagination now hides/shows complete content blocks instead of scrolling. The final browser audit covered phone portrait (320×568), phone landscape (844×390) and desktop (1440×900), including complete field-guide and paint-shop pages. Discard uses a dedicated confirmation screen.

Welcome screen: the title, movement guide and expedition button stay together on one responsive screen, without pagination or scrolling.

## Two-world update verification (18 October 2026)

The local Ore Frontier expansion is documented in [release notes](docs/ORE_FRONTIER_RELEASE_NOTES.md) and [the implementation log](docs/NEXT_UPDATE_PLAN.md). Real-time fresh-core and renewable-fuel return runs passed at full hull. A separate earned continuation built warehouses and extractors on Cryo and Mars, shipped mined nickel home and installed reinforced hull, then retained both colonies through reload. Fixture tests cover migration, freight/travel failures, legacy recovery, specialist ownership and responsive layouts. Controlled-clock checks are labelled separately in [QA](docs/QA.md).

The homepage distinguishes the current public build from this undeployed local update. No commit, push, deployment or external publication has been performed. Promotional captures stay under ignored `output/marketing/`; QA stays under ignored `output/playwright/`. Physical Android hardware remains untested here.

Homepage spacing: the hero starts 24px below the token notice on desktop and 20px on phones; oversized minimum height and duplicate top padding are removed.


## Cargo and selling
The cargo HUD, mothership storage and Sell ore entry now open one fullscreen view showing Miner, Mothership and current Planet warehouse quantities side by side. Select an ore quantity in its source column, choose Transfer or Sell for credits, then .5/1/5/Max. The sell button names the exact quantity and credit payout and uses the best current civilian offer. Sales debit only the named source; ship sales require mothership access and planetary sales require local storage access, in addition to an online uplink and sales access. Remote warehouses remain inaccessible. No transfer into the miner is required before selling accessible stored stock. Discard remains miner-only. Compact screens page ore rows while keeping all three totals and action controls visible.

Hover over the HUD Cargo readout for a live miner-only ore breakdown. Keyboard focus also reveals it; clicking or tapping opens full cargo management.

## Player Exchange work status

The new Player Exchange plan is in progress. The approved campaign model keeps the existing `mars-miner.v1` game as Local; a future Verified Online campaign starts separately with server-issued zero ore and credits. Local saves and the separate legacy beta market cannot mint tradable balances. The current `/market` page remains an isolated playtest, not an integrated mine-to-market exchange.

M0 baseline passed on 2026-10-19: a fresh isolated browser run recovered the Cryo core, built on both Cryo and Mars using earned materials, mined four nickel, returned, installed reinforced hull and retained both colonies after reload. Five desktop/mobile viewport checks found no document overflow in the welcome or active-game views. `npm install`, `npm test` and `npm run build` passed; the existing large-bundle advisory remains. See [the M0 audit](docs/PLAYER_EXCHANGE_M0_AUDIT.md) and [QA](docs/QA.md).

M1 wire contracts and the Local/Verified Online trust boundary passed local tests. Applying both legacy beta migrations with the new empty v2 foundation in in-memory PostgreSQL showed that beta starter balances and an old admin grant left the v2 wallet at zero and inventory empty; direct client writes and cross-owner reads were denied. A separate Supabase staging project contains only the empty v2 foundation and Local backup schema. The in-game Account screen now supports staging email-link sign-in, Local backup and explicit restore. A real staging backup saved revision 1 and restored the Local campaign after reload; no online balance was created. Responsive Account views passed browser checks on desktop and phone-sized viewports. Verified Online gameplay and integrated player trade are still unavailable. Neither existing Supabase project has been modified.

M3 includes a locally tested fixed-step replay of the existing mining terrain, pod collision and drilling rules. An isolated PostgreSQL test commits the replay through a private, service-only transaction: 22 batches produced six half-units of copper and revision 22, with stable retry receipts and rejected stale/session-conflict requests. The gameplay migrations are not applied to staging.

The server request handler now builds each commit from the database snapshot and miner inventory, rejects browser-supplied position/cargo fields, and recovers a saved receipt on retry. An Edge Function wrapper verifies Supabase Auth before calling it and keeps the service key server-side. Its shared rules bundle builds locally; the function has not run or been deployed, and no live online mining flow is available yet.

A separate Verified mining view is wired behind a disabled-by-default build flag. It displays canonical server state, sends bounded keyboard/touch controls one operation at a time, and offers retry, stale-state refresh or explicit session takeover. The Local campaign and saves remain separate. Verified Online stays unavailable in the current build until the staging backend and earned flow are proven.

A separate local browser run used the real handler and in-memory PostgreSQL migrations over loopback: held drill controls earned three copper, the six half-units survived reload and explicit session takeover, and a forged browser cargo field left the canonical balance unchanged. This did not exercise Supabase Auth or a deployed Edge Function. The full Online economy, player trading and staging two-account flow are still unimplemented or unverified.

The first M4 transaction moves canonical ore between miner and landed ship with server-side access/capacity checks and idempotent receipts; an isolated PostgreSQL test verifies conservation and failure rollback. The in-game Cargo screen now invokes that transaction without sending claimed balances. A loopback browser run mined three copper, returned to the ship and used the Cargo controls to move two units into ship storage. The canonical read showed miner 2 half-units, ship 4 and zero credits. Desktop and mobile Cargo checks passed four viewport sizes with no scrolling, clipped controls or forbidden form elements. This is local proof for one server move; Supabase Auth/Edge, NPC sales, the rest of the Online expedition and player exchange remain open.

M4 now also has an unapplied server transaction to build the first Cryo Market uplink from the existing 4 copper, 4 iron and 2 silver cost. The Cargo view offers Build only when its canonical read shows enough material. Isolated SQL tests prove exact debits, rollback, owner/session checks and stable retry, while browser layout and interaction checks pass desktop and mobile. A deterministic local browser run earned all build materials through the server-owned mining simulation and built the uplink with no resource grant. This is a fixed starter site, not a general building-placement system; the complete Online economy and exchange are still unfinished.

A further unapplied transaction supports Verified Online civilian sales. It requires that uplink and canonical stock, uses the current ore prices and buyer-project bonus, then records an exact credit issuance with an idempotent receipt. The separate Sell to civilians screen checks a server offer before confirmation. Isolated SQL tests and a mobile browser run passed an earned mine → build → civilian sale → reload chain: half a copper paid 12.00 credits and removed one half-unit of ore. The loopback test uses a fixed QA identity, so staging Auth/Edge and the integrated player exchange remain unavailable.

Verified Online also has an unapplied server-owned ship service transaction. At the landed ship, battery recharge is free and hull repair uses the Local 0.45-credit-per-missing-hull rule; neither condition nor cost is accepted from the browser. The in-game Service Bay confirms the result only after a server receipt and canonical reload. Isolated SQL tests cover paid repair, zero-credit recharge, rollback, owner/session checks and stable retry. The earned local browser run recharged after its civilian sale, then reloaded at full battery with the same 12.00 credits and remaining ore. Four desktop/mobile layouts passed without scrolling or clipped controls. Other Online services and the complete economy remain unfinished.

The Verified rig workshop can now install the five basic tracks wired into the authoritative mining replay: drill, battery, cargo, hull and engine. The server derives the next level and material cost from canonical state, debits miner then ship, and advances the level with one receipt. Rig levels persist apart from rendered terrain chunks and change drilling, movement and capacity rules; service and transfers use the expanded caps. Isolated SQL tests cover exact costs, rollback, retry, owner/session denial, expanded service and a 40-half-unit miner transfer after a cargo upgrade. A fixture-backed browser run installed drill level 2, reloaded and continued mining through the real handler. The separate earned mine/build/sell/service chain still passes after this change; earned-material upgrade and the remaining Online progression are open.

Verified Online now has a server-owned recovery transaction for a pod with zero fuel or hull. The last depleted input commits a stranded state, and the recovery screen requires two clicks to forfeit unsold miner ore. SQL clears that cargo, records the forfeiture, restores the pod at the surface and keeps ship cargo, credits, excavation and upgrades. Isolated SQL tests cover authorization, exact retry and conservation; a fixture-backed Chrome run passed recovery and reload at four desktop/mobile sizes. This migration remains unapplied to staging, and full M4 progression and player trading are still open.

The authoritative mining replay now records the first Cryo core when its canonical tile is mined. The same terrain-destruction transaction issues four travel-fuel units exactly once and no credits; later controls and reload cannot claim it again. A fixture placed the pod near an excavated core approach, then a mobile browser drilled the actual core tile through the handler and SQL, reloaded, and displayed the persisted fuel on desktop. This proves core claiming, not an earned surface-to-core trip or interplanetary travel. The gameplay migrations remain unapplied to staging.

Exposed-core extraction is now also server timed. Holding drill near the recovered Cryo core for ten uninterrupted seconds replenishes one fuel unit up to the Local four-unit reserve; releasing the control resets partial work. A separate fixture began at three fuel after a simulated future spend, then earned the fourth through the browser, handler and SQL, and retained it after reload. The fixture does not prove a real travel spend or the full Cryo-to-Mars route.

The still-unapplied Verified Online travel migration now stores each planet’s terrain and loose drops separately while keeping one canonical inventory, wallet, rig and core-fuel balance. Its SQL transaction debits one core fuel per jump, enforces the Local return reserve, and supports exact retry. A local Chrome/PGlite fixture passed the in-game Cryo → Mars → Cryo action and reload on desktop and mobile; this was a recovered-core fixture, not an earned full expedition or live staging test. The exchange and complete Online economy are still unavailable.
The two locally implemented Verified planets now share canonical cargo, service, upgrade and recovery transactions, while each requires its own Market uplink. An isolated Mars SQL fixture transferred cargo, built the Mars uplink and sold nickel; the nickel and construction materials were fixture-supplied, so the earned campaign proof remains open.

A separate local browser run now starts with zero Verified resources, mines the Cryo core using the real controls, returns to dock and jumps to Mars through the in-game action. The server read after arrival retained the earned cargo, one spent fuel and zero credits. This is local browser-to-PostgreSQL proof with a fixed QA world seed; Mars nickel, a completed earned return, deployed staging Auth/Edge and player exchange are still open.

Mothership menu exit regression check: Return to mine and Escape from workshop or nested discard now deploy the landed miner and restore movement without pressing E again. Explicit ship-pilot mode retains boarding. Chromium playtests confirmed boarding cleared, pause cleared and D moved the miner after each of those three exit paths.

Building menu QA (24 October): selected all eight surface structures at 1280×720, 390×844, 320×568 and 844×390 in an isolated browser save. All controls and material panels fit within the viewport; narrow phones use a two-row header. Physical Android touch testing remains outstanding.

Building cost feedback QA (24 October): checked all eight surface buildings with funded and empty inventory fixtures at four desktop/mobile viewport sizes. Affordable ore and Kredits rows, including zero-cost Kredits, are green; shortages are red with exact missing amounts. No tested controls or cost panels overflowed.

### Workhorse mothership and surface defences (24 October)
The landed carrier uses the selected asymmetric Workhorse direction: raised warm-lit crew bridge, segmented cargo spine, amber prow, articulated landing struts and ramp. Crew silhouettes shift, radar sweeps, the cargo hoist moves, engine lamps breathe, vents exhaust and a physical worklamp sweeps its apron. Reduced-motion mode freezes ambient movement. The shared renderer also supplies flight and transit art.

Landed mothership guns now replace automatic near-ship flyer retreat with actual defensive bursts: 340 surface-distance range, 220 altitude limit, one damage per 1.6-second volley. A normal two-health flyer requires two volleys. Guns do not fire while the ship is boarded/absent, against underground targets, or during underground retreat. Balance lives in MOTHERSHIP in config.ts; no save schema changes. Mining-driven escalation remains future work.

Planetary walls and gates render 65% taller; surface pylons now have 138-unit braced towers and elevated guns. Saved placement footprints, stacking increments and collision rules are unchanged. Catalogue silhouettes reflect the higher walls and tower design.

QA: full npm test and production build passed. Isolated Chromium playtests covered desktop 1440x900 and mobile 390x844, movement beside defences, reduced motion and ship-menu exit. A browser encounter with only its initial wait shortened verified real tracking/fire, two volleys, flyer removal and unchanged miner hull. Dedicated tests cover cooldown, range, altitude, absent ship and underground retreat. Physical Android performance and a natural 55-second initial raid wait were not verified. QA artifacts remain in ignored output/playwright. These changes are local browser gameplay, not a deployment of the verified online engine.

Security gates are no longer offered in the building catalogue. Existing saved gates retain their rendering, behaviour and colony management; no save migration is required.

Planet crust QA (24 October): a continuous opaque globe and two-tile crust backing now remain visible outside the local terrain window. Discovered excavations paint dark openings through that backing; no ore discovery, collision or save state changes. Desktop/mobile surface screenshots and browser flight, landing and drilling checks passed (two additional tiles excavated during the sampled drill). Physical Android remains untested.

### Cryo Shelf globe-anchored scenery (24 October)
The painted panorama was rejected and is no longer loaded or shipped. Cryo Shelf uses original geometric ice shelves and fractured escarpments in the foreground palette. Three relief layers are projected through the same spherical camera as the crust, so they curve with the world, rotate with the camera and fall away during ascent. Sky objects remain distant; atmospheric colour and world-anchored frost fade with altitude. There is no clamped screen-space landscape horizon. Other worlds are unchanged. Reduced motion stops ambient frost movement. No save, ore discovery, collision or balance changes.

QA: isolated desktop checks at surface level and approximately 289/583 units above the surface verified that the landscape recedes out of view, with zero panorama requests and no page errors. Portrait 390x844 was also checked. Physical Android performance remains untested. The rejected asset is preserved only under ignored output/playwright.

Cryo refinement QA (24 October): mixed glacier-wall, split-peak and shelf silhouettes replace the repeated ridge profile. Added restrained snow caps, fracture strata, sparse near-surface ice clusters and wind streaks. All scenery still uses globe projection and stays behind terrain/actors. Rechecked surface, two ascent heights and portrait mobile with no page errors; no gameplay or save changes. Physical Android remains untested.

Free-fire QA (24 October): mobile FIRE now uses the miner's directional aim when no enemy is present instead of projecting the FIRE button into the world. Existing nearby-enemy aim assistance remains. Desktop Shift + click already fires toward the cursor without a target. Browser-tested machine gun, autocannon and beam laser with no enemies on desktop and touch-layout contexts: all produced shots, consumed charge and stopped after release. Added an empty-sky range regression check; rock occlusion remains tested. Physical Android touch remains untested.

Workhorse refinement (24 October): detailed cargo ribs/amber stripes, lower maintenance passage with moving technician, bridge crew working consoles and walking between stations, engine plumbing and cycling vanes, landing pistons, illuminated ramp and flight-stowed cargo hoist. Existing defensive balance is unchanged. Desktop/mobile visual checks and an accelerated browser defensive encounter passed. Ambient animation/reduced-motion stability and flight geometry were checked with an isolated renderer probe. Physical Android remains untested.

Hint and weapon QA (updated 25 October): the mission hint appears for the first five seconds of play, then is removed for the rest of that session. Hovering, changing objectives and reopening menus cannot bring it back. Desktop and mobile Chromium verified dismissal and menu/hover persistence without page errors. Earlier weapon QA checked continuous left/right aiming and targetless machine-gun firing in empty sky and a cleared underground chamber. Purchases now fit automatically when compatible; existing unfitted weapons still need Workshop > Weapon > Fit. Attempting to fire unarmed or without charge explains why.

Mothership visibility pass (24 October): idle guns sweep independently across the sky, then track nearby flyers. Recoil, muzzle flashes and travelling tracers originate at each rendered barrel tip. Surface flyers now arrive after 25 seconds of active surface play (65 seconds between encounters), approach at 125 units above the surface, and dive after their warning. Larger animated wings improve their silhouette. A normal-timing Chromium encounter verified ship interception at about 27 seconds, no miner hull loss, and movement after closing the ship menu. Reduced-motion art remains stable; natural spawn/dive tests pass. Physical Android testing remains pending.

Mothership component art pass (24 October): rotating guns now have armoured breeches, ammunition boxes, recoil cylinders, slotted cooling jackets and muzzle brakes. Shot origins follow the new muzzle geometry. Distinct cargo locking bars, exposed power modules, aft exhaust nozzle, lift-engine bells, hydraulic landing legs and ramp rails replace generic repeated shapes. Chromium inspected desktop/narrow views and defensive firing with no page errors; the accelerated encounter verified interception and movement after ship-menu exit. Geometry checks cover ambient motion, reduced motion and retracted gear. This pass changes rendering only.


Cave inhabitants (24 October): underground enemies no longer appear on an arrival timer or phase through geology. Deterministic natural cave homes activate as the miner explores nearby; excavating new space does not create new inhabitants. Residents patrol their home and follow bounded routes through open tiles. Solid rock blocks body movement, charges, contact damage and defensive turret fire. Surface/shelter breaks pursuit. Cleared habitat IDs are stored per world outside disposable chunks; save version 34 migrates existing campaigns without changing ore or excavations. Unrevealed cave residents are hidden by exploration fog.
Cave QA: Chromium entered a real seeded Cryo cave at approximately 170 m, observed its resident immediately and moved the miner with no page errors. Automated checks cover deterministic homes, no inhabitants created by excavation, sealed walls, routes opened by mining, high-speed charge collision, turret occlusion, cleared-home map reload and v33-to-v34 migration. Physical Android and long-session population balance remain untested.

Creature and surface art pass (25 October): shared original creature anatomy replaces abstract enemy markers. Cave hunters have segmented shells, alternating jointed legs, antennae and bite jaws; scrappers have armoured fronts and claws; flyers and mantas have membrane wings, tails, crests and attack folding. Wind-up, charge, contact and hit states drive the art, with stable reduced-motion poses. Ground scenery uses seeded irregular ice shards/slabs, mineral formations, rocks, wreckage and wind-blown growth projected onto the globe. It clears ship/building access and disappears with mined support. This is a visual surface pass, not new terrain collision or elevation. Chromium cave movement and surface views passed without page errors; art checks cover all four movement/attack silhouettes and reduced motion. Physical Android remains untested.


### Surface terrain and creature territories (25 October 2026)

Local expeditions now use a saved, deterministic surface profile: real stepped ridges, shallow basins, building shelves and open shafts into roofed cave chambers. The same profile drives solid tiles, the globe silhouette, surface classification, decoration and placement checks. New structures require supported, level ground. The mothership landing apron stays level.

Save version 35 accepts version 34 and older migrations. On the first load, existing building footprints and columns around old excavations retain their original terrain. The generated profile is then stored rather than recalculated as the player mines. Existing ore inventories, structures and destroyed tile records are retained.

Bone-and-chitin nests mark surface territories. Entering a territory wakes its flyer; leaving its range or hiding underground breaks pursuit. Defeated territories remain cleared in that world's save. Cave creatures inhabit natural chambers and cannot move through solid blocks or emerge onto the surface. No new menus, scrolling or dropdowns were added.

Browser QA used isolated saves at 1440x900, 1280x800 and 390x844: terrain and cave rendering, visible nest encounter, far-side flight, mothership close-and-move, and no document overflow. A condition-based cave escape test flew from y=347.6 to y=-22 with battery remaining. The cave inhabitant dealt damage before escape, as intended. Some earlier browser attempts were interrupted by hot reload or page-load timeout and were retried. Physical Android testing remains outstanding. QA screenshots and scripts are ignored under `output/playwright/terrain-*`.

Validation: npm install, the complete npm test suite, the terrain persistence/territory tests and npm run build passed. The build retains the existing large-bundle warning. These changes are local and have not been committed, pushed or deployed.


### Quick mothership unloading

Near the landed mothership, press **F**, click **Unload ore**, or tap **Unload ore** in the mobile action buttons. The miner remains playable; no menu is opened. A single saved transaction moves carried ores into the ship hold, retaining any excess in the miner. Empty/full hold states are explicit, and failed saves roll back the complete transfer. The cosmetic sequence opens the intake shutter, arcs a bounded set of cargo crates into the ship and feeds them past a roller bed, loading arm and operator. Reduced motion uses a static intake indication instead of flying crates.

Browser checks at 1440x900 and touch-emulated 390x844 confirmed full-haul transfer, partial capacity with the remainder retained, repeated-input safety, persistence after reload, no page errors and no document overflow. Unit coverage includes fractional units, a single save per haul and false/throwing save rollback. Artifacts are in ignored `output/playwright/unload-*`. Physical Android remains untested.

Quick-unload validation: npm install, npm test and npm run build passed. The keyboard F shortcut and reduced-motion presentation also passed browser checks. The build retains the existing large-bundle warning. Changes remain local, uncommitted and unpushed.

Unloading animation iteration: the miner opens a cargo hatch and recoils on each ejection. Up to four cosmetic crates launch from the moving hatch, tumble onto a telescoping receiving platform, bounce, and are lifted into a visible stack by a larger jointed loader. Hydraulic rails retract, the shutter closes and completion lights turn green, with ejection, landing and completion sounds. Reduced motion keeps a static handling presentation. Cargo transactions are unchanged. npm install, npm test and npm run build passed; browser checks confirmed movement during unloading, completed retraction, mobile layout, reduced motion, capacity and reload safety. Physical Android remains untested. QA artifacts: output/playwright/unload-refine-*. Changes remain local and unpushed.

### Fresh-save gameplay review (25 October 2026)

Played a new, isolated browser context on the local game without granting items or changing inventory. The user's browser profile and save were not accessed. Three normal drilling runs reached about 330 m; returned using W, unloaded using F, built a Market uplink with earned ship-held ore, sold copper and silver, bought/fitted a cargo rack (16 to 20 capacity), and paid for repairs. Reload preserved ore, Kredits, equipment, the uplink and all mined cells exactly. Descending an existing shaft caused substantial impact damage; W braking is now explicit on the start screen. Physics and damage balance were not changed from this single run.

Review fixes: Cargo & selling opens on accessible stocked inventory instead of an empty miner; the HUD Cargo button still explicitly inspects the miner. Empty cargo points to existing ship/planet stock. Mothership navigation uses consistent Cargo & selling wording, and explains that construction/equipment use shared ore. Construction copy distinguishes travelling ship stock from stationary warehouse stock. Equipment previews display projected fitting power and numerical changes to rig stats before buying. The dedicated loadout screen bypasses generic page splitting, with compact spacing for landscape phones.

Browser checks: desktop 1440x900, portrait 390x844, landscape 844x390; loadout and simple cargo panels fit without scroll overflow. Purchases, sales, repair, recharge and reload were exercised through normal controls. No page errors in the final recovery/reload check. This covers the opening mining/economy loop, not a full campaign or long-session balance review. Physical Android touch/performance, later automation, multi-world travel and multiplayer were not retested in this pass. QA scripts/screenshots live under ignored output/playwright/fresh-*.

Validation for this review: npm install, the full npm test suite, and npm run build passed. The production build retains the existing large-chunk warning.

### Continued base/combat playthrough (25 October 2026)

Continued the isolated earned save with normal controls, no inventory grants. Bought/fitted the machine gun, defeated a surface nest inhabitant, encountered a cave manta, and escaped through excavated passages. Built a warehouse on the cleared territory, rejected an unsupported silver extraction seam, moved to iron and built an extractor. Observed real iron production into planetary storage across reload. Bought excavation charges, excavated a chamber, built/entered an underground shelter, observed automatic recovery to full hull/battery, then left and returned to the surface. Sold three individual silver units through Advanced to afford a pylon; the new pylon intercepted the next territory's flyer with no miner damage. A further flyer took a visible gun hit (2 to 1.65 health) and withdrew when the miner went underground; its uncleared nest activated again later. Five buildings, equipment and earned currency survived reload. The user's existing browser profile/save was never accessed.

Fixes from this pass:
- B and the touch Build action open the underground catalogue even above the minimum construction depth. The footer explains the 180 m rule or the required chamber clearance, and an invalid site cannot spend materials.
- Underground placement searches nearby clear space instead of demanding one exact anchor. It retains footprint, depth and building-spacing checks and rejects solid-rock paths to separate cavities. Browser-tested against the actual excavated QA chamber.
- Armed surface combat prompts explain firing as well as retreat (touch uses FIRE); damaged/attacking flyers show a small health bar. Gun victories distinguish a cleared territory from a cave creature defeat; cleared nearby nests are labelled quiet.
- Extractor copy explains the warehouse dependency and 0.5 ore/75-second starter cadence. Colony details name the receiving inventory and explain storage blockage. Removed obsolete fort copy promising timer-driven raids. Production/combat economy rates were not changed.
- Fixed an old flat-surface docking rule that made the rig hover over terrain dips. Landings follow local terrain height, and open cave mouths have no invisible landing plane. Browser-tested returning from the saved shaft and settling into a dip with zero rock overlaps; regression tests cover relief and cave mouths.

Building feedback fits 390x844 and 844x390 without panel overflow. Placement regression tests cover nearby chambers, solid rock, depth and overlap restrictions. Remaining balance questions: starter extraction is slow compared with active mining; later enemy variety and repeated long-session defence need a longer balance pass. Physical Android controls/performance, full campaign travel, and multiplayer were not retested here. QA artifacts are ignored under output/playwright/base-*.

Additional browser check: a separate touch-enabled 390x844 context, copied only from the QA save, opened Tools > Build by tapping; no overflow or page errors.

Final validation: npm install, the full npm test suite (including nearby-chamber and terrain-docking regression cases), and npm run build passed. Existing large-bundle warning remains. Changes are local and unpushed.


### Mothership operations navigation review (2026-10-25)
- Six permanent home destinations separate Build structures, Your colony, Cargo & selling, Miner loadout, Recharge & repair, and Star map. Building an uplink updates the cargo status without replacing construction.
- Home uses a responsive single-screen grid, with no pagination, scrolling or dropdowns. Secondary paint/log/help tools remain below it.
- Cargo inspection no longer silently refuses to open away from storage; individual freight actions retain proximity checks.
- Browser-tested a disposable copy of the earned QA save with an existing uplink at 1440×900, 390×844 and 844×390: no card/content overflow, construction and cargo both open. Original user save untouched. Physical Android testing remains outstanding.
- Validation: npm install, the full npm test suite and npm run build passed; build retains the existing large-bundle warning.

### Menu artwork refresh (2026-10-25)
- Start/pause artwork and browser miner icon now use the current in-game vehicle drawing code. Regenerate with npx tsx scripts/export-menu-art.ts after model changes.
- Mobile has its own framing so both vehicles remain visible. Continuing saves say Your expedition instead of First deployment.
- Browser checked at 1440x900, 780x817 and 390x844 without overflow, in a disposable context. User save untouched.
- Menu-art validation: npm install, npm test and npm run build passed; existing bundle-size warning remains.

### Launch control guide (2026-10-25)
- Launch screen now teaches move, mine, fly/brake, shoot (Shift + click, fitted weapon required), fast unload (F near ship, available storage) and build (B). Touch labels show FIRE, Unload ore and Tools to Build.
- Full desktop and touch guides include combat and menu-free unloading. No input or save changes.
- Browser checked 1440x900, 780x817, 390x844 and 844x390: six controls fit without scrolling.
- Launch-guide validation: npm install, full npm test and npm run build passed; existing bundle warning remains. Touch FIRE/Unload/Build labels and guide verified in an isolated mobile browser.

### Operations navigation and quick rig exchange (2026-10-25)
- Persistent Home / Build / Colony / Cargo / Loadout / Repair / Worlds / More navigation across operations screens, with an eight-tab desktop row and two phone rows. No scrolling or dropdowns.
- Land beside the mothership and press G (or tap Repair) for full hull repair plus free recharge at the existing service price shown on the button. F remains fast unload; grapple is now H.
- The 3.2-second visual exchange lifts the pilot with support drones, returns the empty chassis towards the ship and flies replacement sections into place. The actual game model and fitted equipment are reused. Reduced-motion presentation avoids flying parts.
- Service is saved atomically before the cosmetic sequence, prevents duplicate requests, preserves cargo/loadout and rolls back money/hull/battery if saving fails. Movement, drilling and firing wait for exchange completion; the world continues.
- QA uses disposable copies only, leaving the user save and the earned playthrough save untouched. Tested desktop and phone operation navigation and a damaged-rig exchange.
- Browser verification: G pressed twice charged once (K 25 from 500), full hull and battery survived reload, cargo unchanged. Touch Repair matched. Navigation/content checks passed at 1440x900, 390x844 and 844x390 after tightening the landscape loadout panel. Physical Android and extended combat during exchange remain untested.
- Validation: npm install, full npm test (including quick-repair transaction cases), and npm run build passed. Existing large-bundle warning remains.

### Unlimited colony building (2026-10-25)
- Removed per-type and per-planet building-count caps from catalogue, placement/site selection and save validation. Building still requires materials, a valid footprint and support; overlapping buildings remain blocked.
- Additional warehouses add their own capacity to planetary storage. Colony upgrades target the selected warehouse. Wall counts no longer show a quota.
- Save data shape is unchanged; existing saves remain compatible. Added coverage for 40-warehouse save import and mixed-tier storage capacity.
- Isolated browser QA loaded 29 structures including 25 warehouses: the catalogue showed 25 built, kept Choose placement enabled, and entered a valid additional warehouse placement. The user's save was untouched. Very large-colony performance has not been stress-tested.
- Final validation: all 21 focused building/save checks, full npm test, npm install and npm run build passed. Legacy quota assertions were replaced with expanded-colony expectations; normal data validation remains. Build retains its existing bundle-size warning.


### Warehouse quick unload (25 October 2026)
- F or the touch Unload action now transfers the miner haul into shared planetary storage beside an ore warehouse. A nearby warehouse takes precedence over the ship; the action names its destination. Storage limits preserve excess cargo, and the existing atomic saved transfer rolls back on save failure.
- Warehouse receiving animation adds ejected crates, moving conveyor rollers, a loader robot and a completion pulse. It follows the building projection, supports reduced motion, and does not trigger the mothership loader. Animation is cosmetic; cargo is saved first.
- Isolated browser fixtures verified a 1.5-unit partial transfer, repeated F, a full 9.5-unit touch transfer, full storage, unchanged ship inventory and reload conservation. Phone 390 × 844 had no page overflow. User save was not accessed or modified. Physical Android and far-hemisphere animation were not tested.
- Suggested future world actions, not implemented: repair drones for nearby damaged defences; explicitly priced quick sales at the uplink with a cargo pickup; building relocation with a packing/crawler sequence. Avoid adding manual collection chores to extractors that already feed storage automatically.
- Validation: npm install and the complete npm test suite passed; production build passed (existing large-chunk warning). A final build after the cargo-help wording update is recorded in output/playwright/warehouse-final-build.log.


### Uplink quick sales and destructible economy buildings (25 October 2026)
- Beside a Market uplink, T or the touch Sell action sells all carried miner ore to the best available civilian buyer. The action displays the ore amount and exact Kredits including the current project bonus before activation. Ship and planetary inventories are not sold. Empty cargo, concurrent handling, menus and remote activation are blocked. Payment and cargo commit atomically before the cosmetic pickup; save failure rolls both back.
- An original twin-thruster cargo drone approaches, winches a crate from the rig's sale position, passes the uplink and departs. Reduced motion keeps it stationary. No new save fields or relocation mechanic.
- Territorial surface encounters alternate between the miner and nearby colony buildings when available. Warehouses, uplinks and extractors are now valid targets alongside defences/habitats. Existing integrity, walls, turret interception, destruction and saving apply; destroyed sites can be built again. Leaving surface territory still ends encounters, so this does not add offline raids. Underground creatures remain confined to their existing cave gameplay.
- Isolated browser fixtures: desktop T and phone touch both displayed and paid exactly 289 Kredits for 9.5 ore; repeated T paid only once, ship/warehouse stocks stayed unchanged, and reload retained payment and empty cargo. Phone 390 × 844 showed no page overflow. A deliberately damaged warehouse in a nest territory was targeted, destroyed and remained absent after reload. User save untouched. Physical Android, far-hemisphere drone presentation and long-term raid balance remain untested.
- Validation: npm install, the complete npm test suite and production build passed. Browser fixtures and screenshots are under ignored output/playwright/uplink-*. Existing user save and live deployment unchanged.


### Field repair, mothership survival and miner wrecks (25 October 2026)
- J / touch Repair fixes the closest damaged building for the displayed 180 Kredits, with two welding drones and sparks. It includes warehouses, uplinks and extractors as well as defences. When no damaged building is nearby, it repairs a damaged mothership. G remains the miner exchange.
- Mothership hull starts at 3,000. Surface siege encounters can inflict 100 damage; its guns and colony defences still intercept attackers. Initial tuning allows a home assault after 120 active surface seconds. Hull reaching zero ends the expedition persistently; starting another expedition uses the existing explicit new-game confirmation. No offline assaults.
- Miner destruction ejects a pilot with smoke/debris, leaves a non-colliding visual wreck and transfers all carried ore into its persistent salvage. Recovering returns the pilot to the surface; approaching a wreck retrieves only what fits. Wrecks never enter terrain, structure placement or weapon collision checks. Battery exhaustion remains a predictable stranding event, not a random overcharge explosion; recovery leaves that cargo at a wreck too.
- Save v36 migrates older campaigns with full mothership hull, preserves existing map data and records disabled miners and planet-local wreck cargo. Save/reload cannot reset defeat or restore sold/recovered cargo.
- Disposable browser checks: repair price 180 charged exactly once and restored integrity survived reload; enemy-caused miner death left 7.5 copper + 2 iron at the wreck, persisted through reload, then recovered exactly once; 25-unit wreck with 16 capacity retained 9 at the wreck after reload. Phone repair restored mothership hull from 1,000 to 3,000, cost 180, and persisted. Defeat at zero hull survived Escape/reload. Phone checks had no page overflow. User save untouched. Physical Android, far-hemisphere effects and long-term siege tuning remain untested.
- Validation: npm install, full npm test, the additional natural mothership siege test, and production build passed. Existing large bundle warning remains. Changes are local, not pushed.

### Airborne rig exchange (25 October 2026)
- Removed the landed/docked requirement from G and the Repair button. A miner flying within the existing mothership service range can trigger the same priced replacement sequence. The lift drones hold the miner position during assembly, then normal flight resumes. Existing equipment/cargo and saved service transaction are unchanged; disabled miners still use recovery.
- Updated the field guide to describe in-flight servicing. Disposable desktop and 390 × 844 touch checks both initiated repair while airborne, restored 45 hull to 100 for exactly 25 Kredits, and showed the replacement animation without page overflow. Holding W resumed upward flight after assembly; repeated G charged only once. User save untouched.

### Rig exchange visual pass (25 October 2026)
- Airborne servicing uses the equipped miner artwork, with curved component arrivals, rotating service markers, articulated pilot-recovery drones, module-lock welding sparks and a final thruster ignition. Reduced motion uses the assembled miner and a quiet service outline.
- Isolated desktop (1440x900) and touch (390x844) browser checks confirmed airborne activation, a single K 25 payment despite repeated input, full hull/battery restoration, resumed movement and no viewport overflow. Assembly screenshots are under ignored `output/playwright/`. The real save was not used. Physical-device performance remains untested.

### Sandbox opening expedition (26 October 2026)
- New local Cryo expeditions have a reliable copper/iron starting seam, a sheltered cave with construction space, an iron breakthrough into a deeper silver/crystal den, and a slower territorial first creature. No objectives, catalogue gates or timed encounter spawns are added. Discovery messages are brief and saved once.
- The excavator costs 4 copper / 6 iron; the hauler and expedition battery each cost 6 copper / 4 iron. The workshop marks affordable departments and previews actual equipped stats. All models remain directly purchasable. The battery increases charge capacity without granting charge on purchase; mothership recharging remains free.
- Shelters can be built from 60 m. Their clearance matches their above-floor footprint (5 tiles across, 3 high), rather than requiring excavation below the floor. Powered downward drilling caps descent at 220 px/s; empty batteries, ordinary freefall and core crossing retain their physics.
- Save v37 adds an opt-in opening layout for newly created Cryo maps. Migration preserves existing map contents and leaves old maps opted out; old buildings, ore and tunnels are not regenerated. Cleared den inhabitants use the existing coordinate-based persistence format.
- Fresh-save desktop playthrough used normal input and earned ore: mined and unloaded, bought/fitted an expedition battery, recharged, discovered the cave, mined building materials, built a shelter and observed hull/battery recovery while the world ran. The first den retreat failed and killed the test miner; this exposed the need for a connected escape passage and a territorial first resident. After those changes, normal recovery retained the built shelter and dropped cargo; a subsequent den visit defeated the slower resident with the drill and returned through the passage to the shelter. Controlled drilling prevented the previous routine shaft-impact damage.
- Touch-browser checks at 390x844 and 844x390 covered fresh mining, return to ship, construction and equipment comparison. No viewport/panel overflow. Fixed the Tools tray remaining over contextual actions, and silent unavailable Loadout/Repair navigation now explains where to go.
- QA uses disposable browser contexts only; no user-profile save was read, reset or overwritten. Screenshots and scripts are in ignored `output/playwright/`. These are interrupted development playthroughs, not a measured uninterrupted 20-minute usability study. Real Android performance and unaided-player pacing still need testing.

### Outpost feedback pass (2026-10-26)
- Extractor gauges now follow the saved half-unit production fraction; nearby active production shows an ore-to-storage delivery label. Production settles once per second during play and keeps the existing finite-seam, storage-capacity and offline rules.
- Colony details show the next batch estimate and the actual next destination (planet warehouse first, otherwise mothership). The storage summary explicitly labels planet storage.
- Extractor placement reports seam yield, uncleared nest territory and mothership/tower coverage. On building encounters, a nearby nest prioritises an extractor inside its territory. Underground retreat still ends the encounter; this adds no offline attacks.
- QA: disposable browser fixture verified a 0.5 copper payout into the ship without a warehouse, colony destination copy and placement coverage. Portrait 390x844 and landscape 844x390 checks exposed clipped landscape actions; compact layout fixed and both passed overflow checks. Existing player browser/save was not accessed. Unit coverage checks countdown/payout agreement, settled reload conservation, territorial targeting and underground retreat. This is targeted feature QA, not a fresh uninterrupted 20-minute pacing study; physical Android touch remains untested.

### Rewarding outpost loop (2026-10-26)
- Extractor rates are now 120 / 240 / 480 ore per hour. The basic machine delivers 0.5 ore every 15 seconds, and its 60-unit seam lasts 30 minutes. Offline production uses the same bounded rates; storage and depletion still stop production.
- Real settled batches drive cargo-bin fill, loader-arm activity and short drone deliveries to a warehouse or mothership. These effects never modify inventory. Split deliveries identify the correct destination; loading offline production does not spawn a screenful of drones.
- Attack warnings name the threatened building and mark it in-world. Damaged structures show a health strip and smoke. Existing defence, repair and underground-retreat rules remain in place.
- Corrected the build catalogue's stale warehouse requirement. Ship storage works without a warehouse. Existing equipment remains the reward: two complementary extractors yield 6 copper and 6 iron in three minutes, enough for one hauler, excavator or machine-gun purchase and fit (tested independently).
- Playtest: isolated fresh save mined 6 copper / 1 iron, spent 3 copper / 1 iron on a surface extractor at x300 via the catalogue and placement controls, then received 0.5 copper into ship storage after its first cycle. Selecting a site required moving past the ship's occupied footprint. An unbraked fall during this test caused the existing hard-landing penalty; return with braking remained possible. Separate disposable combat fixture showed a named extractor warning, target marker and damaged-warehouse effects. Mobile colony views at 390x844 and 844x390 had no overflow. Full test suite passed; added reward and split-delivery tests passed; production build passed. Existing user save untouched. Physical Android performance and a continuous 20-minute end-to-end pacing study remain untested.

### Human surface attackers (2026-10-26)
- Added ordinary game-controlled ground rigs and gunships. One encounter at a time, 75 seconds of active surface grace, then alternating types with 110-second spacing and a bounded encounter lifetime. No enemy economy, camps, LLMs, offline attacks or new durable save fields.
- Ground rigs use a walkable arrival route, follow terrain and stop at cliffs, mined shafts and walls. If no ground route exists, defer and try an aircraft encounter. Gunships hover above the local surface. Underground retreat ends either encounter; underground creatures are unchanged.
- Original angular slate/rust machinery includes cockpit glazing, crawler bogies and moving treads, suspension, hover exhaust, armour plates, a tracking gun, recoil, muzzle flashes and visible travelling rounds. Rendered barrels and projectile origins share muzzle geometry. Reduced motion suppresses bobbing/flashes/exhaust movement.
- Shots lock an aim point, resolve after flight and can be dodged. Rock and defensive walls stop them. Existing miner weapons, towers and mothership guns engage both types. Surface turrets can defend themselves against human attackers.
- QA: full npm test passed after updating the old siege test to allow the new preceding human warning; added tests cover arrival grace, type alternation, walls/shafts, projectile origin/travel, dodging, cover damage, flight altitude and underground retreat. Final build and targeted combat/terrain tests passed. Isolated browser tests confirmed natural ground arrival and damage, a forced gunship encounter in a disposable fixture, and gunship defeat with Shift-click. The 390x844 combat viewport had no document overflow. Existing user save was never accessed or modified. A test setup was rejected by automatic review before execution; subsequent fixtures used explicitly empty browser contexts. Physical Android performance and sustained wave balance remain untested.

Mothership navigation groups related tasks: Buildings contains Build new and Your buildings; Miner contains Equipment, Repair & recharge and Paint. Ore, Worlds and Extras stay directly accessible. Menu navigation checked in isolated empty-save browser contexts at 1280x720, 390x844 and 844x390; no document overflow or offscreen modal buttons found in the five main task panels. Physical phone testing remains outstanding.

Picture-led menu pass: overview cards use original miner/building art; build choices show building silhouettes and explicit missing ore; miner slots have part icons and named item buttons instead of arrow browsing. Ore locations have distinct miner/ship/warehouse pictures, sales quote the exact Kredits, and repair actions name the 100% result. Main operation panels consistently use Back to game. Verified six main panels at 1280x720, 390x844 and 844x390, plus every equipment choice in both mobile orientations, with no scroll containers or covered/offscreen controls in these checks. A disposable stocked save sold 3 Copper for the quoted 72 Kredits and restored hull/charge through the repair screen. Existing user storage was not accessed. npm test and production build passed; actual child usability and physical-device touch have not been tested.

Building placement update: new surface structures use the same detailed art for their preview and built form. A level foundation samples natural terrain and extends supports over up to 120px of relief; missing support or overlapping buildings blocks placement. Existing stored coordinates and excavated terrain are retained. Repeat placement stays active, finds a nearby usable candidate and centres the view; touch uses Build here / Done. Assembly includes a short delivery drone effect and honours reduced motion. Warehouses/extractors/turrets expose existing upgrades with before/after storage, production or range in Your buildings.
Additional surface nests are persisted in the existing terrain array, only on solid untouched sites away from saved buildings, workings and the mothership; no schema change. Surface mouse drilling now works above ground, walking alone does not deal drill damage, and touch S aims toward a nearby creature. Surface drill attacks check rock obstruction and defeating a nest inhabitant records the cleared territory.
QA: npm install, full npm test and production build passed. Isolated desktop and touch-emulated 390x844 playtests built two warehouses successively, verified exact iron/silver deductions and reload persistence; selected warehouse upgraded from 40 to 100 storage in place. A controlled isolated surface encounter was defeated with mouse-aimed drill input. Added tests cover slope supports without terrain mutation, overlap prevention, idempotent nest expansion away from structures, and drill territory clearing. Actual Android device feel and extended combat balance remain untested. User browser storage was never accessed.

### Shared game buttons

`src/game/ui/GameButtons.ts` and `GameButtons.css` own button appearance across menus and in-world controls. New buttons may declare `data-button="primary"`, `"secondary"`, `"choice"` or `"danger"`; existing UI selectors are adapted centrally. Use native `disabled`, `aria-pressed` and `aria-current` for states. Screen CSS should own layout only, not invent new button colours, radii or focus treatments. Planet map objects and the cargo telemetry trigger intentionally retain their specialist presentation. The observer applies presentation to newly rendered controls without changing handlers or save state and disconnects on hot reload.

Button QA: eight main screens checked at 1280x720, 390x844 and 844x390 after transitions settle, with no scrolling, covered buttons or offscreen controls detected. Reviewed rendered screenshots; touch-emulated repeat warehouse placement, Done, exact material payment and reload persistence still pass. Full tests and production build passed. Physical Android testing and signed-in account/online workflows were not exercised; all browser testing used empty isolated contexts.

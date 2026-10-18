# Ore Frontier

An original browser mining game built with TypeScript, Phaser 3 and Vite. Your mothership lands with a mining rig but no jump fuel, no camp and no credits. Mine to build an operation, connect to the market, upgrade your rig and fuel travel to other planets.

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

The opening screen teaches movement, drilling and return flight. The fullscreen build catalogue groups Mining, Storage, Services and Defence without scrolling or dropdowns. It shows exact shortages from pooled planetary materials and retains repair/upgrade management. There is no camp prerequisite for an uplink. The Star map has its own menu entry.

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
The surface catalogue is open from the start: Mining, Storage, Services and Defence. Camp, uplink, warehouse and extractor have material-only entry costs; other buildings retain their credit costs and physical limits. A camp is a service option, not an uplink prerequisite. All construction draws from carried ore first, then the current planet's stored ore; other planets are never charged. Surface placement has a ghost preview, occupancy validation, optional snapping, Place and Cancel. Existing wall stacking remains available.

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

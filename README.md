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

The same game and save format support touch devices. Landscape is recommended; portrait remains playable. The left pad steers and thrusts upward, while the right pad drills down or sideways. Sideways steering also drills against rock, just as keyboard movement does. Multiple fingers can hold thrust and drilling together. Board/Disembark, Services, Build and Map are available on screen; equipment controls appear when owned. The pause button stays in the top bar.

Touch inputs clear on rotation, menu entry, cancellation and loss of focus. Phone layouts use a compact battery/hull/cargo HUD, safe-area spacing and full-screen service panels. How to play shows touch instructions on touch devices. No mobile fork, backend or save migration is required.

Verified with Chromium mobile emulation at 844×390 and 390×844, including mining, return, transactions and reload. Real iPhone Safari/Android hardware, thermal performance and extended interplanetary play still need device testing; this is not a claim of full mobile certification.

The 2026-10-17 beta UX pass changes the mothership flight deck to fit the viewport, turns its destinations into a compact touch grid on narrow screens, hides scrollbar chrome, and replaces service/reserve/warehouse dropdowns with visible button choices. Build and automated tests pass. The deployed PR preview was browser-tested at 1536×639: the full star map and launch button fit, world selection updates the detail panel, and neither the document nor modal overflows. Physical Android testing is still pending.

## Ore Frontier teaser

The Ore Frontier teaser is the homepage at `/` and is also available at `/teaser.html`; the playable game is at `/play`. Its copy describes building a mining empire through ore collection, camp/uplink construction, rig upgrades, warehouses, automated extraction, and planetary travel. The hero and video poster use an actual gameplay capture. The embedded gameplay MP4 is hosted in the public Supabase media bucket. CREDIT is the planned ecosystem token; the page distinguishes the local game economy, the separate player-market beta, and future token integration. Unagreed seasonal expeditions, voting, and token cosmetics are not advertised.

The custom domain is `https://playorefrontier.xyz/`; canonical and social-share metadata use that URL. Cloudflare Pages rewrites `/play` to `game.html`. Branch previews update after pushing; production remains on `master` until the PR is merged.

## The mining loop

1. Deploy from the mothership on the Cryo Shelf. Mine copper and iron nearby.
2. Build a **Mining camp** with 6 copper and 4 iron. No credits are required.
3. Build a **Market uplink** with 4 copper, 4 iron and 2 silver. It connects the planet to the interplanetary market and unlocks ore sales and paid rig upgrades.
4. Sell carried ore for credits. Store construction materials in the mothership hold before selling the rest. Stored ore is not sold.
5. Buy upgrades, expand your operation and drill toward the planetary core.
6. Extract cores for **mothership fuel**. Board with E, choose **Pilot mothership**, then hold W to take off. Travel costs core fuel by distance; a core supplies four units.

The rig runs on a **battery**, separate from mothership fuel. Return to the mothership and choose **Recharge** to fill it for free, even with zero credits. Hull repairs still cost credits. Signals, missing-crew quests and survey cash rewards are not part of the live expedition. Cores supply travel fuel, not cash.

Near the core, aim at its glowing marker and hold the mouse button to extract it. The marker remains selectable when polar tiles become narrower than a screen pixel; intervening rock still needs to be drilled first. A fresh Cryo descent, core extraction and return to the surface has been browser-tested with earned cargo and no funded upgrades. A later core-crossing return stalled against rock, so reliable return navigation and the full six-world campaign remain under review.

An earned opening campaign also passed core return with controlled browser frame timing, camp/uplink construction, first sales and the first drill upgrade, including save/reload. Shipment quantities update their quote while you type without losing focus when switching fields. These automated checks do not replace real-time navigation, raid-balance or human playtesting; see [QA](docs/QA.md).

Camp and uplink construction uses ore carried in the rig. Withdraw stored materials first, press B, select a building, position its preview, then confirm. Materials are spent only after successful placement. The initial material seams provide enough ore for both buildings. Additional warehouses, extractors and existing colony structures remain available.

## Controls and menus

- **A/D** or **Left/Right:** move.
- **S/Down:** drill downward. **W/Up/Space:** thrust through open tunnels.
- **Mouse:** aim; hold left-click to drill.
- **E:** open the mothership or use a nearby structure. **Return to mine / Esc** closes the landed ship terminal and deploys the rig immediately.
- **B:** open the build yard. **M:** explored tunnel map. **Esc:** pause/close.
- **R:** installed surface winch. **Q:** mining charge. **X:** installed stasis module.

The **Open mothership** button and E open the same full-screen hub: recharge, build/sell, storage and upgrades. Leaving the terminal restores miner controls immediately, including Space to thrust; no second E is required. **Pilot mothership** deliberately keeps you aboard for flight once core fuel is available.

The opening screen teaches movement, drilling and return flight. The in-game objective tracks carried materials against building costs from `src/game/config.ts`. The build yard starts with just Mining camp and Market uplink; **More buildings** opens the rest. Optional records, appearance and worlds live under **Explore & customise**.

The game fits the viewport without browser scrollbars. Main menus use the full screen; longer reference/catalogue panels offer **Previous / Next** controls and still support wheel, touch and keyboard navigation. Phone service navigation uses a compact selector. The original illustrated title, lander, sky and mineral treatment share the new blue/orange visual style.

The redesigned miner has a visible pilot, directional banking, gimballed thrusters, correction jets, retractable skids and drill recoil. The mothership uses a long carrier hull, raised bridge, twin engines and a closing landing bay. These animations follow movement without changing handling, collision size or saves. Pause freezes the pose; reduced motion removes banking and oscillation.

## Saves and compatibility

Campaigns remain under `mars-miner.v1`, save version 30. Existing credits, upgrades, structures, cargo, stored ore and excavation are retained; only fresh expeditions start at zero credits. The internal `fuel` field represents rig battery charge. Version 29 saves gain empty slots for the four new ores and a civilian delivery ledger. Retired survey IDs remain readable for older saves, but their collectibles and quest prompts are absent from live gameplay.

Automated extractors stop at the planet warehouse's capacity and cap offline catch-up at 12 hours. Full storage discards blocked production instead of banking it for an immediate payout after withdrawal. The extractor upgrade panel shows the same credit and material costs that the purchase charges. Browser fixtures cover a Cryo–Mars round trip, upgrade persistence, full-store withdrawal/reload, and v28 migration; they do not replace an earned-resource campaign playthrough.

## Worlds, customers and the Expedition Codex

The planet atlas previews geology and expedition footholds. In orbit, the flight deck shows route fuel cost and remaining fuel before an explicit departure, with a skippable transit sequence. Civilian worlds are trading partners, not playable mining destinations.

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

### Launch landing page update — 2026-10-17

The custom-domain landing page includes launching-soon messaging, the game overview, proposed token utility and demand drivers, a staged product roadmap, and a non-clickable official X account placeholder. The agreed token name and ticker are **CREDIT**, targeting **Robinhood Chain** with a proposed CREDIT/WETH pair. The contract, supply, distribution, vesting and actual game utility remain unconfirmed; the page makes no claim of live token integration or economics. Gameplay and save schema are unchanged.

Validation: npm install, npm test, and npm run build passed. Local Chromium exercised Tokenomics and X section navigation at 1440×900 and 390×844 and opened the launch FAQ. Screenshots are in ignored output/playwright/launch-desktop.png and launch-mobile.png. This checks the local landing page, not a deployed custom domain or real mobile hardware. The /play hosting rewrite and expedition gameplay were not retested in this content-only pass. These edits have not been deployed.

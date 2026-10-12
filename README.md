# Interplanetary Miner

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

## The mining loop

1. Deploy from the mothership on the Cryo Shelf. Mine copper and iron nearby.
2. Build a **Mining camp** with 6 copper and 4 iron. No credits are required.
3. Build a **Market uplink** with 4 copper, 4 iron and 2 silver. It connects the planet to the interplanetary market and unlocks ore sales and paid rig upgrades.
4. Sell carried ore for credits. Store construction materials in the mothership hold before selling the rest. Stored ore is not sold.
5. Buy upgrades, expand your operation and drill toward the planetary core.
6. Extract cores for **mothership fuel**. Board with E, then press W to choose another world. Travel costs core fuel by distance; a core supplies four units.

The rig runs on a **battery**, separate from mothership fuel. Return to the mothership and choose **Recharge** to fill it for free, even with zero credits. Hull repairs still cost credits. Signals, missing-crew quests and survey cash rewards are not part of the live expedition. Cores supply travel fuel, not cash.

Near the core, aim at its glowing marker and hold the mouse button to extract it. The marker remains selectable when polar tiles become narrower than a screen pixel; intervening rock still needs to be drilled first. A fresh Cryo descent, core extraction and return to the surface has been browser-tested with earned cargo and no funded upgrades. A later core-crossing return stalled against rock, so reliable return navigation and the full six-world campaign remain under review.

An earned opening campaign also passed core return with controlled browser frame timing, camp/uplink construction, first sales and the first drill upgrade, including save/reload. Shipment quantities update their quote while you type without losing focus when switching fields. These automated checks do not replace real-time navigation, raid-balance or human playtesting; see [QA](docs/QA.md).

Camp and uplink construction uses ore carried in the rig. Withdraw stored materials first, press B, select a building, position its preview, then confirm. Materials are spent only after successful placement. The initial material seams provide enough ore for both buildings. Additional warehouses, extractors and existing colony structures remain available.

## Controls and menus

- **A/D** or **Left/Right:** move.
- **S/Down:** drill downward. **W/Up/Space:** thrust through open tunnels.
- **Mouse:** aim; hold left-click to drill.
- **E:** board/disembark at the mothership or use a nearby structure.
- **B:** open the build yard. **M:** explored tunnel map. **Esc:** pause/close.
- **R:** installed surface winch. **Q:** mining charge. **X:** installed stasis module.

At the mothership, **Quick services** provides common actions. **Full services** opens the full-screen terminal directly. Before the market connection is built, it opens the build yard; afterwards it opens the workshop. The workshop compares current and next component stats and shows costs and requirements.

## Saves and compatibility

Campaigns remain under `mars-miner.v1`, save version 30. Existing credits, upgrades, structures, cargo, stored ore and excavation are retained; only fresh expeditions start at zero credits. The internal `fuel` field represents rig battery charge. Version 29 saves gain empty slots for the four new ores and a civilian delivery ledger. Retired survey IDs remain readable for older saves, but their collectibles and quest prompts are absent from live gameplay.

Automated extractors stop at the planet warehouse's capacity and cap offline catch-up at 12 hours. Full storage discards blocked production instead of banking it for an immediate payout after withdrawal. The extractor upgrade panel shows the same credit and material costs that the purchase charges. Browser fixtures cover a Cryo–Mars round trip, upgrade persistence, full-store withdrawal/reload, and v28 migration; they do not replace an earned-resource campaign playthrough.

## Worlds, customers and the Expedition Codex

The planet atlas previews geology and expedition footholds. In orbit, the flight deck shows route fuel cost and remaining fuel before an explicit departure, with a skippable transit sequence. Civilian worlds are trading partners, not playable mining destinations.

Teletrade offers four customers: Helion's municipal works, Kepler's shipyards, Verdant's growers and Lyra's research institute. Each has three development projects. Selected shipments earn a capped 35% premium on the current project's remaining ore requirement; completed projects persist and add lights to the world's artwork. Shipment quantities are separate from carried and stored inventory. Select surplus reserves materials for a chosen camp, uplink or warehouse.

Nickel, titanium and cobalt expand planetary geology; cryocrystal occurs only on Cryo Shelf. Deposits obey depth and planet restrictions in `src/game/config.ts`.

Open the Expedition Codex from pause, the mothership terminal, workshop technology links or resource names. Its 28 articles cover miner technology, resources, civilian histories and starting infrastructure, with original illustrations, related links and engineering references. Fictional technology and frontier histories are explicitly identified.

## Art and verification

All runtime artwork is original and drawn locally in Phaser/SVG. The mothership is the initial surface landmark; player buildings appear through construction. Mining camp platforms and the camp surface zone protect against fall damage. The game has no backend; the market is an in-game economy.

See [QA](docs/QA.md) for measured playtests and limitations, [architecture](docs/ARCHITECTURE.md) for save details, and [config](src/game/config.ts) for balance data. Historical QA entries describe the behavior tested on their dates and may refer to retired names or mechanics.

## Publish

The existing GitHub Actions workflow tests, builds and publishes `dist/` to GitHub Pages. `vite.config.ts` uses `/SrajMiner/` for production and `/` locally. Local changes are not a hosted deployment.

## Stackable perimeter walls

Choose Perimeter Wall in Build. Auto-stack snaps to an existing column and previews its next supported layer. Keep clicking the column or use Build block to raise a tower; use the layer buttons for manual placement and Done/Esc to finish. Drag or move the mouse toward the edge to pan while building. The camera follows rising stacks, with level lights, construction flashes and rising tones. Each block retains its $80 + 1 copper cost and the existing 12-wall limit per planet. Existing wall saves remain compatible.

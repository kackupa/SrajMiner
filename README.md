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

## The mining loop

1. Deploy from the mothership on the Cryo Shelf. Mine copper and iron nearby.
2. Build a **Mining camp** with 6 copper and 4 iron. No credits are required.
3. Build a **Market uplink** with 4 copper, 4 iron and 2 silver. It connects the planet to the interplanetary market and unlocks ore sales and paid rig upgrades.
4. Sell carried ore for credits. Store construction materials in the mothership hold before selling the rest. Stored ore is not sold.
5. Buy upgrades, expand your operation and drill toward the planetary core.
6. Extract cores for **mothership fuel**. Board with E, then press W to choose another world. Travel costs core fuel by distance; a core supplies four units.

The rig runs on a **battery**, separate from mothership fuel. Return to the mothership and choose **Recharge** to fill it for free, even with zero credits. Hull repairs still cost credits. Signals, missing-crew quests and survey cash rewards are not part of the live expedition. Cores supply travel fuel, not cash.

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

Campaigns remain under `mars-miner.v1`, save version 29. Existing credits, upgrades, structures, cargo, stored ore and excavation are retained; only fresh expeditions start at zero credits. The internal `fuel` field now represents rig battery charge, preserving its saved value and upgrades. Retired survey IDs remain readable for older saves, but their collectibles and quest prompts are absent from live gameplay. No new save fields are needed for this change.

## Art and verification

All runtime artwork is original and drawn locally in Phaser/SVG. The mothership is the initial surface landmark; player buildings appear through construction. Mining camp platforms and the camp surface zone protect against fall damage. The game has no backend; the market is an in-game economy.

See [QA](docs/QA.md) for measured playtests and limitations, [architecture](docs/ARCHITECTURE.md) for save details, and [config](src/game/config.ts) for balance data. Historical QA entries describe the behavior tested on their dates and may refer to retired names or mechanics.

## Publish

The existing GitHub Actions workflow tests, builds and publishes `dist/` to GitHub Pages. `vite.config.ts` uses `/SrajMiner/` for production and `/` locally. Local changes are not a hosted deployment.

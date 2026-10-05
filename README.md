# Mars Miner

An original 2D mining game built with TypeScript, Vite, and Phaser 3. Dig into a seeded Martian world, bring ore back to Outpost 07, and turn your first haul into a better pod.

## Run locally

Install Node.js 22.12+ (tested with Node 24) and npm. From this folder:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://127.0.0.1:5173). If that port is occupied, Vite chooses the next available port. Use the same URL/port to continue an existing save: browser storage is origin-specific.

```sh
npm run build
npm run preview
npm test
```

`build` checks TypeScript and writes the production site to `dist/`. `preview` serves that build locally. No account, API keys, server, or external assets are needed at runtime. Fonts are bundled locally. Visuals are drawn procedurally; audio is synthesized after the first interaction.

## Play

- **A / D or Left / Right:** move; hold into rock to drill sideways.
- **S / Down:** descend and drill downward.
- **W / Up / Space:** thrust upward through open tunnels. There is no upward drill.
- **Esc:** pause/resume. **E:** open the ore exchange at the outpost.
- Surface buttons open **Sell Ore**, **Service**, and **Upgrades**. These panels pause the simulation.

Start by holding S over the copper seam under your pod. Follow nearby veins, then hold W to fly up your shaft. Move sideways onto solid ground before releasing thrust. Sell your haul, refuel, repair, and buy an upgrade. Hard falls hurt; short drops do not. Full cargo means additional ore is discarded if you keep drilling.

Fuel exhaustion underground or zero hull triggers recovery: unsold cargo is lost, but your credits, upgrades, and tunnels remain. Emergency recovery in the pause menu prevents a stranded or bankrupt save from becoming unplayable.

## Persistence

Version 1 saves use `localStorage`, key `mars-miner.v1`. Position, fuel, hull, ore, money, upgrades, seed, excavation, exploration, deepest depth, and the deep discovery are stored. Save occurs every eight active seconds, on returning to the hub, on transactions, on recovery, and when hiding/leaving the page. Manual save is in the pause menu. Loading opens a paused Continue screen.

**New Expedition** requires confirmation and replaces the current save. Clearing browser data removes the save. Storage errors appear in the HUD. Saves do not synchronize across browsers or devices.

## Project notes

- [Game design](docs/GAME_DESIGN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Balancing](docs/BALANCING.md)
- [QA results](docs/QA.md)
- [Next sprint](docs/NEXT_SPRINT.md)

Desktop keyboard play is the target. Smaller desktop layouts are supported; touch controls and gamepads are not implemented. The Phaser engine is the main part of the download (~350 KB gzip before fonts). The mine streams 16×16 chunks and draws only viewport tiles, rather than creating a sprite per tile.

# Cold Signal

Cold Signal is an original, single-player mining campaign built with TypeScript, Vite, and Phaser 3. Mine a planet's core, return to the mothership, then choose another world using a fuel-priced system map. Runtime art is drawn in Phaser; the game needs no backend or external assets.

## Run locally

Use Node.js 22.12 or newer. From this directory:

```sh
npm install
npm run dev
npm test
npm run build
```

Vite prints the local game URL, usually `http://127.0.0.1:5173`. Browser saves belong to that origin. `npm test` runs the system, atmosphere, and route tests. `npm run build` checks TypeScript and creates `dist/`.

## Play

Start on the Cryo Shelf. Mine its core, return to the surface, drive into the mothership, and press **E** to board. Press **W** to open the full-screen planet selector. Review a world and its core-fuel route price, then confirm travel. Recover five core records to unlock Vesper-9.

- **A/D** or **Left/Right:** move across the mine or surface.
- **S/Down:** drill downward. **W/Up/Space:** thrust through open tunnels.
- **Mouse:** aim. Hold left-click to drill in that direction.
- **E:** use a nearby station, board the mothership, or open a contextual interaction.
- **B:** place a colony structure on a charted planet. **R:** use the installed surface winch.
- **M:** open the explored tunnel map. **Esc:** pause.

WASD is not used to travel between planets. Local miner fuel and mothership core fuel are separate. The game also has planet-local ore warehouses with capacity upgrades, three tiers of automated extractors, offline production, Trading Posts, rotating buyer demand, delivery contracts, colony projects, defensive pylons, forts, surface raids, and underground service structures.

## Saves

Campaigns use `localStorage` under `mars-miner.v1`. The current save version is 29. Earlier supported saves migrate without discarding planet charts, excavation, cargo, structures, or campaign milestones. Export a save from the pause menu before transferring it to another browser or device.

## Project notes

- [MVP plan and remaining phases](docs/MVP_PLAN.md)
- [Current backlog and player checks](docs/NEXT_SPRINT.md)
- [Dated QA results and limitations](docs/QA.md)
- [Architecture and save migrations](docs/ARCHITECTURE.md)
- [Balance data](docs/BALANCING.md)
- [Campaign playtest sheet](docs/PLAYTEST.md)

## Publish

The GitHub Actions workflow tests and builds the site, then publishes `dist/` to GitHub Pages. Configure Pages to use GitHub Actions in repository settings. `vite.config.ts` sets `/SrajMiner/` for production and `/` for local development. A passing local build does not verify a hosted deployment.

## Current verification

On 2026-10-11, 171 system tests, cave-atmosphere checks, and solar-flight tests passed; `npm run build` passed outside the sandbox with Vite's existing large-bundle advisory. GitHub Pages is serving commit `4ccc735` and a hosted save survived a reload. A fresh hosted run reached 240 m, made a real sale, repaired and upgraded the miner, then returned safely; the Cryo core and six-world campaign were not completed. The workspace now measures descent warnings using curved-planet radial speed; that change and save-v29 mining systems have not been published yet. See [QA](docs/QA.md) for findings and open art/campaign checks. Player feedback on pacing, controls, and sound remains open.

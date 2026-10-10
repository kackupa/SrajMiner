# Cold Signal

An original 2D mining campaign built with TypeScript, Vite, and Phaser 3. Descend into Vesper-9, a luminous ice moon hiding the lost generation ship Faraday. Bring ore home to Hab 07, rebuild a launch craft, and follow the buried navigation signal into new regions.

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

`build` checks TypeScript and writes the production site to `dist/`. `preview` serves that build locally. No account, API keys, server, or external assets are needed at runtime. Fonts and original music are bundled locally. Visuals are drawn procedurally; music and synthesized effects start after the first interaction. The top bar offers quick mute and an audio mixer with separately saved music and effects levels.

## Publish on GitHub Pages

In GitHub Settings → Pages, set Source to **GitHub Actions**. The workflow in
`.github/workflows/pages.yml` tests, builds, and publishes `dist` on every push to
`main` and `master` (the repository currently defaults to `master`), or when started manually with
**Run workflow** in the Actions tab. The workflow runs `npm ci`, `npm test`, and
`npm run build` before deploying. `vite.config.ts` uses `/SrajMiner/` for
production builds and `/` for local development.
The expected address is https://kackupa.github.io/SrajMiner/.
The build uses the Pages base path so bundled assets load under the repository URL.
Local development still uses `npm run dev`. Hosted saves are separate from local
saves; use Export Save and Import Save to transfer a campaign.
Deployment must finish successfully before the public link works; local build
checks do not verify a live GitHub deployment. The deployment for commit
`1f479b9` completed successfully on October 10, 2026; both build and deploy
jobs passed, and Settings → Pages confirms GitHub Actions as the source.

## Play

New Expeditions open an interactive Vesper system map. Inspect five known world dossiers and preview the hidden Vesper-9 chapter. The Cryo Shelf is your first landing; drill its four glowing ship parts and each installs in the Faraday automatically. All four unlock travel. Record the first five planetary cores to chart Vesper-9, then recover its Return Bloom to complete the new chapter and unlock the final upgrade milestone.

Explored tunnels contain drifting frost flakes, rust fibers, crystal fragments, or red mineral dust according to the region. The pod's lamp catches the particles; thrust disturbs them and drilling leaves a short dust wake. Sparse larger flakes pass in front of the scene. These cosmetic effects pause with the game and are hidden with the system's reduced-motion preference. Toggle **Cave Atmosphere** in **MIX**; this device preference is separate from campaign saves.

- **A / D or Left / Right:** move; hold into rock to drill sideways.
- **S / Down:** descend and drill downward.
- **Mouse:** point toward nearby rock or a cave enemy; hold left-click to drill along that direction while moving or using thrusters. Wider drill upgrades cut a swath perpendicular to your aim.
- **Drill hardware:** upgrades visibly grow from a stock bit into an extended auger, reinforced multi-rail head, and laser emitter. The Laser Miner builds heat during sustained cutting: release the drill to cool it, or a full emitter briefly vents and pauses. The head follows your aim while the miner stays upright through camera turns.
- **W / Up / Space:** thrust screen-up through open tunnels. On a round world, the camera smoothly follows local up during surface travel; only crossing the center triggers the deliberate 180° turn. Coast through that brief turn, then follow the far-side **W CLIMBS OUTWARD** prompt to climb toward the opposite crust. Once all four Faraday systems are assembled, keep holding W past the town skyline to launch into orbit; open **Worlds** to choose a planet, or hold **S / Down** to descend again.
- **Mouse wheel:** smoothly zoom the gameplay view; zooming far out blends into an orbital cutaway of the whole planet. Drill aiming follows the zoomed and rotated camera.
- **Auto grapple:** purchase its first level in the workshop to install the safety hook. It catches only when a hard landing is imminent and a clear higher anchor is nearby; hold W to thrust free. Further levels extend range and reduce cooldown.
- **R:** hold to reel upward faster after installing the Surface Winch; the pull uses more fuel and still needs an open tunnel.
- **M:** toggle the explored-tunnel map. It shows dug passages and scanner-surveyed ore in ore-specific shapes; undiscovered deposits stay hidden.
- **Esc:** pause/resume. **E:** open the ore exchange at the outpost or a built underground service beacon. **B:** build underground.
- The pause screen shows your equipped pod, current fuel/hull/cargo, and the next Faraday objective. Save, export, import, emergency recovery, and New Expedition remain available there.
- The soundtrack begins with **Signal Run**. Reaching 600 m starts the one-time **Descent Transition**, which leads into **Deep Pressure**; returning above 350 m restores Signal Run. Loading an existing deep save selects the matching stage immediately. Pause, mute, and the music mixer control all three tracks.
- Surface buttons open **Sell Ore**, **Service**, and **Upgrades**. These panels pause the simulation.

The pod starts safely held by the magnetic dock. A/D moves along the outpost, W launches, and S releases the dock to drill into the ice shelf. The field catches returning pods without refilling excavated terrain. Ore deposits have seeded yields from 0.5 to 3 units, shown by crystal size and in the target panel; richer deposits are worth more but can exceed your remaining cargo space. A full hold never stops the drill: available space fills first and overflow becomes physical ore you can retrieve on a return trip. Buy mining-charge packs at the pod workshop, then press Q underground to drop a gravity-driven charge with a 1.2-second fuse; it clears up to 13 nearby blocks and releases ore as physical pickups. Fly close to collect loose ore; leftovers stay in that map. The optional $420 salvage magnet reels charge-freed pickups toward your pod through open tunnels from up to 190 px away; it cannot pull through solid blocks. The style bay lets you choose a pod finish, pilot suit palette, hull decal, and pod profile; all are visual only. Profiles add a beacon mast, stabilizer fins, or armored rails with matching cabin glows. Hold W to fly up your shaft. Sell your haul, refuel, repair, buy upgrades, and view your ship parts at Hab 07. Hard falls hurt; when descent speed gets dangerous the HUD says to hold W to brake before impact. Short drops do not hurt. A drill-reactive original synth groove adds quantized layers while you move and cut; ship-part finds and archive hashes add short melodic cues on the beat. The audio mixer saves separate music and effects levels alongside quick mute.

Hab 07 grows into a vertical mining town as you build the Faraday and recover planetary core records. New decks, work cabins, an elevator frame, tram, archive antenna, and beacon appear in stages, with small crews bringing the skyline to life. The decks are one-way platforms: land on them from the direction of local gravity, then hold **S / Down** to drop through. Gravity mirrors the platforms on the far hemisphere. The service zone reaches the upper decks, and the camera expands to show more of the town as it grows.

At depth, press **B** to spend credits and carried ore on a five-tile one-way platform ($140, 2 copper, 1 iron) or a service beacon ($420, 3 iron, 2 silver). Build in a cleared cavern between 180 m and the planet core; the beacon needs a small empty room and only one can be built per map. Decks catch the pod under either gravity direction and can be dropped through with Down. A beacon opens the regular refuel and repair services with **E**, using Hab 07's prices. Stops persist separately for each planet and survive reloads, but ore left behind still needs a full trip to Hab 07.

The Cryo Shelf's central shaft contains four guaranteed, luminous ship parts at progressively deeper landmarks. Each part sits in a growing, oval chamber; drilling it permanently records and installs the part. Older saves that already contain a recovered signal receive its matching part automatically. Find all four to assemble the Faraday and unlock travel. Parts are free, and each find adds $200 recovery credits for gear. Ore sales fund upgrades, services, and optional tools. Upgrade levels can continue beyond level 5 with progressively higher prices and diminishing gains. The scanner starts with a tight four-tile field, grows to full map width, then extends vertical survey depth. After 240 m, glowing Rock Swimmers phase through geology and home toward your miner; their glow warns you, and a collision deals 8 hull damage. Every third cave encounter introduces a Shard Manta that pauses to telegraph a fast charge; dodge its line or interrupt it with the drill, then follow up during its recovery. On Hull Graveyard, the same slot is a Hull Scrapper: its armored nose deflects frontal drill hits, so flank it and aim for its side or rear. Build up to three sentry turrets underground ($560, 2 iron, 2 silver, 1 gold each) to automatically intercept cave enemies within 440 px. The optional stasis module lets you hover by holding X at a fuel cost. Older Mars saves retain their original depth-based archive. The assembled craft opens the destination board: Cryo Shelf, Hull Graveyard, Prism Fault, and Mars Frontier. Each destination has its own deterministic seed, resource profile, geology colors, and persistent tunnels. Prism Fault has rare, luminous geodes worth three ore units; the wreck hides mint-lit alloy caches and Mars has orange thermal seams, each highlighted as a richer find in its map. Each region also hides one fictional navigation hash, an optional offline archive collectible with no cash or exchange value. Underground telemetry also provides a conservative vertical return-fuel estimate; route detours and steering require extra reserve.

New Cryo Shelf expeditions use the smaller 480 m globe; later worlds use 1,800 m, while existing campaigns keep their saved geometry, including the original 3,600 m globe. Polar collision follows the curved terrain, and radial cuts widen automatically near the core so the miner keeps physical clearance as angular cells narrow. A different sealed core sample in each world must be drilled out of the crossing route; recording one pays a one-time $600 archive claim and reveals a new piece of the Faraday story in the Archive. All four records unlock the route-home conclusion. The camera follows local up smoothly around the surface; the 180° animation occurs only when crossing the center, while screen-up stays aligned for steering. The crossing awards a separate one-time campaign claim and switches depth and return-fuel estimates to the local crust. Mouse drilling works at any angle, including while flying. The far-side prompt explains when to thrust outward. Isolated browser playtests confirm crossing to the far side, climbing, crossing back with full hull, and returning from the far crust to the surface dock with fuel remaining at desktop and 800×600. A complete fresh-start planet run and player pacing feedback remain open. Each far outpost has service and sale access.

Fuel exhaustion underground or zero hull triggers recovery: unsold cargo is lost, but your credits, upgrades, and tunnels remain. Emergency recovery in the pause menu lands at the surface near your current longitude and on your current planet side, rather than resetting you to the starting pad. It forfeits unsold cargo but keeps your mine and progression.

At Hab 07, choose a free pilot path for your next run: Seam Cutter speeds up hard-rock drilling, Surveyor reveals a wider scanner area, and Hauler increases cargo capacity. You can switch paths while docked; the workshop blocks a smaller hold if it would leave ore behind.

Optional navigation hashes recover named Faraday crew voice logs in the archive. Each region adds a different perspective to the signal mystery; finding all four reveals the crew's final message. The fictional checksums and recordings are offline collectibles with no cash or exchange value.

## Persistence

Version 24 saves use `localStorage`, key `mars-miner.v1`. Previous version 1–23 saves migrate automatically and remain on the original Mars Frontier map when they are legacy Mars campaigns. The save stores campaign credits/upgrades/cargo/discoveries and a separate seed, position, depth record, excavation, exploration, physical ore pickups, armed charge, constructed platforms, service beacons, defense turrets, surface habitats, trading posts, and planet-local warehouse ore per visited map, plus emergency-suit ownership and active escape status. Upgrade tracks can advance beyond level 5; later tiers use higher costs and diminishing stat gains, while scanner tiers beyond full map width extend vertical survey depth. Fractional ore cargo, ship components, route fragments, navigation-hash archive records, core-crossing reward, far-hemisphere location, remaining charges, pod paints, pilot suit palettes, hull decals, silhouette profiles, the salvage magnet, scanner and grapple levels, stasis module, surface winch, and selected pilot specialization persist. Grapple tether/cooldown and rock-swimmer encounters are transient. Turrets automatically intercept approaching rock swimmers within 440 px, with a 1.4-second reload. At Hab 07, pack a one-use $780 escape suit: if hull reaches zero, eject with independent jetpack thrust, steer with A / D, boost with W, and drop carried charges with Q. Drilling is disabled. Reach any surface dock or built service beacon to survive; swimmer contact still triggers normal recovery. Save occurs every eight active seconds, on returning to the hub, on transactions, on recovery, and when hiding/leaving the page. Manual save is in the pause menu. Loading opens a paused Continue screen.

**New Expedition** requires confirmation and replaces the current save. Use **Export Save** in the pause menu to prepare a JSON download link, or **Import Save** to select a file. Imports validate the save first, show a campaign preview, and only replace the current expedition after explicit confirmation. Supported version-1–23 files migrate on import. Clearing browser data removes the local save. Storage errors appear in the HUD. Saves do not synchronize across browsers or devices.

## Project notes

- [Game design](docs/GAME_DESIGN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Balancing](docs/BALANCING.md)
- [QA results](docs/QA.md)
- [Campaign roadmap](docs/NEXT_SPRINT.md)
- [15-minute campaign playtest sheet](docs/PLAYTEST.md)

The latest isolated Chromium expedition verified a complete first loop: a 291 m, 16-unit haul returned with 111 L fuel and no terrain overlap, sold for $506, and funded service plus a drill upgrade that survived reload. A second upgraded descent reached 216 m with no overlap; its landing reduced hull to 75, which remains a balance point for broader playtesting. A separate fresh-save keyboard run mined all four Cryo signals, serviced between returns, built the ship, traveled to Hull Graveyard, and preserved the campaign across reload; hull fell to 1.5 after the third signal, so descent pacing still needs human review. Isolated held-key Chromium also confirmed the new fast-descent cue appears before damage and clears safely when W brakes. A separate underground run built a refuel/repair beacon and sentry turret, restored fuel and hull at the beacon, and preserved both structures through reload; underground service exposes no surface sale or upgrade controls. Automated checks cover map persistence, per-region archive depth records, surveyed-ore map markers, mixer settings, reduced-motion changes, keyboard dialogs, briefing layouts, charge drops and magnet pickup, regional finds, all four no-value archive hashes, and cosmetic purchases rendered on the pod. Five ore types retain visible color signatures at near, mid, and outer lamp range in a 960×560 Chromium view, and their silhouettes remain distinct in grayscale captures. Edge 154 passes a small-screen keyboard smoke check. Subjective audio balance, map/tool feel, accessibility feedback, and a 15–30 minute human campaign session remain open. See the [QA report](docs/QA.md) for details.

Desktop keyboard play is the target. Smaller desktop layouts are supported; touch controls and gamepads are not implemented. The Phaser engine is the main part of the download (~350 KB gzip before fonts). The mine streams 16×16 chunks and draws only viewport tiles, rather than creating a sprite per tile.

Mining feedback changes by material: dirt throws dust, rock chips, hard seams spark, Cryo Shelf ice sheds frost, and valuable finds flash distinct fragments. The drill extends as a cut progresses and recoils briefly when a tile breaks. These effects are cosmetic and respect the reduced-motion setting.


The recommended new-game start, Cryo Shelf, is 480 m deep; later planets remain 1,800 m deep. Its four guaranteed ship-route signals scale across both hemispheres. Existing campaigns retain their saved globe geometry, including the previous 768 m starter. Move the pointer to aim the searchlight and drill; hold the left mouse button to cut in that direction. The ray stays aimed through open tunnel so it can hit rock swimmers; a clear-path drill drives them off in three hits. The first rock swimmer waits until 420 m so new pilots get a quieter opening. Running out of fuel or losing the miner pauses at the current location; refuel at a nearby beacon or explicitly recover to the surface and forfeit only unsold cargo. Escape-suit rescue returns you to the surface at your current longitude rather than the original landing pad. Curved-chart collisions now keep the miner at its last clear position instead of snapping to rectangular tile coordinates. If a saved position overlaps solid rock, the game searches farther around the saved tunnel and points to emergency recovery if it cannot find a clear pocket.

A fresh isolated browser check confirmed mouse-directed side cutting: a rightward cut at 36 m collected 1.5 ore units with full hull and cleared the aimed cell. The compact 480 m opening and curved-collision correction still need an isolated browser run and human feel check.

Press B anywhere on a charted planet’s exposed surface to build up to three Colony Habitats per planet ($900, 4 copper, 2 iron, 1 silver), a Trading Post ($1,100, 4 copper, 4 iron, 2 gold), or defense pylons. Aim the curved preview with the mouse or nudge it with arrow keys; Enter confirms and Escape cancels without spending. Habitats provide a local repair/refuel bay and Trading Posts provide a local sale point with interplanetary network premiums. Each planet has a three-stage ore buy-order chain at its Trading Post; the colony board and sale dialog show the current ore, quantity, stage, and one-time delivery bonus. The destination board draws stable routes between online posts. Hab 07 keeps its own sale, service, and upgrade yard. Surface raiders telegraph attacks on habitats and pylons; two strikes destroy the module, and Hab 07 repairs damage for $180. Trading Posts and Hab 07 are protected. Rotating demand, buyer choice, and the first two authored colony projects are playable; more system projects and a broader surface-threat roster remain on the colony backlog. The Vesper Relay links the route map and adds a disclosed 5% premium to linked-post sales. The Cargo Tug, funded with ore stored at Cryo Shelf, Hull Graveyard, and Vesper-9, enables remote withdrawals from built colony depots. Wall segments connect into raider barriers; security gates open when the miner approaches, and raiders breach or damage those structures before reaching protected colony modules.

At a linked Trading Post, choose which connected planet buys the haul. Each market has its own rotating demand bonus; choosing a remote buyer skips the current planet's local ore order. Sales show an itemized settlement for ore, buyer, network premium, demand, and any fulfilled local order. If the browser cannot save the transaction, the game restores cargo and market progress so the sale can be retried. A second warehouse-funded project, the Cargo Tug, unlocks remote ore withdrawals from every planet where you have built a warehouse.

Each planet also has original, deterministic surface landmark silhouettes that follow its curved globe and matching markers in the orbital cutaway. These landmarks are decorative and do not affect mining or collisions.

The Faraday is also the miner’s orbital vehicle. After assembly, W carries it from the colony into a stable parking orbit; the cutaway shows the craft outside the small globe, and the **Worlds** panel is available there for planet travel. S begins a controlled descent. Orbital location is stored in the existing per-planet position field, so version-24 campaigns need no save migration.

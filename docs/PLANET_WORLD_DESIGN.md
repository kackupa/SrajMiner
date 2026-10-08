# Round-planet world design

## Goal

Each destination should read and play as one connected round planet. The miner can travel all the way around its surface, drill radially inward through the core, and emerge on the opposite surface. At normal play zoom, keep the mine in a readable tile-map view; zooming out should curve that same map into a complete cutaway globe. This document is a technical proposal, not an implemented gameplay change.

The [orbital cutaway concept](prototypes/orbital-cutaway-concept.png) illustrates the intended transition from the familiar wrap-map to the complete globe. It is an original visual reference for discussion, not game art or a screenshot of the current build.

## Current geometry

The current world is a vertical shaft with a second hemisphere: `WORLD.width` is 48 tiles, each tile is 40 px and 12 m; the core is at row 300 / 3,600 m and the far surface at row 600. `TileWorld` treats x outside 0–47 as solid boundary. `MiningScene` clamps the camera to those horizontal bounds, and `Projection` only flips screen coordinates on the far hemisphere. So the game currently has two surface ends, but no continuous surface route around the planet.

The current proportions cannot form a circular world while keeping square tiles and the existing 3,600 m radius. A 300-tile radius needs a half-circumference of about `π × 300 = 942` tiles. The current 48-tile width implies a radius of about 15.3 tiles, roughly 183 m at 12 m per tile—about 20 times shallower than the existing core distance. The prototype must therefore drive a real world-scale choice, rather than only bending the current rectangle visually.

## Proposed world chart

Represent the planet in a half-turn polar strip. Horizontal tile coordinate `u` runs through angles 0 to π; vertical coordinate `v` runs from the near surface, through the core, to the far surface. With `R` as the planet radius in tiles:

```text
theta = π × u / W
r     = R - v                 // core is v = R; far crust is v = 2R
worldX = centerX + r × sin(theta)
worldY = centerY - r × cos(theta)
```

The strip's side edges have a twisted seam: `(u = 0, v)` is the same world location as `(u = W, v = 2R - v)`. This joins the near and far surface edges into one closed surface loop while keeping the drilled core passage continuous. When crossing the seam, radial velocity and radial aim change sign; tangent velocity remains continuous. Gravity always points toward the core, so its sign in the strip changes at `v = R` as it does in the current hemisphere model.

For square tiles at 12 m each and a 3,600 m radius, use `R = 300` rows and `W ≈ 942` angular columns. That yields a diameter of 600 rows and a surface circumference of about 1,885 tiles (22.6 km). At the current 145 px/s horizontal cap, a full surface loop would take about 8.7 minutes before terrain and acceleration; test whether that feels like worthwhile traversal. Chunk streaming should make the larger seeded world feasible, but scanner coverage, map UI, surface town placement, landmark generation, and save validation currently assume a narrow width and need review.

The existing home shaft is centered at x tile 24, not at the center of the current width. Keep that as the planet's authored meridian during the first migration so old position, core passage, and mined tiles stay aligned. Refactor authored core/route placement to use this explicit meridian rather than `WORLD.width / 2` before changing the width.

## Camera and controls

Keep simulation and rendering coordinates separate. Close in, render a nearly flat unwrapped strip with wrap cues at the seam. Blend toward the polar projection above as zoom increases, and show the full disc, surface loop, both surface settlements, dug tunnels, discoveries, core, and player marker at overview zoom. Interpolate position, tile edges, lights, and aim together; do not rotate controls unexpectedly during zoom. If local movement is represented in strip coordinates, convert horizontal input to tangential travel using the current radius so one tile step does not cover a different physical distance at different depths. Near the core, where all angles converge, constrain lateral movement and make the protected crossing passage explicit.

The mine's tile cells become angular wedges in the globe view and narrow toward the core. A smooth screenshot-style bend alone is not sufficient: collision, drilling, ore pickup reach, structure placement, charge gravity, grapple anchors, turrets, particles, and mouse targeting must resolve against the same world transform. Preserve a stable close-range view and keep terrain/hazards legible throughout the transition.

## Save compatibility

Save version 17 stores per-map positions, destroyed/discovered tile keys, physical ore drops, charges, and structures. If the new world keeps tile keys and the existing home meridian, old coordinates can remain intact while the playable angular width expands; newly reachable columns use the same deterministic seed/coordinate generation. That still changes the boundary and can add new geology, so regression-test old saves around both edges and the mined core route. If the save starts storing per-planet radius, chart version, or transformed positions, add a versioned migration and preserve every drop and built structure. Never reset old excavation to make the globe easier to build.

The isolated planet branch now adds optional chart dimensions in save v18 and migrates v17 saves without changing their rectangular map interpretation. It validates three-digit chart columns and round-trips wide positions, excavation, drops, charges, and structures. The active checkout remains on v17 until the branch is integrated.

## Delivery sequence and acceptance

1. Keep the isolated [camera concept](prototypes/round-planet-camera.html) as presentation reference. Decide whether to expand to roughly 942 columns or deliberately choose a smaller, compressed arcade planet; do not ship a visibly squashed globe by accident.
2. A first set of pure chart/seam helpers now exists in [`PlanetChart.ts`](../src/game/world/PlanetChart.ts), with checks in [`systems.test.ts`](../tests/systems.test.ts). They verify forward/inverse coordinate round-trips across both hemispheres, both seam directions, mirrored radial velocity/aim, core convergence, round surface scale, and invalid inputs. The helpers are deliberately not imported into the live scene; expand their coverage and review the coordinate assumptions before integration.
3. Expand seeded geology and chunk/map/scanner limits without breaking deterministic terrain, current saves, ore drops, or structures.
4. Adapt movement, collision, gravity, mining, mouse aim, structures, tools, particles, and surface docking to the shared chart transform.
5. Add the close-map-to-globe zoom transition and inspect it at desktop and small viewport sizes. The surface route must close, the through-core route must emerge at the opposite point, and no tile seam or player jump may appear.
6. Browser-play a full surface loop, a mined core crossing, a far-side return, reload at both hemispheres, and an old save with excavation and drops. Confirm no high-speed collision, stranded return, or duplicated ore.

No live gameplay geometry or save changes are included yet; preserve the current playable campaign while this design is reviewed.

## Validation boundary — 2026-10-08

The current checkout passes `npm test`: all 84 system tests and the cave-atmosphere suite, including the pure chart/seam checks. A separate Chromium smoke check verified the camera concept's zoom transition to orbital cutaway, return to mining view, full-planet shortcut, and clean console. This validates the presentation sketch only. It does not validate a round world in the game: `MiningScene`, collision, drilling, camera, saves, and the browser renderer still use the existing rectangular map model.

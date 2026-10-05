# Architecture

## Modules

| Module                      | Responsibility                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `src/main.ts`               | Font/style loading and Phaser boot                                                    |
| `game/config.ts`            | World dimensions, physics, fuel, ore, bands, upgrades, prices                         |
| `game/MiningScene.ts`       | Simulation orchestration, original procedural rendering, particles, camera, lifecycle |
| `world/TileWorld.ts`        | Pure seeded geology, ore veins, bounded chunk cache, excavation and discovery sets    |
| `player/PlayerPod.ts`       | Acceleration, thrust, substepped axis-separated tile collision, impact callbacks      |
| `mining/MiningSystem.ts`    | Continuous contact, hardness progress, tile destruction, collection                   |
| `economy/Progress.ts`       | Cargo, money, capacities, upgrade and service transactions, recovery                  |
| `surface/SurfaceStation.ts` | Station layout and service range                                                      |
| `ui/HUD.ts`                 | DOM HUD, menus, feedback, focus handling, sale animation                              |
| `save/SaveManager.ts`       | Schema validation, versioned localStorage read/write, reconstruction                  |
| `audio/AudioSystem.ts`      | Web Audio oscillators, engine and ambience, effect envelopes                          |

Related small systems are grouped rather than split into empty abstraction classes. TileWorld incorporates the chunk manager and ore generator; Progress incorporates cargo, fuel capacity, upgrades, and economy. This keeps the slice easy to navigate.

## Update order

Clamp elapsed time to 50 ms. If unpaused, integrate player movement with substeps no larger than seven pixels, resolve solid tiles along each axis, and forward the contacted tile to mining. Complete a cut, collect within capacity, check recovery, update deepest depth, reveal nearby tiles, and autosave when appropriate. Camera and particles interpolate separately; the HUD updates at about 12 Hz.

Collision uses a very small exclusion epsilon at edges. A larger epsilon caused intermittent floor contact at 120 Hz, resetting drill progress; the regression is covered by the down-drilling system test. The visual drill tip and side thrusters extend beyond the physical 26×32 pixel collision box intentionally.

## World storage

`generate(x,y)` depends only on seed and coordinates. `get()` reads deterministic base chunks and overlays the destroyed set. Evicting chunks never discards excavation or exploration. Generation requires no neighboring chunks and works in any order. Chunks more than two chunk rows away are discarded; rendering visits only viewport cells. No per-tile Phaser objects are created.

Exploration/excavation sets still grow with the total explored mine. A future large-world version should compact them or move to IndexedDB; v0.1 reports quota failures instead of silently pretending to save.

## Saves

One versioned record stores seed, player position, money, levels, fuel, hull, cargo, deepest depth, the discovery flag, destroyed coordinates, and discovered coordinates. Maximum capacities are derived from persisted levels and central balance data. Velocities reset on reload so a save does not resume in an uncontrolled fall. Saved position is collision-checked, with surface recovery if invalid.

Validation rejects malformed records, invalid levels, non-finite numbers, unsupported versions, and malformed tile coordinates. Browser storage failure is nonfatal and visible. New games explicitly confirm replacing the record.

## Rendering and assets

Phaser Graphics draws only the current viewport, with screen coordinates transformed by a smooth follow offset. Phaser text objects are used for station labels and transient pickups. DOM overlays supply scalable buttons and keyboard focus. Locally bundled Fontsource packages supply typefaces. No bitmap or audio downloads occur at runtime.

## Future discovery extension

The saved `artifact` flag and one-time survey event provide a narrow extension point. Future artifacts can replace the simple event with data-driven discoveries without changing terrain determinism or the economy interface. No large story framework is justified yet.

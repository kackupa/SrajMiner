# Forge textured miner

Original game assets generated with the built-in image generation tool on 29 October 2026, using the user-approved Forge concept as the visual reference. These are transparent PNG atlases consumed by `ForgeSpriteRig`, not promotional screenshots or imported game artwork.

- `forge-parts.png`: torso with pilot and helmet, upper arm, machine-gun forearm, thigh, shin/boot, drill, searchlight, thruster and shoulder armour. Requested detailed shaded metal, bevelled ochre armour, mechanical joints and isolated parts on transparency, matching the approved Forge reference.
- `forge-weapons.png`: minigun, autocannon, laser, arc weapon, grenade launcher, missile pod, rocket pod, cargo rack and excavator. Requested matching materials and lighting, side-on orientation, separated in a three-by-three transparent atlas.
- `forge-turn.png`: three opaque directional torso views, generated with the built-in image tool on 30 October. Prompt: use the original Forge parts as reference, preserve helmet, pilot cabin, ochre armour and pelvis; supply right-facing, frontal and left-facing torso views in an evenly spaced transparent row, without limbs, weapons, text or scenery. The renderer uses discrete solid views with independent chest and pelvis joints; it does not dissolve or squash the cabin during a pivot.

The original PNGs are preserved. Source rectangles and the shin separation mask live in `src/game/player/ForgeSpriteRig.ts`; that renderer trims transparent gutters at load time and assembles the moving rig around the existing gameplay sockets. The same compositor produces the refit portrait. Changing an atlas requires reviewing those rectangles and checking the assembled rig and all thumbnails in the browser.

Only the disposable uniform test scene loads this rig. Campaign saves and collision geometry are unchanged. `&miner=legacy` retains the previous procedural miner for comparison. The approved marketing concepts remain in ignored `output/marketing/miner-concepts/`.

The helmet is separately masked from each normalized directional frame for independent pitch. `HEADS` in `ForgeSpriteRig.ts` defines its outline and neck pivot; review those masks if replacing the torso atlas. This extraction happens in memory and does not alter the original PNG.

The forearm now uses a separate compact crop of the original arm pistons and elbow casing, excluding the large shoulder plate. Per-frame `joints` are measured before trimming and translated into trimmed coordinates during extraction, keeping the artwork's hinges attached to the animated bones.

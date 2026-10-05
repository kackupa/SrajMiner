# Next sprint — findings from v0.1 playtests

## Completed from the review

Safe docking, keyboard menu activation, Pause/Resume, the smaller surface layout, ore identification, pre-cut full-cargo warnings, and connected outpost services are built and tested. Upgrade benefits/affordability, retained receipts, low-hull feedback, remaining fuel in liters, and reduced camera motion are also implemented. See the new section in [QA](QA.md).

## Next priorities

The remaining recommendations in [the review](UX_GAMEPLAY_REVIEW.md) are explored-tunnel navigation, long-session economy testing, less rectangular vein generation (with save compatibility), sound/settings persistence, visible deep-discovery history, and save export/import. Do not rebalance the entire economy without new human playtest evidence.

## Longer-term playtest work

1. **Tune longer expeditions with human players.** Automated keyboard trips filled a 16-slot hold and reached silver within the first minute. The loop is immediate, but fuel pressure and high-tier prices need 15–30 minute sessions, across several seeds, before claiming sustained balance. Record return fuel, average sale, and recovery rate.
2. **Make long return routes easier to read.** Vertical shafts were easy to reverse. Side branches require remembering junctions. Add a restrained explored-tunnel map or breadcrumbs if human tests confirm disorientation; avoid revealing unvisited ore.
3. **Improve vein shapes.** Coarse cell clusters work and are deterministic, but screenshot review makes their rectangular grouping visible. Try short seeded vein walks or warped cell boundaries, preserving old world generation for existing saves.
4. **Increase geological landmarks.** Depth palettes and hardness change, but most layers still share rectangular rock textures. Add original band-specific details and a physical deep discovery chamber after the basic economy is tuned.
5. **Harden long-save storage.** Chunk memory stays bounded, while exploration/excavation sets grow. Test 10,000+ excavated tiles, compact coordinates, then consider IndexedDB. Add export/import before people invest hours.
6. **Broaden device QA.** Current testing covers desktop Chromium at 1440×960 and 960×720. Test Firefox, Safari, high-DPI screens, keyboard layouts, and subjective audio levels. Touch and gamepad support remain out of scope until separately designed.

## Fixed during this sprint

- Drilling would repeatedly lose floor contact with an overly large collision epsilon at high frame rates. Reduced the epsilon and tested 120 Hz simulation.
- Early cave falls plus a surface landing could drain most of the initial hull. Raised the safe impact threshold and reduced damage.
- Off-center vertical cuts could require breaking two tile columns. Added collision-checked gentle centering during downward input and a regression test.
- External font requests made presentation network-dependent. Bundled fonts locally.
- Sale and upgrade notification toasts overlapped the workshop footer. Moved modal notifications below the panel and enlarged essential telemetry.

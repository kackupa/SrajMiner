# Working on Mars Miner

Keep this repository a runnable, original browser mining game. Use TypeScript and Phaser 3; avoid a backend unless a future request specifically requires one.

- Run `npm install`, `npm test`, and `npm run build` for relevant changes.
- Browser-test changes to input, rendering, UI, or the expedition loop. Do not substitute a type check for playtesting.
- Keep balance data in `src/game/config.ts` and durable state separate from cached chunks.
- Preserve save compatibility. Version migrations are necessary if the save schema changes.
- Do not add upward drilling, extra survival meters, combat, crafting, monetization, or online systems without a scoped request.
- All art and synthesized audio here are original. Do not import assets from other mining games.
- Save screenshots and other temporary QA artifacts under ignored `output/playwright/`.
- Treat high-speed collisions, inability to return home, and duplicated ore on reload as blocking regressions.
- Keep the README and actual playtest findings current. Report untested limitations honestly.

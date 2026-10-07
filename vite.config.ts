import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // GitHub Pages serves this repository beneath /SrajMiner/. Keep the dev
  // server at the origin root so `npm run dev` retains its usual local URL.
  base: command === 'build' ? '/SrajMiner/' : '/',
}));

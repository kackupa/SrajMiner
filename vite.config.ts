import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // GitHub Pages serves this repository beneath /SrajMiner/. Keep the dev
  // project path while Cloudflare custom domains use the origin root.
  base: command === 'build' && process.env.GITHUB_ACTIONS === 'true' ? '/SrajMiner/' : '/',
  build: { rollupOptions: { input: ['index.html', 'teaser.html', 'game.html'] } },
}));

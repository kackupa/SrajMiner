import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  const key = loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_ANON_KEY?.trim();
  if (key) {
    let role: unknown;
    if (key.startsWith('eyJ')) {
      try { role = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString('utf8')).role; }
      catch { throw new Error('Invalid public Supabase key format.'); }
    }
    if (key.startsWith('sb_secret_') || key.startsWith('eyJ') && role !== 'anon' ||
        key.startsWith('sb_') && !key.startsWith('sb_publishable_')) {
      throw new Error('A secret or service-role Supabase key cannot be bundled into the browser.');
    }
  }
  return {
    // GitHub Pages serves this repository beneath /SrajMiner/. Keep the dev
    // project path while Cloudflare custom domains use the origin root.
    base: command === 'build' && process.env.GITHUB_ACTIONS === 'true' ? '/SrajMiner/' : '/',
    build: { rollupOptions: { input: ['index.html', 'teaser.html', 'game.html', 'market.html'] } },
  };
});

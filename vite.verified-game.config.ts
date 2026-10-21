import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    target: 'es2022',
    outDir: 'supabase/functions/verified-game',
    emptyOutDir: false,
    lib: {
      entry: 'src/game/online/VerifiedGameService.ts',
      formats: ['es'],
      fileName: () => 'engine.js',
    },
  },
});

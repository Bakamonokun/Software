import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const customWinOutDir = process.env.VITE_WIN_OUTDIR;
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: customWinOutDir || 'dist',
      emptyOutDir: !customWinOutDir,
    },
    optimizeDeps: {
      entries: ['index.html'],
    },
    server: {
      hmr: false,
      watch: null,
    },
  };
});



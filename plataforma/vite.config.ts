import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)) },
  },
  build: { target: 'es2022', sourcemap: true },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'supabase/functions/_shared/**/*.test.ts'] },
});

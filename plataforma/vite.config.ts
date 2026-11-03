import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)) },
  },
  // Sem mapas de código: o site público e as apps (webDir dist) não levam o código-fonte nem os comentários.
  // SOURCEMAP=hidden gera-os sem referência nos ficheiros, para enviar a um serviço de erros (não publicar).
  build: { target: 'es2022', sourcemap: process.env.SOURCEMAP === 'hidden' ? 'hidden' : false },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'supabase/functions/_shared/**/*.test.ts'] },
});

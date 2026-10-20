import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const API_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:8000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Dev only. Without this the dev server hands the browser each of the ~240 files that import
  // lucide-react, and every motion / recharts / zod module, as its own request on the first load.
  // Pre-bundling them once, and transforming the entry files before the first request, makes the
  // first load of a fresh checkout (or a cleared cache) much shorter.
  optimizeDeps: {
    include: [
      '@hookform/resolvers/zod',
      '@tanstack/react-query',
      'lucide-react',
      'motion/react',
      'react',
      'react-dom/client',
      'react-hook-form',
      'react-router',
      'recharts',
      'zod',
      'zustand',
    ],
  },
  server: {
    port: 5173,
    warmup: {
      clientFiles: [
        './src/main.tsx',
        './src/app/App.tsx',
        './src/app/router/routes.tsx',
        './src/components/layout/AppShell.tsx',
      ],
    },
    proxy: {
      // The browser only ever talks to one origin; the refresh cookie stays same-origin.
      '/api': { target: API_TARGET, changeOrigin: false },
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks, so an application release does not invalidate them.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'router', test: /node_modules[\\/]react-router[\\/]/ },
            {
              name: 'motion',
              test: /node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/,
            },
            { name: 'query', test: /node_modules[\\/]@tanstack[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost:3000' } },
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
    testTimeout: 20_000,
  },
});

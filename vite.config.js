import { defineConfig } from 'vite';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [cloudflare()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
  },
});
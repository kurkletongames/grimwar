import { defineConfig } from 'vite';
import { minify as minifyHtml } from 'html-minifier-terser';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import { cloudflare } from "@cloudflare/vite-plugin";

const htmlMinifyOptions = {
  collapseWhitespace: true,
  removeComments: true,
  removeRedundantAttributes: true,
  useShortDoctype: true,
  minifyCSS: true,
  minifyJS: true,
};

function walkHtmlFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkHtmlFiles(full));
    } else if (full.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

function minifyHtmlPlugin() {
  return {
    name: 'grimwar-minify-html',
    apply: 'build',
    async closeBundle() {
      for (const file of walkHtmlFiles('dist')) {
        const html = readFileSync(file, 'utf8');
        const out = await minifyHtml(html, htmlMinifyOptions);
        writeFileSync(file, out);
      }
    },
  };
}

export default defineConfig({
  plugins: [minifyHtmlPlugin(), cloudflare()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    minify: true,
    cssMinify: true,
  },
});
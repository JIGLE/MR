// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:8080',
  trailingSlash: 'always',
  build: { format: 'directory' },
  image: {
    // Keep generated images reasonably sharp; originals are always kept untouched.
    responsiveStyles: true,
  },
  vite: {
    // Snapshots and scans can be large; never inline them as data URIs.
    build: { assetsInlineLimit: 0 },
  },
});

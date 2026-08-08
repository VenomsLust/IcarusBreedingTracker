import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// base: './' + vite-plugin-singlefile bundles everything (JS, CSS) into one
// inline <script> in dist/index.html, so the build works two ways:
//  - double-click dist/index.html and it runs directly, no server needed
//  - or host that same file (e.g. GitHub Pages) at any subpath
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@shared': resolve('src/shared')
    }
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 100_000_000
  }
})

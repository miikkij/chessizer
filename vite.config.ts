import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { readFileSync } from 'node:fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'chessizer-license-notices',
    generateBundle() {
      for (const fileName of ['LICENSE', 'NOTICE.md', 'LICENSES/MIT-original.txt']) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(new URL(fileName, import.meta.url), 'utf8') })
      }
    },
  }],
  build: {
    license: { fileName: 'THIRD_PARTY_LICENSES.md' },
  },
  server: {
    port: 12173,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
})

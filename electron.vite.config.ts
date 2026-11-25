import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { thirdPartyNotices } from './scripts/third-party-notices'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const shared = { '@shared': resolve(import.meta.dirname, 'src/shared') }

export default defineConfig({
  main: {
    resolve: { alias: shared },
    plugins: [thirdPartyNotices({ includeDependencies: true })],
  },
  preload: {
    resolve: { alias: shared },
    build: {
      // Sandboxed preloads must be CommonJS.
      rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } },
    },
  },
  renderer: {
    resolve: {
      alias: { ...shared, '@': resolve(import.meta.dirname, 'src/renderer/src') },
    },
    define: { APP_VERSION: JSON.stringify(version) },
    plugins: [react(), tailwindcss(), thirdPartyNotices()],
  },
})

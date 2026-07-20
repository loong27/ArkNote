import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart(args) {
          // Use startup() to properly launch/restart Electron
          args.startup()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['simple-git', 'pdf-parse', 'electron-updater'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          // Debounce reload to prevent esbuild EPIPE errors
          setTimeout(() => options.reload(), 200)
        },
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // Optimize dev server stability
  server: {
    watch: {
      // Ignore electron output directory to prevent feedback loops
      ignored: ['**/dist-electron/**'],
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { copyFileSync, mkdirSync } from 'fs'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    // Plugin to copy manifest.json, icon files, and content.css after build
    {
      name: 'copy-extension-assets',
      closeBundle() {
        const distPath = resolve(__dirname, 'dist')
        mkdirSync(distPath, { recursive: true })
        copyFileSync(resolve(__dirname, 'manifest.json'), resolve(distPath, 'manifest.json'))
        // Copy icon files
        const iconSizes = [16, 48, 128]
        iconSizes.forEach(size => {
          const iconPath = resolve(__dirname, `icon${size}.png`)
          try {
            copyFileSync(iconPath, resolve(distPath, `icon${size}.png`))
          } catch (err) {
            console.warn(`Warning: icon${size}.png not found, skipping...`)
          }
        })
        // Copy content.css if it exists
        const contentCssSource = resolve(__dirname, 'src/content/01_show-ui-island/content.css')
        const contentCssDest = resolve(__dirname, 'dist/content.css')
        try {
          copyFileSync(contentCssSource, contentCssDest)
          console.log('[Build] Copied content.css to dist')
        } catch (err) {
          // CSS is optional for now
        }
      }
    }
  ],
  build: {
    outDir: 'dist',
    base: './',
    // Skip building entirely - scripts are copied separately
    emptyOutDir: false,
    rollupOptions: {
      // Don't build anything - we're just copying simple scripts
      input: {}
    }
  }
})

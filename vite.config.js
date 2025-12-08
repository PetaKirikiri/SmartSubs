import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    // Plugin to ensure content script is a single bundled file
    {
      name: 'bundle-content-script',
      generateBundle(options, bundle) {
        // Force content.js to include all dependencies
        if (bundle['content.js']) {
          // Content script should already be bundled, but ensure no chunks
          const contentChunk = bundle['content.js'];
          if (contentChunk.imports && contentChunk.imports.length > 0) {
            console.warn('[Build] Content script has imports:', contentChunk.imports);
          }
        }
      },
      writeBundle() {
        const contentPath = resolve(__dirname, 'dist/content.js');
        try {
          let content = readFileSync(contentPath, 'utf-8');
          
          // Remove ALL import statements completely
          content = content.replace(/import\s*\{[^}]+\}\s*from\s*["'][^"']+["'];?/g, '');
          content = content.replace(/import\s*\{[^}]+\}\s*from\s*["'][^"']+["']/g, '');
          
          // Also remove any broken import patterns
          content = content.replace(/\(e=import\{[^}]+\}from"[^"]+"\)/g, '(e=null)');
          
          // Wrap in IIFE if not already wrapped
          if (!content.trim().startsWith('(function')) {
            content = `(function(){\n'use strict';\n${content}\n})();`;
          }
          
          writeFileSync(contentPath, content, 'utf-8');
          console.log('[Build] Processed content script');
        } catch (err) {
          console.error('[Build] Error processing content script:', err);
        }
      }
    },
    // Plugin to copy manifest.json and icon files after build
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
        // Copy thaiDb.json from public folder
        try {
          copyFileSync(resolve(__dirname, 'public/thaiDb.json'), resolve(distPath, 'thaiDb.json'))
        } catch (err) {
          console.warn('Warning: public/thaiDb.json not found, skipping...')
        }
        // Copy dict.txt for tokenizer
        try {
          copyFileSync(resolve(__dirname, 'public/dict.txt'), resolve(distPath, 'dict.txt'))
        } catch (err) {
          console.warn('Warning: public/dict.txt not found, skipping...')
        }
      }
    }
  ],
  build: {
    outDir: 'dist',
    // Use relative paths for Chrome extension
    base: './',
    // Disable eval for Chrome extension CSP compliance
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        content: resolve(__dirname, 'src/content/content.js'),
        netflixSeekBridge: resolve(__dirname, 'src/content/netflixSeekBridge.js'),
        background: resolve(__dirname, 'src/background/background.js')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'content') return 'content.js';
          if (chunkInfo.name === 'netflixSeekBridge') return 'netflixSeekBridge.js';
          if (chunkInfo.name === 'background') return 'background.js';
          return 'assets/[name].[hash].js';
        },
        chunkFileNames: (chunkInfo) => {
          // Don't create separate chunks for content script dependencies
          if (chunkInfo.moduleIds && chunkInfo.moduleIds.some(id => id.includes('content.js'))) {
            return 'content.js';
          }
          return 'assets/[name].[hash].js';
        },
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] || assetInfo.name || ''
          if (name.includes('content') && name.endsWith('.css')) {
            return 'content.css'
          }
          if (name && name.endsWith('.css')) {
            return 'assets/[name].[hash].css'
          }
          return 'assets/[name].[hash].[ext]'
        },
        manualChunks: (id) => {
          // Force content script and all its dependencies into a single chunk
          if (id.includes('src/content/content.js') || 
              id.includes('SubtitleStagePanel') ||
              id.includes('subtitle.js') ||
              id.includes('jsx-runtime')) {
            return 'content';
          }
        }
      }
    }
  }
})


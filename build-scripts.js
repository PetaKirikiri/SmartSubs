/**
 * Build scripts for Chrome extension
 * Bundles content.js with React support
 */

import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distPath = resolve(__dirname, 'dist');

mkdirSync(distPath, { recursive: true });

// Read .env file and parse environment variables
function loadEnv() {
  const envPath = resolve(__dirname, '.env');
  const env = {};
  
  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            env[key.trim()] = value;
          }
        }
      });
    } catch (error) {
      console.warn('[Build] Could not read .env file:', error.message);
      console.warn('[Build] Continuing without .env file...');
    }
  }
  
  return env;
}

const env = loadEnv();

// Build content.js with React bundling
async function buildContentScript() {
  const ai4thaiKey = env.VITE_AI4THAI_API_KEY || env.AI4THAI_API_KEY || '';
  const openaiKey = env.VITE_OPENAI_API_KEY || env.OPENAI_API_KEY || '';
  
  await build({
    entryPoints: [resolve(__dirname, 'src/content/content.js')],
    bundle: true,
    outfile: resolve(distPath, 'content.js'),
    format: 'iife',
    platform: 'browser',
    target: 'esnext',
    minify: false,
    sourcemap: false,
    jsx: 'automatic',
    external: ['chrome'], // Chrome APIs are global, don't bundle them
    banner: {
      js: `window.__AI4THAI_API_KEY__ = ${JSON.stringify(ai4thaiKey)};\nwindow.__OPENAI_API_KEY__ = ${JSON.stringify(openaiKey)};`
    },
    define: {
      'process.env.NODE_ENV': '"production"',
      'AIRTABLE_CONFIG_API_TOKEN': JSON.stringify(env.VITE_AIRTABLE_API_TOKEN || env.AIRTABLE_API_TOKEN || ''),
      'AIRTABLE_CONFIG_BASE_ID': JSON.stringify(env.VITE_AIRTABLE_BASE_ID || env.AIRTABLE_BASE_ID || '')
    },
    // Bundle React and ReactDOM into the output
    inject: []
  });
  
  if (ai4thaiKey) {
    console.log('[Build] AI4Thai API key loaded from .env');
  } else {
    console.warn('[Build] ⚠️  AI4Thai API key not found in .env (VITE_AI4THAI_API_KEY or AI4THAI_API_KEY)');
  }
  
  if (openaiKey) {
    console.log('[Build] OpenAI API key loaded from .env');
  } else {
    console.warn('[Build] ⚠️  OpenAI API key not found in .env (VITE_OPENAI_API_KEY or OPENAI_API_KEY)');
  }
  
  console.log('[Build] Bundled content.js with React');
}

// Build background.js with bundling (needs to import handler functions)
async function buildBackgroundScript() {
  await build({
    entryPoints: [resolve(__dirname, 'src/background/background.js')],
    bundle: true,
    outfile: resolve(distPath, 'background.js'),
    format: 'esm', // Service workers can use ES modules
    platform: 'browser',
    target: 'esnext',
    minify: false,
    sourcemap: false,
    external: ['chrome'], // Chrome APIs are global
    define: {
      'process.env.NODE_ENV': '"production"'
    }
  });
  console.log('[Build] Bundled background.js');
}

buildBackgroundScript().catch(console.error);

// Copy manifest
copyFileSync(
  resolve(__dirname, 'manifest.json'),
  resolve(distPath, 'manifest.json')
);
console.log('[Build] Copied manifest.json');

// Build content script
buildContentScript().catch(console.error);

console.log('[Build] Build complete!');

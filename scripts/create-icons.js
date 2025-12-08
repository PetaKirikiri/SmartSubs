// Simple script to create placeholder icons for Chrome extension
// These are minimal valid PNG files that can be replaced later

import { writeFileSync } from 'fs';
const sizes = [16, 48, 128];

// Create a minimal 1x1 pixel PNG (base64 encoded)
// This is a valid PNG that Chrome will accept as a placeholder
const minimalPNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

sizes.forEach(size => {
  writeFileSync(`icon${size}.png`, minimalPNG);
  console.log(`Created icon${size}.png`);
});

console.log('Placeholder icons created. Replace these with proper icons later.');


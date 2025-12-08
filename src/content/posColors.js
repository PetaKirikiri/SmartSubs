import { AIRTABLE_CONFIG } from '../services/airtable.js';

/**
 * Get ThaiWords base ID - uses same base as SmartSubs by default
 * Can be overridden via localStorage if ThaiWords is in a different base
 */
function getThaiWordsBaseId() {
  // First check localStorage for override
  const stored = localStorage.getItem('smartSubs_thaiWordsBaseId');
  if (stored) return stored;
  
  // Default to same base as SmartSubs (most common case)
  return AIRTABLE_CONFIG.baseId;
}

let posColorCache = new Map();
let posColorCacheLoaded = false;

function normalizeColor(color) {
  if (!color) return '#FFD700';
  const normalized = String(color).trim().toLowerCase();
  const colorMap = {
    'red': '#FF4444', 'green': '#44FF44', 'blue': '#4444FF',
    'yellow': '#FFD700', 'orange': '#FF8800', 'purple': '#8844FF',
    'pink': '#FF44AA', 'cyan': '#44FFFF', 'white': '#FFFFFF', 'black': '#000000'
  };
  if (colorMap[normalized]) return colorMap[normalized];
  if (normalized.startsWith('#') || normalized.startsWith('rgb')) return normalized;
  return '#FFD700';
}

export async function fetchPOSColors() {
  if (posColorCacheLoaded && posColorCache.size > 0) {
    return posColorCache;
  }
  
  const thaiWordsBaseId = getThaiWordsBaseId();
  if (!thaiWordsBaseId) return posColorCache;
  
  try {
    const apiUrl = `https://api.airtable.com/v0/${thaiWordsBaseId}/POSColors`;
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_CONFIG.apiToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      (data.records || []).forEach(record => {
        const fields = record.fields || {};
        const pos = String(fields.pos || '').trim().toLowerCase();
        const color = fields.color || fields.Color || fields.colour || fields.Colour || '';
        if (pos && color) {
          posColorCache.set(pos, normalizeColor(String(color).trim()));
        }
      });
      posColorCacheLoaded = true;
    }
  } catch (error) {
    // Silent error handling
  }
  
  return posColorCache;
}


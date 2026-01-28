/**
 * DISPLAY CACHE - Subtitle Display Cache
 * 
 * This is the DISPLAY cache used for UI performance. It is SEPARATE from the
 * processing cache (episodeWordCache Map) used during import/processing.
 * 
 * DISPLAY CACHE (this file):
 * - Purpose: Fast subtitle display without reloading from Firebase
 * - Scope: Persists in memory for UI display
 * - Data: Fat subtitles (complete subtitle objects with tokens)
 * - Used by: UI components (subtitle-area.jsx, smartsubs-parent.jsx, etc.)
 * - Populated: After loading episode or processing subtitles
 * 
 * PROCESSING CACHE (episodeWordCache Map):
 * - Purpose: Avoid repeated Firebase fetches during batch processing
 * - Scope: Temporary, only during processing operations
 * - Data: Word data objects (from wordsThai/wordsEng collections)
 * - Used by: Processing functions (addressNeedsWork, processTokens, etc.)
 * - Populated: During import/processing operations
 * 
 * IMPORTANT: These two caches serve different purposes and should NEVER be mixed.
 */

import { sensesNeedsWork } from '../03_process/helpers/workmap/schema-work-map-builder.js';
import { FIELD_REGISTRY } from '../05_save/helpers/field-registry.js';

// Fat subtitle storage for display
let fatSubtitlesArray = [];
let fatSubtitlesMap = new Map(); // recordId -> fat subtitle object

// Cache context (showName and mediaId for save operations)
let cacheContext = { showName: null, mediaId: null };

// Schema work map saved state tracking
let savedSchemaWorkMaps = new Map(); // recordId -> boolean (true = saved)

// ============================================================================
// Core Cache Functions
// ============================================================================

/**
 * Check if workmap has any true values (incomplete data)
 * @param {object} workmap - Schema work map
 * @returns {boolean} True if workmap has any true values
 */
export function checkWorkmapHasTrueValues(workmap) {
  if (!workmap || typeof workmap !== 'object') return false;
  
  // Check top-level fields
  for (const [key, value] of Object.entries(workmap)) {
    // Skip validated and needsSave - they're status flags, not work flags
    if (key === 'validated' || key === 'needsSave' || key === 'tokens') continue;
    if (value === true) return true;
  }
  
  // Check tokens structure
  if (workmap.tokens && typeof workmap.tokens === 'object') {
    // Check display tokens
    if (Array.isArray(workmap.tokens.displayThai)) {
      for (const tokenWorkMap of workmap.tokens.displayThai) {
        if (tokenWorkMap && typeof tokenWorkMap === 'object') {
          for (const value of Object.values(tokenWorkMap)) {
            if (value === true) return true;
          }
        }
      }
    }
    
    // Check sense tokens
    if (Array.isArray(workmap.tokens.sensesThai)) {
      for (const senseTokenWorkMap of workmap.tokens.sensesThai) {
        if (senseTokenWorkMap && typeof senseTokenWorkMap === 'object') {
          // Check sense-level fields
          for (const [key, value] of Object.entries(senseTokenWorkMap)) {
            if (key === 'senses' && Array.isArray(value)) {
              for (const senseWorkMap of value) {
                if (senseWorkMap && typeof senseWorkMap === 'object') {
                  for (const v of Object.values(senseWorkMap)) {
                    if (v === true) return true;
                  }
                }
              }
            } else if (value === true) {
              return true;
            }
          }
        }
      }
    }
    
    // Check displayEng tokens
    if (Array.isArray(workmap.tokens.displayEnglish)) {
      for (const tokenWorkMap of workmap.tokens.displayEnglish) {
        if (tokenWorkMap && typeof tokenWorkMap === 'object') {
          for (const value of Object.values(tokenWorkMap)) {
            if (value === true) return true;
          }
        }
      }
    }
    
    // Check sensesEng tokens
    if (Array.isArray(workmap.tokens.sensesEnglish)) {
      for (const senseTokenWorkMap of workmap.tokens.sensesEnglish) {
        if (senseTokenWorkMap && typeof senseTokenWorkMap === 'object') {
          for (const [key, value] of Object.entries(senseTokenWorkMap)) {
            if (key === 'senses' && Array.isArray(value)) {
              for (const senseWorkMap of value) {
                if (senseWorkMap && typeof senseWorkMap === 'object') {
                  for (const v of Object.values(senseWorkMap)) {
                    if (v === true) return true;
                  }
                }
              }
            } else if (value === true) {
              return true;
            }
          }
        }
      }
    }
  }
  
  return false;
}

/**
 * Set entire cache from load-subtitles.js
 * Stores showName and mediaId in module context for save operations
 * @param {Array} fatSubtitles - Array of fat subtitles
 * @param {string} showName - Show name
 * @param {string} mediaId - Media ID
 */
export function setCachedSubtitleCache(fatSubtitles, showName, mediaId) {
  fatSubtitlesArray = fatSubtitles || [];
  
  // Store context for save operations
  if (showName && mediaId) {
    cacheContext = { showName, mediaId };
  }
  
  // Clear fatSubtitlesMap and rebuild from fatSubtitles to keep them in sync
  fatSubtitlesMap.clear();
  for (const fatSubtitle of fatSubtitlesArray) {
    if (fatSubtitle?.subtitle?.id) {
      fatSubtitlesMap.set(fatSubtitle.subtitle.id, fatSubtitle);
    }
  }
}

/**
 * Clear cache
 */
export function clearCache() {
  fatSubtitlesArray = [];
  fatSubtitlesMap.clear();
  cacheContext = { showName: null, mediaId: null };
  savedSchemaWorkMaps.clear();
}

/**
 * Cache fat subtitle silently (no validation, no save)
 * Used for display cache updates
 * @param {string} recordId - Subtitle record ID
 * @param {object} fatSubtitle - Fat subtitle object
 */
export function cacheFatSubtitleSilent(recordId, fatSubtitle) {
  if (!recordId || !fatSubtitle) return;
  
  // Update map
  fatSubtitlesMap.set(recordId, fatSubtitle);
  
  // Update array - find existing or add new
  const existingIndex = fatSubtitlesArray.findIndex(s => s?.subtitle?.id === recordId);
  if (existingIndex >= 0) {
    fatSubtitlesArray[existingIndex] = fatSubtitle;
  } else {
    fatSubtitlesArray.push(fatSubtitle);
  }
}

/**
 * Get cached subtitle by record ID
 * @param {string} recordId - Subtitle record ID
 * @returns {object|null} Cached fat subtitle or null
 */
export function getCachedSubtitle(recordId) {
  if (!recordId) return null;
  return fatSubtitlesMap.get(recordId) || null;
}

/**
 * Get cached subtitle by record ID (alias for getCachedSubtitle)
 * @param {string} recordId - Subtitle record ID
 * @returns {object|null} Cached fat subtitle or null
 */
export function getCachedSubtitleByRecordId(recordId) {
  return getCachedSubtitle(recordId);
}

/**
 * Get entire cache array
 * @returns {Array} Array of fat subtitles
 */
export function getCachedSubtitleCache() {
  return fatSubtitlesArray;
}

/**
 * Get cache context (showName and mediaId)
 * @returns {object} Cache context
 */
export function getCacheContext() {
  return { ...cacheContext };
}

/**
 * Update current subtitle in cache
 * @param {string} recordId - Subtitle record ID
 * @param {Function|object} updater - Function that receives current subtitle and returns updated, or object to merge
 * @returns {object|null} Updated cached subtitle or null
 */
export function updateCurrentSubtitle(recordId, updater) {
  if (!recordId) return null;
  
  const current = getCachedSubtitle(recordId);
  if (!current) return null;
  
  const updated = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
  
  cacheFatSubtitleSilent(recordId, updated);
  return updated;
}

/**
 * Get cached subtitle at specific time
 * @param {number} timeSeconds - Time in seconds
 * @returns {object|null} Fat subtitle at that time or null
 */
export function getCachedSubtitleAtTime(timeSeconds) {
  if (timeSeconds === null || timeSeconds === undefined || isNaN(timeSeconds)) {
    return null;
  }
  
  // Find subtitle that contains this time
  for (const fatSubtitle of fatSubtitlesArray) {
    const subtitle = fatSubtitle?.subtitle;
    if (!subtitle) continue;
    
    const startTime = parseFloat(subtitle.startSecThai) || 0;
    const endTime = parseFloat(subtitle.endSecThai) || 0;
    
    if (timeSeconds >= startTime && timeSeconds <= endTime) {
      return fatSubtitle;
    }
  }
  
  return null;
}

/**
 * Get bundle at specific time (alias for getCachedSubtitleAtTime)
 * @param {number} timeSeconds - Time in seconds
 * @returns {object|null} Fat subtitle at that time or null
 */
export function getBundleAtTime(timeSeconds) {
  return getCachedSubtitleAtTime(timeSeconds);
}

/**
 * Check if subtitle changed (for tracking)
 * @param {string} recordId - Subtitle record ID
 * @param {object} newBundle - New bundle to compare
 * @returns {boolean} True if subtitle changed
 */
export function checkSubtitleChanged(recordId, newBundle) {
  const oldBundle = getCachedSubtitle(recordId);
  if (!oldBundle && !newBundle) return false;
  if (!oldBundle || !newBundle) return true;
  
  // Simple comparison - check if IDs match
  return oldBundle?.subtitle?.id !== newBundle?.subtitle?.id;
}

/**
 * Ensure meanings are loaded for a word
 * @param {string} subtitleId - Subtitle ID
 * @param {string} thaiWordsRecordId - Thai words record ID
 * @returns {Promise<void>}
 */
export async function ensureMeaningsLoaded(subtitleId, thaiWordsRecordId) {
  // This is a placeholder - actual implementation would load meanings if needed
  // For now, meanings are loaded via addressNeedsWork
  return Promise.resolve();
}

/**
 * Mark schema work map as saved
 * @param {string} recordId - Subtitle record ID
 * @returns {Promise<void>}
 */
export async function markSchemaWorkMapAsSaved(recordId) {
  savedSchemaWorkMaps.set(recordId, true);
  
  // Update cached subtitle to mark as saved
  const cached = getCachedSubtitle(recordId);
  if (cached && cached.schemaWorkMap) {
    cached.schemaWorkMap.needsSave = false;
    cacheFatSubtitleSilent(recordId, cached);
  }
}

/**
 * Update Thai words record in cached subtitle
 * @param {string} subtitleRecordId - Subtitle record ID
 * @param {string} thaiWordsRecordId - Thai words record ID
 * @param {object} updatedThaiWordsRecord - Updated Thai words record
 * @returns {Promise<void>}
 */
export async function updateThaiWordsRecord(subtitleRecordId, thaiWordsRecordId, updatedThaiWordsRecord) {
  const subtitle = getCachedSubtitle(subtitleRecordId);
  if (subtitle && subtitle.thaiWordsRecords) {
    subtitle.thaiWordsRecords[thaiWordsRecordId] = updatedThaiWordsRecord;
    cacheFatSubtitleSilent(subtitleRecordId, subtitle);
  }
}

/**
 * Lexicon Lookup Utility
 * Handles loading and querying the 50k dictionary JSON
 */

// In-memory lexicon storage
let lexiconData = [];
let lexiconLoaded = false;
let lexiconByThai = new Map();

/**
 * Load the 50k lexicon JSON file
 * Loads thaiDb.json from public folder
 */
export async function loadLexicon() {
  if (lexiconLoaded) {
    return;
  }

  try {
    // Load thaiDb.json from extension resources
    const lexiconUrl = typeof chrome !== 'undefined' && chrome.runtime
      ? chrome.runtime.getURL('thaiDb.json')
      : '/thaiDb.json';
    
    const response = await fetch(lexiconUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch lexicon: ${response.status} ${response.statusText}`);
    }
    
    lexiconData = await response.json();
    
    // Build index by Thai word for fast lookup
    lexiconByThai = new Map();
    lexiconData.forEach((entry) => {
      // Index by t-entry (primary)
      const tEntry = entry['t-entry'];
      if (tEntry && tEntry.trim()) {
        if (!lexiconByThai.has(tEntry)) {
          lexiconByThai.set(tEntry, []);
        }
        lexiconByThai.get(tEntry).push(entry);
      }
      
      // Also index by t-search if different from t-entry
      const tSearch = entry['t-search'];
      if (tSearch && tSearch.trim() && tSearch !== tEntry) {
        if (!lexiconByThai.has(tSearch)) {
          lexiconByThai.set(tSearch, []);
        }
        lexiconByThai.get(tSearch).push(entry);
      }
    });
    
    lexiconLoaded = true;
  } catch (error) {
    lexiconData = [];
    lexiconByThai = new Map();
    lexiconLoaded = true; // Mark as loaded even on error to prevent retry loops
  }
}

/**
 * Get all dictionary entries that match a Thai word (exact match)
 * @param word - Thai word to look up
 * @returns Array of matching dictionary entries
 */
export function getCandidates(word) {
  if (!word || !word.trim()) {
    return [];
  }

  const trimmedWord = word.trim();
  
  // Check in-memory index
  const candidates = lexiconByThai.get(trimmedWord) || [];
  
  // Also check t-search field for exact matches
  const additionalMatches = lexiconData.filter(entry => 
    entry['t-search'] === trimmedWord || entry['t-entry'] === trimmedWord
  );
  
  // Combine and deduplicate by id
  const allMatches = [...candidates, ...additionalMatches];
  const seen = new Set();
  return allMatches.filter(entry => {
    const id = entry.id;
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

/**
 * Get a dictionary entry by its ID
 * @param id - Entry ID to look up
 * @returns Dictionary entry or null if not found
 */
export function getById(id) {
  const entry = lexiconData.find(e => e.id === id || String(e.id) === String(id));
  return entry || null;
}

/**
 * Check if lexicon is loaded
 */
export function isLexiconLoaded() {
  return lexiconLoaded;
}

/**
 * Get total number of entries in lexicon
 */
export function getLexiconSize() {
  return lexiconData.length;
}

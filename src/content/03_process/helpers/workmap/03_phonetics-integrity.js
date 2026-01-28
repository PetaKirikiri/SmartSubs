/**
 * Phonetics Integrity Check
 * Checks integrity of fields produced by phonetics helpers (g2p + phonetic-parser)
 */

/**
 * Check integrity of phonetics fields
 * @param {object} fatBundle - Fat bundle object
 * @param {object} context - Context { tokenIndex }
 * @returns {object} Object mapping field names to booleans (true = needs work)
 */
export function checkIntegrity(fatBundle, context = {}) {
  const result = {};
  
  const { tokenIndex } = context;
  if (tokenIndex === undefined || tokenIndex === null) {
    // If no tokenIndex provided, can't check token-level fields
    return { g2p: false, englishPhonetic: false };
  }
  
  const tokens = fatBundle.tokens || fatBundle.subtitle?.tokens || {};
  const displayTokens = tokens.display || [];
  const token = displayTokens[tokenIndex];
  
  // Check g2p - presence
  result.g2p = token?.g2p === undefined || token.g2p === null;
  
  // Check englishPhonetic - presence
  result.englishPhonetic = token?.englishPhonetic === undefined || token.englishPhonetic === null;
  
  return result;
}

/**
 * Get dependencies required for phonetics helper
 * @returns {Array<string>} Array of dependency field paths
 */
export function getDependencies() {
  return ['wordReferenceIdsThai', 'tokens.display[i].g2p']; // Need wordReferenceIdsThai for g2p, g2p for englishPhonetic
}

/**
 * Get fields produced by phonetics helper
 * @returns {Array<string>} Array of field paths this helper produces
 */
export function getFields() {
  return ['tokens.display[i].g2p', 'tokens.display[i].englishPhonetic'];
}

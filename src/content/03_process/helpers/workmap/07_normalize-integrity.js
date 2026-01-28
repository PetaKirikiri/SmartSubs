/**
 * Normalize Integrity Check
 * Checks integrity of fields produced by normalization helper (gpt-normalize-senses)
 */

/**
 * Check integrity of normalized sense fields
 * @param {object} fatBundle - Fat bundle object
 * @param {object} context - Context { tokenIndex, senseIndex }
 * @returns {object} Object mapping field names to booleans (true = needs work)
 */
export function checkIntegrity(fatBundle, context = {}) {
  const result = {};
  
  const { tokenIndex, senseIndex } = context;
  if (tokenIndex === undefined || tokenIndex === null || senseIndex === undefined || senseIndex === null) {
    // If no tokenIndex/senseIndex provided, can't check sense-level fields
    return {};
  }
  
  const tokens = fatBundle.tokens || fatBundle.subtitle?.tokens || {};
  const senseTokens = tokens.senses || [];
  const senseToken = senseTokens[tokenIndex];
  
  if (!senseToken || !Array.isArray(senseToken.senses)) {
    // Senses array doesn't exist - can't check normalization
    return {};
  }
  
  const sense = senseToken.senses[senseIndex];
  if (!sense) {
    // Sense doesn't exist - can't check normalization
    return {};
  }
  
  // Check normalized fields directly - same as g2p, phonetic, etc.
  // If fields exist, validate them; if they don't exist, mark as false (no work needed)
  result.posEnglish = !sense.posEnglish || String(sense.posEnglish).trim() === '';
  result.meaningThai = !sense.meaningThai || String(sense.meaningThai).trim() === '';
  result.meaningEnglish = !sense.meaningEnglish || String(sense.meaningEnglish).trim() === '';
  result.descriptionThai = !sense.descriptionThai || String(sense.descriptionThai).trim() === '';
  result.descriptionEnglish = !sense.descriptionEnglish || String(sense.descriptionEnglish).trim() === '';
  
  // Check confidence - presence only
  result.confidence = sense.confidence === undefined || sense.confidence === null;
  
  return result;
}

/**
 * Get dependencies required for normalization helper
 * @returns {Array<string>} Array of dependency field paths
 */
export function getDependencies() {
  return ['tokens.senses[i].senses'];
}

/**
 * Get fields produced by normalization helper
 * @returns {Array<string>} Array of field paths this helper produces
 */
export function getFields() {
  return [
    'posEnglish',
    'meaningThai',
    'meaningEnglish',
    'descriptionThai',
    'descriptionEnglish',
    'confidence'
  ];
}

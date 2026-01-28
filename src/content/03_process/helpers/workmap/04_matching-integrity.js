/**
 * Matching Integrity Check
 * Checks integrity of fields produced by matching helper (gpt-match-words)
 */

/**
 * Check integrity of matching fields
 * @param {object} fatBundle - Fat bundle object
 * @param {object} context - Context (not used for top-level fields)
 * @returns {object} Object mapping field names to booleans (true = needs work)
 */
export function checkIntegrity(fatBundle, context = {}) {
  const result = {};
  
  // Check matchedWords - presence+type
  const matchedWords = fatBundle.matchedWords ?? fatBundle.subtitle?.matchedWords;
  result.matchedWords = !Array.isArray(matchedWords);
  
  return result;
}

/**
 * Get dependencies required for matching helper
 * @returns {Array<string>} Array of dependency field paths
 */
export function getDependencies() {
  return ['wordReferenceIdsThai', 'wordReferenceIdsEng'];
}

/**
 * Get fields produced by matching helper
 * @returns {Array<string>} Array of field paths this helper produces
 */
export function getFields() {
  return ['matchedWords'];
}

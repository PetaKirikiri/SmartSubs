/**
 * Tokenization Integrity Check
 * Checks integrity of fields produced by tokenization helpers (ai4thai + english)
 */

/**
 * Check integrity of tokenization fields
 * @param {object} fatBundle - Fat bundle object
 * @param {object} context - Context (not used for top-level fields)
 * @returns {object} Object mapping field names to booleans (true = needs work)
 */
export function checkIntegrity(fatBundle, context = {}) {
  const result = {};
  
  // Check wordReferenceIdsThai - presence+type+length-when-workmap-true
  // Array must exist AND have items if workmap is true
  const wordRefsThai = fatBundle.wordReferenceIdsThai ?? fatBundle.subtitle?.wordReferenceIdsThai;
  result.wordReferenceIdsThai = !Array.isArray(wordRefsThai) || wordRefsThai.length === 0;
  
  // Check wordReferenceIdsEng - presence+type+length-when-workmap-true
  const wordRefsEng = fatBundle.wordReferenceIdsEng ?? fatBundle.subtitle?.wordReferenceIdsEng;
  result.wordReferenceIdsEng = !Array.isArray(wordRefsEng) || wordRefsEng.length === 0;
  
  return result;
}

/**
 * Get dependencies required for tokenization helper
 * @returns {Array<string>} Array of dependency field paths
 */
export function getDependencies() {
  return ['thai', 'english']; // Need thai for Thai tokenization, english for English tokenization
}

/**
 * Get fields produced by tokenization helper
 * @returns {Array<string>} Array of field paths this helper produces
 */
export function getFields() {
  return ['wordReferenceIdsThai', 'wordReferenceIdsEng'];
}

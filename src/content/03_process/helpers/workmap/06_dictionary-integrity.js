/**
 * Dictionary Integrity Check
 * Checks integrity of fields produced by dictionary helpers (orst + gpt-meaning)
 */

/**
 * Check integrity of dictionary fields
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
    // Senses array doesn't exist - mark all fields as needs work
    return {
      thaiWord: true,
      senseNumber: true,
      pos: true,
      definition: true,
      source: true,
      originalData: true
    };
  }
  
  const sense = senseToken.senses[senseIndex];
  if (!sense) {
    // Sense doesn't exist - mark all fields as needs work
    return {
      thaiWord: true,
      senseNumber: true,
      pos: true,
      definition: true,
      source: true,
      originalData: true
    };
  }
  
  // Check ORST fields - presence+content for most, presence+type for originalData
  result.thaiWord = !sense.thaiWord || String(sense.thaiWord).trim() === '';
  result.senseNumber = !sense.senseNumber || String(sense.senseNumber).trim() === '';
  result.pos = !sense.pos || String(sense.pos).trim() === '';
  result.definition = !sense.definition || String(sense.definition).trim() === '';
  result.source = !sense.source || String(sense.source).trim() === '';
  
  // Check originalData - presence+type (must be object)
  result.originalData = !(typeof sense.originalData === 'object' && sense.originalData !== null && !Array.isArray(sense.originalData));
  
  return result;
}

/**
 * Get dependencies required for dictionary helper
 * @returns {Array<string>} Array of dependency field paths
 */
export function getDependencies() {
  return ['wordReferenceIdsThai'];
}

/**
 * Get fields produced by dictionary helper
 * @returns {Array<string>} Array of field paths this helper produces
 */
export function getFields() {
  return [
    'tokens.senses[i].senses',
    'thaiWord',
    'senseNumber',
    'pos',
    'definition',
    'source',
    'originalData'
  ];
}

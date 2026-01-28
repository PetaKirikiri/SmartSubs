/**
 * References Integrity Check
 * Checks integrity of fields produced by references helper (smartsubsrefs-builder)
 */

/**
 * Check integrity of references fields
 * @param {object} fatBundle - Fat bundle object
 * @param {object} context - Context (not used for top-level fields)
 * @returns {object} Object mapping field names to booleans (true = needs work)
 */
export function checkIntegrity(fatBundle, context = {}) {
  const result = {};
  
  // Check smartSubsRefs - presence+type
  const smartSubsRefs = fatBundle.smartSubsRefs ?? fatBundle.subtitle?.smartSubsRefs;
  result.smartSubsRefs = !Array.isArray(smartSubsRefs);
  
  return result;
}

/**
 * Get dependencies required for references helper
 * @returns {Array<string>} Array of dependency field paths
 */
export function getDependencies() {
  return ['wordReferenceIdsThai', 'wordReferenceIdsEng'];
}

/**
 * Get fields produced by references helper
 * @returns {Array<string>} Array of field paths this helper produces
 */
export function getFields() {
  return ['smartSubsRefs'];
}

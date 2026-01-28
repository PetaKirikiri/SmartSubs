/**
 * VTT Integrity Check
 * Checks integrity of fields produced by VTT fetch + parse helpers
 */

/**
 * Check integrity of VTT fields
 * @param {object} fatBundle - Fat bundle object
 * @param {object} context - Context (not used for top-level fields)
 * @returns {object} Object mapping field names to booleans (true = needs work)
 */
export function checkIntegrity(fatBundle, context = {}) {
  const result = {};
  
  // Check thai - presence+content
  const thai = fatBundle.thai ?? fatBundle.subtitle?.thai;
  result.thai = !thai || String(thai).trim() === '';
  
  // Check english - presence+content
  const english = fatBundle.english ?? fatBundle.subtitle?.english;
  result.english = !english || String(english).trim() === '';
  
  // Check timestamps - presence only
  result.startSecThai = fatBundle.startSecThai === undefined || fatBundle.startSecThai === null;
  result.endSecThai = fatBundle.endSecThai === undefined || fatBundle.endSecThai === null;
  result.startSecEng = fatBundle.startSecEng === undefined || fatBundle.startSecEng === null;
  result.endSecEng = fatBundle.endSecEng === undefined || fatBundle.endSecEng === null;
  
  return result;
}

/**
 * Get dependencies required for VTT helper
 * @returns {Array<string>} Array of dependency field paths
 */
export function getDependencies() {
  return []; // VTT is origin - no dependencies
}

/**
 * Get fields produced by VTT helper
 * @returns {Array<string>} Array of field paths this helper produces
 */
export function getFields() {
  return ['thai', 'english', 'startSecThai', 'endSecThai', 'startSecEng', 'endSecEng'];
}

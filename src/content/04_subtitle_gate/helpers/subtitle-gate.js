/**
 * Subtitle Gate - Enforces customer-facing invariants
 * 
 * Guarantees "no data left behind" by blocking save, cache, and display
 * unless all mandatory fields required for user safety and correctness are present.
 * 
 * Gate validates customer-facing invariants:
 * - id must exist and be non-empty
 * - All timing fields must exist: startSecThai, endSecThai, startSecEng, endSecEng (all non-null)
 * - At least one language string must exist: thai.trim() !== '' OR english.trim() !== ''
 * - Tokens structure must exist: tokens object with arrays (never null)
 * - All arrays must exist (may be empty): wordReferenceIdsThai, wordReferenceIdsEng, smartSubsRefs, matchedWords
 * 
 * If gate fails, save/cache/display are blocked.
 */

/**
 * Validate customer-facing invariants
 * @param {object} fatBundle - Fat bundle to validate
 * @param {string} subtitleId - Subtitle ID for error messages
 * @returns {{ passed: boolean, error?: string }} Gate result
 */
export function validateSubtitleInvariants(fatBundle, subtitleId) {
  if (!fatBundle) {
    return { passed: false, error: `Subtitle gate failed for ${subtitleId}: fatBundle is null or undefined` };
  }

  // Check id exists and is non-empty
  if (!fatBundle.id || typeof fatBundle.id !== 'string' || fatBundle.id.trim() === '') {
    return { passed: false, error: `Subtitle gate failed for ${subtitleId}: id is missing or empty` };
  }

  // Check all timing fields exist and are non-null
  if (fatBundle.startSecThai === undefined || fatBundle.startSecThai === null) {
    return { passed: false, error: `Subtitle gate failed for ${subtitleId}: startSecThai is missing or null` };
  }
  if (fatBundle.endSecThai === undefined || fatBundle.endSecThai === null) {
    return { passed: false, error: `Subtitle gate failed for ${subtitleId}: endSecThai is missing or null` };
  }
  if (fatBundle.startSecEng === undefined || fatBundle.startSecEng === null) {
    return { passed: false, error: `Subtitle gate failed for ${subtitleId}: startSecEng is missing or null` };
  }
  if (fatBundle.endSecEng === undefined || fatBundle.endSecEng === null) {
    return { passed: false, error: `Subtitle gate failed for ${subtitleId}: endSecEng is missing or null` };
  }

  // Check at least one language string exists
  const hasLanguage = (fatBundle.thai && typeof fatBundle.thai === 'string' && fatBundle.thai.trim() !== '') ||
                      (fatBundle.english && typeof fatBundle.english === 'string' && fatBundle.english.trim() !== '');
  if (!hasLanguage) {
    return { passed: false, error: `Subtitle gate failed for ${subtitleId}: no language strings present (need thai OR english)` };
  }

  // Check tokens structure exists
  if (!fatBundle.tokens || typeof fatBundle.tokens !== 'object') {
    return { passed: false, error: `Subtitle gate failed for ${subtitleId}: tokens structure is missing or invalid` };
  }

  // Check tokens arrays exist
  if (!Array.isArray(fatBundle.tokens.display)) {
    return { passed: false, error: `Subtitle gate failed for ${subtitleId}: tokens.display is not an array` };
  }
  if (!Array.isArray(fatBundle.tokens.senses)) {
    return { passed: false, error: `Subtitle gate failed for ${subtitleId}: tokens.senses is not an array` };
  }
  if (!Array.isArray(fatBundle.tokens.displayEng)) {
    return { passed: false, error: `Subtitle gate failed for ${subtitleId}: tokens.displayEng is not an array` };
  }
  if (!Array.isArray(fatBundle.tokens.sensesEng)) {
    return { passed: false, error: `Subtitle gate failed for ${subtitleId}: tokens.sensesEng is not an array` };
  }

  // Check all arrays exist (may be empty)
  if (!Array.isArray(fatBundle.wordReferenceIdsThai)) {
    return { passed: false, error: `Subtitle gate failed for ${subtitleId}: wordReferenceIdsThai is not an array` };
  }
  if (!Array.isArray(fatBundle.wordReferenceIdsEng)) {
    return { passed: false, error: `Subtitle gate failed for ${subtitleId}: wordReferenceIdsEng is not an array` };
  }
  if (!Array.isArray(fatBundle.smartSubsRefs)) {
    return { passed: false, error: `Subtitle gate failed for ${subtitleId}: smartSubsRefs is not an array` };
  }
  if (!Array.isArray(fatBundle.matchedWords)) {
    return { passed: false, error: `Subtitle gate failed for ${subtitleId}: matchedWords is not an array` };
  }

  return { passed: true };
}

/**
 * Subtitle Gate - Enforce customer-facing invariants
 * 
 * @param {object} fatBundle - Fat bundle to validate
 * @param {string} subtitleId - Subtitle ID
 * @returns {{ passed: boolean, error?: string }}
 * @throws {Error} If subtitle gate fails (invariants not met)
 */
export function subtitleGate(fatBundle, subtitleId) {
  const validation = validateSubtitleInvariants(fatBundle, subtitleId);
  if (!validation.passed) {
    throw new Error(validation.error);
  }
  return { passed: true };
}

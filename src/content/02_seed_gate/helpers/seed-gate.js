/**
 * Seed Gate - Validates canonical seed (DB preferred, VTT fallback)
 * 
 * Rules:
 * - Runs once
 * - Runs before schemaWorkMap exists
 * - Decides source only by DB presence
 * - Produces only seed fields
 * - Does not toggle workmap flags
 * - Does not touch fat bundle structure
 * 
 * Gate validates minimum seed invariants:
 * - id must exist and be non-empty
 * - Both Thai timing fields must exist (startSecThai AND endSecThai)
 * - Both English timing fields must exist (startSecEng AND endSecEng)
 * - Both language strings must exist (thai AND english)
 * 
 * If gate fails, processing must NOT run.
 */

/**
 * Validate seed invariants
 * @param {object} seed - Seed object with id, timing fields, and language strings
 * @param {string} subtitleId - Subtitle ID for error messages
 * @returns {{ passed: boolean, error?: string }} Gate result
 */
function validateSeedInvariants(seed, subtitleId) {
  // Check id exists and is non-empty
  if (!seed.id || typeof seed.id !== 'string' || seed.id.trim() === '') {
    return { passed: false, error: `Seed gate failed for ${subtitleId}: id is missing or empty` };
  }

  // Check both Thai timing fields exist
  const hasThaiStart = seed.startSecThai !== undefined && seed.startSecThai !== null;
  const hasThaiEnd = seed.endSecThai !== undefined && seed.endSecThai !== null;
  if (!hasThaiStart || !hasThaiEnd) {
    return { passed: false, error: `Seed gate failed for ${subtitleId}: missing Thai timing fields (need both startSecThai AND endSecThai)` };
  }

  // Check both English timing fields exist
  const hasEngStart = seed.startSecEng !== undefined && seed.startSecEng !== null;
  const hasEngEnd = seed.endSecEng !== undefined && seed.endSecEng !== null;
  if (!hasEngStart || !hasEngEnd) {
    return { passed: false, error: `Seed gate failed for ${subtitleId}: missing English timing fields (need both startSecEng AND endSecEng)` };
  }

  // Check both language strings exist
  const hasThai = seed.thai && typeof seed.thai === 'string' && seed.thai.trim() !== '';
  const hasEnglish = seed.english && typeof seed.english === 'string' && seed.english.trim() !== '';
  if (!hasThai || !hasEnglish) {
    return { passed: false, error: `Seed gate failed for ${subtitleId}: missing language strings (need both thai AND english)` };
  }

  return { passed: true };
}

/**
 * Seed Gate - Validates fat bundle invariants
 * Only validates - does not materialize seed
 * 
 * @param {object} fatBundle - Fat bundle object (id extracted from fatBundle.id)
 * @throws {Error} If seed gate fails (invariants not met)
 */
export function seedGate(fatBundle) {
  // Extract subtitleId from fat bundle
  const subtitleId = fatBundle?.id || 'unknown';
  // Validate seed invariants on fat bundle
  const validation = validateSeedInvariants(fatBundle, subtitleId);
  if (!validation.passed) {
    throw new Error(validation.error);
  }
  // No return - just validates
}

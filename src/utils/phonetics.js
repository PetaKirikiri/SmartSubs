/**
 * Thai Phonetics Utility
 * Uses @dehoist/romanize-thai for rule-based Thai→Latin romanization
 */

import romanize from '@dehoist/romanize-thai';

/**
 * Romanize a Thai word to Latin script
 * @param word - Thai word to romanize
 * @returns Romanized phonetic representation
 */
export function romanizeThai(word) {
  if (!word) {
    return '';
  }
  
  try {
    return romanize(word);
  } catch (error) {
    // Return empty string on error to maintain deterministic behavior
    return '';
  }
}

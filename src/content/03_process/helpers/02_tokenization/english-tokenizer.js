/**
 * English Tokenizer - Simple parser for English text
 * No API calls needed - just basic text parsing
 */

/**
 * Tokenize English sentence into words
 * Simple parser: Split by whitespace, filter empty strings, remove punctuation
 * @param {string} englishSentence - English sentence to tokenize
 * @returns {Array<string>} Array of word strings
 */
export function tokenizeEnglishSentence(englishSentence) {
  if (!englishSentence || typeof englishSentence !== 'string') {
    return [];
  }
  
  // Split by whitespace and filter empty strings
  const words = englishSentence.trim().split(/\s+/).filter(word => word.length > 0);
  
  // Remove leading/trailing punctuation from words
  // Keep punctuation that's part of contractions (e.g., "don't", "it's")
  const cleanedWords = words.map(word => {
    // Remove leading punctuation (except apostrophes in contractions)
    let cleaned = word.replace(/^[^\w']+/, '');
    // Remove trailing punctuation
    cleaned = cleaned.replace(/[^\w']+$/, '');
    // Normalize to lowercase for wordReferenceIds (matches database word IDs)
    return cleaned.toLowerCase();
  }).filter(word => word.length > 0);
  
  return cleanedWords;
}

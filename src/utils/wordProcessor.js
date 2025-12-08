/**
 * Word Processor - Glues together tokenization, lexicon lookup, phonetics, and sense selection
 */

import { tokenizeThai } from './tokenizer.js';
import { loadLexicon, getCandidates, getById } from './lexiconLookup.js';
import { romanizeThai } from './phonetics.js';
import { chooseSense } from './senseSelector.js';

/**
 * Process a single word/token from a sentence
 * @param params - Parameters for word processing
 * @param params.sentenceTh - Thai sentence
 * @param params.sentenceEn - Optional English translation
 * @param params.token - Token/word to process
 * @returns Processed word data with lexicon information
 */
export async function processWord(params) {
  const { sentenceTh, sentenceEn, token } = params;

  // Ensure lexicon is loaded
  await loadLexicon();

  // Get candidates from dictionary
  const candidates = getCandidates(token);

  let chosenEntry = null;
  let lexId = null;

  if (candidates.length === 0) {
    // No candidates found
    return {
      thai: token,
      lex_id: null,
      english: null,
      pos: null,
      phonetic: null
    };
  } else if (candidates.length === 1) {
    // Single candidate - use it directly
    chosenEntry = candidates[0];
    lexId = chosenEntry.id;
  } else {
    // Multiple candidates - use GPT to choose the right sense
    lexId = await chooseSense({
      sentenceTh,
      sentenceEn,
      targetWord: token,
      options: candidates
    });

    if (lexId !== null) {
      chosenEntry = getById(lexId);
    }
  }

  // Extract data from chosen entry
  const english = chosenEntry?.['e-entry'] || null;
  const pos = chosenEntry?.['t-cat'] || null;
  
  // Generate phonetic from the Thai word
  const thaiWord = chosenEntry?.['t-entry'] || chosenEntry?.['t-search'] || token;
  const phonetic = romanizeThai(thaiWord);

  return {
    thai: token,
    lex_id: lexId,
    english,
    pos,
    phonetic
  };
}

/**
 * Process an entire Thai sentence
 * @param params - Parameters for sentence processing
 * @param params.sentenceTh - Thai sentence
 * @param params.sentenceEn - Optional English translation
 * @returns Array of processed words
 */
export async function processSentence(params) {
  const { sentenceTh, sentenceEn } = params;

  // Tokenize the sentence
  const tokens = await tokenizeThai(sentenceTh);

  // Process each token
  const results = await Promise.all(
    tokens.map(token => processWord({ sentenceTh, sentenceEn, token }))
  );

  return results;
}

// ============================================================================
// TEMPORARY DEV TEST - Pipeline test for "คุณหมายถึงอยู่ที่นี่เหรอ?"
// ============================================================================
// Dev-only guard: check both process.env (Node) and import.meta.env (Vite)
// Also allow manual trigger via window.SMARTSUBS_RUN_TEST = true
const isDevelopment = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') ||
                      (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.DEV || import.meta.env.MODE === 'development')) ||
                      (typeof window !== 'undefined' && window.SMARTSUBS_RUN_TEST === true);

// Test code disabled - no console logs
if (false && isDevelopment) {
  // Test code preserved but disabled
}

/**
 * GPT Prompts and Configuration
 * Edit these prompts and settings to change how GPT behaves
 */

// ============================================================================
// MODEL CONFIGURATION
// ============================================================================

/**
 * Default GPT model to use
 */
export const DEFAULT_MODEL = 'gpt-4o-mini';

// ============================================================================
// THAI WORD ANALYSIS CONFIGURATION
// ============================================================================

/**
 * System prompt for analyzing Thai words with context
 */
export const THAI_WORD_ANALYSIS_SYSTEM_PROMPT = `You are a Thai language expert. Input: (a) token, (b) tokenized Thai line for context. Task: choose EXACTLY ONE POS from: noun, verb, adjective, adverb, pronoun, classifier, negator, particle. Then output EXACTLY ONE best English gloss for the token as used in this sentence. Also provide romanized phonetic using simple diacritics (á, à, â) integrated into the word. DO NOT append numbers. Use only standard ASCII/Latin characters. Never output multiple meanings, never use '/', 'or', parentheses with alternates, or notes. If POS=classifier, english MUST describe the classifier function in context (e.g., 'classifier for flat objects') and MUST NOT give the literal noun sense (e.g., 'leaf'). Return strict JSON only: {"token":"…","pos":"…","english":"…","englishPhonetic":"…"}.`;

/**
 * User prompt template for analyzing Thai words
 * @param {string} token - The token to analyze
 * @param {string} originalThaiLine - Original Thai line from thai field (not used in prompt, kept for potential debugging)
 * @param {string} thaiSplitArray - Full thaiSplit array for context
 * @returns {string} Formatted user prompt
 */
export function getThaiWordAnalysisUserPrompt(token, originalThaiLine, thaiSplitArray) {
  return `Token to analyze: ${token.trim()}

Tokenized line (thaiSplit): ${thaiSplitArray}

Return strict JSON: {"token":"${token.trim()}","pos":"one of allowed labels","english":"single best gloss","englishPhonetic":"romanized phonetic with simple diacritics (á, à, â), no trailing numbers, standard ASCII only"}`;
}

/**
 * Configuration for Thai word analysis
 */
export const THAI_WORD_ANALYSIS_CONFIG = {
  model: 'gpt-5.1',
  temperature: 0,           // Lower temperature for consistent analysis
  max_completion_tokens: 150,          // Maximum tokens in response
  response_format: { type: "json_object" }  // Force JSON response
};

// ============================================================================
// GPT CONNECTIVITY TEST CONFIGURATION
// ============================================================================

/**
 * System prompt for GPT connectivity test
 */
export const GPT_TEST_SYSTEM_PROMPT = null; // No system prompt for test

/**
 * User prompt for GPT connectivity test
 */
export function getGPTTestUserPrompt() {
  return 'Give me a random quote (just the quote, no attribution).';
}

/**
 * Configuration for GPT connectivity test
 */
export const GPT_TEST_CONFIG = {
  model: DEFAULT_MODEL,
  temperature: 0.8,         // Higher temperature for variety
  max_completion_tokens: 50           // Short response for test
};

// ============================================================================
// THAI TOKENIZATION CONFIGURATION
// ============================================================================

/**
 * System prompt for Thai tokenization
 */
export const THAI_TOKENIZATION_SYSTEM_PROMPT = 'You are a Thai word segmenter. Return only the same Thai text with spaces inserted between lexical words. Do not translate, do not add punctuation, do not add quotes, no numbering, no explanations.';

/**
 * Configuration for Thai tokenization
 */
export const THAI_TOKENIZATION_CONFIG = {
  model: DEFAULT_MODEL,
  temperature: 0,           // Zero temperature for consistent segmentation
  max_completion_tokens: null          // No limit (let GPT decide based on input length)
};


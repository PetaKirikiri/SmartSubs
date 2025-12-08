// OpenAI service for Thai tokenization

import OpenAI from 'openai';
import {
  THAI_WORD_ANALYSIS_SYSTEM_PROMPT,
  getThaiWordAnalysisUserPrompt,
  THAI_WORD_ANALYSIS_CONFIG,
  GPT_TEST_SYSTEM_PROMPT,
  getGPTTestUserPrompt,
  GPT_TEST_CONFIG,
  THAI_TOKENIZATION_SYSTEM_PROMPT,
  THAI_TOKENIZATION_CONFIG
} from './gptPrompts.js';

// OpenAI configuration
export const OPENAI_CONFIG = {
  apiKey: 'IINQXbcVTYWY119Fdn7xhpWLvOqx947F', // Test key - swap later
  model: 'gpt-4o-mini'
};

// Initialize OpenAI client
let openaiClient = null;

/**
 * Get OpenAI client instance (lazy initialization)
 * @returns {OpenAI} OpenAI client
 */
function getOpenAIClient() {
  if (!openaiClient) {
    const apiKey = window.SMARTSUBS_GPT_KEY || OPENAI_CONFIG.apiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Set window.SMARTSUBS_GPT_KEY or configure OPENAI_CONFIG.apiKey.');
    }
    openaiClient = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true // Required for browser/extension usage
    });
  }
  return openaiClient;
}

/**
 * Tokenize a single Thai line
 * @param {string} thaiText - Thai text to tokenize
 * @returns {Promise<string>} Space-segmented Thai string
 * @deprecated Use tokenizeThaiLine from utils/tokenizer instead
 */
export async function tokenizeThaiLine(thaiText) {
  // REFACTORED: Now uses utility module instead of GPT
  const { tokenizeThaiLine: tokenize } = await import('../utils/tokenizer.js');
  return tokenize(thaiText);
}

/**
 * Simple GPT connectivity test - returns a variable response to prove it's working
 * @returns {Promise<string>} Variable test response from GPT
 */
export async function testGPTConnection() {
  try {
    const client = getOpenAIClient();
    
    const messages = [];
    
    if (GPT_TEST_SYSTEM_PROMPT) {
      messages.push({
        role: 'system',
        content: GPT_TEST_SYSTEM_PROMPT
      });
    }
    
    messages.push({
      role: 'user',
      content: getGPTTestUserPrompt()
    });
    
    const response = await client.chat.completions.create({
      model: GPT_TEST_CONFIG.model,
      messages: messages,
      temperature: GPT_TEST_CONFIG.temperature,
      max_completion_tokens: GPT_TEST_CONFIG.max_completion_tokens
    });

    const result = response.choices?.[0]?.message?.content?.trim() || 'No response';
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Analyze a Thai word with context and return POS and translation
 * @param {string} token - Single Thai word/token to analyze
 * @param {string} originalThaiLine - Full original Thai line from thai field
 * @param {string} thaiSplitArray - Full thaiSplit array (space-separated) for context
 * @returns {Promise<{token: string, pos: string, english: string, englishPhonetic: string}>}
 * @deprecated Use processWord from utils/wordProcessor instead
 */
export async function analyzeThaiWord(token, originalThaiLine, thaiSplitArray) {
  // REFACTORED: Now uses utility modules instead of GPT for POS/English/Phonetics
  // GPT is only used for sense selection via wordProcessor
  const { processWord } = await import('../utils/wordProcessor.js');
  
  const result = await processWord({
    sentenceTh: originalThaiLine || thaiSplitArray,
    token: token.trim()
  });
  
  return {
    token: result.thai,
    pos: result.pos || '',
    english: result.english || '',
    englishPhonetic: result.phonetic || ''
  };
}


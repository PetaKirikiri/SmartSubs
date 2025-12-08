/**
 * Thai Tokenizer
 * Tokenizes Thai text into word-level tokens using GPT
 */

import {
  THAI_TOKENIZATION_SYSTEM_PROMPT,
  THAI_TOKENIZATION_CONFIG
} from '../services/gptPrompts.js';
import OpenAI from 'openai';

// Initialize OpenAI client
let openaiClient = null;

function getOpenAIClient() {
  if (!openaiClient) {
    const apiKey = window.SMARTSUBS_GPT_KEY || 'IINQXbcVTYWY119Fdn7xhpWLvOqx947F';
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Set window.SMARTSUBS_GPT_KEY.');
    }
    openaiClient = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });
  }
  return openaiClient;
}

/**
 * Tokenize Thai text into an array of word-level tokens
 * @param {string} thaiText - Thai text to tokenize
 * @returns {Promise<Array<string>>} Array of token strings
 */
export async function tokenizeThai(thaiText) {
  if (!thaiText || typeof thaiText !== 'string' || !thaiText.trim()) {
    return [];
  }

  try {
    const client = getOpenAIClient();
    
    const messages = [];
    if (THAI_TOKENIZATION_SYSTEM_PROMPT) {
      messages.push({
        role: 'system',
        content: THAI_TOKENIZATION_SYSTEM_PROMPT
      });
    }
    
    messages.push({
      role: 'user',
      content: thaiText.trim()
    });
    
    const response = await client.chat.completions.create({
      model: THAI_TOKENIZATION_CONFIG.model || 'gpt-4o-mini',
      messages: messages,
      temperature: THAI_TOKENIZATION_CONFIG.temperature ?? 0,
      max_completion_tokens: THAI_TOKENIZATION_CONFIG.max_completion_tokens ?? null
    });

    const result = response.choices?.[0]?.message?.content?.trim() || '';
    
    // Clean up: remove line breaks, normalize spaces
    const cleaned = result.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Split into tokens and filter out empty strings
    const tokens = cleaned.split(/\s+/).filter(token => token.trim());
    
    return tokens;
  } catch (error) {
    // Fallback: return text as single token if GPT fails
    return [thaiText.trim()];
  }
}

/**
 * Tokenize Thai text and return as space-separated string
 * @param {string} thaiText - Thai text to tokenize
 * @returns {Promise<string>} Space-separated tokenized string
 */
export async function tokenizeThaiLine(thaiText) {
  const tokens = await tokenizeThai(thaiText);
  return tokens.join(' ');
}

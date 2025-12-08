/**
 * API Keys Configuration
 * Centralized storage for all API keys used by the extension
 * 
 * Copy this file to apiKeys.js and fill in your actual API keys
 */

export const API_KEYS = {
  // AI4Thai API key for tokenization, POS tagging, and G2P
  ai4thai: 'YOUR_AI4THAI_API_KEY_HERE',
  
  // OpenAI API key (if needed)
  openai: null, // Set via window.SMARTSUBS_GPT_KEY or OPENAI_CONFIG
  
  // Airtable API token (stored in airtable.js)
  airtable: null // Stored in src/services/airtable.js
};


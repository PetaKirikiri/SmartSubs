/**
 * AI4Thai Configuration and Utilities
 * Shared utilities for all AI4Thai API calls
 */

export const STORAGE_KEY_AI4THAI_API_KEY = 'smartSubs_ai4thai_apiKey';
export const STORAGE_KEY_PROCESSING_PROGRESS = 'smartSubs_processingProgress';

export const AI4THAI_G2P_ENDPOINT = 'https://api.aiforthai.in.th/g2p';

export function getAI4ThaiApiKey() {
  const stored = localStorage.getItem(STORAGE_KEY_AI4THAI_API_KEY);
  if (stored && stored.trim()) {
    return stored.trim();
  }
  
  if (typeof window !== 'undefined' && window.__AI4THAI_API_KEY__) {
    const envKey = window.__AI4THAI_API_KEY__;
    if (envKey && typeof envKey === 'string' && envKey.trim()) {
      return envKey.trim();
    }
  }
  
  return null;
}

export function setAI4ThaiApiKey(apiKey) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_AI4THAI_API_KEY, apiKey);
  }
}

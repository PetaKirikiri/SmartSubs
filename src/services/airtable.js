// Load Airtable config from environment variables
// Set these in .env file: VITE_AIRTABLE_API_TOKEN, VITE_AIRTABLE_BASE_ID, VITE_AIRTABLE_TABLE_NAME
export const AIRTABLE_CONFIG = {
  apiToken: import.meta.env.VITE_AIRTABLE_API_TOKEN || '',
  baseId: import.meta.env.VITE_AIRTABLE_BASE_ID || '',
  tableName: import.meta.env.VITE_AIRTABLE_TABLE_NAME || 'LookUp'
};

export function getTableName() {
  const stored = localStorage.getItem('smartSubs_tableName');
  return stored || AIRTABLE_CONFIG.tableName;
}

export function setTableName(tableName) {
  localStorage.setItem('smartSubs_tableName', tableName);
  AIRTABLE_CONFIG.tableName = tableName;
}

/**
 * Get AI4Thai API key from localStorage or environment variable
 * Priority: localStorage > environment variable
 * Set it with: localStorage.setItem('smartSubs_ai4thai_apiKey', 'your-api-key-here')
 */
export function getAI4ThaiApiKey() {
  // First check localStorage (user override)
  const stored = localStorage.getItem('smartSubs_ai4thai_apiKey');
  if (stored && stored.trim()) {
    return stored.trim();
  }
  
  // Fall back to environment variable (injected at build time by Vite)
  const envKey = import.meta.env.VITE_AI4THAI_API_KEY;
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }
  
  return null;
}

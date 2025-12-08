import { AIRTABLE_CONFIG } from './airtable.js';

/**
 * Fetch all table names from Airtable base
 * @returns {Promise<string[]>} Array of table names
 */
export async function fetchTablesFromAirtable() {
  if (!AIRTABLE_CONFIG.baseId || !AIRTABLE_CONFIG.apiToken) {
    throw new Error('Airtable configuration missing');
  }

  try {
    const metaApiUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_CONFIG.baseId}/tables`;
    const response = await fetch(metaApiUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_CONFIG.apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Airtable API error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data.tables?.map(table => table.name) || [];
  } catch (error) {
    throw error;
  }
}



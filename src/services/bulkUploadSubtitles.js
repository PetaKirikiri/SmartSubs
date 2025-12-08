/**
 * Bulk upload subtitles to Airtable
 */

import { AIRTABLE_CONFIG } from './airtable.js';

/**
 * Bulk upload subtitles to Airtable
 * @param {Array} parsedSubtitles - Array of parsed subtitle objects with thai, startSec, endSec, index
 * @param {Function} progressCallback - Callback(current, total) for progress updates
 * @param {Object} options - Upload options
 * @param {string} options.tableName - Airtable table name
 * @param {string} options.mediaId - Media ID
 * @param {number} options.duration - Episode duration in seconds
 * @param {number|null} options.season - Optional season number
 * @param {number|null} options.episode - Optional episode number
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function bulkUploadSubtitles(parsedSubtitles, progressCallback, options) {
  const { tableName, mediaId, duration, season, episode } = options;
  
  console.log('[SRT Upload] Starting upload:', { 
    subtitleCount: parsedSubtitles.length, 
    tableName, 
    mediaId 
  });
  
  if (!AIRTABLE_CONFIG.baseId || !AIRTABLE_CONFIG.apiToken) {
    throw new Error('Airtable configuration missing');
  }
  
  if (!tableName || !mediaId) {
    throw new Error('tableName and mediaId are required');
  }
  
  if (!parsedSubtitles || parsedSubtitles.length === 0) {
    throw new Error('No subtitles to upload');
  }
  
  const apiUrl = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(tableName)}`;
  const headers = {
    'Authorization': `Bearer ${AIRTABLE_CONFIG.apiToken}`,
    'Content-Type': 'application/json'
  };
  
  let success = 0;
  let failed = 0;
  const BATCH_SIZE = 10; // Airtable allows up to 10 records per request
  const totalBatches = Math.ceil(parsedSubtitles.length / BATCH_SIZE);
  
  // Track if season/episode fields are valid (will be detected on first error)
  let includeSeason = season !== null && season !== undefined && season !== '';
  let includeEpisode = episode !== null && episode !== undefined && episode !== '';
  
  // Process in batches
  for (let i = 0; i < parsedSubtitles.length; i += BATCH_SIZE) {
    const batch = parsedSubtitles.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    
    // Prepare records for this batch
    // Only include fields that exist in the database schema:
    // thai, startSec, endSec, subIndex, mediaId, season, episode
    // Note: Workflow fields (thaiScriptReview, processed, fullReview) may not exist in all tables
    const records = batch.map(subtitle => {
      const fields = {
        thai: String(subtitle.thai || subtitle.text || '').trim(),
        startSec: String(subtitle.startSec || ''),
        endSec: String(subtitle.endSec || ''),
        subIndex: String(subtitle.index || ''),
        mediaId: String(mediaId)
      };
      
      // Add season and episode if provided - fields are text type, so convert to string
      if (includeSeason) {
        fields.season = String(season).trim();
      }
      if (includeEpisode) {
        fields.episode = String(episode).trim();
      }
      
      return { fields };
    });
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ records })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: { message: errorText } };
        }
        
        // Check if error is due to season/episode field issues
        const errorMessage = errorData.error?.message || '';
        if (includeSeason && errorMessage.includes('season') && (errorMessage.includes('cannot accept') || errorMessage.includes('UNKNOWN_FIELD'))) {
          console.log('[SRT Upload] Season field issue detected, continuing without season field');
          includeSeason = false;
          // Retry this batch without season field
          i -= BATCH_SIZE;
          continue;
        }
        if (includeEpisode && errorMessage.includes('episode') && (errorMessage.includes('cannot accept') || errorMessage.includes('UNKNOWN_FIELD'))) {
          console.log('[SRT Upload] Episode field issue detected, continuing without episode field');
          includeEpisode = false;
          // Retry this batch without episode field
          i -= BATCH_SIZE;
          continue;
        }
        
        console.error(`[SRT Upload] Batch ${batchNum}/${totalBatches} failed:`, errorText);
        failed += batch.length;
      } else {
        const data = await response.json();
        const createdCount = data.records?.length || batch.length;
        success += createdCount;
        console.log(`[SRT Upload] Batch ${batchNum}/${totalBatches}: ${createdCount} records created`);
      }
    } catch (error) {
      console.error(`[SRT Upload] Batch ${batchNum}/${totalBatches} error:`, error.message);
      failed += batch.length;
    }
    
    // Report progress
    if (progressCallback) {
      progressCallback(Math.min(i + BATCH_SIZE, parsedSubtitles.length), parsedSubtitles.length);
    }
    
    // Rate limiting: small delay between batches
    if (i + BATCH_SIZE < parsedSubtitles.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Update LookUp table to map mediaId to tableName
  if (success > 0) {
    try {
      await updateLookUpTable(mediaId, tableName);
      console.log(`[SRT Upload] LookUp table updated: mediaId ${mediaId} -> tableName ${tableName}`);
    } catch (error) {
      console.error('[SRT Upload] Failed to update LookUp table:', error.message);
      // Don't fail the whole upload if LookUp update fails
    }
  }
  
  console.log(`[SRT Upload] Complete: ${success} succeeded, ${failed} failed`);
  return { success, failed };
}

/**
 * Create or update LookUp table record mapping mediaId to tableName
 * @param {string} mediaId - Media ID
 * @param {string} tableName - Table name
 */
async function updateLookUpTable(mediaId, tableName) {
  if (!AIRTABLE_CONFIG.baseId || !AIRTABLE_CONFIG.apiToken) {
    throw new Error('Airtable configuration missing');
  }
  
  const lookUpTableName = 'LookUp';
  const apiUrl = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(lookUpTableName)}`;
  const headers = {
    'Authorization': `Bearer ${AIRTABLE_CONFIG.apiToken}`,
    'Content-Type': 'application/json'
  };
  
  // Try to find existing record with various field name variations
  const filterFormulas = [
    `{mediaId} = "${mediaId}"`,
    `{mediald} = "${mediaId}"`,
    `{media_id} = "${mediaId}"`,
    `{Media ID} = "${mediaId}"`,
    `{MediaId} = "${mediaId}"`
  ];
  
  let existingRecordId = null;
  let mediaIdFieldName = null;
  
  for (const filterFormula of filterFormulas) {
    const params = new URLSearchParams();
    params.append('filterByFormula', filterFormula);
    params.append('maxRecords', '1');
    
    try {
      const response = await fetch(`${apiUrl}?${params.toString()}`, {
        headers: headers
      });
      
      if (response.status === 422) continue;
      if (!response.ok) continue;
      
      const data = await response.json();
      const records = data.records || [];
      if (records.length > 0) {
        existingRecordId = records[0].id;
        // Determine which field name was used
        const fields = records[0].fields || {};
        if (fields.mediaId) mediaIdFieldName = 'mediaId';
        else if (fields.mediald) mediaIdFieldName = 'mediald';
        else if (fields.media_id) mediaIdFieldName = 'media_id';
        else if (fields['Media ID']) mediaIdFieldName = 'Media ID';
        else if (fields.MediaId) mediaIdFieldName = 'MediaId';
        break;
      }
    } catch {
      continue;
    }
  }
  
  // Determine TableName field name (try common variations)
  const tableNameFieldNames = ['TableName', 'tableName', 'table_name'];
  let tableNameFieldName = 'TableName'; // Default
  
  // Try to detect the correct field name by checking existing record
  if (existingRecordId) {
    try {
      const response = await fetch(`${apiUrl}/${existingRecordId}`, {
        headers: headers
      });
      if (response.ok) {
        const data = await response.json();
        const fields = data.fields || {};
        for (const fieldName of tableNameFieldNames) {
          if (fields[fieldName] !== undefined) {
            tableNameFieldName = fieldName;
            break;
          }
        }
      }
    } catch {
      // Use default
    }
  }
  
  const fieldsToUpdate = {
    [tableNameFieldName]: String(tableName).trim()
  };
  
  // Use detected mediaId field name or try common ones
  if (!mediaIdFieldName) {
    mediaIdFieldName = 'mediaId'; // Default
  }
  fieldsToUpdate[mediaIdFieldName] = String(mediaId).trim();
  
  if (existingRecordId) {
    // Update existing record
    const response = await fetch(`${apiUrl}/${existingRecordId}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({ fields: fieldsToUpdate })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update LookUp record: ${errorText}`);
    }
  } else {
    // Create new record
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ fields: fieldsToUpdate })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create LookUp record: ${errorText}`);
    }
  }
}


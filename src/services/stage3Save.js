/**
 * Stage 3 Save Module
 * Handles saving the selected senses after Stage 3 confirmation
 */

import { updateSubtitleInCache, syncToAirtable } from './airtableSubtitlePipeline.js';
import { SUBTITLE_STAGE } from '../content/subtitle.js';

/**
 * Save Stage 3: Sense selection confirmation
 * Writes the final list of ThaiWords record IDs to `thaiSplitIds`
 * Ensures ThaiWords records exist before linking (handled by findOrCreateThaiWord in UI)
 * 
 * @param {string} recordId - Subtitle record ID
 * @param {Array<string|null>} lexRecordIds - Array of ThaiWords record IDs (one per token, null for skipped)
 * @returns {Promise<boolean>} Success status
 */
export async function saveStage3(recordId, lexRecordIds) {
  // Update subtitle cache with final thaiSplitIds and mark as processed
  updateSubtitleInCache(recordId, (sub) => {
    sub.thaiSplitIds = lexRecordIds; // Array of record IDs (or nulls)
    sub.processed = true; // Mark Stage 3 complete
    sub.processingStage = SUBTITLE_STAGE.SPLIT_CONFIRMED; // Ensure stage is set
  });
  
  // Save to Airtable directly (syncToAirtable handles the API call)
  // Stage 3 uses direct sync since it's the final stage and needs immediate persistence
  await syncToAirtable(recordId);
  
  return true;
}


/**
 * Stage 1 Save Module
 * Handles saving the thai script after Stage 1 confirmation
 */

import { updateSubtitleInCache, findSubtitleInCache, triggerSave } from './airtableSubtitlePipeline.js';

/**
 * Save Stage 1: Thai script confirmation
 * Writes the final script to `thai` field (not thaiScript)
 * Updates the record so Stage 2 can start
 * 
 * @param {string} recordId - Subtitle record ID
 * @param {string} thaiScript - Final Thai text from Stage 1
 * @returns {Object} Updated subtitle object from cache
 */
export function saveStage1(recordId, thaiScript) {
  const thaiValue = String(thaiScript).trim();
  
  const updated = updateSubtitleInCache(recordId, (subtitle) => {
    subtitle.thai = thaiValue;
    subtitle.Edited = true; // Mark as edited when text changes
  });
  
  if (!updated) throw new Error(`Subtitle not found: ${recordId}`);
  
  triggerSave();
  
  return findSubtitleInCache(recordId);
}


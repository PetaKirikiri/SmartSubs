/**
 * Stage 2 Save Module
 * Handles saving the tokenized array after Stage 2 confirmation
 */

import { updateSubtitleInCache, findSubtitleInCache, triggerSave } from './airtableSubtitlePipeline.js';

/**
 * Save Stage 2: Tokenization confirmation
 * Writes `thaiSplit` as a space-separated string
 * Updates the record so Stage 3 can start
 * 
 * @param {string} recordId - Subtitle record ID
 * @param {string[]} tokensArray - Array of tokenized words
 * @returns {Object} Updated subtitle object from cache
 */
export function saveStage2(recordId, tokensArray) {
  // Convert tokens array to space-separated string
  const thaiSplitString = Array.isArray(tokensArray) 
    ? tokensArray.join(' ').trim()
    : String(tokensArray).trim();
  
  const updated = updateSubtitleInCache(recordId, (subtitle) => {
    subtitle.thaiSplit = thaiSplitString;
  });
  
  if (!updated) throw new Error(`Subtitle not found: ${recordId}`);
  
  triggerSave();
  
  return findSubtitleInCache(recordId);
}


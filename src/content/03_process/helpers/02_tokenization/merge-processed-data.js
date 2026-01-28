/**
 * Merge processed word data back into existing token structures
 * Extracted from process-subtitle-orchestrator.js for separation of concerns
 */

import { parseWordReference } from './word-reference-utils.js';
import { sensesNeedsWork } from '../workmap/schema-work-map-builder.js';

/**
 * Merge processed word data back into existing token structures
 * @param {object} tokens - Existing tokens structure { display, senses, displayEng, sensesEng }
 * @param {Map<string, object>} processedWordsData - Map of processed word data (thaiScript -> { g2p, englishPhonetic, senses })
 * @param {Array<string>} wordReferenceIdsThai - Updated Thai word reference IDs
 * @param {object} schemaWorkMap - Schema work map for conditional updates
 * @returns {object} Updated tokens structure
 */
export function mergeProcessedDataIntoTokens(
  tokens,
  processedWordsData,
  wordReferenceIdsThai,
  schemaWorkMap
) {
  // Update display tokens with processed data
  for (let i = 0; i < tokens.displayThai.length; i++) {
    const wordRef = wordReferenceIdsThai[i];
    if (wordRef) {
      const parsed = parseWordReference(String(wordRef).trim());
      const thaiScript = parsed.thaiScript?.split(',')[0]?.trim() || parsed.thaiScript || null;
      if (thaiScript) {
        const wordData = processedWordsData.get(thaiScript);
        // Update with processed data if available (wordData is an object, even if values are null)
        if (wordData !== undefined) {
          // Always update, even if null (to clear old values)
          if (wordData.g2p !== undefined) {
            tokens.displayThai[i].g2p = wordData.g2p;
          }
          if (wordData.englishPhonetic !== undefined) {
            tokens.displayThai[i].englishPhonetic = wordData.englishPhonetic;
          }
        }
      }
    }
  }

  // Update sense tokens with processed data
  for (let i = 0; i < tokens.sensesThai.length; i++) {
    const wordRef = wordReferenceIdsThai[i];
    if (wordRef) {
      const parsed = parseWordReference(String(wordRef).trim());
      const thaiScript = parsed.thaiScript?.split(',')[0]?.trim() || parsed.thaiScript || null;
      if (thaiScript) {
        const wordData = processedWordsData.get(thaiScript);
        // Check if senses need work according to schemaWorkMap
        const senseWorkMap = schemaWorkMap.tokens.sensesThai[i];
        const needsSensesWork = senseWorkMap && sensesNeedsWork(senseWorkMap);
        // Check if senses already exist and are complete (normalized with core fields)
        const existingSenses = tokens.sensesThai[i]?.senses;
        const hasCompleteSenses = existingSenses && Array.isArray(existingSenses) && existingSenses.length > 0 &&
          existingSenses.some(sense => sense.normalized === true && sense.thaiWord && sense.descriptionEnglish);
        // Check if processed data contains normalized senses (from helper call)
        // Check for presence of normalized fields directly
        const processedSensesAreNormalized = wordData?.senses && Array.isArray(wordData.senses) && wordData.senses.length > 0 && 
          (wordData.senses[0]?.descriptionEnglish !== undefined && wordData.senses[0]?.descriptionEnglish !== null);
        // Update senses if:
        // 1. schemaWorkMap indicates work is needed AND senses are not already complete, OR
        // 2. Processed data contains normalized senses (from helper call) - always merge normalized data
        if (wordData !== undefined && wordData.senses !== undefined && 
            ((needsSensesWork && !hasCompleteSenses) || processedSensesAreNormalized)) {
          if (Array.isArray(wordData.senses) && wordData.senses.length > 0) {
            // Update senses with processed data
            const sensesWithSelection = wordData.senses.map((sense, idx) => {
              let senseDocIndex = null;
              if (sense.senseId) {
                senseDocIndex = parseInt(sense.senseId, 10);
                if (isNaN(senseDocIndex)) senseDocIndex = null;
              }
              
              // CRITICAL: Preserve normalized structure - ensure normalized flag and all normalized fields are preserved
              const mergedSense = {
                ...sense,
                index: senseDocIndex !== null ? senseDocIndex : (idx + 1),
                selected: senseDocIndex === parsed.senseIndex || (parsed.senseIndex === null && idx === 0)
              };
              
              // If sense has normalized fields, ensure normalized flag and originalData are preserved
              if (sense?.descriptionEnglish !== undefined && sense?.descriptionEnglish !== null) {
                mergedSense.normalized = true;
                // CRITICAL: Always preserve originalData if it exists, or create it if missing (data integrity fix)
                if (sense.originalData && typeof sense.originalData === 'object') {
                  mergedSense.originalData = sense.originalData;
                } else {
                  // Create originalData if missing (data integrity fix)
                  mergedSense.originalData = {
                    definition: sense.definition !== undefined ? sense.definition : '',
                    pos: sense.pos !== undefined ? sense.pos : '',
                    senseNumber: sense.senseNumber !== undefined ? sense.senseNumber : ''
                  };
                }
              }
              
              return mergedSense;
            });
            tokens.sensesThai[i].senses = sensesWithSelection;
          } else {
            // Empty array - clear senses
            tokens.sensesThai[i].senses = [];
          }
        }
      }
    }
  }

  return tokens;
}

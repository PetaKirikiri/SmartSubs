/**
 * Token Processing Engine
 * Processes tokens for both Thai and English - pure schema-presence workflow
 * Processes word data (G2P, phonetics, senses) and saves to words collection
 * Can modify wordReferenceIds to add sense indices (e.g., "ดื่ม:0") - this keeps subtitle as skinny
 * Note: Skinny subtitles CAN have sense indices in wordReferenceIds - this is allowed
 * Fat subtitles have BOTH wordReferenceIds (with sense indices) AND tokens structure
 */

import { matchWordsBetweenLanguages } from '../04_matching/gpt-match-words.js';
import { loadSchema, sensesNeedsWork } from '../workmap/schema-work-map-builder.js';
import { getPhonetics } from '../03_phonetics/ai4thai-g2p.js';
import { parsePhoneticToEnglish } from '../03_phonetics/phonetic-parser.js';
import { scrapeOrstDictionary } from '../06_dictionary/06a_orst/orst.js';
import { normalizeSensesWithGPT } from '../07_normalize/gpt-normalize-senses.js';
import { parseWordReference, formatWordReference } from '../02_tokenization/word-reference-utils.js';

// Load schemas once (they're static imports)
let ORST_SCHEMA = null;
let NORMALIZED_SCHEMA = null;

async function getOrstSchema() {
  if (!ORST_SCHEMA) {
    ORST_SCHEMA = await loadSchema('orst-sense');
  }
  return ORST_SCHEMA;
}

async function getNormalizedSchema() {
  if (!NORMALIZED_SCHEMA) {
    NORMALIZED_SCHEMA = await loadSchema('normalized-sense');
  }
  return NORMALIZED_SCHEMA;
}

/**
 * Process tokens for both Thai and English - pure schema-presence workflow
 * Processes word data (G2P, phonetics, senses) and saves to words collection
 * Can modify wordReferenceIds to add sense indices (e.g., "ดื่ม:0") - this keeps subtitle as skinny
 * Note: Skinny subtitles CAN have sense indices in wordReferenceIds - this is allowed
 * Fat subtitles have BOTH wordReferenceIds (with sense indices) AND tokens structure
 * @param {object} subtitleMetadata - Subtitle metadata with wordReferenceIdsThai and wordReferenceIdsEng
 * @param {object} options - Processing options { mediaId, showName, episode, season }
 * @param {Function} progressCallback - Optional progress callback
 * @param {object} schemaWorkMap - Schema work map (key-aligned boolean mask) - if null, falls back to schema-based checks
 * @returns {Promise<object>} { wordReferenceIdsThai, wordReferenceIdsEng }
 */
export async function processTokens(subtitleMetadata, options, progressCallback, schemaWorkMap = null) {
  const { mediaId, showName, episode, season } = options;
  const wordReferenceIdsThai = subtitleMetadata.wordReferenceIdsThai || [];
  const wordReferenceIdsEng = subtitleMetadata.wordReferenceIdsEng || [];
  
  const fullThaiText = subtitleMetadata.thai || '';
  const subtitleId = subtitleMetadata.id || '';
  
  const updatedWordReferenceIdsThai = [];
  const wordChanges = { wordsThai: {}, wordsEng: {} };
  const processedWordsData = new Map(); // Store processed word data for token updates
  
  // Process Thai tokens - use schemaWorkMap to decide what work is needed
  for (let i = 0; i < wordReferenceIdsThai.length; i++) {
    const wordRef = wordReferenceIdsThai[i];
    const { thaiScript: rawThaiScript, senseIndex } = parseWordReference(String(wordRef).trim());
    const thaiScript = rawThaiScript?.split(',')[0]?.trim() || rawThaiScript || null;
    
    if (!thaiScript) {
      updatedWordReferenceIdsThai.push(wordRef);
      // Store empty data for invalid wordRef
      processedWordsData.set(String(wordRef), {
        g2p: null,
        englishPhonetic: null,
        senses: []
      });
      continue;
    }
    
    if (progressCallback) {
      progressCallback(i, wordReferenceIdsThai.length, `Processing Thai token ${i + 1}/${wordReferenceIdsThai.length}: ${thaiScript}...`);
    }
    
    try {
      // TODO: loadWord function needs to be implemented
      // Initialize from existing data (wordData would come from loadWord)
      let g2p = null;
      let englishPhonetic = null;
      let senses = [];
      
      // Initialize word changes tracking
      const changedFields = [];
      
      // schemaWorkMap is REQUIRED for data integrity stage
      if (!schemaWorkMap) {
        throw new Error('processTokens: schemaWorkMap is required for data integrity stage');
      }

      // Check workmap helper groups - ONLY source of truth
      const tokenWorkMap = schemaWorkMap.tokens?.display?.[i];
      const senseWorkMap = schemaWorkMap.tokens?.senses?.[i];
      
      let hasNewData = false;
      
      // Process display token helpers generically - iterate through helper groups
      if (tokenWorkMap?.helpers) {
        for (const [helperName, helperGroup] of Object.entries(tokenWorkMap.helpers)) {
          if (!helperGroup.needsWork) continue;
          
          // Call helper based on helper name from workmap
          if (helperName === 'ai4thai-g2p.js') {
            try {
              if (progressCallback) {
                progressCallback(i, wordReferenceIdsThai.length, `  → Missing G2P, getting phonetics for ${thaiScript}...`);
              }
              const newG2P = await getPhonetics(thaiScript);
              if (newG2P && newG2P.trim()) {
                g2p = newG2P;
                hasNewData = true;
                changedFields.push('g2p');
              }
            } catch (error) {
              // Keep g2p as null
            }
          } else if (helperName === 'phonetic-parser.js') {
            if (g2p && g2p.trim()) {
              try {
                if (progressCallback) {
                  progressCallback(i, wordReferenceIdsThai.length, `  → Missing English phonetic, parsing from G2P...`);
                }
                const newPhonetic = parsePhoneticToEnglish(g2p.trim());
                if (newPhonetic && newPhonetic.trim()) {
                  englishPhonetic = newPhonetic;
                  hasNewData = true;
                  changedFields.push('englishPhonetic');
                }
              } catch (error) {
                // Keep englishPhonetic as null
              }
            }
          }
        }
      }
      
      // Process sense helpers generically - iterate through helper groups
      if (senseWorkMap?.senses && Array.isArray(senseWorkMap.senses)) {
        const sense = senseWorkMap.senses[0]; // Check first sense (all should have same helper needs)
        
        if (sense?.helpers) {
          // CRITICAL: Check if senses already have normalized fields before determining helper needs
          const existingSensesAreNormalized = senses && Array.isArray(senses) && senses.length > 0 && 
            (senses[0]?.descriptionEnglish !== undefined && senses[0]?.descriptionEnglish !== null);
          
          for (const [helperName, helperGroup] of Object.entries(sense.helpers)) {
            if (!helperGroup.needsWork) continue;
            
            // Call helper based on helper name from workmap
            if (helperName === 'orst.js') {
              // CRITICAL: Don't call ORST if senses are already normalized (prevents overwrite loop)
              if (!existingSensesAreNormalized) {
                try {
                  if (progressCallback) {
                    progressCallback(i, wordReferenceIdsThai.length, `  → Missing ORST senses, scraping ORST for ${thaiScript}...`);
                  }
                  const newSenses = await scrapeOrstDictionary(thaiScript);
                  if (newSenses && Array.isArray(newSenses) && newSenses.length > 0) {
                    senses = newSenses;
                    hasNewData = true;
                    changedFields.push('sensesOrst');
                  }
                } catch (error) {
                  // Keep senses as empty array
                }
              } else if (progressCallback) {
                progressCallback(i, wordReferenceIdsThai.length, `  → Skipping ORST for ${thaiScript} (senses already normalized, ORST data in originalData)`);
              }
            } else if (helperName === 'gpt-normalize-senses.js') {
              if (senses && Array.isArray(senses) && senses.length > 0) {
                try {
                  if (progressCallback) {
                    progressCallback(i, wordReferenceIdsThai.length, `  → Missing normalized senses, normalizing with GPT...`);
                  }
                  const normalizedSenses = await normalizeSensesWithGPT(senses, {
                    thaiWord: thaiScript,
                    fullThaiText: fullThaiText,
                    showName: showName,
                    episode: episode,
                    season: season
                  });
                  if (normalizedSenses && Array.isArray(normalizedSenses) && normalizedSenses.length > 0) {
                    senses = normalizedSenses;
                    hasNewData = true;
                    changedFields.push('sensesNormalized');
                  }
                } catch (error) {
                  // Keep senses as-is
                }
              }
            }
          }
        }
      } else if (senseWorkMap) {
        // Fall back to old check for backward compatibility
        const needsWork = sensesNeedsWork(senseWorkMap);
        if (needsWork && senses && Array.isArray(senses) && senses.length > 0) {
          const existingSensesAreNormalized = senses[0]?.descriptionEnglish !== undefined && senses[0]?.descriptionEnglish !== null;
          if (!existingSensesAreNormalized) {
            try {
              if (progressCallback) {
                progressCallback(i, wordReferenceIdsThai.length, `  → Missing ORST senses, scraping ORST for ${thaiScript}...`);
              }
              const newSenses = await scrapeOrstDictionary(thaiScript);
              if (newSenses && Array.isArray(newSenses) && newSenses.length > 0) {
                senses = newSenses;
                hasNewData = true;
                changedFields.push('sensesOrst');
              }
            } catch (error) {
              // Keep senses as empty array
            }
          }
        }
      }
      
      // Track changes for this word (even if no new data, we processed it)
      wordChanges.wordsThai[thaiScript] = changedFields;
      
      // Store processed word data for token updates (even if no new data, store what we have)
      processedWordsData.set(thaiScript, {
        g2p: g2p,
        englishPhonetic: englishPhonetic,
        senses: senses
      });
      
      // Always update wordReferenceIds (no Firestore writes here - that happens in save layer)
      updatedWordReferenceIdsThai.push(formatWordReference(thaiScript, senseIndex));
    } catch (error) {
      // On error, preserve word reference (no Firestore writes here)
      updatedWordReferenceIdsThai.push(formatWordReference(thaiScript, senseIndex));
      
      // Store empty/null data on error (so tokens aren't updated with stale data)
      if (thaiScript) {
        processedWordsData.set(thaiScript, {
          g2p: null,
          englishPhonetic: null,
          senses: []
        });
      }
      
      if (progressCallback) {
        progressCallback(i, wordReferenceIdsThai.length, `  → ✗ Failed to process "${thaiScript}"`);
      }
    }
  }
  
  // Process English tokens (simple - just return as-is, no processing needed)
  const updatedWordReferenceIdsEng = wordReferenceIdsEng;
  
  // No Firestore writes here - smartSubsRefs are built in addressNeedsWork and attached to schemaWorkMap
  
  // Match words if helper group indicates work is needed
  let matchedWords = [];
  const matchedWordsHelper = schemaWorkMap?.helpers?.['gpt-match-words.js'];
  if (matchedWordsHelper?.needsWork && updatedWordReferenceIdsThai.length > 0 && updatedWordReferenceIdsEng.length > 0 && subtitleMetadata.thai && subtitleMetadata.english) {
    try {
      const matches = await matchWordsBetweenLanguages(
        {
          thai: subtitleMetadata.thai,
          english: subtitleMetadata.english,
          wordReferenceIdsThai: updatedWordReferenceIdsThai,
          wordReferenceIdsEng: updatedWordReferenceIdsEng
        },
        { showName, episodeTitle: subtitleMetadata.episodeTitle || null, episode, season, mediaId }
      );
      
      if (matches && matches.length > 0) {
        matchedWords = matches;
      }
    } catch (error) {
      // Word matching failed - continue without matches
    }
  }
  
  return {
    wordReferenceIdsThai: updatedWordReferenceIdsThai,
    wordReferenceIdsEng: updatedWordReferenceIdsEng,
    wordChanges: wordChanges,
    processedWordsData: processedWordsData, // Return processed word data for token updates
    matchedWords: matchedWords // Return matched words for bundle population
  };
}

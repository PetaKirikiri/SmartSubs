/**
 * Process Subtitle Orchestrator
 * Addresses needs/work in fat bundles based on schemaWorkMap
 * - Accepts fat bundle in package format (load phase guarantees this)
 * - Runs helpers workmap says need work
 * - Merges results and returns
 */

import { mergeProcessedDataIntoTokens } from './helpers/02_tokenization/merge-processed-data.js';
import { processTokens } from './helpers/08_token-processing/process-tokens.js';

/**
 * Address needs/work in fat bundle based on schemaWorkMap
 * @param {object} fatBundle - Fat bundle in package format { subtitle: {...}, tokens: {...} }
 * @param {object} schemaWorkMap - Schema work map (key-aligned boolean mask)
 * @param {object} options - Processing options { showName, mediaId, episode, season }
 * @param {Function} progressCallback - Optional progress callback
 * @returns {Promise<object>} Fat subtitle { fat: { subtitle: {...}, tokens: {...}, schemaWorkMap, smartSubsRefsWrites } }
 */
export async function addressNeedsWork(fatBundle, schemaWorkMap, options, progressCallback) {
  // Run helpers workmap says need work
  
  // Token-level helpers
  const hasTokenLevelWork = schemaWorkMap.tokens.displayThai.some(t => 
    t?.helpers && Object.values(t.helpers).some(h => h.needsWork)
  ) || schemaWorkMap.tokens.sensesThai.some(t => 
    t?.senses && Array.isArray(t.senses) && t.senses.some(s => 
      s?.helpers && Object.values(s.helpers).some(h => h.needsWork)
    )
  ) || schemaWorkMap.tokens.displayEnglish.some(t => 
    t?.helpers && Object.values(t.helpers).some(h => h.needsWork)
  ) || schemaWorkMap.tokens.sensesEnglish.some(t => 
    t?.senses && Array.isArray(t.senses) && t.senses.some(s => 
      s?.helpers && Object.values(s.helpers).some(h => h.needsWork)
    )
  );
  
  let processResult = null;
  if (hasTokenLevelWork) {
    processResult = await processTokens(
      fatBundle.subtitle,
      options,
      progressCallback,
      schemaWorkMap
    );
    
    const processedWordsData = processResult.processedWordsData || new Map();
    
    fatBundle.tokens = mergeProcessedDataIntoTokens(
      fatBundle.tokens,
      processedWordsData,
      processResult.wordReferenceIdsThai,
      schemaWorkMap
    );
    
    fatBundle.subtitle = {
      ...fatBundle.subtitle,
      wordReferenceIdsThai: processResult.wordReferenceIdsThai,
      wordReferenceIdsEng: processResult.wordReferenceIdsEng
    };
    
    if (processResult.matchedWords && processResult.matchedWords.length > 0) {
      fatBundle.subtitle = {
        ...fatBundle.subtitle,
        matchedWords: processResult.matchedWords
      };
    }
  }
  
  // Top-level helpers
  if (schemaWorkMap.helpers) {
    for (const [helperName, helperGroup] of Object.entries(schemaWorkMap.helpers)) {
      if (!helperGroup.needsWork) continue;
      
      // Skip tokenizers (handled separately before tokens exist)
      if (helperName === 'ai4thai-tokenizer.js' || helperName === 'english-tokenizer.js') {
        const { tokenizeSubtitle } = await import('./helpers/workmap/schema-work-map-builder.js');
        const tokenized = await tokenizeSubtitle(fatBundle.subtitle);
        fatBundle.subtitle.wordReferenceIdsThai = tokenized.wordReferenceIdsThai || [];
        fatBundle.subtitle.wordReferenceIdsEng = tokenized.wordReferenceIdsEng || [];
        continue;
      }
      
      // Skip parse-vtt (load phase responsibility)
      if (helperName === 'parse-vtt.js') {
        continue;
      }
      
      // gpt-match-words.js
      if (helperName === 'gpt-match-words.js') {
        if (processResult?.matchedWords && processResult.matchedWords.length > 0) {
          continue;
        }
        
        const { matchWordsBetweenLanguages } = await import('./helpers/04_matching/gpt-match-words.js');
        const matches = await matchWordsBetweenLanguages(
          {
            thai: fatBundle.subtitle.thai,
            english: fatBundle.subtitle.english,
            wordReferenceIdsThai: fatBundle.subtitle.wordReferenceIdsThai || [],
            wordReferenceIdsEng: fatBundle.subtitle.wordReferenceIdsEng || []
          },
          { 
            showName: options.showName, 
            episodeTitle: null, 
            episode: options.episode || null, 
            season: options.season || null, 
            mediaId: options.mediaId 
          }
        );
        
        if (matches && matches.length > 0) {
          fatBundle.subtitle = {
            ...fatBundle.subtitle,
            matchedWords: matches
          };
        }
      }
      
      // smartsubsrefs-builder.js
      if (helperName === 'smartsubsrefs-builder.js') {
        const { buildSmartSubsRefsForBundle, buildSmartSubsRefsWritesForWords } = await import('./helpers/05_references/smartsubsrefs-builder.js');
        const smartSubsRefs = await buildSmartSubsRefsForBundle(fatBundle.subtitle, options.mediaId, fatBundle.subtitle.id);
        
        if (smartSubsRefs && smartSubsRefs.length > 0) {
          fatBundle.subtitle = {
            ...fatBundle.subtitle,
            smartSubsRefs: smartSubsRefs
          };
        }
        
        const smartSubsRefsWrites = await buildSmartSubsRefsWritesForWords(
          fatBundle.subtitle,
          schemaWorkMap,
          options.mediaId,
          fatBundle.subtitle.id
        );
        
        fatBundle.smartSubsRefsWrites = smartSubsRefsWrites;
      }
    }
  }
  
  return {
    fat: {
      subtitle: fatBundle.subtitle,
      tokens: fatBundle.tokens,
      schemaWorkMap: schemaWorkMap,
      smartSubsRefsWrites: fatBundle.smartSubsRefsWrites || null
    }
  };
}

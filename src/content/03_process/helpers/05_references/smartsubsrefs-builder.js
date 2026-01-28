/**
 * SmartSubsRefs Builder - Build smart subtitle references for fat bundle
 * Creates array of references in format: ${mediaId}-${subtitleIndex}-${tokenIndex}
 */

import { parseWordReference } from '../02_tokenization/word-reference-utils.js';

/**
 * Map collection identifier to Firestore collection name
 */
function getFirestoreCollectionName(collectionName) {
  const mapping = {
    'wordsThai': 'words',
    'wordsEng': 'wordsEng',
    'failedWords': 'failedWords',
    'failedWordsEng': 'failedWordsEng'
  };
  return mapping[collectionName] || collectionName;
}

/**
 * Build smartSubsRefs array for fat bundle
 * @param {object} fatBundle - Fat bundle with wordReferenceIdsThai and wordReferenceIdsEng
 * @param {string} mediaId - Media ID
 * @param {string} subtitleId - Subtitle ID (format: ${mediaId}-${subtitleIndex})
 * @returns {Promise<Array<string>>} Array of smart subtitle references
 */
export async function buildSmartSubsRefsForBundle(fatBundle, mediaId, subtitleId) {
  if (!fatBundle || !mediaId || !subtitleId) {
    return [];
  }

  // Extract subtitle index from subtitleId
  const parts = subtitleId.split('-');
  const subtitleIndex = parts.length > 1 ? parts[parts.length - 1] : null;
  if (!subtitleIndex) {
    return [];
  }

  const smartSubsRefs = [];
  const wordReferenceIdsThai = fatBundle.wordReferenceIdsThai || [];
  const wordReferenceIdsEng = fatBundle.wordReferenceIdsEng || [];

  // Build refs for Thai tokens
  for (let tokenIndex = 0; tokenIndex < wordReferenceIdsThai.length; tokenIndex++) {
    const wordRef = wordReferenceIdsThai[tokenIndex];
    if (!wordRef || typeof wordRef !== 'string') continue;

    const { thaiScript } = parseWordReference(wordRef.trim());
    if (!thaiScript) continue;

    const ref = `${mediaId}-${subtitleIndex}-${tokenIndex}`;
    smartSubsRefs.push(ref);
  }

  // Build refs for English tokens
  for (let tokenIndex = 0; tokenIndex < wordReferenceIdsEng.length; tokenIndex++) {
    const wordRef = wordReferenceIdsEng[tokenIndex];
    if (!wordRef || typeof wordRef !== 'string') continue;

    const word = wordRef.split(':')[0].trim().toLowerCase();
    if (!word) continue;

    const ref = `${mediaId}-${subtitleIndex}-${tokenIndex}`;
    // Only add if not already present (in case Thai and Eng tokens overlap)
    if (!smartSubsRefs.includes(ref)) {
      smartSubsRefs.push(ref);
    }
  }

  return smartSubsRefs;
}

/**
 * Build smartSubsRefs write arrays for words (process phase)
 * This builds the arrays that the save layer will use to write smartSubsRefs to word documents
 * @param {object} fatBundle - Fat bundle with wordReferenceIdsThai, wordReferenceIdsEng, and smartSubsRefs
 * @param {object} schemaWorkMap - Schema work map
 * @param {string} mediaId - Media ID
 * @param {string} subtitleId - Subtitle ID (format: ${mediaId}-${subtitleIndex})
 * @returns {Promise<{thai: Array, eng: Array}>} Write arrays for Thai and English words
 */
export async function buildSmartSubsRefsWritesForWords(fatBundle, schemaWorkMap, mediaId, subtitleId) {
  const smartSubsRefsWritesThai = [];
  const smartSubsRefsWritesEng = [];

  if (!fatBundle || !schemaWorkMap || !mediaId || !subtitleId) {
    return { thai: smartSubsRefsWritesThai, eng: smartSubsRefsWritesEng };
  }

  // Extract subtitle index from subtitleId
  const parts = subtitleId.split('-');
  const subtitleIndex = parts.length > 1 ? parts[parts.length - 1] : null;
  if (!subtitleIndex) {
    return { thai: smartSubsRefsWritesThai, eng: smartSubsRefsWritesEng };
  }

  const correctPrefix = `${mediaId}-${subtitleIndex}`;
  const wordReferenceIdsThai = fatBundle.wordReferenceIdsThai || [];
  const wordReferenceIdsEng = fatBundle.wordReferenceIdsEng || [];
  const bundleSmartSubsRefs = fatBundle.smartSubsRefs || [];

  // Build smartSubsRefsWritesThai from schemaWorkMap.wordReferenceIdsThai signal
  if (schemaWorkMap.wordReferenceIdsThai && fatBundle.tokens && fatBundle.tokens.displayThai && wordReferenceIdsThai.length > 0) {
    // TODO: loadWord function needs to be implemented
    
    // Build map of unique Thai words to token indices
    const thaiWordMap = new Map(); // thaiScript -> Set<tokenIndex>
    
    for (let tokenIndex = 0; tokenIndex < wordReferenceIdsThai.length; tokenIndex++) {
      const wordRef = wordReferenceIdsThai[tokenIndex];
      if (!wordRef || typeof wordRef !== 'string') continue;
      
      const { thaiScript } = parseWordReference(wordRef.trim());
      if (!thaiScript) continue;
      
      const script = thaiScript.split(',')[0].trim();
      if (!thaiWordMap.has(script)) {
        thaiWordMap.set(script, new Set());
      }
      thaiWordMap.get(script).add(tokenIndex);
    }
    
    // For each unique thaiScript, load word and build smartSubsRefs array
    for (const [thaiScript, tokenIndices] of thaiWordMap.entries()) {
      try {
        // TODO: loadWord function needs to be implemented
        const collectionName = 'wordsThai';
        
        // Get existing smartSubsRefs
        // const wordData = await loadWord(thaiScript, 'wordsThai');
        const existingRefs = []; // wordData?.smartSubsRefs || [];
        const refsArray = Array.isArray(existingRefs) ? [...existingRefs] : [];
        
        // Filter existing refs: remove refs with ':' and refs starting with correctPrefix
        const filteredRefs = refsArray.filter(ref => {
          if (typeof ref !== 'string') return false;
          if (ref.includes(':')) return false;
          if (ref.startsWith(correctPrefix)) return false;
          return true;
        });
        
        // Build new refs: use bundle if available, otherwise build from token indices
        let newRefs = [];
        if (bundleSmartSubsRefs.length > 0) {
          // Extract refs for this word's token indices from bundle
          newRefs = Array.from(tokenIndices)
            .map(tokenIndex => `${mediaId}-${subtitleIndex}-${tokenIndex}`)
            .filter(ref => bundleSmartSubsRefs.includes(ref));
        } else {
          // Backward compatibility: build refs from token indices
          newRefs = Array.from(tokenIndices).map(tokenIndex => 
            `${mediaId}-${subtitleIndex}-${tokenIndex}`
          );
        }
        
        const finalRefs = [...filteredRefs, ...newRefs];
        
        smartSubsRefsWritesThai.push({
          collectionName: getFirestoreCollectionName(collectionName),
          wordId: thaiScript,
          smartSubsRefs: finalRefs
        });
      } catch (error) {
        // Skip on error, continue with next word
      }
    }
  }
  
  // Build smartSubsRefsWritesEng from schemaWorkMap.wordReferenceIdsEng signal
  if (schemaWorkMap.wordReferenceIdsEng && fatBundle.tokens && fatBundle.tokens.displayEnglish && wordReferenceIdsEng.length > 0) {
    // TODO: loadWord function needs to be implemented
    
    // Build map of unique English words to token indices
    const engWordMap = new Map(); // engWord -> Set<tokenIndex>
    
    for (let tokenIndex = 0; tokenIndex < wordReferenceIdsEng.length; tokenIndex++) {
      const wordRef = wordReferenceIdsEng[tokenIndex];
      if (!wordRef || typeof wordRef !== 'string') continue;
      
      const word = wordRef.split(':')[0].trim().toLowerCase();
      if (!word) continue;
      
      if (!engWordMap.has(word)) {
        engWordMap.set(word, new Set());
      }
      engWordMap.get(word).add(tokenIndex);
    }
    
    // For each unique engWord, load word and build smartSubsRefs array
    for (const [engWord, tokenIndices] of engWordMap.entries()) {
      try {
        // TODO: loadWord function needs to be implemented
        const collectionName = 'wordsEng';
        
        // Get existing smartSubsRefs
        // const wordData = await loadWord(engWord, 'wordsEng');
        const existingRefs = []; // wordData?.smartSubsRefs || [];
        const refsArray = Array.isArray(existingRefs) ? [...existingRefs] : [];
        
        // Filter existing refs: remove refs with ':' and refs starting with correctPrefix
        const filteredRefs = refsArray.filter(ref => {
          if (typeof ref !== 'string') return false;
          if (ref.includes(':')) return false;
          if (ref.startsWith(correctPrefix)) return false;
          return true;
        });
        
        // Build new refs: use bundle if available, otherwise build from token indices
        let newRefs = [];
        if (bundleSmartSubsRefs.length > 0) {
          // Extract refs for this word's token indices from bundle
          newRefs = Array.from(tokenIndices)
            .map(tokenIndex => `${mediaId}-${subtitleIndex}-${tokenIndex}`)
            .filter(ref => bundleSmartSubsRefs.includes(ref));
        } else {
          // Backward compatibility: build refs from token indices
          newRefs = Array.from(tokenIndices).map(tokenIndex => 
            `${mediaId}-${subtitleIndex}-${tokenIndex}`
          );
        }
        
        const finalRefs = [...filteredRefs, ...newRefs];
        
        smartSubsRefsWritesEng.push({
          collectionName: getFirestoreCollectionName(collectionName),
          wordId: engWord,
          smartSubsRefs: finalRefs
        });
      } catch (error) {
        // Skip on error, continue with next word
      }
    }
  }

  return { thai: smartSubsRefsWritesThai, eng: smartSubsRefsWritesEng };
}

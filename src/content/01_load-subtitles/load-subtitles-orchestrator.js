/**
 * Load Subtitles Orchestrator
 * ONLY 3 functions: loadFromDB, loadFromVTT, mergeData
 * Re-export: getEmptyFatBundleTemplate
 * Pass-through: passFatBundle
 */

// Debug logging helper (disabled on Netflix due to CSP)
// CSP blocks http:// connections on Netflix, causing console spam
let debugLogDisabled = false;
const debugLog = (location, message, data, hypothesisId) => {
  // Disable entirely on Netflix domain to prevent CSP violations
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.includes('netflix.com') || hostname.includes('netflix')) {
      return; // Skip entirely - CSP blocks http:// on Netflix
    }
  }
  
  // Test fetch once, then disable if it fails (CSP violation)
  if (debugLogDisabled) {
    return;
  }
  
  try {
    fetch('http://127.0.0.1:7242/ingest/321fb967-e310-42c8-9fbb-98d62112cb97', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: location,
        message: message,
        data: data || {},
        timestamp: Date.now(),
        sessionId: 'netflix-subtitle-debug',
        hypothesisId: hypothesisId || 'general'
      })
    }).catch(() => {
      // On first failure, disable to stop spam
      debugLogDisabled = true;
    });
  } catch (e) {
    debugLogDisabled = true;
  }
};

// Re-export getEmptyFatBundleTemplate for convenience
export { getEmptyFatBundleTemplate } from '../03_process/helpers/workmap/schema-work-map-builder.js';

/**
 * Get episode metadata from lookup table by mediaId
 * @param {string} mediaId - Media ID
 * @returns {Promise<object|null>} Metadata object with { showName, mediaId, season, episode, episodeTitle } or null
 */
export async function getEpisodeMetadataFromMediaId(mediaId) {
  if (!mediaId) return null;
  
  const { db } = await import('../utils/firebaseConfig.js');
  const { doc, getDocFromServer } = await import('firebase/firestore');
  
  const lookupRef = doc(db, 'episodeLookup', mediaId);
  const lookupDoc = await getDocFromServer(lookupRef);
  
  if (!lookupDoc.exists()) {
    return null;
  }
  
  return lookupDoc.data();
}

/**
 * Pass fat bundle through (pass-through function)
 * @param {object} fatBundle - Fat bundle to pass through
 * @returns {object} Fat bundle (unchanged)
 */
export function passFatBundle(fatBundle) {
  return fatBundle;
}

/**
 * Load words and senses for a subtitle
 * @param {object} subtitleData - Subtitle data from DB
 * @returns {Promise<object>} Subtitle data with thaiWords and engWords loaded
 */
async function loadWordsAndSenses(subtitleData) {
  const { db } = await import('../utils/firebaseConfig.js');
  const { doc, getDocFromServer, collection, getDocsFromServer } = await import('firebase/firestore');
  const { parseWordReference } = await import('../03_process/process-subtitle-orchestrator.js');
  
  const result = { ...subtitleData };
  
  // Extract unique word IDs from wordReferenceIdsThai
  if (subtitleData.wordReferenceIdsThai && Array.isArray(subtitleData.wordReferenceIdsThai)) {
    const thaiWordIds = new Set();
    for (const wordRef of subtitleData.wordReferenceIdsThai) {
      const { thaiScript } = parseWordReference(wordRef);
      if (thaiScript) {
        thaiWordIds.add(thaiScript);
      }
    }
    
    // Load Thai word documents
    const thaiWords = [];
    for (const wordId of thaiWordIds) {
      // Try words collection first
      const wordRef = doc(db, 'words', wordId);
      const wordDoc = await getDocFromServer(wordRef);
      
      if (wordDoc.exists()) {
        const wordData = { wordId: wordDoc.id, ...wordDoc.data() };
        // Load senses subcollection
        const sensesRef = collection(db, 'words', wordId, 'senses');
        const sensesSnapshot = await getDocsFromServer(sensesRef);
        wordData.senses = sensesSnapshot.docs.map(doc => ({ senseId: doc.id, ...doc.data() }));
        thaiWords.push(wordData);
      } else {
        // Try failedWords collection
        const failedWordRef = doc(db, 'failedWords', wordId);
        const failedWordDoc = await getDocFromServer(failedWordRef);
        
        if (failedWordDoc.exists()) {
          const failedWordData = failedWordDoc.data();
          // Load senses subcollection
          const failedWordSensesRef = collection(db, 'failedWords', wordId, 'senses');
          const failedWordSensesSnapshot = await getDocsFromServer(failedWordSensesRef);
          const subcollectionSenses = failedWordSensesSnapshot.docs.map(doc => ({ senseId: doc.id, ...doc.data() }));
          const senses = subcollectionSenses.length > 0 
            ? subcollectionSenses 
            : (failedWordData.senses || []);
          
          thaiWords.push({
            wordId: wordId,
            thaiScript: failedWordData.thaiScript || wordId,
            senses: senses,
            englishPhonetic: failedWordData.englishPhonetic || '',
            g2p: failedWordData.g2p || '',
            smartSubsRefs: failedWordData.smartSubsRefs || [],
            orstFailed: true
          });
        }
      }
    }
    
    result.thaiWords = thaiWords;
  }
  
  // Extract unique word IDs from wordReferenceIdsEng
  if (subtitleData.wordReferenceIdsEng && Array.isArray(subtitleData.wordReferenceIdsEng)) {
    const engWordIds = new Set();
    for (const wordRef of subtitleData.wordReferenceIdsEng) {
      // English word references are just the word itself (no sense index parsing needed)
      if (wordRef && typeof wordRef === 'string') {
        engWordIds.add(wordRef.toLowerCase());
      }
    }
    
    // Load English word documents
    const engWords = [];
    for (const wordId of engWordIds) {
      // Try wordsEng collection first
      const wordRef = doc(db, 'wordsEng', wordId);
      const wordDoc = await getDocFromServer(wordRef);
      
      if (wordDoc.exists()) {
        const wordData = { wordId: wordDoc.id, ...wordDoc.data() };
        // Load senses subcollection
        const sensesRef = collection(db, 'wordsEng', wordId, 'senses');
        const sensesSnapshot = await getDocsFromServer(sensesRef);
        wordData.senses = sensesSnapshot.docs.map(doc => ({ senseId: doc.id, ...doc.data() }));
        engWords.push(wordData);
      } else {
        // Try failedWordsEng collection
        const failedWordRef = doc(db, 'failedWordsEng', wordId);
        const failedWordDoc = await getDocFromServer(failedWordRef);
        
        if (failedWordDoc.exists()) {
          const failedWordData = failedWordDoc.data();
          // Load senses subcollection
          const failedWordSensesRef = collection(db, 'failedWordsEng', wordId, 'senses');
          const failedWordSensesSnapshot = await getDocsFromServer(failedWordSensesRef);
          const subcollectionSenses = failedWordSensesSnapshot.docs.map(doc => ({ senseId: doc.id, ...doc.data() }));
          const senses = subcollectionSenses.length > 0 
            ? subcollectionSenses 
            : (failedWordData.senses || []);
          
          engWords.push({
            wordId: wordId,
            word: failedWordData.word || wordId,
            senses: senses,
            orstFailed: true
          });
        }
      }
    }
    
    result.engWords = engWords;
  }
  
  return result;
}

/**
 * Load from DB
 * @param {string} mediaId - Media ID
 * @param {string|null} subtitleId - Subtitle ID (null to load all subtitles)
 * @returns {Promise<object|array|null>} Raw DB data (subtitle + words + senses) or null/array
 */
export async function loadFromDB(mediaId, subtitleId = null) {
  debugLog('load:loadFromDB', 'Starting loadFromDB', { mediaId, subtitleId }, 'load_flow');
  
  const { db } = await import('../utils/firebaseConfig.js');
  const { doc, getDocFromServer, collection, getDocsFromServer } = await import('firebase/firestore');
  
  // Query lookup table to get showName
  const lookupMetadata = await getEpisodeMetadataFromMediaId(mediaId);
  debugLog('load:lookup-table', 'Lookup table query', {
    mediaId,
    found: !!lookupMetadata,
    showName: lookupMetadata?.showName,
    season: lookupMetadata?.season,
    episode: lookupMetadata?.episode
  }, 'load_flow');
  
  // If lookup table has entry, try loading from DB
  if (lookupMetadata && lookupMetadata.showName) {
    const showName = lookupMetadata.showName;
    
    // Ensure show exists BEFORE querying (creates show if missing)
    const { ensureShowExists } = await import('../05_save/helpers/ensure-show-exists.js');
    await ensureShowExists(showName);
    debugLog('load:show-exists', 'Show ensured to exist', { showName }, 'load_flow');
    
    try {
      if (subtitleId === null || subtitleId === undefined) {
        // Load all subtitles for episode
        const subsRef = collection(db, 'shows', showName, 'episodes', mediaId, 'subs');
        const subsSnapshot = await getDocsFromServer(subsRef);
        debugLog('load:db-query', 'DB query result', {
          empty: subsSnapshot.empty,
          size: subsSnapshot.size,
          showName,
          mediaId
        }, 'load_flow');
        
        if (subsSnapshot.empty) {
          // Empty array - continue to VTT fallback
          debugLog('load:db-empty', 'DB empty, falling back to VTT', {}, 'load_flow');
        } else {
          // Load all subtitles with words and senses
          const allSubtitles = [];
          for (const subtitleDoc of subsSnapshot.docs) {
            const subtitleData = subtitleDoc.data();
            const result = await loadWordsAndSenses(subtitleData);
            allSubtitles.push(result);
          }
          debugLog('load:db-success', 'Loaded from DB', { count: allSubtitles.length }, 'load_flow');
          return allSubtitles;
        }
      } else {
        // Load single subtitle
        const subtitleRef = doc(db, 'shows', showName, 'episodes', mediaId, 'subs', subtitleId);
        const subtitleDoc = await getDocFromServer(subtitleRef);
        debugLog('load:db-single', 'Single subtitle query', {
          subtitleId,
          exists: subtitleDoc.exists()
        }, 'load_flow');
        
        if (subtitleDoc.exists()) {
          const subtitleData = subtitleDoc.data();
          const result = await loadWordsAndSenses(subtitleData);
          debugLog('load:db-single-success', 'Loaded single from DB', {}, 'load_flow');
          return result;
        }
        // Not found - continue to VTT fallback
        debugLog('load:db-single-not-found', 'Single subtitle not found, falling back to VTT', {}, 'load_flow');
      }
    } catch (error) {
      // Show doesn't exist or other Firebase error - fall through to VTT fallback
      console.warn('[loadFromDB] Failed to query Firebase collection, falling back to VTT:', error.message);
      debugLog('load:db-error', 'DB query error, falling back to VTT', {
        error: error.message
      }, 'load_flow');
    }
  } else {
    debugLog('load:no-lookup', 'No lookup table entry, proceeding to VTT', {}, 'load_flow');
  }
  
  // VTT Fallback (at the END of loadFromDB)
  // This executes if: lookup table doesn't have entry, OR DB query returned null/empty
  debugLog('load:vtt-fallback', 'Starting VTT fallback', { mediaId }, 'load_flow');
  const videoElement = document.querySelector('video');
  
  const { extractMediaMetadata } = await import('./helpers/extract-metadata.js');
  const { saveEpisodeLookupMetadata } = await import('../05_save/helpers/save-episode-lookup.js');
  
  // Extract metadata and ensure lookup table entry
  const metadata = extractMediaMetadata(videoElement, mediaId);
  debugLog('load:metadata-extract', 'Extracted metadata', {
    showName: metadata.showName,
    episodeNumber: metadata.episodeNumber,
    episodeTitle: metadata.episodeTitle
  }, 'load_flow');
  
  if (metadata.showName) {
    await saveEpisodeLookupMetadata(metadata.showName, mediaId, {
      season: null,
      episode: metadata.episodeNumber,
      episodeTitle: metadata.episodeTitle
    });
    debugLog('load:lookup-saved', 'Lookup table metadata saved', {}, 'load_flow');
  } else {
    debugLog('load:no-showname', 'No showName in metadata', {}, 'load_flow');
  }
  
  if (subtitleId === null || subtitleId === undefined) {
    // Load all subtitles from VTT
    const vttSubtitles = await loadAllFromVTT(mediaId);
    debugLog('load:vtt-result', 'loadAllFromVTT result', {
      count: Array.isArray(vttSubtitles) ? vttSubtitles.length : 0,
      isArray: Array.isArray(vttSubtitles)
    }, 'load_flow');
    // Return empty array if VTT loading failed (don't return null)
    return Array.isArray(vttSubtitles) ? vttSubtitles : [];
  } else {
    // Load single subtitle from VTT
    // Extract subtitleIndex from subtitleId format (mediaId-index)
    const parts = subtitleId.split('-');
    const subtitleIndex = parts.length > 1 ? parseInt(parts[parts.length - 1], 10) : null;
    debugLog('load:vtt-single', 'Extracted subtitleIndex', {
      subtitleId,
      subtitleIndex
    }, 'load_flow');
    if (subtitleIndex !== null && !isNaN(subtitleIndex)) {
      return await loadFromVTT(mediaId, subtitleIndex);
    }
    console.warn('[loadFromDB] Invalid subtitleIndex, returning null');
    return null;
  }
}

/**
 * Load from VTT
 * @param {string} mediaId - Media ID
 * @param {number} subtitleIndex - Subtitle index
 * @returns {Promise<object>} VTT data { thai, english, startSecThai, endSecThai, startSecEng, endSecEng }
 */
export async function loadFromVTT(mediaId, subtitleIndex) {
  // Ensure lookup table entry exists
  const videoElement = document.querySelector('video');
  const { extractMediaMetadata } = await import('./helpers/extract-metadata.js');
  const { saveEpisodeLookupMetadata } = await import('../05_save/helpers/save-episode-lookup.js');
  
  const metadata = extractMediaMetadata(videoElement, mediaId);
  if (metadata.showName) {
    await saveEpisodeLookupMetadata(metadata.showName, mediaId, {
      season: null,
      episode: metadata.episodeNumber,
      episodeTitle: metadata.episodeTitle
    });
  }
  
  // Import VTT functions from processing helpers (NOT from load helpers)
  const { fetchThaiVTTContent, fetchEnglishVTTContent, parseThaiVTTContent, parseEnglishVTTContent } = await import('../03_process/helpers/01_vtt/vtt.js');
  
  const thaiVTTResult = await fetchThaiVTTContent(mediaId);
  const englishVTTResult = await fetchEnglishVTTContent(mediaId);
  
  const parsedThai = thaiVTTResult?.content ? parseThaiVTTContent(thaiVTTResult.content) : [];
  const parsedEnglish = englishVTTResult?.content ? parseEnglishVTTContent(englishVTTResult.content) : [];
  
  const thaiSub = parsedThai[subtitleIndex];
  const englishSub = parsedEnglish[subtitleIndex];
  
  // Build VTT data object
  const vttData = {
    thai: thaiSub?.thai || thaiSub?.text || '',
    english: englishSub?.english || englishSub?.text || '',
    startSecThai: thaiSub?.startSecThai || null,
    endSecThai: thaiSub?.endSecThai || null,
    startSecEng: englishSub?.startSecEng || null,
    endSecEng: englishSub?.endSecEng || null
  };
  
  // Merge with fat bundle template
  const subtitleId = `${mediaId}-${subtitleIndex}`;
  const { getEmptyFatBundleTemplate } = await import('../03_process/helpers/workmap/schema-work-map-builder.js');
  const template = getEmptyFatBundleTemplate(subtitleId);
  const fatBundle = mergeData(template, vttData, subtitleId);
  
  return fatBundle;
}

/**
 * Load all subtitles from VTT
 * @param {string} mediaId - Media ID
 * @returns {Promise<array>} Array of all parsed subtitle objects
 */
export async function loadAllFromVTT(mediaId) {
  debugLog('load:loadAllFromVTT', 'Starting loadAllFromVTT', { mediaId }, 'vtt_load');
  
  // Ensure lookup table entry exists
  const videoElement = document.querySelector('video');
  const { extractMediaMetadata } = await import('./helpers/extract-metadata.js');
  const { saveEpisodeLookupMetadata } = await import('../05_save/helpers/save-episode-lookup.js');
  
  const metadata = extractMediaMetadata(videoElement, mediaId);
  debugLog('load:vtt-metadata', 'Extracted metadata for VTT', {
    showName: metadata.showName,
    episodeNumber: metadata.episodeNumber,
    episodeTitle: metadata.episodeTitle
  }, 'vtt_load');
  
  if (metadata.showName) {
    await saveEpisodeLookupMetadata(metadata.showName, mediaId, {
      season: null,
      episode: metadata.episodeNumber,
      episodeTitle: metadata.episodeTitle
    });
  }
  
  // Import VTT functions from processing helpers
  const { fetchThaiVTTContent, fetchEnglishVTTContent, parseThaiVTTContent, parseEnglishVTTContent } = await import('../03_process/helpers/01_vtt/vtt.js');
  
  const thaiVTTResult = await fetchThaiVTTContent(mediaId);
  debugLog('load:vtt-thai-result', 'Thai VTT fetch result', {
    success: !!thaiVTTResult,
    contentLength: thaiVTTResult?.content?.length || 0
  }, 'vtt_load');
  
  const englishVTTResult = await fetchEnglishVTTContent(mediaId);
  debugLog('load:vtt-english-result', 'English VTT fetch result', {
    success: !!englishVTTResult,
    contentLength: englishVTTResult?.content?.length || 0
  }, 'vtt_load');
  
  // Check if at least one VTT source was successfully fetched
  if (!thaiVTTResult && !englishVTTResult) {
    console.warn('[loadAllFromVTT] Failed to fetch both Thai and English VTT content for mediaId:', mediaId);
    debugLog('load:vtt-both-failed', 'Both VTT fetches failed', { mediaId }, 'vtt_load');
    return [];
  }
  
  const parsedThai = thaiVTTResult?.content ? parseThaiVTTContent(thaiVTTResult.content) : [];
  const parsedEnglish = englishVTTResult?.content ? parseEnglishVTTContent(englishVTTResult.content) : [];
  
  debugLog('load:vtt-parsed', 'VTT parsing results', {
    thaiCount: parsedThai.length,
    englishCount: parsedEnglish.length
  }, 'vtt_load');
  
  // If both are empty, return empty array
  if (parsedThai.length === 0 && parsedEnglish.length === 0) {
    console.warn('[loadAllFromVTT] Both Thai and English VTT parsing resulted in empty arrays');
    return [];
  }
  
  // Import template and merge functions
  const { getEmptyFatBundleTemplate } = await import('../03_process/helpers/workmap/schema-work-map-builder.js');
  
  // Merge parsed Thai and English arrays (by index) into combined subtitle objects with fat bundle structure
  const maxLength = Math.max(parsedThai.length, parsedEnglish.length);
  const allSubtitles = [];
  
  for (let i = 0; i < maxLength; i++) {
    const thaiSub = parsedThai[i];
    const englishSub = parsedEnglish[i];
    
    // Build VTT data object
    const vttData = {
      thai: thaiSub?.thai || thaiSub?.text || '',
      english: englishSub?.english || englishSub?.text || '',
      startSecThai: thaiSub?.startSecThai || null,
      endSecThai: thaiSub?.endSecThai || null,
      startSecEng: englishSub?.startSecEng || null,
      endSecEng: englishSub?.endSecEng || null
    };
    
    // Generate subtitleId and merge with template
    const subtitleId = `${mediaId}-${i}`;
    const template = getEmptyFatBundleTemplate(subtitleId);
    const fatBundle = mergeData(template, vttData, subtitleId);
    
    allSubtitles.push(fatBundle);
  }
  
  debugLog('load:vtt-success', 'Built fat bundles from VTT', {
    count: allSubtitles.length
  }, 'vtt_load');
  return allSubtitles;
}

/**
 * Merge data with template
 * @param {object} template - Empty fat bundle template
 * @param {object} data - Data to merge (from DB or VTT)
 * @param {string} subtitleId - Optional subtitle ID to set
 * @returns {object} Merged fat bundle
 */
export function mergeData(template, data, subtitleId = null) {
  // Inline validation: validate data fields are non-null before merging
  if (data.startSecThai === null || data.startSecThai === undefined) {
    throw new Error('mergeData: startSecThai is required, cannot be null or undefined');
  }
  if (data.endSecThai === null || data.endSecThai === undefined) {
    throw new Error('mergeData: endSecThai is required, cannot be null or undefined');
  }
  if (data.startSecEng === null || data.startSecEng === undefined) {
    throw new Error('mergeData: startSecEng is required, cannot be null or undefined');
  }
  if (data.endSecEng === null || data.endSecEng === undefined) {
    throw new Error('mergeData: endSecEng is required, cannot be null or undefined');
  }
  if ((data.thai === null || data.thai === undefined || data.thai.trim() === '') && 
      (data.english === null || data.english === undefined || data.english.trim() === '')) {
    throw new Error('mergeData: at least one of thai or english must be non-empty string');
  }
  
  // Merge template with data
  const merged = {
    ...template,
    ...data,
    tokens: data.tokens || template.tokens,
    id: subtitleId || data.id || template.id,
    // Preserve word data if loaded from DB
    thaiWords: data.thaiWords,
    engWords: data.engWords
  };
  
  // Ensure tokens structure exists with all required arrays
  if (!merged.tokens) {
    merged.tokens = {
      displayThai: [],
      sensesThai: [],
      displayEnglish: [],
      sensesEnglish: []
    };
  } else {
    // Ensure all arrays exist (not null/undefined)
    if (!Array.isArray(merged.tokens.displayThai)) {
      merged.tokens.displayThai = [];
    }
    if (!Array.isArray(merged.tokens.sensesThai)) {
      merged.tokens.sensesThai = [];
    }
    if (!Array.isArray(merged.tokens.displayEnglish)) {
      merged.tokens.displayEnglish = [];
    }
    if (!Array.isArray(merged.tokens.sensesEnglish)) {
      merged.tokens.sensesEnglish = [];
    }
  }
  
  return merged;
}

/**
 * Handle load subtitles - ensures upload panel has its data present
 * Extracts metadata from DOM and lookup table, only season requires human input
 * @returns {Promise<object>} Metadata object { mediaId, showName, episodeNumber, episodeTitle, duration, season }
 */
export async function handleLoadSubtitles() {
  const { getMediaIdFromUrl } = await import('./helpers/extract-metadata.js');
  
  // Inline validation: mediaId must exist
  const mediaId = getMediaIdFromUrl();
  if (!mediaId) {
    throw new Error('handleLoadSubtitles: No mediaId found in URL');
  }
  
  const videoElement = document.querySelector('video');
  
  // Check lookup table first (priority)
  const lookupMetadata = await getEpisodeMetadataFromMediaId(mediaId);
  
  // Extract from DOM
  const { extractMediaMetadata } = await import('./helpers/extract-metadata.js');
  const extractedMetadata = extractMediaMetadata(videoElement, mediaId);
  
  // Merge lookup table (priority) with extracted metadata (fallback)
  const result = {
    mediaId,
    showName: lookupMetadata?.showName || extractedMetadata.showName || null,
    episodeNumber: lookupMetadata?.episode !== null && lookupMetadata?.episode !== undefined 
      ? lookupMetadata.episode 
      : (extractedMetadata.episodeNumber !== null && extractedMetadata.episodeNumber !== undefined 
          ? extractedMetadata.episodeNumber 
          : null),
    episodeTitle: lookupMetadata?.episodeTitle || extractedMetadata.episodeTitle || null,
    duration: extractedMetadata.duration || null,
    season: lookupMetadata?.season !== null && lookupMetadata?.season !== undefined ? lookupMetadata.season : null
  };
  
  return result;
}

/**
 * Handle process subtitles - tries loadFromDB first, falls back to loadAllFromVTT
 * @param {string} mediaId - Media ID
 * @param {number} season - Season number (required, not null)
 * @param {number} episodeNumber - Episode number (required, not null)
 * @param {string} episodeTitle - Episode title (required, not null)
 * @param {string} showName - Show name (required, not null)
 * @returns {Promise<array>} Array of fat bundles
 */
export async function handleProcessSubtitles(mediaId, season, episodeNumber, episodeTitle, showName) {
  // Inline validation: all parameters must be non-null
  if (!mediaId || mediaId.trim() === '') {
    throw new Error('handleProcessSubtitles: mediaId is required, cannot be null or empty');
  }
  if (season === null || season === undefined) {
    throw new Error('handleProcessSubtitles: season is required, cannot be null or undefined');
  }
  if (episodeNumber === null || episodeNumber === undefined) {
    throw new Error('handleProcessSubtitles: episodeNumber is required, cannot be null or undefined');
  }
  if (episodeTitle === null || episodeTitle === undefined || episodeTitle.trim() === '') {
    throw new Error('handleProcessSubtitles: episodeTitle is required, cannot be null or empty');
  }
  if (!showName || showName.trim() === '') {
    throw new Error('handleProcessSubtitles: showName is required, cannot be null or empty');
  }
  
  // First try loadFromDB
  let fatBundles = await loadFromDB(mediaId);
  
  // If DB returns null or empty array, fall back to VTT
  if (!fatBundles || (Array.isArray(fatBundles) && fatBundles.length === 0)) {
    fatBundles = await loadAllFromVTT(mediaId);
  }
  
  // Validate we got subtitles
  if (!fatBundles || (Array.isArray(fatBundles) && fatBundles.length === 0)) {
    throw new Error(`handleProcessSubtitles: No subtitles found in DB or VTT for mediaId: ${mediaId}`);
  }
  
  // Save to lookup table
  const { saveEpisodeLookupMetadata } = await import('../05_save/helpers/save-episode-lookup.js');
  await saveEpisodeLookupMetadata(showName, mediaId, {
    season,
    episode: episodeNumber,
    episodeTitle
  });
  
  return fatBundles;
}


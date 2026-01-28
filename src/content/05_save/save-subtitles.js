/**
 * Save Subtitles - Pure Firestore Writer
 * 
 * ONLY responsibility: accept FAT bundle + schemaWorkMap and perform Firestore writes.
 * Writes keys where schemaWorkMap[key] === true from fat bundle.
 * Zero reads for decision-making, zero parsing, zero validation, zero business logic.
 */

import { db } from '../utils/firebaseConfig.js';
import { doc, setDoc, serverTimestamp, getDocFromServer, writeBatch, deleteField, deleteDoc } from 'firebase/firestore';
import { sensesNeedsWork, buildSensesForSave } from '../03_process/helpers/workmap/schema-work-map-builder.js';
import { FIELD_REGISTRY } from './helpers/field-registry.js';

/**
 * Check if show document exists
 */
async function checkShowExistsSave(showName) {
  if (!showName) return false;
  const showRef = doc(db, 'shows', showName);
  const showDoc = await getDocFromServer(showRef);
  return showDoc.exists();
}

/**
 * Save episode metadata
 * @param {string} showName - Show name
 * @param {string} mediaId - Media ID
 * @param {object} episodeData - Episode data
 */
export async function saveEpisodeSave(showName, mediaId, episodeData) {
  if (!showName || !mediaId) return;
  
  if (!(await checkShowExistsSave(showName))) {
    const showRef = doc(db, 'shows', showName);
    await setDoc(showRef, {
      name: showName,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
  
  const episodeRef = doc(db, 'shows', showName, 'episodes', mediaId);
  await setDoc(episodeRef, {
    showName,
    mediaId,
    ...episodeData,
    updatedAt: serverTimestamp()
  }, { merge: true });
  
  // Save to episodeLookup for mediaId -> showName lookup (with full metadata)
  // Always update with latest metadata from episodeData
  const lookupRef = doc(db, 'episodeLookup', mediaId);
  const lookupData = { showName, mediaId };
  // Include season/episode/episodeTitle if they exist in episodeData (including null values)
  if (episodeData.season !== undefined) {
    lookupData.season = episodeData.season;
  }
  if (episodeData.episode !== undefined) {
    lookupData.episode = episodeData.episode;
  }
  if (episodeData.episodeTitle !== undefined) {
    lookupData.episodeTitle = episodeData.episodeTitle;
  }
  await setDoc(lookupRef, lookupData, { merge: true });
}

/**
 * Ensure episodeLookup table exists for mediaId -> showName mapping
 * Only creates entry if it doesn't exist - does NOT update existing entries
 * For updates with metadata, use saveEpisodeSave instead
 * @param {string} showName - Show name
 * @param {string} mediaId - Media ID
 */
export async function ensureEpisodeLookupSave(showName, mediaId) {
  if (!showName || !mediaId) return;
  
  // Single read operation: check if lookup entry exists
  const lookupRef = doc(db, 'episodeLookup', mediaId);
  const lookupDoc = await getDocFromServer(lookupRef);
  
  // If it exists, don't overwrite - preserve any existing metadata
  if (lookupDoc.exists()) {
    return; // Already exists - don't overwrite
  }
  
  // Only create if it doesn't exist (no metadata - just basic mapping)
  await setDoc(lookupRef, { showName, mediaId }, { merge: true });
}

/**
 * Update episodeLookup entry with metadata if missing
 * Checks if entry exists and updates it with season/episode/episodeTitle if they're missing
 * @param {string} showName - Show name
 * @param {string} mediaId - Media ID
 * @param {object} episodeData - Episode data with season, episode, episodeTitle
 */
export async function updateEpisodeLookupMetadata(showName, mediaId, episodeData) {
  if (!showName || !mediaId) return;
  
  const lookupRef = doc(db, 'episodeLookup', mediaId);
  const lookupData = { showName, mediaId };
  
  // Always update with provided metadata (even if null - explicitly set it)
  if (episodeData.season !== undefined) {
    lookupData.season = episodeData.season;
  }
  if (episodeData.episode !== undefined) {
    lookupData.episode = episodeData.episode;
  }
  if (episodeData.episodeTitle !== undefined) {
    lookupData.episodeTitle = episodeData.episodeTitle;
  }
  
  // Always update - merge ensures we don't overwrite other fields
  await setDoc(lookupRef, lookupData, { merge: true });
}

/**
 * Save fat subtitle - Pure Firestore writer using schemaWorkMap signals
 * Writes keys where schemaWorkMap[key] === true from fat bundle
 * Builds write-ready arrays from schemaWorkMap signals and fat bundle data
 * Save never performs processing work - process layer handles all work
 * @param {object} fatSubtitle - Fat subtitle with subtitle, tokens
 * @param {object} schemaWorkMap - Schema work map (key-aligned boolean mask)
 * @param {object} options - Options { showName, mediaId }
 * @returns {Promise<void>}
 */
export async function saveFatSubtitle(fatSubtitle, schemaWorkMap, options, wasLoadedFromFirebase = false, helpersCalled = {}) {
  const { showName, mediaId } = options;
  const subtitleId = fatSubtitle.subtitle.id;
  
  // If schemaWorkMap not provided, get from cache
  const { getCachedSubtitle } = await import('../05_cache/cache-subtitles.js');
  const cachedBeforeSave = getCachedSubtitle(subtitleId);
  if (!schemaWorkMap) {
    const cachedFatBundle = cachedBeforeSave;
    if (cachedFatBundle && cachedFatBundle.schemaWorkMap) {
      schemaWorkMap = cachedFatBundle.schemaWorkMap;
      // Use cached fat bundle if provided
      if (cachedFatBundle.subtitle && cachedFatBundle.tokens) {
        fatSubtitle = {
          subtitle: cachedFatBundle.subtitle,
          tokens: cachedFatBundle.tokens,
          smartSubsRefsWrites: cachedFatBundle.smartSubsRefsWrites || null
        };
      }
    } else {
      return;
    }
  }
  
  // Helper function to map collection identifier to Firestore collection name
  const getFirestoreCollectionName = (collectionName) => {
    const mapping = {
      'wordsThai': 'words',
      'wordsEng': 'wordsEng',
      'failedWords': 'failedWords',
      'failedWordsEng': 'failedWordsEng'
    };
    return mapping[collectionName] || collectionName;
  };
  
  // Extract subtitleIndex from subtitleId (format: mediaId-index)
  const resultSubtitleId = fatSubtitle.subtitle?.id || fatSubtitle.id;
  const parts = resultSubtitleId.split('-');
  const subtitleIndex = parts.length > 1 ? parts[parts.length - 1] : null;
  const correctPrefix = subtitleIndex ? `${mediaId}-${subtitleIndex}-` : null;
  
  // Build write-ready arrays from schemaWorkMap signals and fat bundle data
  const wordWritesThai = [];
  const wordWritesEng = [];
  
  // Track which helpers saved data (helper-centric tracking)
  // Track separately for Thai and English arrays to know which paths to generate
  // After all saves complete, we'll convert helpers to field paths using FIELD_REGISTRY
  const savedHelpersSet = new Set();
  const savedHelpersThaiSet = new Set(); // Helpers that saved to Thai arrays
  const savedHelpersEngSet = new Set(); // Helpers that saved to English arrays
  
  // Get pre-built smartSubsRefs write arrays from process phase (if available)
  // Process phase builds these arrays - save phase only writes them
  const processSmartSubsRefsWrites = fatSubtitle.smartSubsRefsWrites || null;
  const smartSubsRefsWritesThai = processSmartSubsRefsWrites?.thai || [];
  const smartSubsRefsWritesEng = processSmartSubsRefsWrites?.eng || [];
  
  // Check if any save should happen BEFORE building word writes
  // If workmap is all false AND needsSave is false, NO saves should happen
  const needsSave = schemaWorkMap?.needsSave === true;
  const { checkWorkmapHasTrueValues } = await import('../05_cache/cache-subtitles.js');
  const hasWorkToSave = checkWorkmapHasTrueValues(schemaWorkMap);
  const shouldSave = needsSave || hasWorkToSave;
  
  // EARLY RETURN: If no save should happen, don't proceed
  // This naturally handles the "all false" case - if schema maker says everything is OK, nothing happens
  if (!shouldSave) {
    // No save should happen - don't run any save logic
    // Don't call __reportSave, don't build report, just return
    return;
  }
  
  // Build wordWritesThai from schemaWorkMap.tokens.displayThai signals
  // CRITICAL: Validate array lengths match and word IDs exist before writing
  // Token-level save needs concrete destination (word doc ID) - don't write without it
  // Only build word writes if shouldSave is true
  if (shouldSave && fatSubtitle.tokens && fatSubtitle.tokens.displayThai && fatSubtitle.tokens.sensesThai) {
    const displayTokens = fatSubtitle.tokens.displayThai;
    const senseTokens = fatSubtitle.tokens.sensesThai;
    const wordReferenceIdsThai = fatSubtitle.subtitle.wordReferenceIdsThai || [];
    
    // Validate lengths match - prevent corruption from index mismatches
    if (wordReferenceIdsThai.length !== displayTokens.length) {
      // Skip token writes if lengths don't match (better than corruption)
    } else {
      for (let i = 0; i < displayTokens.length; i++) {
        // CRITICAL: Validate word ID exists before writing token data
        // Skip writes where word ID is missing (better than corruption)
        if (!wordReferenceIdsThai[i]) {
          continue;
        }
        
        const displayToken = displayTokens[i];
        const senseToken = senseTokens[i];
        const workMap = schemaWorkMap.tokens.displayThai[i];
        
        if (!workMap || (!workMap.g2p && !workMap.englishPhonetic)) {
          // Check senses signal
          const senseWorkMap = schemaWorkMap.tokens.sensesThai[i];
          const needsWork = senseWorkMap && sensesNeedsWork(senseWorkMap);
          if (senseWorkMap && (needsWork || needsSave) && senseToken?.senses) {
            const thaiScript = displayToken.thaiScript?.split(',')[0]?.trim();
            if (thaiScript) {
              // Collection name - default to wordsThai
              let collectionName = 'wordsThai';
              
              // If needsSave is true, save all senses regardless of workmap
              // Otherwise, use buildSensesForSave to filter based on workmap
              const sensesToSave = needsSave 
                ? senseToken.senses || []
                : buildSensesForSave(senseWorkMap, senseToken.senses || []);
              if (sensesToSave && sensesToSave.length > 0) {
                const data = { senses: sensesToSave };
                wordWritesThai.push({
                  collectionName: getFirestoreCollectionName(collectionName),
                  wordId: thaiScript,
                  tokenIndex: i, // Store token index for field tracking
                  data
                });
              }
            }
          }
          continue;
        }
        
        const thaiScript = displayToken.thaiScript?.split(',')[0]?.trim();
        if (!thaiScript) {
          // Skip if no thaiScript (can't write without word ID)
          continue;
        }
        
        // Collection name - default to wordsThai
        let collectionName = 'wordsThai';
        
        // Extract data object from token based on schemaWorkMap signals
        // needsSave is already declared at the top of the function (line 188)
        const data = {};
        // If needsSave is true, save fields regardless of workmap
        // Otherwise, only save if workmap indicates work was done
        if ((workMap.g2p || needsSave) && displayToken.g2p) {
          data.g2p = displayToken.g2p;
        }
        if ((workMap.englishPhonetic || needsSave) && displayToken.englishPhonetic) {
          data.englishPhonetic = displayToken.englishPhonetic;
        }
        if (senseToken?.senses && Array.isArray(senseToken.senses) && senseToken.senses.length > 0) {
          const senseWorkMap = schemaWorkMap.tokens.sensesThai[i];
          const needsWork = senseWorkMap && sensesNeedsWork(senseWorkMap);
          if (senseWorkMap && (needsWork || needsSave)) {
            // If needsSave is true, save all senses regardless of workmap
            // Otherwise, use buildSensesForSave to filter based on workmap
            const sensesToSave = needsSave 
              ? senseToken.senses
              : buildSensesForSave(senseWorkMap, senseToken.senses);
            if (sensesToSave && sensesToSave.length > 0) {
              data.senses = sensesToSave;
            }
          }
        }
        
        if (Object.keys(data).length > 0) {
          wordWritesThai.push({
            collectionName: getFirestoreCollectionName(collectionName),
            wordId: thaiScript,
            tokenIndex: i, // Store token index for field tracking
            data
          });
        }
      }
    }
  }
  
  // Build wordWritesEng from schemaWorkMap.tokens.displayEnglish and sensesEnglish signals
  // CRITICAL: Validate array lengths match and word IDs exist before writing
  // Only build word writes if shouldSave is true
  if (shouldSave && fatSubtitle.tokens && fatSubtitle.tokens.displayEnglish && fatSubtitle.tokens.sensesEnglish) {
    const displayEngTokens = fatSubtitle.tokens.displayEnglish;
    const sensesEngTokens = fatSubtitle.tokens.sensesEnglish;
    const wordReferenceIdsEng = fatSubtitle.subtitle.wordReferenceIdsEng || [];
    
    // Validate lengths match - prevent corruption from index mismatches
    if (wordReferenceIdsEng.length !== displayEngTokens.length) {
      // Skip token writes if lengths don't match (better than corruption)
    } else {
      for (let i = 0; i < displayEngTokens.length; i++) {
        // CRITICAL: Validate word ID exists before writing token data
        // Skip writes where word ID is missing (better than corruption)
        if (!wordReferenceIdsEng[i]) {
          continue;
        }
        
        const displayEngToken = displayEngTokens[i];
        const senseEngToken = sensesEngTokens[i];
        const senseWorkMap = schemaWorkMap.tokens.sensesEnglish[i];
        
        const needsWork = senseWorkMap && sensesNeedsWork(senseWorkMap);
        if (!senseWorkMap || (!needsWork && !needsSave) || !senseEngToken?.senses) continue;
        
        const engWord = displayEngToken.englishWord?.toLowerCase();
        if (!engWord) continue;
        
        // Load word to determine collection
        // Collection name - default to wordsEng
        let collectionName = 'wordsEng';
        
        // If needsSave is true, save all senses regardless of workmap
        // Otherwise, use buildSensesForSave to filter based on workmap
        const sensesToSave = needsSave 
          ? senseEngToken.senses || []
          : buildSensesForSave(senseWorkMap, senseEngToken.senses || []);
        if (sensesToSave && sensesToSave.length > 0) {
          const data = { senses: sensesToSave };
          wordWritesEng.push({
            collectionName: getFirestoreCollectionName(collectionName),
            wordId: engWord,
            tokenIndex: i, // Store token index for field tracking
            data
          });
        }
      }
    }
  }
  
  // smartSubsRefs write arrays are built in process phase and attached to fatSubtitle.smartSubsRefsWrites
  // Save phase only uses pre-built arrays - no processing logic here
  // If arrays are not provided (backward compatibility), they will be empty and no writes will occur
  
  // (a) Ensure show doc exists
  if (!(await checkShowExistsSave(showName))) {
    const showRef = doc(db, 'shows', showName);
    await setDoc(showRef, { name: showName, updatedAt: serverTimestamp() }, { merge: true });
  }
  
  // (b) Save subtitle doc - save if needsSave flag is true OR workmap indicates work was done
  // shouldSave was already calculated above before word writes
  const subtitle = fatSubtitle.subtitle || fatSubtitle;
  
  if (subtitle && subtitle.id && shouldSave) {
    const subRef = doc(db, 'shows', showName, 'episodes', mediaId, 'subs', subtitleId);
    
    // Save fields that exist in fat bundle (only if work was done)
    const subtitleData = {
      id: subtitleId,
      ...(subtitle.startSecThai !== undefined && { startSecThai: subtitle.startSecThai }),
      ...(subtitle.endSecThai !== undefined && { endSecThai: subtitle.endSecThai }),
      ...(subtitle.startSecEng !== undefined && { startSecEng: subtitle.startSecEng }),
      ...(subtitle.endSecEng !== undefined && { endSecEng: subtitle.endSecEng }),
      ...(subtitle.thai !== undefined && { thai: subtitle.thai }),
      ...(subtitle.english !== undefined && { english: subtitle.english }),
      ...(subtitle.wordReferenceIdsThai !== undefined && { wordReferenceIdsThai: subtitle.wordReferenceIdsThai || [] }),
      ...(subtitle.wordReferenceIdsEng !== undefined && { wordReferenceIdsEng: subtitle.wordReferenceIdsEng || [] }),
      ...(subtitle.smartSubsRefs !== undefined && { smartSubsRefs: subtitle.smartSubsRefs || [] }),
      ...(subtitle.matchedWords !== undefined && { matchedWords: subtitle.matchedWords || [] }),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(subRef, subtitleData, { merge: true });
    
    // Clear needsSave flag after successful save
    if (schemaWorkMap) {
      schemaWorkMap.needsSave = false;
    }
    
    // Update cache with cleared needsSave flag
    const { getCachedSubtitle } = await import('../05_cache/cache-subtitles.js');
    const cachedSubtitle = getCachedSubtitle(subtitleId);
    if (cachedSubtitle && cachedSubtitle.schemaWorkMap) {
      cachedSubtitle.schemaWorkMap.needsSave = false;
      const { cacheFatSubtitleSilent } = await import('../05_cache/cache-subtitles.js');
      cacheFatSubtitleSilent(subtitleId, cachedSubtitle);
    }
    
    // Mark helpers that contributed to saved subtitle data (helper-centric tracking)
    // Firebase confirmed the write succeeded, so identify helpers from saved fields
    const helperMap = {
      'thai': 'parse-vtt.js',
      'english': 'parse-vtt.js',
      'startSecThai': 'parse-vtt.js',
      'endSecThai': 'parse-vtt.js',
      'startSecEng': 'parse-vtt.js',
      'endSecEng': 'parse-vtt.js',
      'wordReferenceIdsThai': 'ai4thai-tokenizer.js',
      'wordReferenceIdsEng': 'english-tokenizer.js',
      'smartSubsRefs': 'smartsubsrefs-builder.js',
      'matchedWords': 'gpt-match-words.js'
    };
    
    const helpersForSubtitle = new Set();
    for (const [fieldPath, helperName] of Object.entries(helperMap)) {
      if (subtitleData[fieldPath] !== undefined && helperName) {
        helpersForSubtitle.add(helperName);
      }
    }
    
    // Add all helpers that contributed to saved subtitle data
    helpersForSubtitle.forEach(helper => savedHelpersSet.add(helper));
    
    // Report building moved to after all saves complete (see end of function)
  } else if (subtitle && subtitle.id && !shouldSave) {
  }
  
  // (c) Batch write smartSubsRefs for Thai words
  if (smartSubsRefsWritesThai.length > 0) {
    try {
      const batch = writeBatch(db);
      for (const write of smartSubsRefsWritesThai) {
        const wordRef = doc(db, write.collectionName, write.wordId);
        batch.set(wordRef, {
          smartSubsRefs: write.smartSubsRefs,
          smartsubsRefs: deleteField(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      await batch.commit();
      // Batch write succeeded - smartSubsRefs fields are saved (but we can't track individual fields from batch)
    } catch (error) {
      console.error('Failed to save smartSubsRefs batch for Thai words:', error);
      // Don't mark fields as saved if batch write failed
    }
  }
  
  // (d) Batch write smartSubsRefs for English words
  if (smartSubsRefsWritesEng.length > 0) {
    try {
      const batch = writeBatch(db);
      for (const write of smartSubsRefsWritesEng) {
        const wordRef = doc(db, write.collectionName, write.wordId);
        batch.set(wordRef, {
          smartSubsRefs: write.smartSubsRefs,
          smartsubsRefs: deleteField(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      await batch.commit();
      // Batch write succeeded - smartSubsRefs fields are saved (but we can't track individual fields from batch)
    } catch (error) {
      console.error('Failed to save smartSubsRefs batch for English words:', error);
      // Don't mark fields as saved if batch write failed
    }
  }
  
  // (e) Write word docs for Thai words
  if (wordWritesThai.length > 0) {
    for (const write of wordWritesThai) {
      try {
        const wordRef = doc(db, write.collectionName, write.wordId);
        await setDoc(wordRef, {
          ...write.data,
          thaiScript: write.wordId,
          updatedAt: serverTimestamp()
        }, { merge: true });
        
        // Mark helpers as saved ONLY after successful Firebase write
        // Identify helpers from the saved data itself
        if (write.data.g2p) {
          savedHelpersSet.add('ai4thai-g2p.js');
          savedHelpersThaiSet.add('ai4thai-g2p.js');
        }
        if (write.data.englishPhonetic) {
          savedHelpersSet.add('phonetic-parser.js');
          savedHelpersThaiSet.add('phonetic-parser.js');
        }
        if (write.data.senses && Array.isArray(write.data.senses)) {
          // Check if any sense is normalized to determine helper
          const hasNormalizedSenses = write.data.senses.some(sense => sense?.normalized === true);
          // Also check for normalized fields as fallback (posEnglish, meaningThai, etc. indicate normalization)
          const hasNormalizedFields = write.data.senses.some(sense => 
            sense?.posEnglish !== undefined || 
            sense?.meaningThai !== undefined || 
            sense?.meaningEnglish !== undefined ||
            sense?.descriptionEnglish !== undefined
          );
          if (hasNormalizedSenses || hasNormalizedFields) {
            savedHelpersSet.add('gpt-normalize-senses.js');
            savedHelpersThaiSet.add('gpt-normalize-senses.js');
          } else {
            savedHelpersSet.add('orst.js');
            savedHelpersThaiSet.add('orst.js');
          }
        }
      } catch (error) {
        console.error(`Failed to save Thai word ${write.wordId}:`, error);
        // Don't mark fields as saved if write failed
      }
    }
  }
  
  // (f) Write word docs for English words
  if (wordWritesEng.length > 0) {
    for (const write of wordWritesEng) {
      try {
        const wordRef = doc(db, write.collectionName, write.wordId.toLowerCase());
        await setDoc(wordRef, {
          ...write.data,
          word: write.wordId.toLowerCase(),
          updatedAt: serverTimestamp()
        }, { merge: true });
        
        // Mark helpers as saved ONLY after successful Firebase write
        // Identify helpers from the saved data itself
        if (write.data.senses && Array.isArray(write.data.senses)) {
          // Check if any sense is normalized to determine helper
          const hasNormalizedSenses = write.data.senses.some(sense => sense?.normalized === true);
          // Also check for normalized fields as fallback (posEnglish, meaningThai, etc. indicate normalization)
          const hasNormalizedFields = write.data.senses.some(sense => 
            sense?.posEnglish !== undefined || 
            sense?.meaningThai !== undefined || 
            sense?.meaningEnglish !== undefined ||
            sense?.descriptionEnglish !== undefined
          );
          if (hasNormalizedSenses || hasNormalizedFields) {
            savedHelpersSet.add('gpt-normalize-senses.js');
            savedHelpersEngSet.add('gpt-normalize-senses.js');
          } else {
            savedHelpersSet.add('orst.js');
            savedHelpersEngSet.add('orst.js');
          }
        }
      } catch (error) {
        console.error(`Failed to save English word ${write.wordId}:`, error);
        // Don't mark fields as saved if write failed
      }
    }
  }
  
  // Convert saved helpers to field paths using helper-sorted registry
  // Helper-centric approach: we tracked which helpers saved data, now derive field paths
  const { getFieldRegistryByHelper } = await import('./helpers/field-registry.js');
  const savedFields = [];
  
  let registryByHelper;
  try {
    registryByHelper = getFieldRegistryByHelper();
  } catch (error) {
    throw error;
  }
  
  for (const helperName of savedHelpersSet) {
    // Collect all fieldDefs for this helper from helper-sorted registry
    const helperFieldDefs = [];
    Object.values(registryByHelper).forEach(helperGroups => {
      const fields = helperGroups.helpers[helperName] || [];
      helperFieldDefs.push(...fields);
    });
    
    // Convert each fieldDef.field to template paths
    for (const fieldDef of helperFieldDefs) {
      const field = fieldDef?.field;
      if (!field || typeof field !== 'string') continue;
      
      // If field already contains template path structure, use it directly
      if (field.includes('tokens.')) {
        // Token-level field with full template path (e.g., 'tokens.displayThai[i].g2p')
        savedFields.push(field);
      } else {
        // Field name only - construct paths based on which arrays this helper saved to
        // For sense-level fields, check which arrays were saved
        const pathsAdded = [];
        const isInThaiSet = savedHelpersThaiSet.has(helperName);
        const isInEngSet = savedHelpersEngSet.has(helperName);
        if (isInThaiSet) {
          const path = `tokens.sensesThai[i].senses[i].${field}`;
          savedFields.push(path);
          pathsAdded.push(path);
        }
        if (isInEngSet) {
          const path = `tokens.sensesEnglish[i].senses[i].${field}`;
          savedFields.push(path);
          pathsAdded.push(path);
        }
        // Also check top-level path (for top-level fields)
        savedFields.push(field);
      }
    }
  }
  
  
  // Report all saved fields to content.js BEFORE building report
  // This updates the tracking object so the report reads accurate save status
  // Firebase confirmed these helpers saved data, so we update tracking accordingly
  if (typeof window !== 'undefined' && window.__reportSave && subtitleId) {
    
    // Report each saved field
    for (const fieldPath of savedFields) {
      if (window.__reportDataStatus) {
        window.__reportDataStatus(subtitleId, fieldPath, 'clean');
      }
    }
    
    // Update tracking object with saved fields - this happens BEFORE report building
    window.__reportSave(subtitleId, savedFields);
  }
  
  // NOW build report with updated tracking - AFTER all saves complete and tracking is updated
  // This ensures the report reflects the actual saved state
  if (subtitle && subtitle.id) {
    const { buildReportObject } = await import('../utils/build-report-object.js');
    const tracking = typeof window !== 'undefined' && window.__getSubtitleTracking 
      ? window.__getSubtitleTracking(subtitleId) 
      : null;
    const report = buildReportObject(subtitleId, schemaWorkMap, fatSubtitle, tracking, wasLoadedFromFirebase, helpersCalled);
    
    // Set report in content.js
    if (typeof window !== 'undefined' && window.__setSubtitleReport) {
      window.__setSubtitleReport(subtitleId, report);
    }
    
    // Log formatted JSON
    console.log('[REPORT]', report.table);
    console.log('[REPORT RAW]', JSON.stringify(report.raw, null, 2));
  }
  
  // Save complete - no callbacks, no reporting
  // Callers handle save success themselves if needed
}

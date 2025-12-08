import { AIRTABLE_CONFIG, getTableName, setTableName } from './airtable.js';

/**
 * Get ThaiWords base ID - uses same base as SmartSubs by default
 * Can be overridden via localStorage if ThaiWords is in a different base
 */
function getThaiWordsBaseId() {
  // First check localStorage for override
  const stored = localStorage.getItem('smartSubs_thaiWordsBaseId');
  if (stored) return stored;
  
  // Default to same base as SmartSubs (most common case)
  return AIRTABLE_CONFIG.baseId;
}
import { SUBTITLE_STAGE } from '../content/subtitle.js';
import { getSubtitleCache, setSubtitleCache, updateLoadingProgress, getLoadingProgress } from '../content/subtitleCache.js';

let currentMediaId = null;
let isReloading = false;
let saveQueue = new Set();
let saveTimeout = null;
const SAVE_DEBOUNCE_MS = 1000;
let cachedTableSchema = null; // Cache table schema (available fields)

function deriveProcessingStage(fields) {
  // Field-based stage detection:
  // - thaiSplitIds present → DONE (Stage 3 finished)
  // - thaiSplit present but no thaiSplitIds → Stage 3
  // - thai present but no thaiSplit → Stage 2
  // - else → Stage 1
  
  const hasThaiSplitIds = fields.thaiSplitIds && (
    (Array.isArray(fields.thaiSplitIds) && fields.thaiSplitIds.length > 0) ||
    (typeof fields.thaiSplitIds === 'string' && fields.thaiSplitIds.trim() !== '' && fields.thaiSplitIds !== '[]')
  );
  
  const hasThaiSplit = fields.thaiSplit && String(fields.thaiSplit).trim() !== '';
  const hasThai = fields.thai && String(fields.thai).trim() !== '';
  
  if (hasThaiSplitIds) {
    // Stage 3 complete - this row is done
    return SUBTITLE_STAGE.SPLIT_CONFIRMED;
  } else if (hasThaiSplit) {
    // Stage 3: thaiSplit exists but no thaiSplitIds yet
    return SUBTITLE_STAGE.SPLIT_CONFIRMED;
  } else if (hasThai) {
    // Stage 2: thai exists but no thaiSplit yet
    return SUBTITLE_STAGE.SCRIPT_CONFIRMED;
  } else {
    // Stage 1: no thai field yet
    return SUBTITLE_STAGE.RAW_IMPORTED;
  }
}

function processRecordToSubtitle(record) {
  const fields = record.fields || {};
  const startSecStr = fields.startSec || '';
  const endSecStr = fields.endSec || '';
  const startTime = startSecStr ? parseFloat(startSecStr) : null;
  const endTime = endSecStr ? parseFloat(endSecStr) : null;
  
  if (startTime === null || isNaN(startTime) || !fields.thai) {
    return null;
  }
  
  // Compute stage from fields (field-based detection)
  const processingStage = deriveProcessingStage(fields);
  
  const subtitle = {
    recordId: record.id,
    processingStage,
    thai: fields.thai || '',
    startSec: startSecStr,
    endSec: endSecStr,
    subIndex: fields.subIndex || '',
    mediaId: fields.mediaId || '',
    thaiScriptReview: fields.thaiScriptReview || false,
    processed: fields.processed || false,
    fullReview: fields.fullReview || false,
    Edited: fields.Edited || false,
    thaiSplit: fields.thaiSplit || null,
    thaiSplitIds: fields.thaiSplitIds || null,
    startTime,
    endTime,
    range: `${startSecStr} --> ${endSecStr}`,
    reviewed: false,
    phoneticWordIds: null,
    phoneticWordMap: null
  };
  
  if (subtitle.thaiSplitIds) {
    try {
      const wordIdsArray = typeof subtitle.thaiSplitIds === 'string' ? JSON.parse(subtitle.thaiSplitIds) : subtitle.thaiSplitIds;
      if (Array.isArray(wordIdsArray)) {
        subtitle.phoneticWordIds = wordIdsArray;
      }
    } catch {}
  }
  
  return subtitle;
}

function inspectNetflixMetadata(videoElement = null) {
  const metadata = { videoId: null, title: null, season: null, episode: null, duration: null };
  const urlMatch = window.location.pathname.match(/\/watch\/(\d+)/);
  if (urlMatch) metadata.videoId = urlMatch[1];
  if (videoElement) {
    metadata.duration = videoElement.duration || null;
  }
  try {
    const appContext = window.netflix?.appContext;
    if (appContext?.state?.playerApp) {
      const getAPI = appContext.state.playerApp.getAPI;
      if (getAPI) {
        const videoPlayerAPI = getAPI().videoPlayer;
        if (videoPlayerAPI) {
          const sessionIds = videoPlayerAPI.getAllPlayerSessionIds?.();
          if (sessionIds?.length > 0) {
            const player = videoPlayerAPI.getVideoPlayerBySessionId(sessionIds[0]);
            if (player?.getState) {
              const state = player.getState();
              if (state) {
                if (state.videoId) metadata.videoId = metadata.videoId || state.videoId;
                if (state.titleId) metadata.titleId = state.titleId;
                if (state.episodeId) metadata.episodeId = state.episodeId;
                if (state.season !== undefined) metadata.season = state.season;
                if (state.episode !== undefined) metadata.episode = state.episode;
                if (state.duration !== undefined) metadata.duration = metadata.duration || state.duration;
              }
            }
          }
        }
      }
    }
  } catch {}
  return metadata;
}

async function getEpisodeIdFromMetadata(videoElement = null) {
  const metadata = inspectNetflixMetadata(videoElement);
  if (metadata.videoId) return String(metadata.videoId);
  if (metadata.episodeId) return String(metadata.episodeId);
  const urlMatch = window.location.pathname.match(/\/watch\/(\d+)/);
  return urlMatch ? urlMatch[1] : null;
}

async function lookupTableNameFromMediaId(mediaId) {
  if (!AIRTABLE_CONFIG.baseId) {
    return null;
  }
  
  const lookUpTableName = 'LookUp';
  const apiUrl = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(lookUpTableName)}`;
  
  // First, try to get the table schema to discover field names
  try {
    const metaApiUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_CONFIG.baseId}/tables`;
    const metaResponse = await fetch(metaApiUrl, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_CONFIG.apiToken}`, 'Content-Type': 'application/json' }
    });
    
    if (metaResponse.ok) {
      const metaData = await metaResponse.json();
      const lookUpTable = metaData.tables?.find(t => t.name === lookUpTableName);
      if (lookUpTable) {
        const fieldNames = lookUpTable.fields?.map(f => f.name) || [];
        
        // Find mediaId field (case-insensitive)
        const mediaIdField = fieldNames.find(f => 
          f.toLowerCase() === 'mediaid' || 
          f.toLowerCase() === 'media id' || 
          f.toLowerCase() === 'media_id' ||
          f.toLowerCase() === 'mediald'
        );
        
        // Find TableName field (case-insensitive)
        const tableNameField = fieldNames.find(f => 
          f.toLowerCase() === 'tablename' || 
          f.toLowerCase() === 'table name' || 
          f.toLowerCase() === 'table_name' ||
          f.toLowerCase() === 'table'
        );
        
        if (mediaIdField && tableNameField) {
          // Use the actual field names from the schema
          const filterFormula = `{${mediaIdField}} = "${mediaId}"`;
          const params = new URLSearchParams();
          params.append('filterByFormula', filterFormula);
          params.append(`fields[]`, tableNameField);
          params.append('maxRecords', '1');
          
          const response = await fetch(`${apiUrl}?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${AIRTABLE_CONFIG.apiToken}`, 'Content-Type': 'application/json' }
          });
          
          if (response.ok) {
            const data = await response.json();
            const records = data.records || [];
            if (records.length > 0) {
              const tableName = records[0].fields?.[tableNameField];
              if (tableName) {
                const resolvedTableName = String(tableName).trim();
                return resolvedTableName;
              }
            }
          }
        }
      }
    }
  } catch (error) {
    // Silently fail
  }
  
  // Fallback: try common field name variations
  const filterFormulas = [
    `{mediaId} = "${mediaId}"`,
    `{mediald} = "${mediaId}"`,
    `{media_id} = "${mediaId}"`,
    `{Media ID} = "${mediaId}"`,
    `{MediaId} = "${mediaId}"`
  ];
  
  for (let i = 0; i < filterFormulas.length; i++) {
    const filterFormula = filterFormulas[i];
    
    const params = new URLSearchParams();
    params.append('filterByFormula', filterFormula);
    params.append('maxRecords', '10'); // Get a few records to see field names
    
    try {
      const response = await fetch(`${apiUrl}?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_CONFIG.apiToken}`, 'Content-Type': 'application/json' }
      });
      
      if (response.status === 422) {
        continue;
      }
      
      if (!response.ok) {
        continue;
      }
      
      const data = await response.json();
      const records = data.records || [];
      
      if (records.length > 0) {
        const record = records[0];
        const availableFields = Object.keys(record.fields || {});
        
        // Try to find TableName field
        const tableNameField = availableFields.find(f => 
          f.toLowerCase().includes('table') && f.toLowerCase().includes('name')
        ) || availableFields.find(f => f.toLowerCase() === 'tablename') ||
          availableFields.find(f => f.toLowerCase() === 'table name');
        
        if (tableNameField) {
          const tableName = record.fields?.[tableNameField];
          if (tableName) {
            const resolvedTableName = String(tableName).trim();
            return resolvedTableName;
          }
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  return null;
}

async function fetchTablesFromAirtable() {
  try {
    const metaApiUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_CONFIG.baseId}/tables`;
    const response = await fetch(metaApiUrl, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_CONFIG.apiToken}`, 'Content-Type': 'application/json' }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.tables?.map(table => table.name) || [];
  } catch {
    return [];
  }
}

async function fetchAllSubtitlesForMedia(mediaId) {
  if (!AIRTABLE_CONFIG.baseId || !AIRTABLE_CONFIG.apiToken) throw new Error('Airtable configuration missing');
  if (!mediaId) throw new Error('mediaId is required');
  
  // Always look up table name from LookUp table using mediaId
  let tableName = await lookupTableNameFromMediaId(mediaId);
  
  if (!tableName) {
    throw new Error(`Table name not found in LookUp table for mediaId: ${mediaId}. Please upload subtitles first or add a LookUp entry.`);
  }
  
  // Verify table exists
  const existingTables = await fetchTablesFromAirtable();
  if (!existingTables.includes(tableName)) {
    throw new Error(`Table "${tableName}" does not exist in Airtable`);
  }
  
  // Cache the resolved table name
  setTableName(tableName);
  
  // Discover which fields exist in this table and cache the schema
  let availableFields = [];
  try {
    const metaApiUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_CONFIG.baseId}/tables`;
    const metaResponse = await fetch(metaApiUrl, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_CONFIG.apiToken}`, 'Content-Type': 'application/json' }
    });
    
    if (metaResponse.ok) {
      const metaData = await metaResponse.json();
      const targetTable = metaData.tables?.find(t => t.name === tableName);
      if (targetTable) {
        availableFields = targetTable.fields?.map(f => f.name) || [];
        // Cache the full schema for later use
        cachedTableSchema = {
          tableName,
          fields: targetTable.fields || [],
          fieldNames: availableFields
        };
      }
    }
  } catch (error) {
    // Silently fail - will try to save all fields
  }
  
  // Define required and optional fields
  const requiredFields = ['mediaId', 'thai', 'startSec', 'endSec', 'subIndex'];
  const optionalFields = ['thaiScriptReview', 'processed', 'fullReview', 'thaiSplit', 'thaiSplitIds'];
  
  // Build list of fields to request - only include fields that exist
  let fieldsToRequest = [];
  if (availableFields.length > 0) {
    // Use schema discovery - only request fields that exist
    for (const field of [...requiredFields, ...optionalFields]) {
      // Try exact match first
      if (availableFields.includes(field)) {
        fieldsToRequest.push(field);
      } else {
        // Try case-insensitive match
        const found = availableFields.find(f => f.toLowerCase() === field.toLowerCase());
        if (found) {
          fieldsToRequest.push(found);
        }
      }
    }
  } else {
    // Fallback: request all fields and let Airtable return 422 for missing ones
    fieldsToRequest = [...requiredFields, ...optionalFields];
  }
  
  const filterFormula = `{mediaId} = "${mediaId}"`;
  let allRecords = [];
  let offset = null;
  
  do {
    const params = new URLSearchParams();
    params.append('pageSize', '100');
    params.append('filterByFormula', filterFormula);
    if (offset) params.append('offset', offset);
    fieldsToRequest.forEach(f => params.append('fields[]', f));
    
    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(tableName)}?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_CONFIG.apiToken}`, 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable API error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const rawRecords = data.records || [];
    
    const pageRecords = rawRecords.map(processRecordToSubtitle).filter(r => r !== null);
    
    allRecords = allRecords.concat(pageRecords);
    offset = data.offset || null;
  } while (offset);
  
  allRecords.sort((a, b) => a.startTime - b.startTime);
  return allRecords;
}

async function fetchWordMetadataForSubtitle(subtitle) {
  if (!subtitle?.thaiSplitIds) return new Map();
  
  const thaiWordsBaseId = getThaiWordsBaseId();
  if (!thaiWordsBaseId) throw new Error('ThaiWords base ID not found');
  
  let wordIds = [];
  try {
    if (typeof subtitle.thaiSplitIds === 'string') {
      const parsed = JSON.parse(subtitle.thaiSplitIds);
      wordIds = Array.isArray(parsed) ? parsed : [];
    } else if (Array.isArray(subtitle.thaiSplitIds)) {
      wordIds = subtitle.thaiSplitIds;
    }
    if (!wordIds.length) return new Map();
  } catch {
    return new Map();
  }
  
  const wordMap = new Map();
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < wordIds.length; i += BATCH_SIZE) {
    const batch = wordIds.slice(i, i + BATCH_SIZE);
    const filterFormula = `OR(${batch.map(id => `RECORD_ID() = "${id}"`).join(',')})`;
    
    const params = new URLSearchParams();
    params.append('pageSize', '100');
    params.append('filterByFormula', filterFormula);
    ['thaiScript', 'englishPhonetic', 'english', 'pos', 'status'].forEach(f => params.append('fields[]', f));
    
    const response = await fetch(`https://api.airtable.com/v0/${thaiWordsBaseId}/Words?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_CONFIG.apiToken}`, 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) continue;
    
    const data = await response.json();
    (data.records || []).forEach(record => {
      const fields = record.fields || {};
      wordMap.set(record.id, {
        wordId: record.id,
        thaiScript: fields.thaiScript || '',
        englishPhonetic: fields.englishPhonetic || '',
        english: fields.english || '',
        pos: fields.pos || '',
        status: fields.status || ''
      });
    });
  }
  
  return wordMap;
}

async function preloadPhoneticTexts(subtitles, currentVideoTime = null) {
  if (!subtitles || subtitles.length === 0) return;
  
  const thaiWordsBaseId = getThaiWordsBaseId();
  if (!thaiWordsBaseId) {
    updateLoadingProgress({ userModeLoading: false });
    return;
  }
  
  const wordMap = new Map();
  const allWordIds = new Set();
  const subtitleWordIdMap = new Map();
  
  for (const subtitle of subtitles) {
    if (!subtitle.thaiSplitIds) continue;
    try {
      const wordIdsArray = typeof subtitle.thaiSplitIds === 'string' ? JSON.parse(subtitle.thaiSplitIds) : subtitle.thaiSplitIds;
      if (Array.isArray(wordIdsArray)) {
        const validIds = wordIdsArray.filter(id => id && id.trim() !== '');
        subtitleWordIdMap.set(subtitle, validIds);
        validIds.forEach(id => allWordIds.add(id.trim()));
      }
    } catch {}
  }
  
  if (allWordIds.size === 0) {
    updateLoadingProgress({ userModeLoading: false });
    return;
  }
  
  updateLoadingProgress({ 
    userModeLoading: true,
    phoneticWordsTotal: allWordIds.size, 
    phoneticWordsLoaded: 0 
  });
  
  const wordIdsArray = Array.from(allWordIds);
  const batchSize = 10;
  let fetchedCount = 0;
  
  for (let i = 0; i < wordIdsArray.length; i += batchSize) {
    const batch = wordIdsArray.slice(i, i + batchSize);
    
    try {
      const apiUrl = `https://api.airtable.com/v0/${thaiWordsBaseId}/Words`;
      const fetchPromises = batch.map(async (wordId) => {
        try {
          const response = await fetch(`${apiUrl}/${wordId}`, {
            headers: { 'Authorization': `Bearer ${AIRTABLE_CONFIG.apiToken}`, 'Content-Type': 'application/json' }
          });
          
          if (response.ok) {
            const record = await response.json();
            const wordData = {
              wordId: record.id || '',
              thaiScript: record.fields?.thaiScript || '',
              englishPhonetic: record.fields?.englishPhonetic || '',
              english: record.fields?.english || '',
              pos: record.fields?.pos || '',
              status: record.fields?.status || ''
            };
            if (wordData.englishPhonetic) fetchedCount++;
            return { id: record.id, data: wordData };
          }
          return null;
        } catch {
          return null;
        }
      });
      
      const results = await Promise.all(fetchPromises);
      results.forEach(result => {
        if (result) wordMap.set(result.id, result.data);
      });
      
      subtitleWordIdMap.forEach((wordIdsArray, subtitle) => {
        const allWordsReady = wordIdsArray.every(id => wordMap.has(id));
        if (allWordsReady && !subtitle.phoneticWordMap) {
          subtitle.phoneticWordMap = wordMap;
        }
      });
      
      updateLoadingProgress({ phoneticWordsLoaded: fetchedCount });
      
      if (i + batchSize < wordIdsArray.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch {}
  }
  
  subtitleWordIdMap.forEach((wordIdsArray, subtitle) => {
    if (!subtitle.phoneticWordMap) subtitle.phoneticWordMap = wordMap;
  });
  
  updateLoadingProgress({ userModeLoading: false });
}

async function fetchSingleSubtitleFromAirtable(recordId) {
  if (!AIRTABLE_CONFIG.baseId || !AIRTABLE_CONFIG.apiToken) throw new Error('Airtable configuration missing');
  if (!recordId) throw new Error('recordId is required');
  
  const tableName = getTableName();
  if (!tableName || tableName === 'LookUp') throw new Error('Invalid table name');
  
  const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(tableName)}/${recordId}`, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_CONFIG.apiToken}`, 'Content-Type': 'application/json' }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 404) {
      throw new Error(`Record not found: ${recordId}`);
    }
    if (response.status === 422) {
      throw new Error(`Airtable validation error (422): ${errorText}`);
    }
    throw new Error(`Airtable API error ${response.status}: ${errorText}`);
  }
  
  const data = await response.json();
  return processRecordToSubtitle(data);
}

async function saveSubtitleToAirtable(recordId, fieldsToUpdate) {
  if (!AIRTABLE_CONFIG.baseId || !AIRTABLE_CONFIG.apiToken) throw new Error('Airtable configuration missing');
  if (!recordId) throw new Error('recordId is required');
  
  const tableName = getTableName();
  if (!tableName || tableName === 'LookUp') throw new Error('Invalid table name');
  
  const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(tableName)}/${recordId}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${AIRTABLE_CONFIG.apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: fieldsToUpdate })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 404) {
      throw new Error(`Record not found: ${recordId}`);
    }
    if (response.status === 422) {
      throw new Error(`Airtable validation error (422): ${errorText}`);
    }
    throw new Error(`Airtable API error ${response.status}: ${errorText}`);
  }
  
  return await response.json();
}

async function processSaveQueue() {
  if (saveQueue.size === 0) return;
  
  const recordIdsToSave = Array.from(saveQueue);
  saveQueue.clear();
  
  for (const recordId of recordIdsToSave) {
    const subtitle = getSubtitleCache().find(s => s.recordId === recordId);
    if (!subtitle) continue;
    
    try {
      await syncToAirtable(recordId);
    } catch (error) {
    }
  }
}

export function triggerSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    processSaveQueue();
    saveTimeout = null;
  }, SAVE_DEBOUNCE_MS);
}

export function findSubtitleInCache(recordId) {
  return getSubtitleCache().find(s => s.recordId === recordId) || null;
}

export function updateSubtitleInCache(recordId, updater) {
  const cache = getSubtitleCache();
  const index = cache.findIndex(s => s.recordId === recordId);
  if (index === -1) return false;
  updater(cache[index]);
  setSubtitleCache([...cache]);
  return true;
}

export async function loadEpisode(mediaId, videoElement = null) {
  if (isReloading) {
    return getSubtitleCache();
  }
  if (currentMediaId === mediaId && getSubtitleCache().length > 0) {
    return getSubtitleCache();
  }
  
  isReloading = true;
  updateLoadingProgress({ editModeReady: false });
  
  try {
    let resolvedMediaId = mediaId;
    if (!resolvedMediaId && videoElement) {
      resolvedMediaId = await getEpisodeIdFromMetadata(videoElement);
    }
    if (!resolvedMediaId) {
      const urlMatch = window.location.pathname.match(/\/watch\/(\d+)/);
      resolvedMediaId = urlMatch ? urlMatch[1] : null;
    }
    
    if (!resolvedMediaId) {
      updateLoadingProgress({ editModeReady: false, userModeLoading: false });
      isReloading = false;
      return [];
    }
    
    currentMediaId = resolvedMediaId;
    
    const metadata = inspectNetflixMetadata(videoElement);
    try {
      chrome.storage?.local?.set({
        smartsubs_media_meta: {
          platform: 'netflix',
          mediaId: resolvedMediaId,
          title: metadata.title || null,
          seasonNumber: metadata.season || null,
          episodeNumber: metadata.episode || null,
          duration: metadata.duration || null
        }
      });
    } catch {}
    
    if (videoElement && !videoElement.paused) {
      videoElement.pause();
    }
    
    const freshSubtitles = await fetchAllSubtitlesForMedia(resolvedMediaId);
    
    if (freshSubtitles.length > 0) {
      updateLoadingProgress({ editModeReady: true });
      
      const existingCache = getSubtitleCache();
      const existingRecordIds = new Set(existingCache.map(s => s.recordId));
      const newSubtitles = freshSubtitles.filter(s => !existingRecordIds.has(s.recordId));
      
      const mergedSubtitles = [...existingCache, ...newSubtitles].sort((a, b) => a.startTime - b.startTime);
      
      setSubtitleCache(mergedSubtitles);
      
      const subtitlesReadyForWordData = mergedSubtitles.filter(sub => sub.processed === true);
      
      if (subtitlesReadyForWordData.length > 0) {
        const phoneticVideoTime = videoElement?.currentTime;
        preloadPhoneticTexts(subtitlesReadyForWordData, phoneticVideoTime).catch(() => {
          updateLoadingProgress({ userModeLoading: false });
        });
      } else {
        updateLoadingProgress({ userModeLoading: false });
      }
      
      if (videoElement && videoElement.paused) {
        videoElement.play().catch(() => {});
      }
    } else {
      setSubtitleCache([]);
      updateLoadingProgress({ editModeReady: false, userModeLoading: false });
    }
    
    return getSubtitleCache();
  } catch (error) {
    updateLoadingProgress({ editModeReady: false, userModeLoading: false });
    return [];
  } finally {
    isReloading = false;
  }
}

export function getSubtitleAt(time) {
  const cache = getSubtitleCache();
  if (!cache.length) {
    return null;
  }

  // Find the most recent subtitle that has started (startTime <= time)
  // Skip rows that are already complete (have thaiSplitIds)
  // IGNORE endTime - subtitle stays visible until next one starts
  let bestMatch = null;
  for (const sub of cache) {
    if (sub.startTime <= time) {
      // Skip completed rows (Stage 3 finished - have thaiSplitIds)
      const hasThaiSplitIds = sub.thaiSplitIds && (
        (Array.isArray(sub.thaiSplitIds) && sub.thaiSplitIds.length > 0) ||
        (typeof sub.thaiSplitIds === 'string' && sub.thaiSplitIds.trim() !== '' && sub.thaiSplitIds !== '[]')
      );
      
      if (hasThaiSplitIds) {
        // This row is complete, skip it
        continue;
      }
      
      // If we haven't found one yet, or this one started more recently, use it
      if (!bestMatch || sub.startTime > bestMatch.startTime) {
        bestMatch = sub;
      }
    }
  }

  return bestMatch;
}

export async function refreshSubtitle(recordId) {
  const refreshed = await fetchSingleSubtitleFromAirtable(recordId);
  if (!refreshed) throw new Error(`Failed to refresh subtitle: ${recordId}`);
  
  // Recompute stage from fields (field-based detection)
  // Use fields from refreshed subtitle to determine stage
  const fields = {
    thai: refreshed.thai,
    thaiSplit: refreshed.thaiSplit,
    thaiSplitIds: refreshed.thaiSplitIds
  };
  refreshed.processingStage = deriveProcessingStage(fields);
  
  const cache = getSubtitleCache();
  const index = cache.findIndex(s => s.recordId === recordId);
  if (index === -1) throw new Error(`Subtitle not found in cache: ${recordId}`);
  
  cache[index] = refreshed;
  setSubtitleCache([...cache]);
  
  if (refreshed.processingStage >= SUBTITLE_STAGE.SPLIT_CONFIRMED && refreshed.thaiSplitIds) {
    try {
      refreshed.phoneticWordMap = await fetchWordMetadataForSubtitle(refreshed);
      cache[index] = refreshed;
      setSubtitleCache([...cache]);
    } catch (error) {
    }
  }
  
  return refreshed;
}

export function updateStage(recordId, newStage) {
  // Three-stage workflow only
  const validStages = [SUBTITLE_STAGE.RAW_IMPORTED, SUBTITLE_STAGE.SCRIPT_CONFIRMED, SUBTITLE_STAGE.SPLIT_CONFIRMED];
  if (!validStages.includes(newStage)) throw new Error(`Invalid stage: ${newStage}`);
  
  const updated = updateSubtitleInCache(recordId, (subtitle) => {
    subtitle.processingStage = newStage;
    if (newStage === SUBTITLE_STAGE.SCRIPT_CONFIRMED) subtitle.thaiScriptReview = true;
    if (newStage === SUBTITLE_STAGE.SPLIT_CONFIRMED) subtitle.processed = true; // Stage 3 complete
  });
  
  if (!updated) throw new Error(`Subtitle not found: ${recordId}`);
  
  saveQueue.add(recordId);
  triggerSave();
  
  const updatedSubtitle = findSubtitleInCache(recordId);
  
  refreshSubtitle(recordId).catch(err => {
  });
  
  return updatedSubtitle;
}

export function updateThaiText(recordId, newText) {
  // Implementation matches stage1Save.js (delegates to avoid code duplication)
  // Using inline implementation to avoid circular dependency (stage save modules import from this file)
  const updated = updateSubtitleInCache(recordId, (subtitle) => {
    subtitle.thai = String(newText).trim();
    subtitle.thaiScriptReview = true; // Mark Stage 1 complete, enable Stage 2
  });
  
  if (!updated) throw new Error(`Subtitle not found: ${recordId}`);
  
  triggerSave();
  
  return findSubtitleInCache(recordId);
}

export function updateThaiSplit(recordId, newSplit) {
  // Delegate to stage2Save module
  // Use inline implementation to avoid circular dependency
  const updated = updateSubtitleInCache(recordId, (subtitle) => {
    subtitle.thaiSplit = String(newSplit).trim();
  });
  
  if (!updated) throw new Error(`Subtitle not found: ${recordId}`);
  
  triggerSave();
  
  return findSubtitleInCache(recordId);
}

/**
 * Find or create a ThaiWords record for a selected sense from 50k lexicon (thaiDb.json)
 * 
 * Candidates ALWAYS come from thaiDb.json (50k lexicon).
 * When user confirms a selection:
 * 1. Check if this word already exists in ThaiWords table (avoid duplicates)
 * 2. If found: return existing record ID (e.g. "rec3294234")
 * 3. If not found: create new ThaiWords record and return new record ID
 * 
 * The returned record ID is stored in thaiSplitIds array for that token.
 * 
 * @param {Object} params - Word data from selected sense (from 50k lexicon)
 * @param {string} params.thaiScript - Thai token text
 * @param {string} params.english - English translation
 * @param {string} params.pos - Part of speech
 * @param {string} params.phonetic - Phonetic transcription (from romanizeThai)
 * @param {string|number|null} params.worldId - Optional worldId from sense (preferred match key)
 * @param {string|number|null} params.lexId - Optional lexicon ID from 50k lexicon
 * @returns {Promise<string>} ThaiWords record ID (existing record ID like "rec3294234" or newly created)
 */
export async function findOrCreateThaiWord({ 
  sourceLexId, 
  thaiScript, 
  thaiSearch, 
  english, 
  pos, 
  classifier, 
  thaiSynonyms, 
  thaiAntonyms, 
  thaiDefinition, 
  thaiSample, 
  englishRelated, 
  notes, 
  sourceBundleJSON 
}) {
  const thaiWordsBaseId = getThaiWordsBaseId();
  if (!thaiWordsBaseId) throw new Error('ThaiWords base ID not found');
  
  if (!thaiScript || !thaiScript.trim()) {
    throw new Error('Thai text is required');
  }
  
  // Search for exact match using thaiScript + english + pos
  const params = new URLSearchParams();
  params.append('pageSize', '100');
  
  // Build filter formula: exact match on thaiScript + english + pos
  if (thaiScript && english && pos) {
    const thaiEscaped = String(thaiScript).trim().replace(/"/g, '\\"');
    const posEscaped = String(pos).trim().replace(/"/g, '\\"');
    const engEscaped = String(english).trim().replace(/"/g, '\\"');
    const filterFormula = `AND({thaiScript} = "${thaiEscaped}", {pos} = "${posEscaped}", {english} = "${engEscaped}")`;
    params.append('filterByFormula', filterFormula);
  } else {
    // Fallback: match by thaiScript only if english or pos missing
    const thaiEscaped = String(thaiScript).trim().replace(/"/g, '\\"');
    params.append('filterByFormula', `{thaiScript} = "${thaiEscaped}"`);
  }
  
  params.append('fields[]', 'thaiScript');
  params.append('fields[]', 'pos');
  params.append('fields[]', 'english');
  
  // Try to find existing record first (avoid duplicates)
  try {
    const searchResponse = await fetch(`https://api.airtable.com/v0/${thaiWordsBaseId}/Words?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_CONFIG.apiToken}`, 'Content-Type': 'application/json' }
    });
    
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.records && searchData.records.length > 0) {
        // Find exact match on thaiScript + english + pos
        if (thaiScript && english && pos) {
          const exactMatch = searchData.records.find(record => {
            const recordThai = String(record.fields?.thaiScript || '').trim();
            const recordPos = String(record.fields?.pos || '').trim();
            const recordEng = String(record.fields?.english || '').trim();
            return recordThai === String(thaiScript).trim() && 
                   recordPos === String(pos).trim() && 
                   recordEng === String(english).trim();
          });
          if (exactMatch) {
            return exactMatch.id; // Return existing Airtable record ID
          }
        }
        
        // Fallback: return first match if exact match not found
        return searchData.records[0].id;
      }
    }
  } catch (error) {
    // Silently fail
  }
  
  // No existing record found - create new one with all mapped fields
  const fieldsToCreate = {
    thaiScript: String(thaiScript).trim(),
    english: english ? String(english).trim() : '',
    pos: pos ? String(pos).trim() : '',
    englishPhonetic: '' // Leave blank - phonetics pipeline will fill it later
  };
  
  // Add optional fields if provided
  if (sourceLexId !== null && sourceLexId !== undefined && sourceLexId !== '') {
    fieldsToCreate.sourceLexId = String(sourceLexId).trim();
  }
  
  if (thaiSearch !== null && thaiSearch !== undefined && thaiSearch !== '') {
    fieldsToCreate.thaiSearch = String(thaiSearch).trim();
  }
  
  if (classifier !== null && classifier !== undefined && classifier !== '') {
    fieldsToCreate.classifier = String(classifier).trim();
  }
  
  if (thaiSynonyms !== null && thaiSynonyms !== undefined && thaiSynonyms !== '') {
    fieldsToCreate.thaiSynonyms = String(thaiSynonyms).trim();
  }
  
  if (thaiAntonyms !== null && thaiAntonyms !== undefined && thaiAntonyms !== '') {
    fieldsToCreate.thaiAntonyms = String(thaiAntonyms).trim();
  }
  
  if (thaiDefinition !== null && thaiDefinition !== undefined && thaiDefinition !== '') {
    fieldsToCreate.thaiDefinition = String(thaiDefinition).trim();
  }
  
  if (thaiSample !== null && thaiSample !== undefined && thaiSample !== '') {
    fieldsToCreate.thaiSample = String(thaiSample).trim();
  }
  
  if (englishRelated !== null && englishRelated !== undefined && englishRelated !== '') {
    fieldsToCreate.englishRelated = String(englishRelated).trim();
  }
  
  if (notes !== null && notes !== undefined && notes !== '') {
    fieldsToCreate.notes = String(notes).trim();
  }
  
  if (sourceBundleJSON !== null && sourceBundleJSON !== undefined && sourceBundleJSON !== '') {
    fieldsToCreate.sourceBundleJSON = String(sourceBundleJSON).trim();
  }
  
  try {
    const createResponse = await fetch(`https://api.airtable.com/v0/${thaiWordsBaseId}/Words`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AIRTABLE_CONFIG.apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: fieldsToCreate })
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create ThaiWords record: ${createResponse.status} ${errorText}`);
    }
    
    const created = await createResponse.json();
    return created.id; // Return new record ID
  } catch (error) {
    // Silently fail
    throw error;
  }
}


export async function syncToAirtable(recordId, options = {}) {
  const subtitle = findSubtitleInCache(recordId);
  if (!subtitle) throw new Error(`Subtitle not found: ${recordId}`);
  
  // Get available field names from cached schema
  const availableFieldNames = cachedTableSchema?.fieldNames || [];
  
  const fieldsToUpdate = {};
  
  // If onlyThai is true, only save the thai field and Edited checkbox (for Stage 1 edits)
  if (options.onlyThai) {
    const thaiValue = subtitle.thai;
    if (thaiValue !== undefined && thaiValue !== null) {
      const stringValue = String(thaiValue).trim();
      if (stringValue) {
        // Find actual field name (case-insensitive)
        const actualFieldName = availableFieldNames.length > 0
          ? availableFieldNames.find(f => f.toLowerCase() === 'thai') || 'thai'
          : 'thai';
        fieldsToUpdate[actualFieldName] = stringValue;
      }
    }
    // Also include Edited checkbox if it exists
    if (subtitle.Edited !== undefined) {
      const editedFieldName = availableFieldNames.length > 0
        ? availableFieldNames.find(f => f.toLowerCase() === 'edited') || 'Edited'
        : 'Edited';
      if (availableFieldNames.length === 0 || availableFieldNames.some(f => f.toLowerCase() === 'edited')) {
        fieldsToUpdate[editedFieldName] = Boolean(subtitle.Edited);
      }
    }
  } else {
    // Full sync - include all fields that exist in the table schema
    const fieldMappings = [
      { key: 'thai', value: subtitle.thai },
      { key: 'thaiSplit', value: subtitle.thaiSplit },
      { key: 'thaiSplitIds', value: subtitle.thaiSplitIds },
      { key: 'startSec', value: subtitle.startSec },
      { key: 'endSec', value: subtitle.endSec },
      { key: 'processed', value: subtitle.processed, isBoolean: true },
      { key: 'fullReview', value: subtitle.fullReview, isBoolean: true }
    ];
    
    for (const { key, value, isBoolean } of fieldMappings) {
      // Find the actual field name from table schema (case-insensitive match)
      let actualFieldName = null;
      if (availableFieldNames.length > 0) {
        actualFieldName = availableFieldNames.find(f => f.toLowerCase() === key.toLowerCase());
        if (!actualFieldName) continue; // Skip fields that don't exist in the table
      } else {
        // If schema not available, use the key as-is
        actualFieldName = key;
      }
      
      if (value !== undefined && value !== null) {
        if (isBoolean) {
          fieldsToUpdate[actualFieldName] = Boolean(value);
        } else {
          const stringValue = String(value).trim();
          if (stringValue) fieldsToUpdate[actualFieldName] = stringValue;
        }
      }
    }
  }
  
  if (Object.keys(fieldsToUpdate).length === 0) {
    return null;
  }
  
  try {
    const result = await saveSubtitleToAirtable(recordId, fieldsToUpdate);
    return result;
  } catch (error) {
    throw error;
  }
}

export { getSubtitleCache };

/**
 * Save Episode Lookup Metadata Helper
 * Consolidates ensureEpisodeLookupSave + updateEpisodeLookupMetadata into single function
 */

import { ensureEpisodeLookupSave, updateEpisodeLookupMetadata } from '../save-subtitles.js';

/**
 * Save episode lookup metadata
 * Ensures lookup entry exists (creates if needed), then updates with metadata
 * @param {string} showName - Show name
 * @param {string} mediaId - Media ID
 * @param {object} episodeData - Episode data with season, episode, episodeTitle (optional)
 * @returns {Promise<void>}
 */
export async function saveEpisodeLookupMetadata(showName, mediaId, episodeData = {}) {
  if (!showName || !mediaId) return;
  
  // First ensure the lookup entry exists (creates if needed, preserves existing if present)
  await ensureEpisodeLookupSave(showName, mediaId);
  
  // Then update with provided metadata (even if empty object - will just ensure entry exists)
  await updateEpisodeLookupMetadata(showName, mediaId, episodeData);
}

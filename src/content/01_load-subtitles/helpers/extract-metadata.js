/**
 * Extract Metadata - Extract Netflix video metadata from DOM/URL
 */

/**
 * Get media ID from Netflix URL
 * @returns {string|null} Media ID from URL or null
 */
export function getMediaIdFromUrl() {
  const urlMatch = window.location.pathname.match(/\/watch\/(\d+)/);
  return urlMatch && urlMatch[1] ? urlMatch[1] : null;
}

/**
 * Inspect Netflix video element for metadata
 * @param {HTMLElement} videoElement - Video element
 * @returns {object} Metadata object with videoId, duration, etc.
 */
export function inspectNetflixMetadata(videoElement) {
  if (!videoElement) {
    return { videoId: null, duration: null };
  }
  
  const videoId = getMediaIdFromUrl();
  const duration = videoElement.duration || null;
  
  return {
    videoId,
    duration
  };
}

/**
 * Extract full media metadata from video element and media ID
 * Includes showName, episodeNumber, episodeTitle from DOM extraction
 * @param {HTMLElement} videoElement - Video element
 * @param {string} mediaId - Media ID
 * @returns {object} Metadata object with mediaId, duration, showName, episodeNumber, episodeTitle
 */
export function extractMediaMetadata(videoElement, mediaId) {
  if (!videoElement || !mediaId) {
    return {
      mediaId: mediaId || null,
      duration: null,
      showName: null,
      episodeNumber: null,
      episodeTitle: null
    };
  }
  
  const duration = videoElement.duration || null;
  
  // Extract show name from DOM
  let showName = null;
  const showNameElement = document.querySelector('[data-uia="video-title"]');
  if (showNameElement) {
    let rawShowName = showNameElement.textContent?.trim() || null;
    
    // Netflix sometimes combines show name with episode info (e.g., "Show NameE1Episode Title")
    // Try to separate by looking for episode patterns (E1, E2, Episode 1, etc.)
    if (rawShowName) {
      // Pattern: ShowName followed by E\d+ or Episode \d+ followed by episode title
      // Try to extract: "Show Name" from "Show NameE1Episode Title"
      const episodePattern = /([Ee](\d+)|[Ee]pisode\s+(\d+))/;
      const episodeMatch = rawShowName.match(episodePattern);
      
      if (episodeMatch) {
        // Found episode pattern - extract show name as everything before the episode pattern
        const episodeIndex = episodeMatch.index;
        showName = rawShowName.substring(0, episodeIndex).trim();
      } else {
        // No episode pattern found - use as-is
        showName = rawShowName;
      }
    }
  }
  
  // Extract episode number and title from DOM
  let episodeNumber = null;
  let episodeTitle = null;
  const episodeInfoElement = document.querySelector('[data-uia="video-title-secondary"]');
  if (episodeInfoElement) {
    const episodeText = episodeInfoElement.textContent?.trim() || '';
    // Try to extract episode number (e.g., "Episode 5" or "E5")
    const episodeMatch = episodeText.match(/[Ee]pisode\s+(\d+)|[Ee](\d+)/);
    if (episodeMatch) {
      episodeNumber = parseInt(episodeMatch[1] || episodeMatch[2], 10);
    }
    episodeTitle = episodeText || null;
  }
  
  // If episode info wasn't found in secondary element, try extracting from show name element
  if (!episodeNumber && showNameElement) {
    const rawShowName = showNameElement.textContent?.trim() || '';
    // Pattern: ShowNameE1EpisodeTitle or ShowName Episode 1 EpisodeTitle
    // Match: E1, E2, Episode 1, etc. followed by optional episode title
    const episodePattern = /([Ee](\d+)|[Ee]pisode\s+(\d+))(.+)?$/;
    const episodeMatch = rawShowName.match(episodePattern);
    
    if (episodeMatch) {
      // Extract episode number (from group 2 or 3)
      const episodeNumStr = episodeMatch[2] || episodeMatch[3];
      if (episodeNumStr) {
        episodeNumber = parseInt(episodeNumStr, 10);
      }
      
      // Extract episode title (everything after episode pattern, group 4)
      if (episodeMatch[4]) {
        episodeTitle = episodeMatch[4].trim();
      }
    }
  }
  
  return {
    mediaId,
    duration,
    showName,
    episodeNumber,
    episodeTitle
  };
}

/**
 * Get episode ID from metadata (video element)
 * @param {HTMLElement} videoElement - Video element
 * @returns {Promise<string|null>} Episode ID or null
 */
export async function getEpisodeIdFromMetadata(videoElement) {
  if (!videoElement) {
    return null;
  }
  
  // Try to get from URL first
  const mediaId = getMediaIdFromUrl();
  if (mediaId) {
    return mediaId;
  }
  
  // Fallback: try to extract from video element or metadata
  // This is a fallback - normally URL should have it
  return null;
}

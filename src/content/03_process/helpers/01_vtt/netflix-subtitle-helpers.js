/**
 * Netflix Subtitle Helpers
 * Helper functions to extract subtitle URLs from Netflix's internal runtime objects
 * Similar pattern to extract-metadata.js helpers
 */

/**
 * Recursively search for subtitle URLs in an object
 * @param {object} obj - Object to search
 * @param {string} path - Current path in object (for logging)
 * @returns {Array<{path: string, url: string, lang?: string}>} Array of found URLs with paths
 */
export function findSubtitleUrls(obj, path = '') {
  const urls = [];
  if (!obj || typeof obj !== 'object') return urls;
  
  for (const key in obj) {
    const value = obj[key];
    const currentPath = path ? path + '.' + key : key;
    
    if (typeof value === 'string' && (
      value.startsWith('http') && (
        value.includes('timedtext') || 
        value.includes('vtt') || 
        value.includes('dfxp') ||
        value.includes('subtitle') ||
        value.includes('caption')
      )
    )) {
      // Try to extract language from context
      let lang = null;
      if (key.toLowerCase().includes('th') || value.toLowerCase().includes('thai')) {
        lang = 'th';
      } else if (key.toLowerCase().includes('en') || value.toLowerCase().includes('english')) {
        lang = 'en';
      }
      urls.push({ path: currentPath, url: value, lang });
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      urls.push(...findSubtitleUrls(value, currentPath));
    } else if (Array.isArray(value)) {
      value.forEach((item, idx) => {
        if (typeof item === 'object' && item !== null) {
          urls.push(...findSubtitleUrls(item, currentPath + '[' + idx + ']'));
        }
      });
    }
  }
  return urls;
}

/**
 * Extract subtitle URL from Netflix runtime objects
 * Searches appContext.state, videoPlayerAPI, and player for subtitle URLs
 * @param {object} netflixContext - Netflix context object with appContext, videoPlayerAPI, player
 * @param {string} langCode - Language code ('th' or 'en')
 * @returns {string|null} Subtitle URL or null if not found
 */
export function extractSubtitleUrlFromRuntime(netflixContext, langCode) {
  const { appContext, videoPlayerAPI, player } = netflixContext;
  
  // Search in player object first (most likely location)
  if (player) {
    const playerUrls = findSubtitleUrls(player, 'player');
    const matchingUrl = playerUrls.find(u => 
      !u.lang || u.lang === langCode || 
      (langCode === 'th' && (u.url.includes('th') || u.url.includes('thai'))) ||
      (langCode === 'en' && (u.url.includes('en') || u.url.includes('english')))
    );
    if (matchingUrl) {
      console.log('[extractSubtitleUrlFromRuntime] Found URL in player:', matchingUrl);
      return matchingUrl.url;
    }
  }
  
  // Search in videoPlayerAPI
  if (videoPlayerAPI) {
    const apiUrls = findSubtitleUrls(videoPlayerAPI, 'videoPlayerAPI');
    const matchingUrl = apiUrls.find(u => 
      !u.lang || u.lang === langCode || 
      (langCode === 'th' && (u.url.includes('th') || u.url.includes('thai'))) ||
      (langCode === 'en' && (u.url.includes('en') || u.url.includes('english')))
    );
    if (matchingUrl) {
      console.log('[extractSubtitleUrlFromRuntime] Found URL in videoPlayerAPI:', matchingUrl);
      return matchingUrl.url;
    }
  }
  
  // Search in appContext.state
  if (appContext && appContext.state) {
    const stateUrls = findSubtitleUrls(appContext.state, 'state');
    const matchingUrl = stateUrls.find(u => 
      !u.lang || u.lang === langCode || 
      (langCode === 'th' && (u.url.includes('th') || u.url.includes('thai'))) ||
      (langCode === 'en' && (u.url.includes('en') || u.url.includes('english')))
    );
    if (matchingUrl) {
      console.log('[extractSubtitleUrlFromRuntime] Found URL in state:', matchingUrl);
      return matchingUrl.url;
    }
  }
  
  return null;
}

/**
 * Get Netflix subtitle URL by language
 * This is the main helper function similar to getNetflixSubtitleContent
 * @param {string} langCode - Language code ('th' or 'en')
 * @returns {Promise<string|null>} Subtitle URL or null if not found
 */
export async function getNetflixSubtitleUrl(langCode) {
  if (!window.netflix || !window.netflix.appContext) {
    console.warn('[getNetflixSubtitleUrl] Netflix API not available');
    return null;
  }
  
  try {
    const appContext = window.netflix.appContext;
    const state = appContext.state;
    
    if (!state || !state.playerApp) {
      console.warn('[getNetflixSubtitleUrl] Netflix state/playerApp not available');
      return null;
    }
    
    const playerApp = state.playerApp;
    const getAPI = playerApp.getAPI;
    
    if (!getAPI || typeof getAPI !== 'function') {
      console.warn('[getNetflixSubtitleUrl] getAPI not available');
      return null;
    }
    
    const api = getAPI();
    const videoPlayerAPI = api.videoPlayer;
    
    if (!videoPlayerAPI) {
      console.warn('[getNetflixSubtitleUrl] videoPlayerAPI not available');
      return null;
    }
    
    const getAllPlayerSessionIds = videoPlayerAPI.getAllPlayerSessionIds;
    if (!getAllPlayerSessionIds || typeof getAllPlayerSessionIds !== 'function') {
      console.warn('[getNetflixSubtitleUrl] getAllPlayerSessionIds not available');
      return null;
    }
    
    const sessionIds = getAllPlayerSessionIds();
    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      console.warn('[getNetflixSubtitleUrl] No session IDs');
      return null;
    }
    
    const player = videoPlayerAPI.getVideoPlayerBySessionId(sessionIds[0]);
    if (!player) {
      console.warn('[getNetflixSubtitleUrl] Player not available');
      return null;
    }
    
    // Try to extract URL from runtime
    const url = extractSubtitleUrlFromRuntime(
      { appContext, videoPlayerAPI, player },
      langCode
    );
    
    return url;
  } catch (error) {
    console.error('[getNetflixSubtitleUrl] Error:', error);
    return null;
  }
}

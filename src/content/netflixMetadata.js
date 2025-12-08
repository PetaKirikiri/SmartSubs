/**
 * Netflix Metadata Extraction Module
 * Extracts metadata from Netflix's internal APIs and DOM
 */

function findVideoElement() {
  return document.querySelector('video');
}

/**
 * Get episode ID from Netflix metadata
 * @param {HTMLVideoElement|null} videoElement - Video element (optional, will be found if not provided)
 * @returns {Promise<string|null>} Episode ID or null
 */
export async function getEpisodeIdFromMetadata(videoElement = null) {
  const metadata = inspectNetflixMetadata(videoElement);
  
  // videoId IS the mediaId - prioritize it
  // Try to get videoId (mediaId) from various places in the metadata
  if (metadata.videoId) return String(metadata.videoId); // videoId = mediaId
  if (metadata.episodeId) return String(metadata.episodeId);
  if (metadata.titleId) return String(metadata.titleId);

  // Fallback to URL if no metadata ID is found
  const urlMatch = window.location.pathname.match(/\/watch\/(\d+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1]; // This is also the mediaId
  }
  
  return null;
}

/**
 * Inspect Netflix metadata (silent - no console logs)
 * Uses the same internal player API route as the seek bridge for maximum data access
 * @param {HTMLVideoElement|null} videoElement - Video element (optional, will be found if not provided)
 * @returns {Object} Metadata object
 */
export function inspectNetflixMetadata(videoElement = null) {
  const metadata = {
    title: null,
    episodeTitle: null,
    season: null,
    episode: null,
    duration: null,
    currentTime: null,
    actors: [],
    directors: [],
    genres: [],
    year: null,
    rating: null,
    description: null,
    videoId: null,
    titleId: null,
    episodeId: null,
    trackId: null,
    url: window.location.href,
    pageTitle: document.title,
    playerState: null,
    playerMethods: [],
    playerProperties: []
  };
  
  // Extract Video ID from URL path (format: /watch/81304576)
  const urlMatch = window.location.pathname.match(/\/watch\/(\d+)/);
  if (urlMatch) {
    metadata.videoId = urlMatch[1];
  }
  
  // Extract Track ID from URL params
  const urlParams = new URLSearchParams(window.location.search);
  metadata.trackId = urlParams.get('trackId') || null;
  
  // Find video element if not provided
  if (!videoElement) {
    videoElement = findVideoElement();
  }
  
  // Video element metadata
  if (videoElement) {
    metadata.duration = videoElement.duration || null;
    metadata.currentTime = videoElement.currentTime || null;
  }
  
  // Use the same player API route as the seek bridge
  try {
    const appContext = window.netflix && window.netflix.appContext;
    if (appContext) {
      const state = appContext.state;
      if (state) {
        const playerApp = state.playerApp;
        if (playerApp) {
          const getAPI = playerApp.getAPI;
          if (getAPI && typeof getAPI === 'function') {
            const videoPlayerAPI = getAPI().videoPlayer;
            if (videoPlayerAPI) {
              const getAllPlayerSessionIds = videoPlayerAPI.getAllPlayerSessionIds;
              if (getAllPlayerSessionIds && typeof getAllPlayerSessionIds === 'function') {
                const sessionIds = getAllPlayerSessionIds();
                if (sessionIds && sessionIds.length > 0) {
                  const sessionId = sessionIds[0];
                  const player = videoPlayerAPI.getVideoPlayerBySessionId(sessionId);
                  
                  if (player) {
                    // Get all available methods and properties
                    metadata.playerMethods = Object.getOwnPropertyNames(player).filter(name => typeof player[name] === 'function');
                    metadata.playerProperties = Object.getOwnPropertyNames(player).filter(name => typeof player[name] !== 'function');
                    
                    // Try getState() - this often contains rich metadata
                    if (typeof player.getState === 'function') {
                      try {
                        const playerState = player.getState();
                        metadata.playerState = playerState;
                        
                        // Extract common metadata fields from state
                        if (playerState) {
                          // Try to find video metadata in state
                          const stateKeys = Object.keys(playerState);
                          for (const key of stateKeys) {
                            const value = playerState[key];
                            
                            // Look for nested objects that might contain metadata
                            if (value && typeof value === 'object') {
                              // Check for common metadata fields
                              if (value.title || value.name) {
                                metadata.title = metadata.title || value.title || value.name;
                              }
                              if (value.episodeTitle || value.episode) {
                                metadata.episodeTitle = metadata.episodeTitle || value.episodeTitle;
                              }
                              if (value.season !== undefined) metadata.season = value.season;
                              if (value.episode !== undefined) metadata.episode = value.episode;
                              if (value.videoId) metadata.videoId = metadata.videoId || value.videoId;
                              if (value.titleId) metadata.titleId = metadata.titleId || value.titleId;
                              if (value.episodeId) metadata.episodeId = metadata.episodeId || value.episodeId;
                              if (value.year) metadata.year = value.year;
                              if (value.rating) metadata.rating = value.rating;
                              if (value.duration !== undefined && value.duration !== null) {
                                metadata.duration = metadata.duration || value.duration;
                              }
                              if (value.length !== undefined && value.length !== null) {
                                metadata.duration = metadata.duration || value.length;
                              }
                              if (value.runtime !== undefined && value.runtime !== null) {
                                metadata.duration = metadata.duration || value.runtime;
                              }
                              if (value.description || value.synopsis) {
                                metadata.description = metadata.description || value.description || value.synopsis;
                              }
                              if (value.actors || value.cast) {
                                metadata.actors = metadata.actors.length > 0 ? metadata.actors : (value.actors || value.cast || []);
                              }
                              if (value.directors) metadata.directors = value.directors;
                              if (value.genres) metadata.genres = value.genres;
                            }
                          }
                        }
                      } catch (e) {
                        // Silent error handling
                      }
                    }
                    
                    // Try all possible metadata methods
                    const metadataMethods = [
                      'getVideoMetadata',
                      'getTitleMetadata',
                      'getMetadata',
                      'getVideoInfo',
                      'getTitleInfo',
                      'getCurrentVideo',
                      'getVideo',
                      'getTitle',
                      'getEpisode',
                      'getSession'
                    ];
                    
                    for (const methodName of metadataMethods) {
                      if (typeof player[methodName] === 'function') {
                        try {
                          const result = player[methodName]();
                          if (result) {
                            // Extract metadata from result
                            if (result.title || result.name) {
                              metadata.title = metadata.title || result.title || result.name;
                            }
                            if (result.episodeTitle) metadata.episodeTitle = result.episodeTitle;
                            if (result.season !== undefined) metadata.season = result.season;
                            if (result.episode !== undefined) metadata.episode = result.episode;
                            if (result.year) metadata.year = result.year;
                            if (result.rating) metadata.rating = result.rating;
                            if (result.description || result.synopsis) {
                              metadata.description = metadata.description || result.description || result.synopsis;
                            }
                            if (result.actors || result.cast) {
                              metadata.actors = metadata.actors.length > 0 ? metadata.actors : (result.actors || result.cast || []);
                            }
                            if (result.directors) metadata.directors = result.directors;
                            if (result.genres) metadata.genres = result.genres;
                            if (result.videoId) metadata.videoId = metadata.videoId || result.videoId;
                            if (result.titleId) metadata.titleId = result.titleId;
                            if (result.episodeId) metadata.episodeId = result.episodeId;
                            if (result.duration !== undefined && result.duration !== null) {
                              metadata.duration = metadata.duration || result.duration;
                            }
                            if (result.length !== undefined && result.length !== null) {
                              metadata.duration = metadata.duration || result.length;
                            }
                            if (result.runtime !== undefined && result.runtime !== null) {
                              metadata.duration = metadata.duration || result.runtime;
                            }
                          }
                        } catch (e) {
                          // Silent error handling
                        }
                      }
                    }
                    
                    // Try playerApp.getState() session for additional metadata
                    if (typeof playerApp.getState === 'function') {
                      try {
                        const playerAppState = playerApp.getState();
                        if (playerAppState && playerAppState.session) {
                          const session = playerAppState.session;
                          
                          metadata.videoId = metadata.videoId || session.videoId || null;
                          metadata.titleId = metadata.titleId || session.titleId || null;
                          metadata.episodeId = metadata.episodeId || session.episodeId || null;
                          
                          if (session.title) metadata.title = metadata.title || session.title;
                          if (session.episodeTitle) metadata.episodeTitle = metadata.episodeTitle || session.episodeTitle;
                          if (session.season !== undefined) metadata.season = session.season;
                          if (session.episode !== undefined) metadata.episode = session.episode;
                        }
                      } catch (e) {
                        // Silent error handling
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (e) {
    // Silent error handling
  }
  
  // Extract from DOM with better filtering (fallback)
  const titleSelectors = [
    '[data-uia="video-title"]',
    '[data-uia="player-title"]',
    '[class*="video-title"]',
    '[class*="player-title"]',
    'h1[class*="title"]',
    '[aria-label*="title"]'
  ];
  
  // Helper to check if text looks like a timestamp (not a title)
  function isTimestamp(text) {
    return /^\d{2}:\d{2}:\d{2}/.test(text.trim()) || /^\d{1,2}:\d{2}:\d{2}/.test(text.trim());
  }
  
  for (const selector of titleSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      if (element && element.textContent) {
        const text = element.textContent.trim();
        // Skip timestamps and very short text
        if (text.length > 3 && !isTimestamp(text) && text.length < 200) {
          if (!metadata.title || (text.length > metadata.title.length && !isTimestamp(metadata.title))) {
            metadata.title = text;
          }
        }
      }
    }
  }
  
  // Try to find episode info in DOM
  const episodeSelectors = [
    '[data-uia="episode-title"]',
    '[class*="episode-title"]',
    '[class*="episode"]'
  ];
  
  for (const selector of episodeSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent && element.textContent.trim().length > 0) {
      const text = element.textContent.trim();
      if (!isTimestamp(text)) {
        metadata.episodeTitle = text;
        break;
      }
    }
  }
  
  // Clean up title if it's still a timestamp
  if (metadata.title && isTimestamp(metadata.title)) {
    metadata.title = null;
  }
  
  // Format duration
  if (metadata.duration) {
    const hours = Math.floor(metadata.duration / 3600);
    const minutes = Math.floor((metadata.duration % 3600) / 60);
    const seconds = Math.floor(metadata.duration % 60);
    metadata.durationFormatted = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  
  // Format current time
  if (metadata.currentTime !== null) {
    const hours = Math.floor(metadata.currentTime / 3600);
    const minutes = Math.floor((metadata.currentTime % 3600) / 60);
    const seconds = Math.floor(metadata.currentTime % 60);
    metadata.currentTimeFormatted = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  
  return metadata;
}







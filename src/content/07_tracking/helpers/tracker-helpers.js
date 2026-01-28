/**
 * Tracker Helpers - Pure Utility Functions
 * Helper functions for subtitle tracking operations
 */

// ============================================================================
// Video Element Utilities
// ============================================================================

/**
 * Get video current time from video element
 * @param {HTMLVideoElement|null} videoElement - Video element (will find if not provided)
 * @returns {number|null} Current time in seconds or null if unavailable
 */
export function getVideoCurrentTime(videoElement = null) {
  if (!videoElement) {
    videoElement = document.querySelector('video');
  }
  return videoElement ? videoElement.currentTime : null;
}

// ============================================================================
// Diagnostic Utilities
// ============================================================================

/**
 * Diagnostic function to check subtitle display integrity
 * @param {object} subtitle - Subtitle to diagnose
 * @param {object} subtitle - Subtitle metadata
 * @param {object} context - Additional context (time, cacheCount, etc.)
 * @returns {object} Diagnostics object with missingFields array
 */
export function diagnoseBundleDisplay(fatSubtitle, subtitle, context = {}) {
  const missingFields = [];
  const diagnostics = {
    subtitleId: subtitle?.id || 'null',
    fatSubtitleExists: fatSubtitle !== null && fatSubtitle !== undefined,
    hasSubtitle: fatSubtitle?.subtitle !== undefined,
    hasTokens: fatSubtitle?.tokens !== undefined,
    hasDisplayTokens: fatSubtitle?.tokens?.display !== undefined,
    hasSenseTokens: fatSubtitle?.tokens?.senses !== undefined,
    displayTokensCount: fatSubtitle?.tokens?.display?.length || 0,
    senseTokensCount: fatSubtitle?.tokens?.senses?.length || 0,
    wordReferenceIdsCount: fatSubtitle?.subtitle?.wordReferenceIdsThai?.length || 0,
    cacheFatSubtitlesCount: context.cacheCount || 0,
    currentVideoTime: context.currentTime || null
  };

  if (!diagnostics.fatSubtitleExists) missingFields.push('fatSubtitle');
  if (!diagnostics.hasSubtitle) missingFields.push('subtitle');
  if (!diagnostics.hasTokens) missingFields.push('tokens');
  if (!diagnostics.hasDisplayTokens) missingFields.push('tokens.display');
  if (!diagnostics.hasSenseTokens) missingFields.push('tokens.senses');
  if (diagnostics.displayTokensCount === 0 && diagnostics.wordReferenceIdsCount > 0) missingFields.push('display tokens empty');
  if (diagnostics.senseTokensCount === 0 && diagnostics.wordReferenceIdsCount > 0) missingFields.push('sense tokens empty');

  return { ...diagnostics, missingFields };
}

// ============================================================================
// Netflix Seek Script Injection
// ============================================================================

/**
 * Netflix API access code - embedded as string to inject into page context
 * 
 * Netflix API Usage: This code runs in the page's main world where window.netflix is available
 * Content scripts cannot access Netflix API directly (isolated world)
 * Background script injects this code via chrome.tabs.executeScript
 * 
 * Seek Flow: Listens for SMARTSUBS_SEEK_PAGE messages → accesses window.netflix.appContext.state.playerApp.getAPI().videoPlayer.getVideoPlayerBySessionId(sessionIds[0]).seek(targetMs)
 * Converts seconds to milliseconds: targetMs = Math.round(timeSeconds * 1000)
 */
export const NETFLIX_SEEK_INJECT_CODE = `
(function() {
  'use strict';

  // Listen for seek messages from content script
  window.addEventListener('message', function(event) {
    // Only process messages from our extension
    if (!event.data || event.data.type !== 'SMARTSUBS_SEEK_PAGE' || typeof event.data.timeSeconds !== 'number') {
      return;
    }

    const timeSeconds = event.data.timeSeconds;
    if (isNaN(timeSeconds) || timeSeconds < 0) {
      return;
    }

    try {
      // Step 1: Check window.netflix
      if (!window.netflix) {
        return;
      }

      // Step 2: Check appContext
      if (!window.netflix.appContext) {
        return;
      }

      const appContext = window.netflix.appContext;
      const state = appContext.state;
      
      // Step 3: Check state
      if (!state) {
        return;
      }

      // Step 4: Check playerApp
      const playerApp = state.playerApp;
      if (!playerApp) {
        return;
      }

      // Step 5: Check getAPI
      const getAPI = playerApp.getAPI;
      if (!getAPI || typeof getAPI !== 'function') {
        return;
      }

      // Step 6: Get videoPlayerAPI
      const videoPlayerAPI = getAPI().videoPlayer;
      if (!videoPlayerAPI) {
        return;
      }

      // Step 7: Get session IDs
      const getAllPlayerSessionIds = videoPlayerAPI.getAllPlayerSessionIds;
      if (!getAllPlayerSessionIds || typeof getAllPlayerSessionIds !== 'function') {
        return;
      }

      const sessionIds = getAllPlayerSessionIds();
      if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
        return;
      }

      // Step 8: Get player
      const player = videoPlayerAPI.getVideoPlayerBySessionId(sessionIds[0]);
      if (!player) {
        return;
      }

      // Step 9: Check seek function
      if (typeof player.seek !== 'function') {
        return;
      }

      // Step 10: Execute seek
      const targetMs = Math.round(timeSeconds * 1000);
      player.seek(targetMs);
      
    } catch (error) {
      // Silent error handling
    }
  });
})();
`;

/**
 * Inject Netflix seek script into page context
 * 
 * Injection Mechanism: Content script requests injection via chrome.runtime.sendMessage
 * Background script handles injection via chrome.tabs.executeScript (has tabs API access)
 * This ensures the script runs in the page's main world where window.netflix is available
 * 
 * Note: This function manages its own state (scriptInjected, scriptInjectionPromise) via closure
 * @returns {Promise<void>}
 */
let scriptInjected = false;
let scriptInjectionPromise = null;

export async function injectNetflixSeekScript() {
  if (scriptInjected) {
    return;
  }

  // If injection is already in progress, wait for it
  if (scriptInjectionPromise) {
    return scriptInjectionPromise;
  }

  scriptInjectionPromise = (async () => {
    try {
      // Check if Chrome extension APIs are available
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        throw new Error('Chrome extension runtime is not available. Make sure the extension is loaded and background script is running.');
      }
      
      // Content scripts can't access chrome.tabs directly
      // Ask background script to handle injection (it has chrome.tabs access)
      const response = await chrome.runtime.sendMessage({
        type: 'INJECT_NETFLIX_SEEK_SCRIPT',
        code: NETFLIX_SEEK_INJECT_CODE
      });

      if (response && response.success) {
        scriptInjected = true;
        scriptInjectionPromise = null;
      } else {
        const errorMsg = response?.error || 'Unknown error';
        scriptInjected = false;
        scriptInjectionPromise = null;
      }
    } catch (error) {
      scriptInjected = false;
      scriptInjectionPromise = null;
    }
  })();

  return scriptInjectionPromise;
}

// ============================================================================
// Timeline Synchronization Helpers
// ============================================================================

/**
 * Force timeline to match subtitle - seeks video to subtitle's startSec
 * 
 * Netflix API Usage: Uses postMessage → injected script → window.netflix.player.seek flow
 * NEVER writes to video.currentTime directly (causes m7375 errors/crashes)
 * 
 * @param {object} subtitleMetadata - The subtitle metadata to sync timeline to
 */
export function forceTimelineToMatchSubtitle(subtitleMetadata) {
  if (!subtitleMetadata || !subtitleMetadata.startSecThai) return;
  
  const targetTime = subtitleMetadata.startSecThai;
  
  // Use only Netflix internal API for seeking (via postMessage bridge)
  // Never set video.currentTime directly - causes m7375 errors
  window.postMessage({
    type: 'SMARTSUBS_SEEK',
    timeSeconds: targetTime
  }, '*');
}

/**
 * Notify all timeline subscribers of subtitle change
 * @param {object} subtitleMetadata - The new subtitle metadata
 * @param {Set<Function>} timelineSubscribers - Set of subscriber callbacks
 * @param {Function} getCurrentSubtitle - Function to get current subtitle from timeline
 */
export function notifyTimelineSubscribers(subtitleMetadata, timelineSubscribers, getCurrentSubtitle) {
  // Validate timeline matches before notifying
  const timelineSubtitle = getCurrentSubtitle();
  const timelineMatches = timelineSubtitle && timelineSubtitle.id === subtitleMetadata.id;
  
  if (!timelineMatches && subtitleMetadata.startSecThai) {
    // Force timeline sync before notifying
    forceTimelineToMatchSubtitle(subtitleMetadata);
  }
  
  timelineSubscribers.forEach(callback => {
    try {
      callback(subtitleMetadata);
    } catch (error) {
      // Error in timeline subscriber callback
    }
  });
}

/**
 * Set current subtitle with timeline sync enforcement
 * Ensures subtitle displayed always matches video timeline
 * @param {object} subtitleMetadata - The subtitle metadata to set
 * @param {object} state - State object with currentSubtitle, lastRecordId, lastLoggedSubtitleId, manualSeekInProgress, timelineSubscribers, renderCallback
 * @param {Function} getCachedSubtitleByRecordId - Function to get subtitle by record ID
 * @param {Function} getCachedSubtitleCache - Function to get cached subtitle cache
 * @param {Function} getVideoCurrentTime - Function to get video current time
 * @param {Function} getCurrentSubtitle - Function to get current subtitle from timeline
 * @param {Function} diagnoseBundleDisplay - Diagnostic function
 * @param {Function} forceTimelineToMatchSubtitle - Function to force timeline sync
 * @returns {object} Updated state (mutates state object passed in)
 */
export function setCurrentSubtitleWithSync(
  subtitleMetadata,
  state,
  getCachedSubtitleByRecordId,
  getCachedSubtitleCache,
  getVideoCurrentTime,
  getCurrentSubtitle,
  diagnoseBundleDisplay,
  forceTimelineToMatchSubtitle
) {
  if (!subtitleMetadata) {
    state.currentSubtitle = null;
    state.lastRecordId = null;
    state.lastLoggedSubtitleId = null; // Reset logging when clearing
    return state;
  }
  
  const oldSubtitleId = state.currentSubtitle?.id || null;
  const newSubtitleId = subtitleMetadata.id;
  
  // Diagnostic logging (only when subtitle changes)
  if (newSubtitleId !== state.lastLoggedSubtitleId) {
    const fatSubtitle = getCachedSubtitleByRecordId(newSubtitleId);
    const fatSubtitles = getCachedSubtitleCache();
    const currentTime = getVideoCurrentTime(state.videoElement);
    
    const diagnostics = diagnoseBundleDisplay(fatSubtitle, subtitleMetadata, {
      cacheCount: fatSubtitles.length,
      currentTime: currentTime
    });
    
    state.lastLoggedSubtitleId = newSubtitleId;
  }
  
  // Check if subtitle matches timeline
  const timelineSubtitle = getCurrentSubtitle();
  const timelineMatches = timelineSubtitle && timelineSubtitle.id === subtitleMetadata.id;
  
  // Skip timeline enforcement if manual seek is in progress (prevents race condition)
  if (!timelineMatches && !state.manualSeekInProgress) {
    // Force timeline to match subtitle
    forceTimelineToMatchSubtitle(subtitleMetadata);
  }
  
  // Now set subtitle (timeline will sync via video events)
  state.currentSubtitle = subtitleMetadata;
  state.lastRecordId = subtitleMetadata.id;
  
  // Notify subscribers (without double validation - already checked above)
  state.timelineSubscribers.forEach(callback => {
    try {
      callback(subtitleMetadata);
    } catch (error) {
      // Error in timeline subscriber callback
    }
  });
  if (state.renderCallback) {
    state.renderCallback(subtitleMetadata);
  }
  
  return state;
}

/**
 * Check subtitle - Event-driven subtitle resolution
 * 
 * Called by video event handlers (timeupdate, seeked, play, pause, loadeddata)
 * Reads video.currentTime (read-only) and resolves subtitle via getCachedBundleAtTime(time)
 * Updates currentSubtitle if different and notifies subscribers
 * Handles auto-pause at endSec for editor workflow
 * 
 * Event-Driven Model: This function is NOT called via polling - only via video events
 * Throttling: Max once per 50ms, or if time changed significantly (>0.1s)
 * 
 * @param {object} state - State object
 * @param {object} helpers - Helper functions object
 * @returns {object} Updated state
 */
export function checkSubtitleBundle(state, helpers) {
  const {
    getCachedSubtitleCache,
    getBundleAtTime,
    checkSubtitleChanged,
    getCachedSubtitleByRecordId,
    getFreeplayMode,
    getVideoCurrentTime,
    diagnoseBundleDisplay,
    setCurrentSubtitleWithSync,
    clearReviewedTokens,
    selectToken
  } = helpers;
  
  const fatSubtitles = getCachedSubtitleCache();
  if (fatSubtitles.length === 0) {
    // Don't log this - it's expected during initial load
    return state;
  }
  
  if (!state.videoElement) {
    state.videoElement = document.querySelector('video');
    if (!state.videoElement) {
      // Don't log this - video might not be ready yet
      return state;
    }
  }
  
  // Read video.currentTime (read-only) - this is the authoritative timeline clock
  // video.currentTime is observable even during Netflix seeks and can be trusted once seeked event fires
  const seconds = state.videoElement.currentTime;
  
  if (seconds == null || isNaN(seconds)) {
    // If video time is not available yet, try to get initial fat subtitle at time 0
    const initialFatSubtitle = getBundleAtTime(0);
    if (initialFatSubtitle && initialFatSubtitle.subtitle) {
      const subtitleId = initialFatSubtitle.subtitle.id;
      if (!state.currentSubtitle || state.currentSubtitle.id !== subtitleId) {
        const { signature } = checkSubtitleChanged(initialFatSubtitle, null);
        state.lastBundleSignature = signature;
        setCurrentSubtitleWithSync(
          initialFatSubtitle.subtitle,
          state,
          getCachedSubtitleByRecordId,
          getCachedSubtitleCache,
          getVideoCurrentTime,
          helpers.getCurrentSubtitle,
          diagnoseBundleDisplay,
          helpers.forceTimelineToMatchSubtitle
        );
      }
    }
    return state;
  }
  
  // Throttle: only check if enough time has passed or time changed significantly
  const now = Date.now();
  const timeChanged = state.lastCheckSeconds === null || Math.abs(seconds - state.lastCheckSeconds) > 0.1;
  if (!timeChanged && (now - state.lastCheckTime < state.checkThrottleMs)) {
    return state; // Skip this check - too soon
  }
  state.lastCheckTime = now;
  state.lastCheckSeconds = seconds;
  
  const fatSubtitle = getBundleAtTime(seconds);
  
  // Diagnostic logging when subtitle detected (only when subtitle changes)
  if (fatSubtitle && fatSubtitle.subtitle && fatSubtitle.subtitle.id !== state.lastLoggedSubtitleId) {
    const fatSubtitles = getCachedSubtitleCache();
    const diagnostics = diagnoseBundleDisplay(fatSubtitle, fatSubtitle.subtitle, {
      cacheCount: fatSubtitles.length,
      currentTime: seconds
    });
  }
  
  // Auto-pause at endSec: If current subtitle has reached endSec and video is playing, pause for editor
  // This allows editor to review subtitle content without it disappearing
  // video.pause() is ALLOWED - we can control playback, just not timeline directly
  // Skip auto-pause if freeplay mode is active
  const isFreeplay = getFreeplayMode();
  if (!isFreeplay && state.currentSubtitle && state.currentSubtitle.endSec !== undefined && state.currentSubtitle.endSec !== null) {
    if (seconds >= state.currentSubtitle.endSec && state.videoElement && !state.videoElement.paused) {
      const video = document.querySelector('video');
      if (video && !video.paused) {
        video.pause();
      }
    }
  }
  
  // If paused at endSecThai, don't switch subtitle - keep current one visible for editor
  // BUT: Allow update if manual seek in progress OR if fat subtitle is different (we've moved)
  if (state.currentSubtitle && 
      state.currentSubtitle.endSecThai !== undefined && 
      state.currentSubtitle.endSecThai !== null &&
      seconds >= state.currentSubtitle.endSecThai &&
      state.videoElement && 
      state.videoElement.paused &&
      !state.manualSeekInProgress) { // Allow update during manual seeks
    // Check if fat subtitle is different - if so, we've moved, allow update
    const subtitleId = fatSubtitle?.subtitle?.id;
    const currentSubtitleId = state.currentSubtitle?.id;
    if (subtitleId === currentSubtitleId) {
      // Still on same subtitle - keep it visible
      return state;
    }
    // Fat subtitle is different - we've moved, allow update
  }
  
  const hasFatSubtitle = fatSubtitle !== null && fatSubtitle.subtitle !== undefined;
  const hasCurrentSubtitle = state.currentSubtitle !== null;
  const subtitleId = fatSubtitle?.subtitle?.id;
  const currentSubtitleId = state.currentSubtitle?.id;
  const differentRecordId = fatSubtitle && state.currentSubtitle && subtitleId !== currentSubtitleId;
  
  if (hasFatSubtitle && (!hasCurrentSubtitle || differentRecordId)) {
    const fatSubtitleSubtitle = fatSubtitle.subtitle;
    
    if (state.lastRecordId !== subtitleId) {
      // Set current subtitle ID for build logging
      if (typeof window !== 'undefined') {
        window.__currentSubtitleId = subtitleId;
      }
      
      const { signature } = checkSubtitleChanged(fatSubtitle, null);
      state.lastBundleSignature = signature;
      
      // Clear reviewed tokens and reset initial load flag for new subtitle
      clearReviewedTokens(subtitleId);
      
      // Don't auto-select token - let user or explicit calls handle selection
      selectToken(subtitleId, null);
      
      // Set subtitle with sync enforcement
      setCurrentSubtitleWithSync(
        fatSubtitleSubtitle,
        state,
        getCachedSubtitleByRecordId,
        getCachedSubtitleCache,
        getVideoCurrentTime,
        helpers.getCurrentSubtitle,
        diagnoseBundleDisplay,
        helpers.forceTimelineToMatchSubtitle
      );
    } else if (state.currentSubtitle && bundleId === currentSubtitleId) {
      const cachedBundle = getCachedSubtitleByRecordId(bundleId);
      if (cachedBundle) {
        const { changed, signature } = checkSubtitleChanged(cachedBundle, state.lastBundleSignature);
        
        if (changed) {
          state.lastBundleSignature = signature;
          setCurrentSubtitleWithSync(
            cachedBundle.subtitle,
            state,
            getCachedSubtitleByRecordId,
            getCachedSubtitleCache,
            getVideoCurrentTime,
            helpers.getCurrentSubtitle,
            diagnoseBundleDisplay,
            helpers.forceTimelineToMatchSubtitle
          );
        }
      }
    }
  }
  // If no subtitle at current time, don't show anything
  // Timeline is source of truth - subtitles only show when timeline matches
  
  return state;
}

// ============================================================================
// Event Listener Management
// ============================================================================

/**
 * Remove video event listeners
 * @param {HTMLVideoElement|null} videoElement - Video element
 * @param {object} handlers - Handler references object { timeupdateHandler, seekedHandler, playHandler, pauseHandler, loadedDataHandler }
 * @returns {object} Cleared handlers object
 */
export function removeVideoEventListeners(videoElement, handlers) {
  if (videoElement && handlers.timeupdateHandler) {
    videoElement.removeEventListener('timeupdate', handlers.timeupdateHandler);
    videoElement.removeEventListener('seeked', handlers.seekedHandler);
    videoElement.removeEventListener('play', handlers.playHandler);
    videoElement.removeEventListener('pause', handlers.pauseHandler);
    if (handlers.loadedDataHandler) {
      videoElement.removeEventListener('loadeddata', handlers.loadedDataHandler);
    }
  }
  
  return {
    timeupdateHandler: null,
    seekedHandler: null,
    playHandler: null,
    pauseHandler: null,
    loadedDataHandler: null
  };
}

/**
 * Attach video event listeners - Event-driven subtitle resolution setup
 * 
 * Event-Driven Model: All subtitle updates come from video events, not polling
 * - timeupdate: Continuous timeline updates during playback → checkSubtitleBundle()
 * - seeked: Explicit seek completion → clear manualSeekInProgress flag + checkSubtitleBundle()
 * - play: Playback started → checkSubtitleBundle()
 * - pause: Playback paused → checkSubtitleBundle()
 * - loadeddata: Video metadata loaded → checkSubtitleBundle()
 * 
 * Temporary Polling: setTimeout used only for initial video element discovery (not steady-state)
 * 
 * @param {object} state - State object with videoElement, manualSeekInProgress, handlers
 * @param {object} helpers - Helper functions object
 * @returns {object} Updated state with handlers
 */
export function attachVideoEventListeners(state, helpers) {
  const { checkSubtitleBundle } = helpers;
  
  if (!state.videoElement) {
    state.videoElement = document.querySelector('video');
  }
  
  if (!state.videoElement) {
    // Video element not found, try again later
    // Temporary polling acceptable for initial discovery only
    setTimeout(() => attachVideoEventListeners(state, helpers), 200);
    return state;
  }
  
  // Remove existing listeners if reattaching
  const clearedHandlers = removeVideoEventListeners(state.videoElement, {
    timeupdateHandler: state.timeupdateHandler,
    seekedHandler: state.seekedHandler,
    playHandler: state.playHandler,
    pauseHandler: state.pauseHandler,
    loadedDataHandler: state.loadedDataHandler
  });
  
  // Update state with cleared handlers
  state.timeupdateHandler = clearedHandlers.timeupdateHandler;
  state.seekedHandler = clearedHandlers.seekedHandler;
  state.playHandler = clearedHandlers.playHandler;
  state.pauseHandler = clearedHandlers.pauseHandler;
  state.loadedDataHandler = clearedHandlers.loadedDataHandler;
  
  // Create event handlers - all delegate to checkSubtitleBundle() for event-driven resolution
  state.timeupdateHandler = () => checkSubtitleBundle(state, helpers);
  state.seekedHandler = () => {
    // Clear manual seek flag when seek completes
    // After Netflix internal seek, video.currentTime updates normally and can be trusted
    state.manualSeekInProgress = false;
    checkSubtitleBundle(state, helpers);
  };
  state.playHandler = () => {
    checkSubtitleBundle(state, helpers);
    // Also check after a short delay when play starts
    // Temporary polling acceptable for initial state sync only
    setTimeout(() => checkSubtitleBundle(state, helpers), 100);
  };
  state.pauseHandler = () => checkSubtitleBundle(state, helpers);
  state.loadedDataHandler = () => {
    // Video metadata loaded, check immediately
    checkSubtitleBundle(state, helpers);
  };
  
  // Attach event listeners
  state.videoElement.addEventListener('timeupdate', state.timeupdateHandler);
  state.videoElement.addEventListener('seeked', state.seekedHandler);
  state.videoElement.addEventListener('play', state.playHandler);
  state.videoElement.addEventListener('pause', state.pauseHandler);
  state.videoElement.addEventListener('loadeddata', state.loadedDataHandler);
  
  // Initial check - try multiple times to ensure video is ready
  checkSubtitleBundle(state, helpers);
  setTimeout(() => {
    checkSubtitleBundle(state, helpers);
  }, 100);
  setTimeout(() => {
    checkSubtitleBundle(state, helpers);
  }, 500);
  
  // If video is already loaded, check immediately
  if (state.videoElement.readyState >= 2) {
    checkSubtitleBundle(state, helpers);
  }
  
  return state;
}

/**
 * Watch for video element being added/replaced
 * @param {object} state - State object with videoElement, videoObserver
 * @param {Function} attachCallback - Callback to attach listeners when video found
 * @returns {object} Updated state with videoObserver
 */
export function watchForVideoElement(state, attachCallback) {
  // Stop existing observer
  if (state.videoObserver) {
    state.videoObserver.disconnect();
  }
  
  // Watch for video element being added/replaced
  state.videoObserver = new MutationObserver(() => {
    const newVideo = document.querySelector('video');
    if (newVideo && newVideo !== state.videoElement) {
      state.videoElement = newVideo;
      attachCallback();
    }
  });
  
  state.videoObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  return state;
}

/**
 * Start event listeners
 * @param {object} state - State object
 * @param {object} helpers - Helper functions object
 * @returns {object} Updated state
 */
export function startEventListeners(state, helpers) {
  const { getCachedSubtitleCache, attachVideoEventListeners, watchForVideoElement } = helpers;
  
  const bundles = getCachedSubtitleCache();
  if (bundles.length === 0) {
    return state;
  }
  
  attachVideoEventListeners(state, helpers);
  watchForVideoElement(state, () => {
    attachVideoEventListeners(state, helpers);
  });
  
  return state;
}

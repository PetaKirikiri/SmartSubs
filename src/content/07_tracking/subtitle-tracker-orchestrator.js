/**
 * Subtitle Tracker Orchestrator - Timeline Observation and Seek Orchestration
 * 
 * CORE RESPONSIBILITY:
 * - Main function: `seekToSubtitleTime(recordId)` - Accepts recordId, resolves subtitle, seeks to subtitle.subtitle.startSecThai using Netflix internal API
 * - Secondary effect: When at a timestamp, resolve current subtitle from timeline and update UI state
 * 
 * NETFLIX PLAYBACK REALITY (NON-NEGOTIABLE):
 * 
 * Seeking Rules:
 * - FORBIDDEN: Writing to video.currentTime directly (causes m7375 errors/crashes)
 * - REQUIRED: ALL seeking MUST go through Netflix internal player API
 * - Flow: window.postMessage({ type: 'SMARTSUBS_SEEK', timeSeconds }) 
 *   → content script bridge → injected script 
 *   → window.netflix.appContext.state.playerApp.getAPI().videoPlayer.getVideoPlayerBySessionId(sessionIds[0]).seek(targetMs)
 * 
 * Video Element Rules:
 * - ALLOWED (Read-Only):
 *   - Read video.currentTime (authoritative timeline clock)
 *   - Read video.currentTime is observable even during Netflix seeks - after a Netflix internal seek, video.currentTime updates normally and can be trusted once seeked event fires
 *   - Read video.paused
 *   - Listen to events: timeupdate, seeked, play, pause, loadeddata
 * - ALLOWED (Control):
 *   - Call video.play()
 *   - Call video.pause()
 * - FORBIDDEN:
 *   - Writing to video.currentTime (causes m7375 errors/crashes)
 * 
 * TIMELINE OWNERSHIP:
 * - video.currentTime is the authoritative READ-ONLY timeline clock
 * - Subtitle resolution = function(time) → getCachedBundleAtTime(time)
 * - NEVER subtitle → time guessing
 * - ALWAYS time → subtitle lookup
 * 
 * EVENT-DRIVEN MODEL:
 * - Polling is NOT required for steady-state playback
 * - Video events provide all necessary timeline updates:
 *   - timeupdate → continuous subtitle updates during playback
 *   - seeked → subtitle update after seek completes
 *   - play → subtitle update when playback starts
 *   - pause → subtitle update when playback pauses
 *   - loadeddata → subtitle update when video metadata loads
 * - Temporary polling acceptable for:
 *   - Initial video element discovery
 *   - Initial subtitle availability check
 *   - Fallback timeout for async operations
 * - CRITICAL: Polling must NEVER be used to "chase" the timeline or compensate for missing events
 * 
 * RESPONSIBILITY BOUNDARIES:
 * - TrackSubtitle owns: timeline observation, seek execution, pause/play coordination, subtitle resolution
 * - JSX owns: rendering, visual state, sense selection UI
 * - JSX NEVER: reads video.currentTime directly, seeks video directly, decides subtitle timing
 * - Hotkeys.js: ONLY listens and delegates, contains ZERO playback logic
 */

import { getCachedSubtitleAtTime, getBundleAtTime, checkSubtitleChanged, getCachedSubtitleByRecordId, getCachedSubtitleCache, ensureMeaningsLoaded } from '../05_cache/cache-subtitles.js';
import { getFreeplayMode } from './hotkeys.js';
import { getMediaIdFromUrl } from '../01_load-subtitles/helpers/extract-metadata.js';

// Import helpers
import {
  getVideoCurrentTime,
  diagnoseBundleDisplay,
  NETFLIX_SEEK_INJECT_CODE,
  injectNetflixSeekScript,
  forceTimelineToMatchSubtitle,
  notifyTimelineSubscribers,
  setCurrentSubtitleWithSync,
  checkSubtitleBundle,
  attachVideoEventListeners,
  removeVideoEventListeners,
  watchForVideoElement,
  startEventListeners
} from './helpers/tracker-helpers.js';

// Re-export helpers for backward compatibility
export {
  getVideoCurrentTime,
  diagnoseBundleDisplay,
  NETFLIX_SEEK_INJECT_CODE,
  injectNetflixSeekScript,
  forceTimelineToMatchSubtitle,
  notifyTimelineSubscribers,
  setCurrentSubtitleWithSync,
  checkSubtitleBundle,
  attachVideoEventListeners,
  removeVideoEventListeners,
  watchForVideoElement,
  startEventListeners
};

// ============================================================================
// State Management
// ============================================================================

let currentSubtitle = null; // Cleared initially for diagnostics
let renderCallback = null;
let timelineSubscribers = new Set(); // Set of callbacks for timeline changes
let videoElement = null;
let lastLoggedSubtitleId = null; // Track last logged subtitle to prevent spam
let timeupdateHandler = null;
let seekedHandler = null;
let playHandler = null;
let pauseHandler = null;
let loadedDataHandler = null;
let videoObserver = null;
let currentMediaId = null;
let manualSeekInProgress = false;

// Token selection state
let tokenSelectionCallbacks = new Map(); // recordId -> callback(recordId, tokenIndex)
let selectedTokens = new Map(); // recordId -> tokenIndex
let reviewedTokens = new Map(); // recordId -> Set<tokenIndex>
let isInitialLoad = new Map(); // recordId -> boolean

// Subtitle checking logic (extracted from polling)
let lastBundleSignature = null;
let lastRecordId = null;

// Throttle checkSubtitleBundle to reduce spam during seeks
let lastCheckTime = 0;
let lastCheckSeconds = null;
let checkThrottleMs = 50; // Check at most every 50ms

// ============================================================================
// State Object Helper
// ============================================================================

/**
 * Get state object for passing to helpers
 * @returns {object} State object
 */
function getState() {
  return {
    currentSubtitle,
    renderCallback,
    timelineSubscribers,
    videoElement,
    lastLoggedSubtitleId,
    timeupdateHandler,
    seekedHandler,
    playHandler,
    pauseHandler,
    loadedDataHandler,
    videoObserver,
    currentMediaId,
    manualSeekInProgress,
    tokenSelectionCallbacks,
    selectedTokens,
    reviewedTokens,
    isInitialLoad,
    lastBundleSignature,
    lastRecordId,
    lastCheckTime,
    lastCheckSeconds,
    checkThrottleMs
  };
}

/**
 * Update state from state object (for state mutations from helpers)
 * @param {object} state - State object from helpers
 */
function updateState(state) {
  currentSubtitle = state.currentSubtitle;
  renderCallback = state.renderCallback;
  timelineSubscribers = state.timelineSubscribers;
  videoElement = state.videoElement;
  lastLoggedSubtitleId = state.lastLoggedSubtitleId;
  timeupdateHandler = state.timeupdateHandler;
  seekedHandler = state.seekedHandler;
  playHandler = state.playHandler;
  pauseHandler = state.pauseHandler;
  loadedDataHandler = state.loadedDataHandler;
  videoObserver = state.videoObserver;
  currentMediaId = state.currentMediaId;
  manualSeekInProgress = state.manualSeekInProgress;
  tokenSelectionCallbacks = state.tokenSelectionCallbacks;
  selectedTokens = state.selectedTokens;
  reviewedTokens = state.reviewedTokens;
  isInitialLoad = state.isInitialLoad;
  lastBundleSignature = state.lastBundleSignature;
  lastRecordId = state.lastRecordId;
  lastCheckTime = state.lastCheckTime;
  lastCheckSeconds = state.lastCheckSeconds;
  checkThrottleMs = state.checkThrottleMs;
}

// Cache helpers object to avoid recreating it
let cachedHelpers = null;

/**
 * Get helpers object for passing to helper functions
 * @returns {object} Helpers object
 */
function getHelpers() {
  if (cachedHelpers) {
    return cachedHelpers;
  }
  
  cachedHelpers = {
    getCachedSubtitleCache,
    getBundleAtTime,
    checkSubtitleChanged,
    getCachedSubtitleByRecordId,
    getFreeplayMode,
    getVideoCurrentTime: (videoEl) => getVideoCurrentTime(videoEl),
    diagnoseBundleDisplay,
    setCurrentSubtitleWithSync: (subtitle, state, ...args) => {
      const updatedState = setCurrentSubtitleWithSync(subtitle, state, ...args);
      updateState(updatedState);
      return updatedState;
    },
    forceTimelineToMatchSubtitle,
    getCurrentSubtitle: () => {
      const time = getVideoCurrentTime(videoElement);
      if (time == null || isNaN(time)) {
        return null;
      }
      const fatSubtitle = getCachedSubtitleAtTime(time);
      return fatSubtitle?.subtitle ?? null;
    },
    clearReviewedTokens: (recordId) => {
      reviewedTokens.delete(recordId);
      isInitialLoad.set(recordId, true);
      setTimeout(() => {
        isInitialLoad.set(recordId, false);
      }, 500);
    },
    selectToken: (recordId, tokenIndex) => {
      if (!recordId) return;
      
      if (tokenIndex === null || tokenIndex === undefined) {
        // Clear selection
        selectedTokens.delete(recordId);
        const callback = tokenSelectionCallbacks.get(recordId);
        if (callback) {
          callback(recordId, null);
        }
        return;
      }
      
      // Set selection
      selectedTokens.set(recordId, tokenIndex);
      const callback = tokenSelectionCallbacks.get(recordId);
      if (callback) {
        callback(recordId, tokenIndex);
      }
    },
    checkSubtitleBundle: (state) => {
      const updatedState = checkSubtitleBundle(state, cachedHelpers);
      updateState(updatedState);
      return updatedState;
    },
    attachVideoEventListeners: (state) => {
      const updatedState = attachVideoEventListeners(state, cachedHelpers);
      updateState(updatedState);
      return updatedState;
    },
    removeVideoEventListeners: (videoElement, handlers) => {
      return removeVideoEventListeners(videoElement, handlers);
    },
    watchForVideoElement: (state, attachCallback) => {
      const updatedState = watchForVideoElement(state, attachCallback);
      updateState(updatedState);
      return updatedState;
    },
    startEventListeners: (state) => {
      const updatedState = startEventListeners(state, cachedHelpers);
      updateState(updatedState);
      return updatedState;
    }
  };
  
  return cachedHelpers;
}

// ============================================================================
// Public API - Timeline Access
// ============================================================================

/**
 * Get current subtitle from timeline (always fresh - single source of truth)
 * 
 * Timeline Ownership: Reads video.currentTime (read-only) and resolves subtitle via time → subtitle lookup
 * NEVER guesses subtitle from stale state - always queries timeline
 * 
 * @returns {object|null} Current subtitle metadata based on video timeline
 */
export function getCurrentSubtitle() {
  const time = getVideoCurrentTime(videoElement);
  if (time == null || isNaN(time)) {
    // Don't fallback to stale currentSubtitle - return null
    // Timeline is source of truth - if time unavailable, no subtitle
    return null;
  }
  const fatSubtitle = getCachedSubtitleAtTime(time);
  return fatSubtitle?.subtitle ?? null;
}

/**
 * Get current subtitle ID from timeline
 * @returns {string|null} Current subtitle recordId
 */
export function getCurrentSubtitleId() {
  return getCurrentSubtitle()?.id || null;
}

/**
 * Subscribe to timeline-driven subtitle changes
 * @param {function} callback - Function called with (subtitleMetadata) when subtitle changes
 * @returns {function} Unsubscribe function
 */
export function subscribeToTimelineChanges(callback) {
  if (typeof callback !== 'function') {
    throw new Error('Callback must be a function');
  }
  
  timelineSubscribers.add(callback);
  
  // Immediately call with current subtitle if available
  const current = getCurrentSubtitle();
  if (current) {
    try {
      callback(current);
    } catch (error) {
      // Error in callback
    }
  }
  
  // Return unsubscribe function
  return () => {
    timelineSubscribers.delete(callback);
  };
}

/**
 * Force sync with timeline - re-check current time and update subtitle
 */
export function forceTimelineSync() {
  const state = getState();
  const helpers = getHelpers();
  const updatedState = checkSubtitleBundle(state, helpers);
  updateState(updatedState);
}

// ============================================================================
// Public API - Tracking Control
// ============================================================================

export function startTrackingVideoTime(onRender) {
  renderCallback = onRender;
  const mediaId = getMediaIdFromUrl();
  if (!mediaId) {
    return;
  }
  
  currentMediaId = mediaId;
  
  const checkCacheAndStart = () => {
    const fatSubtitles = getCachedSubtitleCache();
    
    if (fatSubtitles.length === 0) {
      setTimeout(checkCacheAndStart, 200);
      return;
    }
    
    const currentTime = getVideoCurrentTime(videoElement);
    if (currentTime !== null) {
      const immediateFatSubtitle = getBundleAtTime(currentTime);
      if (immediateFatSubtitle) {
        const state = getState();
        const helpers = getHelpers();
        const updatedState = setCurrentSubtitleWithSync(
          immediateFatSubtitle.subtitle,
          state,
          getCachedSubtitleByRecordId,
          getCachedSubtitleCache,
          (videoEl) => getVideoCurrentTime(videoEl),
          helpers.getCurrentSubtitle,
          diagnoseBundleDisplay,
          forceTimelineToMatchSubtitle
        );
        updateState(updatedState);
      }
    }
    
    const state = getState();
    const helpers = getHelpers();
    const updatedState = startEventListeners(state, helpers);
    updateState(updatedState);
  };
  
  checkCacheAndStart();
}

export function startTrackingVideoTimeWithCacheCheck(onRender) {
  const checkCacheAndStart = () => {
    const fatSubtitles = getCachedSubtitleCache();
    
    if (fatSubtitles.length === 0) {
      setTimeout(checkCacheAndStart, 200);
      return;
    }
    
    startTrackingVideoTime(onRender);
  };
  
  checkCacheAndStart();
}

export function stopSubtitleController() {
  const state = getState();
  const clearedHandlers = removeVideoEventListeners(state.videoElement, {
    timeupdateHandler: state.timeupdateHandler,
    seekedHandler: state.seekedHandler,
    playHandler: state.playHandler,
    pauseHandler: state.pauseHandler,
    loadedDataHandler: state.loadedDataHandler
  });
  
  if (state.videoObserver) {
    state.videoObserver.disconnect();
    state.videoObserver = null;
  }
  
  videoElement = null;
  const helpers = getHelpers();
  const updatedState = setCurrentSubtitleWithSync(
    null,
    getState(),
    getCachedSubtitleByRecordId,
    getCachedSubtitleCache,
    (videoEl) => getVideoCurrentTime(videoEl),
    helpers.getCurrentSubtitle,
    diagnoseBundleDisplay,
    forceTimelineToMatchSubtitle
  );
  updateState(updatedState);
  
  renderCallback = null;
  timelineSubscribers.clear();
  currentMediaId = null;
  lastBundleSignature = null;
  lastRecordId = null;
  tokenSelectionCallbacks.clear();
  selectedTokens.clear();
  reviewedTokens.clear();
  isInitialLoad.clear();
}

// ============================================================================
// Public API - Token Selection Management
// ============================================================================

export function registerTokenSelectionCallback(recordId, callback) {
  if (recordId && callback) {
    tokenSelectionCallbacks.set(recordId, callback);
  }
}

export function unregisterTokenSelectionCallback(recordId) {
  tokenSelectionCallbacks.delete(recordId);
}

export function getSelectedToken(recordId) {
  return selectedTokens.get(recordId) ?? null;
}

export function isTokenReviewed(recordId, tokenIndex) {
  const reviewedSet = reviewedTokens.get(recordId);
  return reviewedSet ? reviewedSet.has(tokenIndex) : false;
}

export function markTokenAsReviewed(recordId, tokenIndex) {
  if (!recordId || tokenIndex === null || tokenIndex === undefined) return;
  if (!reviewedTokens.has(recordId)) {
    reviewedTokens.set(recordId, new Set());
  }
  reviewedTokens.get(recordId).add(tokenIndex);
}

export function clearReviewedTokens(recordId) {
  reviewedTokens.delete(recordId);
  isInitialLoad.set(recordId, true);
  setTimeout(() => {
    isInitialLoad.set(recordId, false);
  }, 500);
}

export function selectToken(recordId, tokenIndex) {
  if (!recordId) return;
  
  if (tokenIndex === null || tokenIndex === undefined) {
    // Clear selection
    selectedTokens.delete(recordId);
    const callback = tokenSelectionCallbacks.get(recordId);
    if (callback) {
      callback(recordId, null);
    }
    return;
  }
  
  // Set selection
  selectedTokens.set(recordId, tokenIndex);
  const callback = tokenSelectionCallbacks.get(recordId);
  if (callback) {
    callback(recordId, tokenIndex);
  }
}

export async function advanceToNextToken(recordId, currentTokenIndex) {
  const fatSubtitle = getCachedSubtitleByRecordId(recordId);
  if (!fatSubtitle) return null;
  
  if (!fatSubtitle.tokens) return null;
  
  const displayTokens = fatSubtitle.tokens.display || [];
  const reviewedSet = reviewedTokens.get(recordId) || new Set();
  
  // Find next unreviewed token
  // Get thaiScript from wordReferenceIdsThai
  const wordReferenceIdsThai = fatSubtitle.subtitle?.wordReferenceIdsThai || [];
  
  for (let i = (currentTokenIndex !== null ? currentTokenIndex : -1) + 1; i < displayTokens.length; i++) {
    const wordRef = wordReferenceIdsThai[i];
    if (!wordRef) continue;
    
    // Parse wordReferenceId to get thaiScript
    const parsed = wordRef.split(':');
    const thaiScript = parsed[0]?.trim();
    if (!thaiScript) continue;
    
    if (!reviewedSet.has(i)) {
      // Found next unreviewed token
      markTokenAsReviewed(recordId, currentTokenIndex);
      selectToken(recordId, i);
      
      // Only ensure meanings are loaded if NOT during initial load (user-initiated action)
      if (thaiScript && !isInitialLoad.get(recordId)) {
        await ensureMeaningsLoaded(recordId, thaiScript);
      }
      
      return i;
    }
  }
  
  return null;
}

export async function handleTokenProcessed(recordId, tokenIndex, isUserAction = false) {
  if (!recordId || tokenIndex === null || tokenIndex === undefined) return;
  
  // Don't auto-advance on initial load
  if (isInitialLoad.get(recordId)) {
    isInitialLoad.set(recordId, false);
    return;
  }
  
  // Only proceed if user action
  if (!isUserAction) return;
  
  const fatSubtitle = getCachedSubtitleByRecordId(recordId);
  if (!fatSubtitle || !fatSubtitle.tokens) return;
  
  const displayTokens = fatSubtitle.tokens.display || [];
  const wordReferenceIdsThai = fatSubtitle.subtitle?.wordReferenceIdsThai || [];
  
  // Filter valid tokens (those that have wordReferenceIdsThai)
  const validTokens = displayTokens.filter((token, index) => {
    const wordRef = wordReferenceIdsThai[index];
    if (!wordRef) return false;
    const parsed = wordRef.split(':');
    const thaiScript = parsed[0]?.trim();
    return thaiScript && !thaiScript.startsWith('[missing:') && !thaiScript.startsWith('[empty:');
  });
  if (validTokens.length === 0) return;
  
  // Try to advance to next token
  const nextIndex = await advanceToNextToken(recordId, tokenIndex);
  
  if (nextIndex !== null) {
    // Next token found and selected
    return;
  }
  
  // No next token - check if all tokens reviewed
  const reviewedSet = reviewedTokens.get(recordId) || new Set();
  let allTokensReviewed = true;
  
  for (let i = 0; i < displayTokens.length; i++) {
    const wordRef = wordReferenceIdsThai[i];
    if (wordRef) {
      const parsed = wordRef.split(':');
      const thaiScript = parsed[0]?.trim();
      if (thaiScript && !reviewedSet.has(i)) {
        allTokensReviewed = false;
        break;
      }
    }
  }
  
  if (allTokensReviewed && reviewedSet.size > 0) {
    // All tokens reviewed - mark current and resume video
    markTokenAsReviewed(recordId, tokenIndex);
    selectToken(recordId, null);
    const video = document.querySelector('video');
    if (video && video.paused) {
      video.play();
    }
  }
}

// ============================================================================
// Public API - Video Playback Controls
// ============================================================================

export function pauseVideoPlayback() {
  const video = document.querySelector('video');
  if (video && !video.paused) {
    video.pause();
  }
}

export function resumeVideoPlayback() {
  const video = document.querySelector('video');
  if (video && video.paused) {
    video.play();
  }
}

export function pauseForEdit() {
  const video = document.querySelector('video');
  if (video && !video.paused) {
    video.pause();
  }
}

// ============================================================================
// Netflix Seek Bridge
// ============================================================================

/**
 * Netflix seek bridge - Content script side
 * 
 * Netflix API Usage: Thin bridge that forwards messages to injected script
 * - Listens for SMARTSUBS_SEEK messages from TrackSubtitle functions
 * - Ensures injected script is present (via injectNetflixSeekScript())
 * - Forwards to injected script as SMARTSUBS_SEEK_PAGE
 * - All Netflix API logic and verification is embedded in NETFLIX_SEEK_INJECT_CODE
 */
window.addEventListener('message', async (event) => {
  if (!event.data || event.data.type !== 'SMARTSUBS_SEEK' || typeof event.data.timeSeconds !== 'number') {
    return;
  }

  const timeSeconds = event.data.timeSeconds;
  if (isNaN(timeSeconds) || timeSeconds < 0) {
    return;
  }

  // Ensure script is injected
  await injectNetflixSeekScript();

  // Forward seek message to injected script in page context
  // The injected script handles all Netflix API access, verification, and logging
  window.postMessage({
    type: 'SMARTSUBS_SEEK_PAGE',
    timeSeconds: timeSeconds
  }, '*');
});

// ============================================================================
// Public API - Navigation Functions
// ============================================================================

/**
 * Advance to next subtitle - Navigation function
 * 
 * Hotkey Behavior: ArrowRight calls this function
 * - Seeks to START of NEXT subtitle using Netflix internal API
 * - PAUSES video immediately (editor-first workflow)
 * - Playback resumes only via ArrowLeft or Space
 * - Purpose: Navigate to next subtitle for editor review, pause for reflection
 */
export function advanceToNextSubtitle() {
  if (!currentSubtitle || !currentSubtitle.id) {
    return;
  }
  
  const currentId = currentSubtitle.id;
  const cache = getCachedSubtitleCache();
  const currentIndex = cache.findIndex(s => s.subtitle?.id === currentId);
  
  if (currentIndex >= 0 && currentIndex < cache.length - 1) {
    const nextBundle = cache[currentIndex + 1];
    if (!nextBundle.subtitle) {
      return;
    }
    
    const nextId = nextBundle.subtitle.id;
    const startSecThai = nextBundle.subtitle.startSecThai;
    if (startSecThai != null) {
      seekToSubtitleTime(nextId);
      // PAUSE video immediately (editor-first workflow)
      // Playback resumes only via ArrowLeft or Space
      const video = document.querySelector('video');
      if (video && !video.paused) {
        video.pause();
      }
    }
  }
}

/**
 * Restart current subtitle - Navigation function
 * 
 * Hotkey Behavior: ArrowLeft calls this function
 * - Seeks to START of CURRENT subtitle using Netflix internal API
 * - PLAYS video (if paused)
 * - AUTO-PAUSES at endSec (handled by checkSubtitleBundle())
 * - Purpose: Replay current subtitle + editor reflection
 */
export function restartCurrentSubtitle() {
  if (!currentSubtitle || !currentSubtitle.id) {
    return;
  }
  
  const startSecThai = currentSubtitle.startSecThai;
  
  if (startSecThai != null) {
    seekToSubtitleTime(currentSubtitle.id);
    // Resume playback if paused
    const video = document.querySelector('video');
    if (video && video.paused) {
      video.play();
    }
  }
}

/**
 * Go to previous subtitle - Navigation function
 * 
 * Hotkey Behavior: ArrowUp calls this function
 * - Seeks to START of PREVIOUS subtitle using Netflix internal API
 * - PAUSES video immediately (editor-first workflow)
 * - Playback resumes only via ArrowLeft or Space
 * - Purpose: Navigate to previous subtitle for editor review, pause for reflection
 */
export function goToPreviousSubtitle() {
  const currentSubtitle = getCurrentSubtitle(); // Use fresh data from timeline
  if (!currentSubtitle || !currentSubtitle.id) {
    return;
  }
  
  const currentId = currentSubtitle.id;
  const cache = getCachedSubtitleCache();
  const currentIndex = cache.findIndex(s => s.subtitle?.id === currentId);
  
  if (currentIndex > 0) {
    const previousBundle = cache[currentIndex - 1];
    if (!previousBundle.subtitle) {
      return;
    }
    
    const previousId = previousBundle.subtitle.id;
    const startSecThai = previousBundle.subtitle.startSecThai;
    if (startSecThai != null) {
      seekToSubtitleTime(previousId);
      // PAUSE video immediately (editor-first workflow)
      // Playback resumes only via ArrowLeft or Space
      const video = document.querySelector('video');
      if (video && !video.paused) {
        video.pause();
      }
    }
  }
}

// Keep old function name for backwards compatibility (if needed)
export function moveToPreviousSubtitle() {
  goToPreviousSubtitle();
}

/**
 * Seek to subtitle time - Main seek function
 * 
 * CORE RESPONSIBILITY: Accepts recordId, resolves subtitle, seeks to subtitle.subtitle.startSec using Netflix internal API
 * 
 * Netflix API Usage: Uses postMessage → injected script → window.netflix.player.seek flow
 * NEVER writes to video.currentTime directly (causes m7375 errors/crashes)
 * 
 * Manual Seek Flag: Sets manualSeekInProgress = true to prevent timeline enforcement from overriding manual seek
 * Flag cleared by seekedHandler when seek completes (fallback timeout after 1000ms)
 * 
 * @param {string} recordId - Subtitle record ID
 */
export function seekToSubtitleTime(recordId) {
  const fatSubtitle = getCachedSubtitleByRecordId(recordId);
  if (!fatSubtitle) {
    return;
  }
  
  const targetTime = fatSubtitle.subtitle?.startSecThai;
  if (targetTime == null) {
    return;
  }
  
  // Set flag to prevent timeline enforcement from overriding manual seek
  manualSeekInProgress = true;
  
  // Use only Netflix internal API for seeking (via postMessage bridge)
  // NEVER write to video.currentTime directly
  window.postMessage({
    type: 'SMARTSUBS_SEEK',
    timeSeconds: targetTime
  }, '*');
  
  // Clear flag after timeout as fallback (seekedHandler also clears it)
  // Temporary polling acceptable for fallback timeout only
  setTimeout(() => {
    manualSeekInProgress = false;
  }, 1000);
}

/**
 * Content Script Entry Point + Main Orchestrator
 * Orchestrates ALL sequences: "ok that's done, now do this"
 * JSX files manage visual state only - no utility orchestration
 */


// Import identify video to get metadata JSON
import { inspectNetflixMetadata, getMediaIdFromUrl } from './01_load-subtitles/helpers/extract-metadata.js';
// Test function imports (kept for console testing)
import { fetchEnglishVTTContent, parseEnglishVTTContent } from './03_process/helpers/01_vtt/vtt.js';
// Load orchestrator imports
import { passFatBundle } from './01_load-subtitles/load-subtitles-orchestrator.js';
import { seedGate } from './02_seed_gate/helpers/seed-gate.js';
// CRITICAL: content.js ONLY calls orchestrators - removed direct imports of process/cache/save helpers
// All processing/caching/saving is handled by orchestrators in numbered folders

// Track subtitles currently being processed to prevent duplicate processing
const processingSubtitleIds = new Set();

// ============================================================================
// Tracking State - Master tracking for ALL subtitle operations
// ============================================================================

import { FIELD_REGISTRY } from './05_save/helpers/field-registry.js';

// Master tracking state: subtitleId -> tracking object
const subtitleTracking = new Map();

// Report storage: subtitleId -> report object
const subtitleReports = new Map();

/**
 * Check if a field exists in fat bundle
 * Handles nested paths like 'tokens.displayThai[0].g2p' or 'thai'
 */
function fieldExistsInFatBundle(fatBundle, fieldPath) {
  if (!fatBundle || !fieldPath) return false;
  
  // Always expect package format: { subtitle: {...}, tokens: {...} }
  // Handle top-level fields (check in subtitle object)
  if (!fieldPath.includes('.')) {
    return fatBundle.subtitle && fatBundle.subtitle[fieldPath] !== undefined && fatBundle.subtitle[fieldPath] !== null;
  }
  
  // Handle nested paths - for template paths with [i], check if structure exists
  const parts = fieldPath.split('.');
  let current = fatBundle.subtitle;
  
  // Check in fatBundle.subtitle (package format)
  if (!current) {
    return false;
  }
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (part.includes('[')) {
      const [arrayName, indexPart] = part.split('[');
      if (current[arrayName] && Array.isArray(current[arrayName])) {
        // For template paths with [i], check if array has items
        if (indexPart === 'i]') {
          current = current[arrayName].length > 0 ? current[arrayName][0] : null;
        } else {
          const index = parseInt(indexPart.replace(']', ''), 10);
          current = current[arrayName] && current[arrayName][index] ? current[arrayName][index] : null;
        }
      } else {
        return false;
      }
    } else {
      current = current && current[part] !== undefined ? current[part] : null;
    }
    
    if (current === null || current === undefined) {
      return false;
    }
  }
  
  return true;
}

/**
 * Initialize tracking for a subtitle from FIELD_REGISTRY
 * Ensures ALL fields have tracking entries
 */
function initializeSubtitleTracking(subtitleId) {
  const tracking = {
    fields: {},
    subtitle: {
      wasLoadedFromFirebase: false,
      wasCached: false,
      wasSaved: false,
      isDisplayed: false
    }
  };
  
  // Initialize ALL fields from FIELD_REGISTRY systematically
  const allFields = [
    ...FIELD_REGISTRY.topLevel,
    ...FIELD_REGISTRY.tokenLevel
  ];
  
  for (const fieldDef of allFields) {
    tracking.fields[fieldDef.field] = {
      helperCalled: null,
      wasLoadedFromFirebase: false,
      wasCached: false,
      wasSaved: false,
      isDisplayed: false,
      dataStatus: 'clean', // Track data status explicitly
      validation: 'unknown', // Track validation status
      error: null // Track errors
    };
  }
  
  // Initialize sense-level fields with full template paths
  // Sense-level fields need template paths like tokens.sensesThai[i].senses[i].id
  // We create entries for both Thai and English senses
  for (const senseFieldDef of FIELD_REGISTRY.senseLevel) {
    // Thai senses: tokens.sensesThai[i].senses[i].fieldName
    const thaiSensePath = `tokens.sensesThai[i].senses[i].${senseFieldDef.field}`;
    tracking.fields[thaiSensePath] = {
      helperCalled: null,
      wasLoadedFromFirebase: false,
      wasCached: false,
      wasSaved: false,
      isDisplayed: false,
      dataStatus: 'clean',
      validation: 'unknown',
      error: null
    };
    
    // English senses: tokens.sensesEnglish[i].senses[i].fieldName
    const engSensePath = `tokens.sensesEnglish[i].senses[i].${senseFieldDef.field}`;
    tracking.fields[engSensePath] = {
      helperCalled: null,
      wasLoadedFromFirebase: false,
      wasCached: false,
      wasSaved: false,
      isDisplayed: false,
      dataStatus: 'clean',
      validation: 'unknown',
      error: null
    };
  }
  
  subtitleTracking.set(subtitleId, tracking);
  return tracking;
}

/**
 * Get tracking for subtitle (initialize if needed)
 */
function getSubtitleTracking(subtitleId) {
  if (!subtitleId) return null;
  if (!subtitleTracking.has(subtitleId)) {
    initializeSubtitleTracking(subtitleId);
  }
  return subtitleTracking.get(subtitleId);
}

// ============================================================================
// Window Handlers - Orchestrators report confirmations via these handlers
// ============================================================================

if (typeof window !== 'undefined') {
  // Report helper was called
  window.__reportHelperCalled = (subtitleId, helperName, fieldPaths) => {
    if (!subtitleId || !helperName || !fieldPaths) return;
    const tracking = getSubtitleTracking(subtitleId);
    if (!tracking) return;
    
    // fieldPaths is array of field paths from FIELD_REGISTRY
    for (const fieldPath of fieldPaths) {
      if (tracking.fields[fieldPath]) {
        tracking.fields[fieldPath].helperCalled = helperName;
      }
    }
  };

  // Report Firebase load
  window.__reportFirebaseLoad = (subtitleId, loadedFields) => {
    if (!subtitleId) return;
    const tracking = getSubtitleTracking(subtitleId);
    if (!tracking) return;
    
    tracking.subtitle.wasLoadedFromFirebase = true;
    // loadedFields is array of field paths that were loaded
    if (loadedFields && Array.isArray(loadedFields)) {
      for (const fieldPath of loadedFields) {
        if (tracking.fields[fieldPath]) {
          tracking.fields[fieldPath].wasLoadedFromFirebase = true;
        }
      }
    }
  };

  // Report cache operation
  window.__reportCache = (subtitleId, cachedFields) => {
    if (!subtitleId) return;
    const tracking = getSubtitleTracking(subtitleId);
    if (!tracking) return;
    
    tracking.subtitle.wasCached = true;
    if (cachedFields && Array.isArray(cachedFields)) {
      for (const fieldPath of cachedFields) {
        if (tracking.fields[fieldPath]) {
          tracking.fields[fieldPath].wasCached = true;
        }
      }
    }
  };

  // Report display operation (called by subtitle-area.jsx when it receives and renders a bundle)
  window.__reportDisplay = (subtitleId, displayedFields) => {
    if (!subtitleId) return;
    const tracking = getSubtitleTracking(subtitleId);
    if (!tracking) return;
    
    tracking.subtitle.isDisplayed = true;
    if (displayedFields && Array.isArray(displayedFields)) {
      for (const fieldPath of displayedFields) {
        if (tracking.fields[fieldPath]) {
          tracking.fields[fieldPath].isDisplayed = true;
        }
      }
    }
  };

  // Report save operation
  window.__reportSave = (subtitleId, savedFields) => {
    if (!subtitleId) return;
    const tracking = getSubtitleTracking(subtitleId);
    if (!tracking) return;
    
    tracking.subtitle.wasSaved = true;
    if (savedFields && Array.isArray(savedFields)) {
      for (const fieldPath of savedFields) {
        if (tracking.fields[fieldPath]) {
          tracking.fields[fieldPath].wasSaved = true;
        }
      }
    }
  };

  // Report data status
  window.__reportDataStatus = (subtitleId, fieldPath, status) => {
    // status: 'clean' | 'dirty'
    const tracking = getSubtitleTracking(subtitleId);
    if (!tracking || !tracking.fields[fieldPath]) return;
    tracking.fields[fieldPath].dataStatus = status;
  };

  // Reset tracking for cache load (tracking is ephemeral, not persistent)
  window.__resetTrackingForCache = (subtitleId) => {
    const tracking = getSubtitleTracking(subtitleId);
    if (!tracking) return;
    
    // Reset wasSaved - tracking only reflects current state, not historical saves
    tracking.subtitle.wasSaved = false;
    for (const fieldPath in tracking.fields) {
      tracking.fields[fieldPath].wasSaved = false;
    }
  };


  // Report error
  window.__reportError = (subtitleId, fieldPath, errorMessage) => {
    // errorMessage: string | null
    const tracking = getSubtitleTracking(subtitleId);
    if (!tracking || !tracking.fields[fieldPath]) return;
    tracking.fields[fieldPath].error = errorMessage;
  };

  // Expose getter for report generation
  window.__getSubtitleTracking = (subtitleId) => {
    return getSubtitleTracking(subtitleId);
  };

  // Report storage functions
  window.__setSubtitleReport = (subtitleId, reportObject) => {
    subtitleReports.set(subtitleId, reportObject);
  };

  window.__getSubtitleReport = (subtitleId) => {
    return subtitleReports.get(subtitleId) || null;
  };
}

/**
 * Test function to fetch and log English subtitles
 * Proof of concept: confirms we can access English VTT
 * Call from console: window.testEnglishSubtitles()
 */
export async function testEnglishSubtitles() {
  try {
    const mediaId = getMediaIdFromUrl();
    if (!mediaId) {
      return;
    }
    
    const englishVTT = await fetchEnglishVTTContent(mediaId);
    
    if (!englishVTT || !englishVTT.content) {
      return;
    }
    
    const parsedEnglish = parseEnglishVTTContent(englishVTT.content);
    
    return parsedEnglish;
  } catch (error) {
    throw error;
  }
}

// Expose test function globally for console access
if (typeof window !== 'undefined') {
  window.testEnglishSubtitles = testEnglishSubtitles;
}

/**
 * Orchestrate Import Sequence
 * Sequence: Parse VTT → Create subtitles → Save to Firebase → Process subtitles → Save episode metadata
 */
export async function orchestrateImport(parsedSubtitles, showName, mediaId, progressCallback, episodeData = {}, problemCounters = null) {
  // CRITICAL: content.js ONLY calls orchestrators - no business logic
  // TODO: loadFromParsedSubtitles function needs to be implemented
  // const { loadFromParsedSubtitles } = await import('./01_load-subtitles/load-subtitles-orchestrator.js');
  
  // Prepare submitData - only data transformation, no logic
  const submitData = {
    showName,
    mediaId,
    duration: episodeData.duration || null,
    season: episodeData.season || null,
    episode: episodeData.episode || null,
    episodeTitle: episodeData.episodeTitle || null
  };
  
  // TODO: loadFromParsedSubtitles function needs to be implemented
  // Delegate ALL work to load orchestrator (which handles 01→02→03→03 flow)
  throw new Error('loadFromParsedSubtitles not implemented');
  // return await loadFromParsedSubtitles(submitData, parsedSubtitles, progressCallback);
}

/**
 * Orchestrate Subtitle Processing Sequence
 * Pure coordinator: delegates to 01_load/processSingleSubtitle orchestrator
 * @param {object} subtitleOrWrappedSubtitleInput - Accepts either a wrapped subtitle ({ subtitle: {...} }) or a direct subtitle object
 * @param {object} options - Processing options { mediaId, showName, episode, season, problemCounters }
 * @param {Function} progressCallback - Progress callback
 * @param {boolean} updateCache - Whether to update cache (default: true, set to false for import)
 */
export async function orchestrateSubtitleProcessing(subtitleOrWrappedSubtitleInput, options, progressCallback, updateCache = true) {
  // CRITICAL: content.js ONLY calls orchestrators - no business logic
  // Normalize input to package format at boundary: { subtitle: {...}, tokens: {...} }
  const packageFatBundle = subtitleOrWrappedSubtitleInput.subtitle
    ? subtitleOrWrappedSubtitleInput  // Already package format
    : {
        subtitle: subtitleOrWrappedSubtitleInput,
        tokens: subtitleOrWrappedSubtitleInput.tokens || { displayThai: [], sensesThai: [], displayEnglish: [], sensesEnglish: [] }
      };  // Convert flat to package
  
  // Check for duplicate processing (coordination only, not logic)
  const subtitleId = packageFatBundle.subtitle.id;
  if (!subtitleId) {
    throw new Error('Subtitle must have id');
  }
  
  if (processingSubtitleIds.has(subtitleId)) {
    if (progressCallback) {
      progressCallback(0, 2, 'Subtitle already being processed, skipping duplicate call');
    }
    return { subtitle: packageFatBundle.subtitle };
  }
  
  // Pass fat bundle through load orchestrator and seed gate
  const fatBundle = passFatBundle(packageFatBundle);
  seedGate(fatBundle);
  
  processingSubtitleIds.add(subtitleId);
  
  try {
    const { addressNeedsWork } = await import('./03_process/process-subtitle-orchestrator.js');
    const { subtitleGate } = await import('./04_subtitle_gate/helpers/subtitle-gate.js');
    const { saveFatSubtitle } = await import('./05_save/save-subtitles.js');
    
    const schemaWorkMap = packageFatBundle.subtitle.schemaWorkMap;
    const processResult = await addressNeedsWork(packageFatBundle, schemaWorkMap, options, progressCallback);
    const result = processResult.fat;
    subtitleGate(result.subtitle, subtitleId);
    const fatSubtitle = {
      subtitle: result.subtitle,
      tokens: result.tokens,
      schemaWorkMap: result.schemaWorkMap
    };
    await saveFatSubtitle(fatSubtitle, result.schemaWorkMap, options);
    return { subtitle: result.subtitle, subtitleId };
  } catch (error) {
    processingSubtitleIds.delete(subtitleId);
    throw error;
  } finally {
    processingSubtitleIds.delete(subtitleId);
  }
}

/**
 * Orchestrate Episode Loading Sequence
 * Sequence: Detect mediaId → Load episode → Load subtitles → Signal cache ready
 */
export async function orchestrateEpisodeLoad(mediaId, videoElement, onCacheReady = null) {
  // CRITICAL: Ensure lookup table exists FIRST before any other operations
  // This is a single read + single write operation, done once per episode load
  try {
    // TODO: getShowNameFromMediaId and loadEpisode functions need to be implemented or imported from correct location
    let showName = null;
    if (videoElement) {
      const { extractMediaMetadata } = await import('./01_load-subtitles/helpers/extract-metadata.js');
      const metadata = extractMediaMetadata(videoElement, mediaId);
      if (metadata.showName) {
        showName = metadata.showName;
      }
    }
    
    // Step 1: Load episode metadata and subtitles
    // TODO: loadEpisode function needs to be implemented
    const fatSubtitles = [];
    
    // Step 2: Signal that cache is ready (orchestrated state)
    if (onCacheReady) {
      onCacheReady(fatSubtitles?.length || 0);
    }
  } catch (error) {
    // Signal error state
    if (onCacheReady) {
      onCacheReady(0);
    }
  }
}

// Mount UI Island component
import React from 'react';
import { createRoot } from 'react-dom/client';
import { SmartSubsContent } from './06_display/smartsubs-content.jsx';

let isMounted = false;
let rootInstance = null;
let observer = null;
let urlCheckInterval = null;
let playerContainerRef = null;
let originalPlayerContainerHeight = null;
let originalPlayerContainerMaxHeight = null;
let originalPlayerContainerPosition = null;
let originalPlayerContainerWidth = null;
let originalPlayerContainerMaxWidth = null;
let smartSubsDockRef = null; // BOTTOM DOCK reference
let smartSubsRightDockRef = null; // RIGHT DOCK reference

function unmountSmartSubsParent() {
  // Find React root container (should be a div we created)
  const reactRootContainer = rootInstance?._internalRoot?.containerInfo;
  if (reactRootContainer && reactRootContainer.parentNode) {
    reactRootContainer.parentNode.removeChild(reactRootContainer);
  }
  
  if (rootInstance) {
    try {
      rootInstance.unmount();
    } catch (e) {
      // Ignore unmount errors
    }
    rootInstance = null;
  }
  
  // Remove BOTTOM DOCK
  if (smartSubsDockRef && smartSubsDockRef.parentNode) {
    smartSubsDockRef.parentNode.removeChild(smartSubsDockRef);
  }
  smartSubsDockRef = null;
  
  // Remove RIGHT DOCK
  // Clear portal container reference before removing DOM to avoid portaling into removed element
  if (typeof window !== 'undefined') {
    window.__rightDockContainer = null;
  }
  if (smartSubsRightDockRef && smartSubsRightDockRef.parentNode) {
    smartSubsRightDockRef.parentNode.removeChild(smartSubsRightDockRef);
  }
  smartSubsRightDockRef = null;
  
  // Restore player container original styles
  if (playerContainerRef && playerContainerRef !== document.body) {
    if (originalPlayerContainerHeight !== null) {
      playerContainerRef.style.height = originalPlayerContainerHeight;
    } else {
      playerContainerRef.style.height = '';
    }
    if (originalPlayerContainerMaxHeight !== null) {
      playerContainerRef.style.maxHeight = originalPlayerContainerMaxHeight;
    } else {
      playerContainerRef.style.maxHeight = '';
    }
    if (originalPlayerContainerWidth !== null) {
      playerContainerRef.style.width = originalPlayerContainerWidth;
    } else {
      playerContainerRef.style.width = '';
    }
    if (originalPlayerContainerMaxWidth !== null) {
      playerContainerRef.style.maxWidth = originalPlayerContainerMaxWidth;
    } else {
      playerContainerRef.style.maxWidth = '';
    }
    if (originalPlayerContainerPosition !== null) {
      playerContainerRef.style.position = originalPlayerContainerPosition;
    } else {
      playerContainerRef.style.position = '';
    }
  }
  
  playerContainerRef = null;
  originalPlayerContainerHeight = null;
  originalPlayerContainerMaxHeight = null;
  originalPlayerContainerWidth = null;
  originalPlayerContainerMaxWidth = null;
  originalPlayerContainerPosition = null;
  isMounted = false;
}

function mountSmartSubsParent() {
  // Prevent double mounting
  if (isMounted) {
    return;
  }

  // Find Netflix player view container (belongs to Netflix - we'll investigate but NOT use as our container)
  const netflixPlayerViewContainer = document.querySelector('.watch-video--player-view') || 
                                     document.querySelector('#appMountPoint > div > div > div > div > div.watch-video--player-view');
  
  // Investigate Netflix's player view container to understand its layout
  if (netflixPlayerViewContainer) {
    const computedStyle = window.getComputedStyle(netflixPlayerViewContainer);
    const parent = netflixPlayerViewContainer.parentElement;
    const parentComputedStyle = parent ? window.getComputedStyle(parent) : null;
    
    if (parentComputedStyle) {
    }
  }

  // Find Netflix player container - try multiple common selectors
  let playerContainer = null;
  const videoElement = document.querySelector('video');
  
  if (videoElement) {
    // Traverse up from video element to find player container
    let parent = videoElement.parentElement;
    while (parent && parent !== document.body) {
      // Check for common Netflix player container classes/attributes
      if (parent.classList.contains('watch-video') || 
          parent.classList.contains('watch-video--player') ||
          parent.hasAttribute('data-uia') && parent.getAttribute('data-uia').includes('player') ||
          parent.classList.contains('player-container')) {
        playerContainer = parent;
        break;
      }
      parent = parent.parentElement;
    }
    
    // Fallback: use video's parent if no specific container found
    if (!playerContainer && videoElement.parentElement) {
      playerContainer = videoElement.parentElement;
    }
  }
  
  // Fallback: use body if no player container found
  if (!playerContainer) {
    playerContainer = document.body;
  }

  // Find parent of player container - this is where we'll mount SmartSubsContent
  // The black space is the 30vh gap BELOW the player container (which is reduced to 70vh)
  let parentContainer = playerContainer.parentElement;
  if (!parentContainer || parentContainer === document.body) {
    parentContainer = document.body;
  }
  
  // Ensure parent container uses flexbox column to stack player and black space
  if (parentContainer !== document.body) {
    const parentComputedStyle = window.getComputedStyle(parentContainer);
    const parentDisplayStyle = parentComputedStyle.display;
    if (parentDisplayStyle !== 'flex' && parentDisplayStyle !== 'grid') {
      parentContainer.style.display = 'flex';
      parentContainer.style.flexDirection = 'column';
    }
  }
  
  // ============================================================================
  // BOTTOM DOCK: Shrink Netflix player container height to make room for bottom dock
  // ============================================================================
  if (playerContainer !== document.body) {
    const computedStyle = window.getComputedStyle(playerContainer);
    
    // Store original styles for cleanup
    playerContainerRef = playerContainer;
    originalPlayerContainerHeight = playerContainer.style.height || null;
    originalPlayerContainerMaxHeight = playerContainer.style.maxHeight || null;
    originalPlayerContainerPosition = playerContainer.style.position || null;
    
    // Set position relative if needed (for normal document flow)
    if (computedStyle.position === 'static') {
      playerContainer.style.position = 'relative';
    }
    
    // Ensure player container uses flexbox
    const displayStyle = computedStyle.display;
    if (displayStyle !== 'flex' && displayStyle !== 'grid') {
      playerContainer.style.display = 'flex';
      playerContainer.style.flexDirection = 'column';
    }
    
    // Reduce player container height to make room for BOTTOM DOCK
    const currentHeight = computedStyle.height;
    if (!currentHeight || currentHeight === 'auto' || currentHeight === '100%' || currentHeight === '100vh') {
      playerContainer.style.height = 'calc(100vh - 30vh)';
      playerContainer.style.maxHeight = 'calc(100vh - 30vh)';
      playerContainer.style.flexShrink = '0';
    } else {
      // If it has a specific height, reduce it by 30vh
      playerContainer.style.height = `calc(${currentHeight} - 30vh)`;
      playerContainer.style.maxHeight = `calc(${currentHeight} - 30vh)`;
      playerContainer.style.flexShrink = '0';
    }
  }
  
  // ============================================================================
  // BOTTOM DOCK: Create our own dock div (NOT using Netflix's .watch-video--player-view)
  // This is our container that fills the freed space at the bottom
  // ============================================================================
  const smartSubsDock = document.createElement('div');
  smartSubsDock.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: 30vh;
    min-height: 30vh;
    max-height: 30vh;
    background-color: black;
    box-sizing: border-box;
    z-index: 1000;
  `;
  
  // Store reference for cleanup
  smartSubsDockRef = smartSubsDock;
  
  // Always append to document.body - complete DOM separation from Netflix
  // parentContainer is only used for space reservation trick, not for mounting UI
  document.body.appendChild(smartSubsDock);
  
  // Create container div for React root inside BOTTOM DOCK
  const container = document.createElement('div');
  container.style.cssText = `
    width: 100%;
    height: 100%;
    position: relative;
  `;
  
  // Append container inside BOTTOM DOCK
  smartSubsDock.appendChild(container);

  // ============================================================================
  // RIGHT DOCK: Calculate width to maintain proper video aspect ratio
  // ============================================================================
  // Use a fixed reasonable width (400px) that maintains video proportions
  // This ensures the video doesn't look stretched or squashed
  const RIGHT_DOCK_WIDTH = '400px';
  
  // ============================================================================
  // RIGHT DOCK: Shrink Netflix player container width to make room for right dock
  // ============================================================================
  if (playerContainer !== document.body) {
    const computedStyle = window.getComputedStyle(playerContainer);
    
    // Store original width styles for cleanup
    originalPlayerContainerWidth = playerContainer.style.width || null;
    originalPlayerContainerMaxWidth = playerContainer.style.maxWidth || null;
    
    // Reduce player container width to make room for RIGHT DOCK
    const currentWidth = computedStyle.width;
    if (!currentWidth || currentWidth === 'auto' || currentWidth === '100%' || currentWidth === '100vw') {
      playerContainer.style.width = `calc(100vw - ${RIGHT_DOCK_WIDTH})`;
      playerContainer.style.maxWidth = `calc(100vw - ${RIGHT_DOCK_WIDTH})`;
    } else {
      // If it has a specific width, reduce it by right dock width
      playerContainer.style.width = `calc(${currentWidth} - ${RIGHT_DOCK_WIDTH})`;
      playerContainer.style.maxWidth = `calc(${currentWidth} - ${RIGHT_DOCK_WIDTH})`;
    }
  }
  
  // ============================================================================
  // RIGHT DOCK: Create our own right dock div
  // This is our container that fills the freed space on the right side
  // Height accounts for BOTTOM DOCK (calc(100vh - 30vh))
  // ============================================================================
  const smartSubsRightDock = document.createElement('div');
  smartSubsRightDock.style.setProperty('position', 'fixed', 'important');
  smartSubsRightDock.style.setProperty('right', '0', 'important');
  smartSubsRightDock.style.setProperty('top', '0', 'important');
  smartSubsRightDock.style.setProperty('bottom', '30vh', 'important');
  smartSubsRightDock.style.setProperty('width', RIGHT_DOCK_WIDTH, 'important');
  smartSubsRightDock.style.setProperty('height', 'calc(100vh - 30vh)', 'important');
  smartSubsRightDock.style.setProperty('min-width', RIGHT_DOCK_WIDTH, 'important');
  smartSubsRightDock.style.setProperty('max-width', RIGHT_DOCK_WIDTH, 'important');
  smartSubsRightDock.style.setProperty('background-color', 'white', 'important');
  smartSubsRightDock.style.setProperty('box-sizing', 'border-box', 'important');
  smartSubsRightDock.style.setProperty('z-index', '1000', 'important');
  
  // Store reference for cleanup
  smartSubsRightDockRef = smartSubsRightDock;
  
  // Always append to document.body - complete DOM separation from Netflix
  // parentContainer is only used for space reservation trick, not for mounting UI
  document.body.appendChild(smartSubsRightDock);
  
  // Create container div inside RIGHT DOCK for React Portal
  const rightDockContainer = document.createElement('div');
  rightDockContainer.style.cssText = `
    width: 100%;
    height: 100%;
    position: relative;
    box-sizing: border-box;
  `;
  smartSubsRightDock.appendChild(rightDockContainer);
  
  // Expose container for React Portal
  window.__rightDockContainer = rightDockContainer;

  // Create callback to signal cache readiness
  let cacheReadyCallback = null;
  const setCacheReadyCallback = (callback) => {
    cacheReadyCallback = callback;
  };

  rootInstance = createRoot(container);
  rootInstance.render(React.createElement(SmartSubsContent, { 
    onCacheReadySignal: setCacheReadyCallback 
  }));
  
  // ============================================================================
  // Timeline Subscription - Track display state
  // ============================================================================
  (async () => {
    const { subscribeToTimelineChanges } = await import('./07_tracking/subtitle-tracker-orchestrator.js');
    const { getCachedSubtitle } = await import('./05_cache/cache-subtitles.js');
    
    let currentDisplayedSubtitleId = null;
    
    subscribeToTimelineChanges((subtitle) => {
      const subtitleId = subtitle?.id;
      
      // Clear previous displayed state
      if (currentDisplayedSubtitleId && currentDisplayedSubtitleId !== subtitleId) {
        const prevTracking = getSubtitleTracking(currentDisplayedSubtitleId);
        if (prevTracking) {
          prevTracking.subtitle.isDisplayed = false;
          // Clear all field display states
          for (const fieldPath in prevTracking.fields) {
            prevTracking.fields[fieldPath].isDisplayed = false;
          }
        }
      }
      
      // Set current displayed subtitle ID (but don't mark as displayed yet)
      // Displayed flag will be set by subtitle-area.jsx when it actually renders the bundle
      if (subtitleId) {
        currentDisplayedSubtitleId = subtitleId;
      }
    });
  })();
  
  (async () => {
    try {
      const videoElement = document.querySelector('video');
      const metadata = inspectNetflixMetadata(videoElement);
      
      if (!metadata.videoId) {
        const urlMatch = window.location.pathname.match(/\/watch\/(\d+)/);
        if (urlMatch) {
          metadata.videoId = urlMatch[1];
        }
      }
      
      if (metadata.videoId) {
        await orchestrateEpisodeLoad(metadata.videoId, videoElement, (subtitleCount) => {
          // Signal cache readiness to UI
          if (cacheReadyCallback) {
            cacheReadyCallback(subtitleCount);
          }
        });
      }
    } catch (error) {
      // Error loading episode
    }
  })();
  
  isMounted = true;
}

function checkAndMount() {
  const urlMatch = window.location.pathname.match(/\/watch\/(\d+)/);
  const isVideoPage = !!urlMatch;
  const videoElement = document.querySelector('video');
  
  if (isVideoPage && videoElement && !isMounted) {
    mountSmartSubsParent();
  } else if (!isVideoPage && isMounted) {
    unmountSmartSubsParent();
  }
}

// Initial check
function initialize() {
if (document.body) {
    // Inject Netflix subtitle script early (on page load) so JSON.parse interception is active
    // when Netflix sends API responses. This matches the extension's approach.
    if (window.location.hostname.includes('netflix.com')) {
      (async () => {
        try {
          const { injectNetflixSubtitleScript } = await import('./03_process/helpers/01_vtt/vtt.js');
          await injectNetflixSubtitleScript();
          console.log('[content.js] Netflix subtitle script injected early');
        } catch (error) {
          console.warn('[content.js] Failed to inject Netflix subtitle script early:', error);
        }
      })();
    }
    
    checkAndMount();
    
    // Watch for video element appearance with MutationObserver
    observer = new MutationObserver(() => {
      checkAndMount();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Watch for URL changes (SPA navigation)
    let lastUrl = window.location.href;
    urlCheckInterval = setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        checkAndMount();
      }
    }, 100);
    
    // Also listen to popstate events (browser back/forward)
    window.addEventListener('popstate', checkAndMount);
    
    // Intercept pushState/replaceState for SPA navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setTimeout(checkAndMount, 0);
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(checkAndMount, 0);
    };
} else {
    document.addEventListener('DOMContentLoaded', () => {
      initialize();
    });
  }
}

initialize();


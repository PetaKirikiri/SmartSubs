/**
 * Hotkey Listener - Document-level key capture and delegation
 * 
 * RESPONSIBILITY BOUNDARIES:
 * - Owns: Captures keys at document level, delegates navigation to TrackSubtitle functions
 * - Contains ZERO playback logic
 * - Contains ZERO decision logic about what happens when keys are pressed
 * 
 * KEY PRINCIPLE:
 * - Logic for "what happens when a hotkey is pressed" lives in TrackSubtitle (subtitle-tracker.js), not in JSX and not in hotkeys.js
 * - JSX only reacts to state changes
 * - You do NOT want JSX branching on ArrowLeft vs ArrowRight - all navigation logic is in subtitle-tracker.js
 * 
 * DELEGATION PATTERN:
 * - ArrowLeft → delegates to restartCurrentSubtitle() in subtitle-tracker.js
 * - ArrowRight → delegates to advanceToNextSubtitle() in subtitle-tracker.js
 * - ArrowUp → delegates to goToPreviousSubtitle() in subtitle-tracker.js
 * 
 * NEVER:
 * - Seeks video directly
 * - Reads video.currentTime
 * - Controls timeline
 * - Decides subtitle timing
 * - Decides what happens when navigation occurs (that logic lives in subtitle-tracker.js)
 */

let arrowKeyHandler = null;
let isFreeplayMode = false;

export function setupArrowKeyNavigation() {
  document.addEventListener('keydown', handleArrowKeyDown, true);
  document.addEventListener('keydown', handleSpaceKey, true);
}

export function getFreeplayMode() {
  return isFreeplayMode;
}

export function removeArrowKeyNavigation() {
  document.removeEventListener('keydown', handleArrowKeyDown, true);
  document.removeEventListener('keydown', handleSpaceKey, true);
  arrowKeyHandler = null;
}

async function handleSpaceKey(e) {
  // Only handle space key
  if (e.key !== ' ') {
    return;
  }
  
  // CRITICAL: Check for upload modal FIRST - if in upload modal, completely ignore
  const uploadModalContainer = document.getElementById('smart-subs-upload-modal-container');
  const isInUploadModal = uploadModalContainer && (
    uploadModalContainer.contains(document.activeElement) ||
    uploadModalContainer.contains(e.target) ||
    e.target.closest('#smart-subs-upload-modal-container')
  );
  
  // If in upload modal, completely ignore - let all keys pass through normally
  if (isInUploadModal) {
    return;
  }
  
  // Ignore if input/textarea is focused
  const activeElement = document.activeElement;
  const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
  if (isInputFocused) {
    return;
  }
  
  // Prevent default behavior (scrolling page)
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  
  // Toggle freeplay mode
  isFreeplayMode = !isFreeplayMode;
  
  // If freeplay mode is ON, resume playback
  if (isFreeplayMode) {
    const video = document.querySelector('video');
    if (video && video.paused) {
      video.play();
    }
  }
}

/**
 * Handle arrow key down events - Delegation pattern
 * 
 * Delegation: This function ONLY captures keys and delegates to subtitle-tracker.js functions
 * It does NOT contain any playback logic or decision-making about what happens when keys are pressed
 * All navigation behavior is defined in subtitle-tracker.js
 */
async function handleArrowKeyDown(e) {
  // Only handle left/right/up arrow keys
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp') {
    return;
  }
  
  // CRITICAL: Check for upload modal FIRST - if in upload modal, completely ignore
  const uploadModalContainer = document.getElementById('smart-subs-upload-modal-container');
  const isInUploadModal = uploadModalContainer && (
    uploadModalContainer.contains(document.activeElement) ||
    uploadModalContainer.contains(e.target) ||
    e.target.closest('#smart-subs-upload-modal-container')
  );
  
  // If in upload modal, completely ignore - let all keys pass through normally
  if (isInUploadModal) {
    return;
  }
  
  // Ignore if input/textarea is focused (same pattern as sense selection)
  const activeElement = document.activeElement;
  const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
  if (isInputFocused) {
    return;
  }
  
  // Prevent default behavior and stop propagation
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  
  // Get current timeline position before navigation (for logging only - not used for decision-making)
  const video = document.querySelector('video');
  const currentTimeBefore = video ? video.currentTime : null;
  
  // Import navigation functions dynamically - delegate all logic to subtitle-tracker.js
  const { advanceToNextSubtitle, restartCurrentSubtitle, goToPreviousSubtitle, getCurrentSubtitle } = await import('./subtitle-tracker-orchestrator.js');
  
  // Get current subtitle before navigation (for logging only)
  const currentSubtitleBefore = getCurrentSubtitle();
  
  if (e.key === 'ArrowRight') {
    advanceToNextSubtitle();
  } else if (e.key === 'ArrowLeft') {
    restartCurrentSubtitle();
  } else if (e.key === 'ArrowUp') {
    goToPreviousSubtitle();
  }
}

/**
 * Edit Mode Management Module
 * Handles entering/exiting edit mode, saving, and cache updates
 */

// CACHE-FIRST: No direct Airtable imports - UI only updates cache
import { formatTimeDisplay } from './videoPlayer.js';

/**
 * Start edit mode
 * @param {Object} dependencies - Dependencies object
 * @param {HTMLElement} overlay - Overlay element
 */
export function startEditMode(dependencies, overlay) {
  const {
    onGetSubtitleCache,
    onGetCurrentRecordId,
    onGetCurrentSubtitleStartTime,
    onSetCurrentRecordId,
    onGetSubtitleUpdateInterval,
    onSetSubtitleUpdateInterval,
    onGetTimerUpdateInterval,
    onSetTimerUpdateInterval,
    onGetOriginalEditText,
    onSetOriginalEditText,
    videoElementRef
  } = dependencies;

  // Pause ALL time-based updates - completely disconnect from time-based logic
  const subtitleInterval = onGetSubtitleUpdateInterval();
  if (subtitleInterval) {
    clearInterval(subtitleInterval);
    onSetSubtitleUpdateInterval(null);
  }
  const timerInterval = onGetTimerUpdateInterval();
  if (timerInterval) {
    clearInterval(timerInterval);
    onSetTimerUpdateInterval(null);
  }
  
  // Pause video
  const videoElement = videoElementRef.current;
  if (videoElement && !videoElement.paused) {
    videoElement.pause();
  }

  const allSubtitlesArray = onGetSubtitleCache();
  let currentRecordId = onGetCurrentRecordId();
  const currentSubtitleStartTime = onGetCurrentSubtitleStartTime();

  // CRITICAL: Ensure we have a valid recordId before allowing edit
  // This ensures we're editing an existing record, not creating a new one
  if (!currentRecordId) {
    // Try to get recordId from current subtitle in array
    const currentRow = document.getElementById('smart-subs-current');
    if (currentRow && currentSubtitleStartTime !== null) {
      const currentSubtitle = allSubtitlesArray.find(s => s.startTime === currentSubtitleStartTime);
      if (currentSubtitle && currentSubtitle.recordId) {
        currentRecordId = currentSubtitle.recordId;
        onSetCurrentRecordId(currentRecordId);
      }
    }
    
    // If still no recordId, cannot proceed with edit
    if (!currentRecordId) {
      alert('No subtitle record found. Cannot edit.');
      return;
    }
  }

  const currentRow = document.getElementById('smart-subs-current');
  const subtitleText = currentRow?.querySelector('.subtitle-text-col');
  const editInput = overlay.querySelector('#smart-subs-input');
  const saveButton = overlay.querySelector('#smart-subs-save');
  const cancelButton = overlay.querySelector('#smart-subs-cancel');

  // Verify the recordId corresponds to a valid subtitle in our array
  const currentSubtitle = allSubtitlesArray.find(s => s.recordId === currentRecordId);
  if (!currentSubtitle) {
    alert('Subtitle record not found in loaded data. Please refresh.');
    return;
  }

  // Hide text, show input and buttons
  if (subtitleText) subtitleText.style.display = 'none';
  if (editInput) {
    // Get display mode
    const displayMode = dependencies.onGetDisplayMode ? dependencies.onGetDisplayMode() : 'edit';
    
    // Get original text from word data (thaiScript) or fallback to text field
    // CRITICAL: Only access phoneticWordIds/phoneticWordMap if processed === true
    let originalText = '';
    const isProcessed = currentSubtitle.processed === true;
    
    if (displayMode === 'edit' && isProcessed) {
      // Edit mode AND processed: get thaiScript from word data
      const wordIds = currentSubtitle.phoneticWordIds || [];
      const wordMap = currentSubtitle.phoneticWordMap || new Map();
      if (wordIds.length > 0 && wordMap.size > 0) {
        // Build thaiScript string from word data
        originalText = wordIds.map(id => {
          const wordData = wordMap.get(id);
          return wordData?.thaiScript || '';
        }).filter(t => t.trim()).join(' ');
      }
    }
    
    // Fallback to thai field if no word data available or not processed
    if (!originalText) {
      originalText = currentSubtitle.thai || currentSubtitle.thaiScript || '';
    }
    
    // For user mode, get from subtitle object (React handles display)
    if (displayMode === 'user' && cachedSubtitle) {
      originalText = cachedSubtitle.thai || cachedSubtitle.thaiSplit || '';
    }
    
    // Store original text to detect if changes were made
    onSetOriginalEditText(originalText.trim());
    
    editInput.value = originalText;
    editInput.style.display = 'block';
    editInput.style.height = 'auto';
    editInput.style.height = editInput.scrollHeight + 'px';
    
    // CRITICAL: Prevent mouse events from stealing focus
    // Use capture phase to intercept mousedown before parent handlers
    const mousedownHandler = (e) => {
      // Prevent any parent handlers from interfering
      e.stopPropagation();
      // Ensure textarea gets focus
      if (document.activeElement !== editInput) {
        editInput.focus();
      }
    };
    
    // Prevent blur events from accidental mouse movements
    const blurHandler = (e) => {
      // Only allow blur if clicking outside the overlay or on save/cancel buttons
      const relatedTarget = e.relatedTarget;
      const saveBtn = overlay.querySelector('#smart-subs-save');
      const cancelBtn = overlay.querySelector('#smart-subs-cancel');
      
      // If blur is caused by clicking save/cancel, allow it
      if (relatedTarget === saveBtn || relatedTarget === cancelBtn) {
        return; // Allow blur
      }
      
      // If clicking elsewhere in overlay (but not save/cancel), prevent blur and refocus
      // Use setTimeout to check after blur completes - less aggressive
      if (relatedTarget && overlay.contains(relatedTarget)) {
        setTimeout(() => {
          if (editInput && editInput.style.display !== 'none' && document.activeElement !== editInput) {
            editInput.focus();
          }
        }, 0);
      }
    };
    
    // Add focus protection handlers - use capture phase for mousedown to catch it early
    editInput.addEventListener('mousedown', mousedownHandler, true); // Capture phase
    editInput.addEventListener('blur', blurHandler);
  }
  if (saveButton) saveButton.style.display = 'block';
  if (cancelButton) cancelButton.style.display = 'block';
  
  // Focus input and select all text immediately
  if (editInput) {
    editInput.focus();
    editInput.select();
  }
}

/**
 * Cancel edit mode
 * @param {Object} dependencies - Dependencies object
 * @param {HTMLElement} overlay - Overlay element
 * @param {HTMLElement} editInput - Edit input element
 * @param {HTMLElement} saveButton - Save button element
 * @param {HTMLElement} cancelButton - Cancel button element
 */
export function cancelEditMode(dependencies, overlay, editInput, saveButton, cancelButton) {
  const {
    onSetOriginalEditText,
    onUpdateDisplayFromCache,
    onResumeTimeBasedUpdates
  } = dependencies;

  // Hide input and buttons, show text
  if (editInput) editInput.style.display = 'none';
  if (saveButton) saveButton.style.display = 'none';
  if (cancelButton) cancelButton.style.display = 'none';
  
  // Display always reads from cache (local-first architecture)
  onUpdateDisplayFromCache();
  
  // Clear original text reference when canceling
  onSetOriginalEditText(null);
  
  // Resume time-based updates after canceling edit mode
  onResumeTimeBasedUpdates();
}

/**
 * Save subtitle - CACHE-ONLY (save button click handler)
 * Updates cache and exits edit mode instantly - no Airtable calls
 * @param {Object} dependencies - Dependencies object
 * @param {HTMLElement} overlay - Overlay element
 * @param {HTMLElement} editInput - Edit input element
 */
export function saveSubtitle(dependencies, overlay, editInput) {
  // Cache-only save - instant, no Airtable calls
  saveToCacheOnly(dependencies, overlay, editInput);
}

/**
 * Handle Escape key press - CACHE-ONLY, no Airtable calls
 * Same as save button - just updates cache and exits instantly
 * @param {Object} dependencies - Dependencies object
 * @param {HTMLElement} overlay - Overlay element
 * @param {HTMLElement} editInput - Edit input element
 */
export function handleEscapeKey(dependencies, overlay, editInput) {
  // Same as save button - cache-only, instant
  saveToCacheOnly(dependencies, overlay, editInput);
}

/**
 * Save to cache only - CACHE-FIRST, no Airtable calls
 * This function is purely synchronous - updates cache and exits edit mode instantly
 * Background save to Airtable happens after UI updates complete (non-blocking)
 * @param {Object} dependencies - Dependencies object
 * @param {HTMLElement} overlay - Overlay element
 * @param {HTMLElement} editInput - Edit input element
 */
function saveToCacheOnly(dependencies, overlay, editInput) {
  const {
    onGetSubtitleCache,
    onUpdateCacheSubtitle,
    onGetCurrentRecordId,
    onGetOriginalEditText,
    onSetOriginalEditText,
    onUpdateDisplayFromCache,
    onResumeTimeBasedUpdates
  } = dependencies;

  const saveButton = overlay ? overlay.querySelector('#smart-subs-save') : null;
  const cancelButton = overlay ? overlay.querySelector('#smart-subs-cancel') : null;
  
  // Get text from input
  const newText = editInput ? editInput.value.trim() : '';
  const originalEditText = onGetOriginalEditText();
  
  // INSTANT: Exit edit mode immediately
  if (editInput) editInput.style.display = 'none';
  if (saveButton) saveButton.style.display = 'none';
  if (cancelButton) cancelButton.style.display = 'none';
  
  // Check if text changed
  const hasChanged = newText && originalEditText !== null && newText !== originalEditText;
  
  // Update cache if we have text and recordId (synchronous, instant)
  const currentRecordId = onGetCurrentRecordId();
  if (newText && currentRecordId) {
    // Get display mode
    const displayMode = dependencies.onGetDisplayMode ? dependencies.onGetDisplayMode() : 'edit';
    
    onUpdateCacheSubtitle(currentRecordId, (cachedSubtitle) => {
      // Save edited text to thai field (source of truth)
      cachedSubtitle.thai = newText;
      
      // Mark as passed/accepted - ready for pipeline processing
      cachedSubtitle.passed = true;
      cachedSubtitle.Edited = true;
    });
  }
  
  // Update display from cache immediately (synchronous, instant)
  onUpdateDisplayFromCache();
  
  // Clear original text reference
  onSetOriginalEditText(null);

  // Resume time-based updates after exiting edit mode
  onResumeTimeBasedUpdates();

  // CACHE-FIRST: Cache already updated above with Edited = true flag
  // Universal save trigger will watch cache changes and save to Airtable
  // Pipeline processing will be triggered by universal save trigger when it detects Edited = true
  // No direct Airtable calls from UI - all saves go through universal trigger
}

/**
 * Update display from cache (always reads from cache, never directly from Airtable)
 * This ensures the UI always reflects the cached state
 * @param {Object} dependencies - Dependencies object
 */
export async function updateDisplayFromCache(dependencies) {
  // DEPRECATED: This function creates a separate React root which conflicts with SubtitleController
  // SubtitleController is now the ONLY source of truth for subtitle display
  // This function should not be called - SubtitleController handles all subtitle updates
  // Keeping function signature for backward compatibility but it does nothing
  return;
}

/**
 * Resume time-based updates after exiting edit mode
 * @param {Object} dependencies - Dependencies object
 */
export function resumeTimeBasedUpdates(dependencies) {
  const {
    onGetTimerUpdateInterval,
    onSetTimerUpdateInterval,
    onGetSubtitleUpdateInterval,
    onSetSubtitleUpdateInterval,
    onGetLastFetchedTime,
    onSetLastFetchedTime,
    onUpdateSubtitleFromTimestamp,
    videoElementRef
  } = dependencies;

  const videoElement = videoElementRef.current;
  if (!videoElement) return;
  
  // Restart timer update
  if (!onGetTimerUpdateInterval()) {
    const timerDisplay = document.getElementById('smart-subs-timer');
    if (timerDisplay) {
      const updateTimer = () => {
        const videoEl = videoElementRef.current;
        if (videoEl && !isNaN(videoEl.currentTime)) {
          timerDisplay.textContent = formatTimeDisplay(videoEl.currentTime);
        }
      };
      const timerInterval = setInterval(updateTimer, 100);
      onSetTimerUpdateInterval(timerInterval);
    }
  }
  
  // DEPRECATED: Old subtitle update interval system
  // SubtitleController now handles all subtitle updates via cache-only polling
  // Do not restart the old updateSubtitleFromTimestamp interval
  // SubtitleController is the ONLY source of truth
}




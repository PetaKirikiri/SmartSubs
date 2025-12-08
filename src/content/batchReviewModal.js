/**
 * Batch Review Modal
 * Shows processed subtitles for final review and data integrity checks
 * Auto-opens when status threshold is met (5/5 status states)
 */

// CACHE-FIRST: No direct Airtable imports - UI only updates cache
import { fetchPOSColors } from './posColors.js';

// Add pulse animation for loading states
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }
`;
document.head.appendChild(style);


/**
 * Show batch review modal
 * @param {Array} subtitles - Array of subtitle objects to review
 * @param {Object} dependencies - Dependencies object
 */
export function showBatchReviewModal(subtitles, dependencies) {
  // CACHE-FIRST: Always use cache (source of truth)
  // Cache is primary - Airtable uploads happen in background
  const cacheSubtitles = dependencies.onGetSubtitleCache ? dependencies.onGetSubtitleCache() : [];
  
  // SOURCE OF TRUTH: Only subtitles that actually passed through "current" position
  // Timeline jumps don't count - only sequential progression through current counts
  const passedThroughCurrentIds = dependencies.onGetSubtitlesPassedThroughCurrent ? dependencies.onGetSubtitlesPassedThroughCurrent() : [];
  const reviewableSubtitles = cacheSubtitles.filter(sub => 
    passedThroughCurrentIds.includes(sub.recordId) && // Must have actually passed through "current"
    sub.fullReview !== true // Not yet fully reviewed
  );
  
  if (reviewableSubtitles.length === 0) {
    return; // No subtitles ready for review
  }
  
  // Limit to 5 subtitles at a time (take the first 5 that have passed through current)
  const subtitlesToShow = reviewableSubtitles.slice(0, 5);
  
  // No need to check if all are ready - modal will show data as it becomes available
  
  // PAUSE VIDEO when review modal opens
  const videoElement = dependencies.onGetVideoElement ? dependencies.onGetVideoElement() : 
                       (dependencies.videoElementRef ? dependencies.videoElementRef.current : null);
  if (videoElement && !videoElement.paused) {
    videoElement.pause();
  }
  
  // Reset counter after modal opens
  if (dependencies.onSetBatchReviewSubtitleCount) {
    dependencies.onSetBatchReviewSubtitleCount(0);
  }
  
  // Clear the passed-through list for the 5 subtitles being reviewed
  // They've been reviewed, so remove them from the tracking list
  if (dependencies.onClearSubtitlesPassedThroughCurrent && subtitlesToShow.length > 0) {
    const reviewedIds = subtitlesToShow.map(s => s.recordId);
    const currentPassedThrough = dependencies.onGetSubtitlesPassedThroughCurrent ? dependencies.onGetSubtitlesPassedThroughCurrent() : [];
    const remainingIds = currentPassedThrough.filter(id => !reviewedIds.includes(id));
    // Clear and rebuild with only remaining IDs
    if (dependencies.onClearSubtitlesPassedThroughCurrent) {
      dependencies.onClearSubtitlesPassedThroughCurrent();
      remainingIds.forEach(id => {
        if (dependencies.onAddSubtitlePassedThroughCurrent) {
          dependencies.onAddSubtitlePassedThroughCurrent(id);
        }
      });
    }
  }
  
  // Check if modal already exists
  let modal = document.getElementById('smart-subs-batch-review-modal');
  
  if (!modal) {
    // Create modal
    modal = document.createElement('div');
    modal.id = 'smart-subs-batch-review-modal';
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
    modal.style.border = '2px solid rgba(255, 215, 0, 0.5)';
    modal.style.borderRadius = '8px';
    modal.style.padding = '20px';
    modal.style.zIndex = '2147483647';
    modal.style.width = '90%';
    modal.style.maxWidth = '1200px';
    modal.style.maxHeight = '90vh';
    modal.style.overflowY = 'auto';
    modal.style.color = '#FFD700';
    modal.style.fontFamily = 'Arial, sans-serif';
    modal.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.8)';
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '8px';
    closeBtn.style.right = '8px';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#FFD700';
    closeBtn.style.fontSize = '24px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '0';
    closeBtn.style.width = '32px';
    closeBtn.style.height = '32px';
    closeBtn.style.lineHeight = '32px';
    closeBtn.addEventListener('click', () => {
      // Mark all 5 subtitles in review bundle as reviewed when modal closes
      // CACHE-FIRST: Only update cache - universal save trigger will handle Airtable save
      const reviewBundle = modal._reviewBundle || [];
      if (reviewBundle.length > 0 && dependencies.onGetSubtitleCache && dependencies.onUpdateCacheSubtitle) {
        const cacheSubtitles = dependencies.onGetSubtitleCache();
        reviewBundle.forEach(recordId => {
          const subtitle = cacheSubtitles.find(s => s.recordId === recordId);
          if (subtitle && !subtitle.fullReview && !subtitle.reviewed) {
            // CACHE-FIRST: Only update cache (source of truth)
            // Universal save trigger will watch cache changes and save to Airtable
            // NOTE: Don't set Edited = true - this is flag update, not text edit
            dependencies.onUpdateCacheSubtitle(recordId, (cachedSub) => {
              cachedSub.reviewed = true;
              cachedSub.fullReview = true;
            });
            // Subtitle reviewed (silent)
          }
        });
      }
      
      // Stop refresh interval when closing
      if (modal._refreshInterval) {
        clearInterval(modal._refreshInterval);
        modal._refreshInterval = null;
      }
      modal.style.display = 'none';
    });
    modal.appendChild(closeBtn);
    
    // Title
    const title = document.createElement('div');
    title.textContent = 'Batch Review';
    title.style.fontSize = '18px';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '16px';
    modal.appendChild(title);
    
    // Progress indicator
    const progressIndicator = document.createElement('div');
    progressIndicator.id = 'batch-review-progress';
    progressIndicator.style.fontSize = '12px';
    progressIndicator.style.opacity = '0.8';
    progressIndicator.style.marginBottom = '16px';
    modal.appendChild(progressIndicator);
    
    // Container for subtitle cards
    const container = document.createElement('div');
    container.id = 'batch-review-container';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '16px';
    modal.appendChild(container);
    
    document.body.appendChild(modal);
  }
  
  // Store the 5 subtitle recordIds - these are the ONLY ones that can be reviewed in this modal session
  const reviewBundle = subtitlesToShow.map(s => s.recordId);
  modal._reviewBundle = reviewBundle; // Lock to these 5 only
  
  // Update modal content (only show the locked 5)
  updateBatchReviewContent(modal, subtitlesToShow, dependencies);
  
  // Set up auto-refresh to update cards as data becomes available (but keep same 5 subtitles)
  // This ensures subtitles 4 and 5 show data when it becomes available
  let refreshInterval = null;
  if (modal._refreshInterval) {
    clearInterval(modal._refreshInterval);
  }
  
  refreshInterval = setInterval(() => {
    const modalElement = document.getElementById('smart-subs-batch-review-modal');
    if (modalElement && modalElement.style.display !== 'none') {
      // Refresh content from cache but keep same 5 subtitles (locked review bundle)
      const lockedBundle = modalElement._reviewBundle || [];
      const cacheSubtitles = dependencies.onGetSubtitleCache ? dependencies.onGetSubtitleCache() : [];
      const lockedSubtitles = cacheSubtitles.filter(s => lockedBundle.includes(s.recordId));
      updateBatchReviewContent(modalElement, lockedSubtitles, dependencies);
    } else {
      // Modal closed - stop refreshing
      clearInterval(refreshInterval);
      modal._refreshInterval = null;
    }
  }, 1000); // Check every second for new data
  
  modal._refreshInterval = refreshInterval;
  
  // Show modal
  modal.style.display = 'block';
  
  // Hide notification when modal opens
  const notification = document.getElementById('batch-review-notification');
  if (notification) {
    notification.style.display = 'none';
  }
}

/**
 * Update batch review modal content
 * @param {HTMLElement} modal - Modal element
 * @param {Array} subtitles - Array of subtitle objects
 * @param {Object} dependencies - Dependencies object
 */
async function updateBatchReviewContent(modal, subtitles, dependencies) {
  const container = modal.querySelector('#batch-review-container');
  const progressIndicator = modal.querySelector('#batch-review-progress');
  
  if (!container || !progressIndicator) return;
  
  // REVIEW BUNDLE: Use provided subtitles if available (locked to 5), otherwise use locked bundle from modal
  let reviewableSubtitles = subtitles;
  if (!reviewableSubtitles || reviewableSubtitles.length === 0) {
    // Fallback: get locked bundle from modal
    const lockedBundle = modal._reviewBundle || [];
    const cacheSubtitles = dependencies.onGetSubtitleCache ? dependencies.onGetSubtitleCache() : [];
    reviewableSubtitles = cacheSubtitles.filter(s => lockedBundle.includes(s.recordId));
  }
  
  // Ensure we only show the locked 5 subtitles (review bundle)
  const lockedBundle = modal._reviewBundle || reviewableSubtitles.map(s => s.recordId).slice(0, 5);
  reviewableSubtitles = reviewableSubtitles.filter(s => lockedBundle.includes(s.recordId)).slice(0, 5);
  
  // Clear container
  container.innerHTML = '';
  
  // Update progress - show count of subtitles in this modal session
  progressIndicator.textContent = `Reviewing ${reviewableSubtitles.length} subtitles`;
  
  // Load POS colors for display
  const posColors = await fetchPOSColors();
  
  // Create subtitle cards from locked bundle
  for (let i = 0; i < reviewableSubtitles.length; i++) {
    const subtitle = reviewableSubtitles[i];
    const card = await createSubtitleReviewCard(subtitle, i + 1, reviewableSubtitles.length, posColors, dependencies, lockedBundle);
    container.appendChild(card);
  }
}

/**
 * Create a subtitle review card
 * @param {Object} subtitle - Subtitle object
 * @param {number} index - Current index (1-based)
 * @param {number} total - Total count
 * @param {Map} posColors - POS color map
 * @param {Object} dependencies - Dependencies object
 * @param {Array<string>} reviewBundle - Array of recordIds that are locked to this modal session
 * @returns {Promise<HTMLElement>} Card element
 */
async function createSubtitleReviewCard(subtitle, index, total, posColors, dependencies, reviewBundle = []) {
  const card = document.createElement('div');
  card.style.border = '1px solid rgba(255, 215, 0, 0.3)';
  card.style.borderRadius = '6px';
  card.style.padding = '16px';
  card.style.marginBottom = '12px';
  card.style.backgroundColor = 'rgba(255, 215, 0, 0.05)';
  
  // Card header
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '12px';
  
  const subtitleNumber = document.createElement('div');
  subtitleNumber.textContent = `Subtitle ${index}/${total}`;
  subtitleNumber.style.fontSize = '14px';
  subtitleNumber.style.fontWeight = 'bold';
  header.appendChild(subtitleNumber);
  
  // Row number computed from cache index (for display only)
  const rowNumber = document.createElement('div');
  const subtitleCache = dependencies.onGetSubtitleCache ? dependencies.onGetSubtitleCache() : [];
  const subtitleIndex = subtitleCache.findIndex(s => s.recordId === subtitle.recordId);
  rowNumber.textContent = subtitleIndex >= 0 ? `Row #${subtitleIndex + 1}` : `Record: ${subtitle.recordId?.substring(0, 10)}...`;
  rowNumber.style.fontSize = '12px';
  rowNumber.style.opacity = '0.7';
  header.appendChild(rowNumber);
  
  card.appendChild(header);
  
  // Tokenized thaiSplit (editable)
  const thaiSplitLabel = document.createElement('div');
  thaiSplitLabel.textContent = 'Tokenized (thaiSplit):';
  thaiSplitLabel.style.fontSize = '11px';
  thaiSplitLabel.style.opacity = '0.8';
  thaiSplitLabel.style.marginBottom = '4px';
  card.appendChild(thaiSplitLabel);
  
  // Check if still processing (thaiScriptReview is true but thaiSplit not ready yet)
  const isProcessing = subtitle.thaiScriptReview === true && (!subtitle.thaiSplit || !subtitle.thaiSplit.trim()) && subtitle.processed !== true;
  
  const thaiSplitInput = document.createElement('textarea');
  if (isProcessing) {
    // Still processing - show loading state
    thaiSplitInput.value = '';
    thaiSplitInput.placeholder = 'Processing... (thaiScript → thaiSplit)';
    thaiSplitInput.disabled = true;
    thaiSplitInput.style.opacity = '0.6';
    thaiSplitInput.style.cursor = 'wait';
  } else {
    thaiSplitInput.value = subtitle.thaiSplit || '';
    thaiSplitInput.disabled = false;
    thaiSplitInput.style.opacity = '1';
    thaiSplitInput.style.cursor = 'text';
  }
  thaiSplitInput.style.width = '100%';
  thaiSplitInput.style.minHeight = '40px';
  thaiSplitInput.style.padding = '8px';
  thaiSplitInput.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
  thaiSplitInput.style.border = '1px solid rgba(255, 215, 0, 0.5)';
  thaiSplitInput.style.borderRadius = '4px';
  thaiSplitInput.style.color = '#FFD700';
  thaiSplitInput.style.fontSize = '14px';
  thaiSplitInput.style.fontFamily = 'Arial, sans-serif';
  thaiSplitInput.style.outline = 'none';
  thaiSplitInput.style.resize = 'vertical';
  
  // Auto-save on change (debounced)
  let saveTimeout = null;
  thaiSplitInput.addEventListener('input', () => {
    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    // Debounce save - wait 1 second after user stops typing
    saveTimeout = setTimeout(async () => {
      const newThaiSplit = thaiSplitInput.value.trim();
      if (newThaiSplit !== subtitle.thaiSplit) {
        // CACHE-FIRST: Use unified update function (single source of truth)
        if (dependencies.onUpdateCacheSubtitle) {
          dependencies.onUpdateCacheSubtitle(subtitle.recordId, (cachedSub) => {
            cachedSub.thaiSplit = newThaiSplit;
            cachedSub.Edited = true; // Universal save watcher will handle Airtable save
          });
        }
        
        // CACHE-FIRST: Cache updated via unified function above
        // Universal save trigger will watch cache changes and save to Airtable
        // No direct Airtable calls from UI
      }
    }, 1000); // 1 second debounce
  });
  
  card.appendChild(thaiSplitInput);
  
  // Words display (with POS colors)
  const wordsLabel = document.createElement('div');
  wordsLabel.textContent = 'Words (with POS colors):';
  wordsLabel.style.fontSize = '11px';
  wordsLabel.style.opacity = '0.8';
  wordsLabel.style.marginTop = '12px';
  wordsLabel.style.marginBottom = '4px';
  card.appendChild(wordsLabel);
  
  const wordsContainer = document.createElement('div');
  wordsContainer.style.display = 'flex';
  wordsContainer.style.flexWrap = 'wrap';
  wordsContainer.style.gap = '8px';
  wordsContainer.style.marginBottom = '12px';
  
  // Parse wordIds
  let wordIds = [];
  try {
    wordIds = typeof subtitle.thaiSplitIds === 'string' 
      ? JSON.parse(subtitle.thaiSplitIds) 
      : subtitle.thaiSplitIds;
    if (!Array.isArray(wordIds)) wordIds = [];
  } catch (e) {
    wordIds = [];
  }
  
  // CACHE-FIRST: Use wordMap from subtitle bundle (already loaded during initial cache load)
  // No second fetch - all data should be in the bundle
  const wordMap = subtitle.phoneticWordMap || new Map();
  
  // Check if ALL word data is available - only show words when bundle is fully loaded
  const isStillProcessing = subtitle.processed !== true && subtitle.thaiScriptReview === true;
  const hasThaiSplit = subtitle.thaiSplit && subtitle.thaiSplit.trim();
  
  // Check if ALL wordIds have corresponding data in wordMap (bundle fully loaded)
  const allWordsLoaded = wordIds.length > 0 && wordIds.every(wordId => {
    if (!wordId || wordId.trim() === '') return true; // Skip empty wordIds
    return wordMap && wordMap.has(wordId) && wordMap.get(wordId);
  });
  const hasWordIdsButIncompleteData = wordIds.length > 0 && !allWordsLoaded;
  
  // Show loading states with animations for subtitles still processing
  if (isStillProcessing && !hasThaiSplit) {
    // Still processing thaiSplit - show animated loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.innerHTML = '⏳ Processing thaiSplit... (thaiScript → thaiSplit → thaiSplitIds)';
    loadingIndicator.style.fontSize = '12px';
    loadingIndicator.style.opacity = '0.7';
    loadingIndicator.style.fontStyle = 'italic';
    loadingIndicator.style.padding = '12px';
    loadingIndicator.style.textAlign = 'center';
    loadingIndicator.style.color = 'rgba(255, 215, 0, 0.8)';
    loadingIndicator.style.border = '1px dashed rgba(255, 215, 0, 0.3)';
    loadingIndicator.style.borderRadius = '4px';
    loadingIndicator.style.animation = 'pulse 2s ease-in-out infinite';
    wordsContainer.appendChild(loadingIndicator);
  } else if (hasWordIdsButIncompleteData) {
    // thaiSplit ready but word data still loading - show animated loading indicator
    // Only show words when ALL wordIds have data in bundle
    const loadingIndicator = document.createElement('div');
    loadingIndicator.innerHTML = '⏳ Loading word data... (waiting for all words in bundle)';
    loadingIndicator.style.fontSize = '12px';
    loadingIndicator.style.opacity = '0.7';
    loadingIndicator.style.fontStyle = 'italic';
    loadingIndicator.style.padding = '12px';
    loadingIndicator.style.textAlign = 'center';
    loadingIndicator.style.color = 'rgba(255, 215, 0, 0.8)';
    loadingIndicator.style.border = '1px dashed rgba(255, 215, 0, 0.3)';
    loadingIndicator.style.borderRadius = '4px';
    loadingIndicator.style.animation = 'pulse 2s ease-in-out infinite';
    wordsContainer.appendChild(loadingIndicator);
  }
  
  // Only display words with POS colors when ALL word data is fully loaded in bundle
  if (allWordsLoaded) {
    for (const wordId of wordIds) {
      if (!wordId || wordId.trim() === '') continue;
      
      // CACHE-FIRST: Get wordData from bundle (phoneticWordMap) - fast, no DB fetch
      const wordData = wordMap.get(wordId);
      if (!wordData) {
        // Should not happen if allWordsLoaded is true, but safety check
        continue;
      }
    
    const wordSpan = document.createElement('span');
    wordSpan.textContent = wordData.thaiScript || '';
    wordSpan.style.padding = '4px 8px';
    wordSpan.style.borderRadius = '4px';
    wordSpan.style.fontSize = '14px';
    wordSpan.style.cursor = 'pointer';
    wordSpan.style.border = '1px solid rgba(255, 215, 0, 0.3)';
    
    // Apply POS color to underline
    const pos = String(wordData.pos || '').trim().toLowerCase();
    const posColor = posColors.get(pos);
    if (posColor) {
      // Convert hex to rgba for underline
      const hex = posColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      wordSpan.style.textDecoration = 'underline';
      wordSpan.style.textDecorationColor = `rgba(${r}, ${g}, ${b}, 0.6)`;
      wordSpan.style.textDecorationThickness = '2px';
    }
    
    // Click to edit word
    wordSpan.addEventListener('click', async () => {
      const { showWordModal } = await import('./wordModal.js');
      // Get subtitle cache for POS dropdown
      const subtitleCache = dependencies.onGetSubtitleCache ? dependencies.onGetSubtitleCache() : [];
      const onUpdateWord = (updatedWordId, updatedData) => {
        // CACHE-FIRST: Update bundle object (source of truth)
        if (dependencies.onUpdateCacheSubtitle) {
          dependencies.onUpdateCacheSubtitle(subtitle.recordId, (cachedSub) => {
            if (cachedSub.phoneticWordMap && cachedSub.phoneticWordMap.has(updatedWordId)) {
              const wordData = cachedSub.phoneticWordMap.get(updatedWordId);
              Object.assign(wordData, updatedData);
              cachedSub.phoneticWordMap.set(updatedWordId, wordData);
              // NOTE: Don't set Edited = true - word data edits are not subtitle text edits
            }
          });
        }
        // Update local subtitle object for immediate display
        const localWordData = wordMap.get(updatedWordId);
        if (localWordData) {
          Object.assign(localWordData, updatedData);
        }
        // Refresh card display from updated bundle (keep same locked review bundle)
        const modalElement = document.getElementById('smart-subs-batch-review-modal');
        if (modalElement) {
          const lockedBundle = modalElement._reviewBundle || [];
          const subtitleCache = dependencies.onGetSubtitleCache ? dependencies.onGetSubtitleCache() : [];
          const lockedSubtitles = subtitleCache.filter(s => lockedBundle.includes(s.recordId));
          updateBatchReviewContent(modalElement, lockedSubtitles, dependencies);
        }
      };
      showWordModal(wordId, wordData, onUpdateWord);
    });
    
      wordsContainer.appendChild(wordSpan);
    }
  }
  
  card.appendChild(wordsContainer);
  
  // No IntersectionObserver - subtitles are marked as reviewed when modal closes
  // User exits modal = finished reviewing those 5 subtitles
  
  return card;
}

/**
 * Check if batch review modal should auto-open
 * @param {Array} subtitles - Array of subtitle objects
 * @param {number} threshold - Number of subtitles needed to trigger (default: 5)
 * @returns {boolean} True if should open
 */
export function shouldAutoOpenBatchReview(subtitles, threshold = 5, currentCount = 0) {
  // CACHE-FIRST: Counter is tracked from cache (subtitles passing through)
  // Counter increments each time a subtitle passes through (thaiScriptReview)
  // subtitles parameter is ignored - counter is the source of truth from cache
  const shouldOpen = currentCount >= threshold;
  // Auto-open check (silent - counter-based)
  return shouldOpen;
}


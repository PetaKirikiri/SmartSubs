import { loadEpisode, getSubtitleAt } from '../services/airtableSubtitlePipeline.js';
import { getSubtitleCache } from './subtitleCache.js';

function getMediaIdFromUrl() {
  const urlMatch = window.location.pathname.match(/\/watch\/(\d+)/);
  return urlMatch ? urlMatch[1] : null;
}

function getVideoCurrentTime() {
  const video = document.querySelector('video');
  return video ? video.currentTime : null;
}

let currentSubtitle = null;
let renderCallback = null;
let pollInterval = null;
let currentMediaId = null;

export function initSubtitleController(onRender) {
  renderCallback = onRender;
  const mediaId = getMediaIdFromUrl();
  if (!mediaId) {
    return;
  }
  
  currentMediaId = mediaId;
  
  loadEpisode(mediaId).then(() => {
    const cache = getSubtitleCache();
    
    if (cache.length === 0) {
      return;
    }
    
    // IMMEDIATELY show first subtitle at current video time - don't wait for polling
    const currentTime = getVideoCurrentTime();
    if (currentTime !== null && cache.length > 0) {
      const immediateSubtitle = getSubtitleAt(currentTime);
      if (immediateSubtitle) {
        currentSubtitle = immediateSubtitle;
        renderCallback?.(immediateSubtitle);
      }
    }
    
    startPolling();
  }).catch((error) => {
    // Silently fail
  });
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  
  const cache = getSubtitleCache();
  if (cache.length === 0) {
    return;
  }
  
  pollInterval = setInterval(() => {
    const seconds = getVideoCurrentTime();
    if (seconds == null) return;
    
    // Check if current subtitle is complete by reading from cache (may have been updated)
    let currentIsComplete = false;
    if (currentSubtitle) {
      const cache = getSubtitleCache();
      const cachedSubtitle = cache.find(s => s.recordId === currentSubtitle.recordId);
      if (cachedSubtitle) {
        const hasThaiSplitIds = cachedSubtitle.thaiSplitIds && (
          (Array.isArray(cachedSubtitle.thaiSplitIds) && cachedSubtitle.thaiSplitIds.length > 0) ||
          (typeof cachedSubtitle.thaiSplitIds === 'string' && cachedSubtitle.thaiSplitIds.trim() !== '' && cachedSubtitle.thaiSplitIds !== '[]')
        );
        currentIsComplete = hasThaiSplitIds;
        // Update currentSubtitle reference to latest from cache
        currentSubtitle = cachedSubtitle;
      }
    }
    
    // If current subtitle is complete, get the next incomplete one
    const subtitle = getSubtitleAt(seconds);
    
    // Only update when:
    // 1. Current subtitle is complete (move to next incomplete one), OR
    // 2. A new subtitle starts (different recordId)
    // IMPORTANT: Don't auto-advance - stay on current row until all stages complete
    const hasSubtitle = subtitle !== null;
    const hasCurrentSubtitle = currentSubtitle !== null;
    const differentRecordId = subtitle && currentSubtitle && subtitle.recordId !== currentSubtitle.recordId;
    
    // Transition if:
    // - Current subtitle is complete (has thaiSplitIds), OR
    // - We have a subtitle AND (no current subtitle OR different recordId)
    const shouldTransition = currentIsComplete || (hasSubtitle && (!hasCurrentSubtitle || differentRecordId));
    
    if (shouldTransition) {
      currentSubtitle = subtitle;
      renderCallback?.(subtitle);
    }
    // Never call renderCallback with null - currentSubtitle stays visible during gaps
  }, 100);
}

export function stopSubtitleController() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  currentSubtitle = null;
  renderCallback = null;
  currentMediaId = null;
}


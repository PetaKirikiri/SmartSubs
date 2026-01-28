/**
 * SmartSubs Parent Component
 * Main UI container - manages UI state and coordinates child components
 */

import React, { useState, useEffect, useRef } from 'react';
import { Taskbar } from './taskbar.jsx';
import { SubtitleArea } from './subtitle-area.jsx';
import UploadPanel from '../01_load-subtitles/components/upload-panel.jsx';
import ProcessSubtitles from '../03_process/components/process-subtitles.jsx';
import { setupArrowKeyNavigation, removeArrowKeyNavigation } from '../07_tracking/hotkeys.js';

// Debug logging helper (disabled on Netflix due to CSP)
// CSP blocks http:// connections on Netflix, causing console spam
let debugLogDisabled = false;
const debugLog = (location, message, data, hypothesisId) => {
  // Disable entirely on Netflix domain to prevent CSP violations
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.includes('netflix.com') || hostname.includes('netflix')) {
      return; // Skip entirely - CSP blocks http:// on Netflix
    }
  }
  
  // Test fetch once, then disable if it fails (CSP violation)
  if (debugLogDisabled) {
    return;
  }
  
  try {
    fetch('http://127.0.0.1:7242/ingest/321fb967-e310-42c8-9fbb-98d62112cb97', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: location,
        message: message,
        data: data || {},
        timestamp: Date.now(),
        sessionId: 'netflix-subtitle-debug',
        hypothesisId: hypothesisId || 'general'
      })
    }).catch(() => {
      // On first failure, disable to stop spam
      debugLogDisabled = true;
    });
  } catch (e) {
    debugLogDisabled = true;
  }
};

export function SmartSubsParent({ onCacheReadySignal }) {
  // Display state only - subtitle comes from timeline (subtitle-tracker.js)
  // Cleared initially for diagnostics
  const [displaySubtitle, setDisplaySubtitle] = useState(null);
  const lastLoggedDisplaySubtitleIdRef = React.useRef(null);
  const previousSubtitleIdRef = useRef(null);
  const [cacheReady, setCacheReady] = useState(false);
  const [cacheBundleCount, setCacheBundleCount] = useState(0);
  const [isFetchingNetflix, setIsFetchingNetflix] = useState(false);
  const [useThaiSplitIdsMode, setUseThaiSplitIdsMode] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadFormData, setUploadFormData] = useState(null);
  const [showProcessing, setShowProcessing] = useState(false);
  const [processingData, setProcessingData] = useState(null);
  const [isFetchingEnglish, setIsFetchingEnglish] = useState(false);
  
  // CRITICAL: Register save success handler - this is the ONLY place that clears true → false
  // Message flow: save → content.js → parent JSX → clear ALL true flags
  useEffect(() => {
    const handleSaveSuccess = async (subtitleId) => {
      // CRITICAL: This is the ONLY place in the whole system that turns true → false
      // Clear ALL true flags (not just some) - they all meant "needs to be saved"
      const { getCachedSubtitle, cacheFatSubtitleSilent } = await import('../05_cache/cache-subtitles.js');
      const { makeBlankSchemaWorkMapFromFatBundle } = await import('../03_process/helpers/workmap/schema-work-map-builder.js');
      
      const fatBundle = getCachedSubtitle(subtitleId);
      if (!fatBundle || !fatBundle.schemaWorkMap) {
        return;
      }
      
      // Reset ALL schemaWorkMap signals to false (does not need work)
      // This is the ONLY place true → false happens
      fatBundle.schemaWorkMap = await makeBlankSchemaWorkMapFromFatBundle(fatBundle, subtitleId);
      
      // Set savedAt timestamp
      fatBundle.savedAt = Date.now();
      
      // Update cache
      cacheFatSubtitleSilent(subtitleId, fatBundle);
    };
    
    // Register handler on window for content.js to call
    if (typeof window !== 'undefined') {
      window.__smartSubsSaveSuccessHandler = handleSaveSuccess;
    }
    
    return () => {
      // Cleanup: remove handler on unmount
      if (typeof window !== 'undefined') {
        delete window.__smartSubsSaveSuccessHandler;
      }
    };
  }, []);
  
  // Register callback with orchestrator
  useEffect(() => {
    if (onCacheReadySignal) {
      onCacheReadySignal((bundleCount) => {
        setCacheBundleCount(bundleCount);
        setCacheReady(true);
      });
    }
  }, [onCacheReadySignal]);
  
  useEffect(() => {
    let unsubscribe = null;
    
    const initTimelineSubscription = async () => {
      const { 
        subscribeToTimelineChanges, 
        getCurrentSubtitle,
        startTrackingVideoTimeWithCacheCheck 
      } = await import('../07_tracking/subtitle-tracker-orchestrator.js');
      const { getCachedSubtitleCache, getCachedSubtitleByRecordId, getCachedSubtitle, getCacheContext } = await import('../05_cache/cache-subtitles.js');
      const { saveFatSubtitle } = await import('../05_save/save-subtitles.js');
      
      // Get initial subtitle from timeline (single source of truth)
      // Cleared for diagnostics - subtitle will be set via subscription
      const initialSubtitle = getCurrentSubtitle();
      // Don't set initial subtitle - let subscription handle it to ensure diagnostics run
      
      // Subscribe to timeline-driven subtitle changes
      unsubscribe = subscribeToTimelineChanges(async (subtitle) => {
        const newSubtitleId = subtitle?.id || null;
        const previousSubtitleId = previousSubtitleIdRef.current;
        
        // Detect subtitle transition
        if (previousSubtitleId && previousSubtitleId !== newSubtitleId) {
          // Transition detected - save previous subtitle if dirty
          const previousBundle = getCachedSubtitle(previousSubtitleId);
          if (previousBundle && previousBundle.savedAt === null && previousBundle.schemaWorkMap) {
            // Previous subtitle has unsaved changes - save it
            const cacheContext = getCacheContext();
            const { showName, mediaId } = cacheContext;
            
            if (showName && mediaId) {
              try {
                await saveFatSubtitle(previousBundle, previousBundle.schemaWorkMap, {
                  showName,
                  mediaId
                });
                
                // Handle save success - clear schemaWorkMap
                if (typeof window !== 'undefined' && window.__smartSubsSaveSuccessHandler) {
                  window.__smartSubsSaveSuccessHandler(previousSubtitleId);
                }
              } catch (error) {
                // Silent fail on transition save
              }
            }
          }
        }
        
        // Update previous subtitle ID
        previousSubtitleIdRef.current = newSubtitleId;
        
        // Diagnostic logging when displaySubtitle changes
        if (subtitle && subtitle.id !== lastLoggedDisplaySubtitleIdRef.current) {
          lastLoggedDisplaySubtitleIdRef.current = subtitle.id;
        }
        setDisplaySubtitle(subtitle);
      });
      
      // Start tracking (this will trigger timeline events)
      const urlMatch = window.location.pathname.match(/\/watch\/(\d+)/);
      const mediaId = urlMatch ? urlMatch[1] : null;
      
      // Use legacy callback for backward compatibility (will be removed later)
      startTrackingVideoTimeWithCacheCheck(() => {
        // Timeline changes are handled by subscription above
      });
    };
    
    // Only initialize timeline subscription when cache is ready (orchestrated signal)
    if (cacheReady) {
      initTimelineSubscription();
    }
    
    // Cleanup: unsubscribe from timeline changes
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [cacheReady, cacheBundleCount]);

  // Set up arrow key navigation for subtitle navigation
  useEffect(() => {
    // Only set up when subtitle area is visible (not during upload/processing)
    const isSubtitleAreaVisible = !showUploadForm && !showProcessing;
    
    if (isSubtitleAreaVisible) {
      setupArrowKeyNavigation();
    }
    
    return () => {
      if (isSubtitleAreaVisible) {
        removeArrowKeyNavigation();
      }
    };
  }, [showUploadForm, showProcessing]);

  // CRITICAL: Continuous timeline validation - subtitle display REQUIRES matching timeline
  useEffect(() => {
    if (!displaySubtitle) return;
    
    let lastValidatedSubtitleId = displaySubtitle.id;
    
    const validateTimeline = async () => {
      const { getCurrentSubtitle } = await import('../07_tracking/subtitle-tracker-orchestrator.js');
      const timelineSubtitle = getCurrentSubtitle();
      const displaySubtitleId = displaySubtitle?.id;
      const timelineSubtitleId = timelineSubtitle?.id;
      
      if (displaySubtitleId !== timelineSubtitleId) {
        setDisplaySubtitle(null);
      } else if (displaySubtitleId !== lastValidatedSubtitleId) {
        lastValidatedSubtitleId = displaySubtitleId;
      }
    };
    
    // Validate immediately
    validateTimeline();
    
    // Validate periodically (every 500ms) to catch any mismatches - reduced frequency to reduce spam
    const validationInterval = setInterval(validateTimeline, 500);
    
    return () => {
      clearInterval(validationInterval);
    };
  }, [displaySubtitle]);

  // Import functions directly - no wrappers
  const handleLoadSubtitles = async () => {
    setIsFetchingNetflix(true);
    try {
      const { handleLoadSubtitles: loadFn } = await import('../01_load-subtitles/load-subtitles-orchestrator.js');
      const metadata = await loadFn();
      
      // Format result for upload form
      const result = {
        mediaMeta: {
          mediaId: metadata.mediaId,
          showName: metadata.showName,
          duration: metadata.duration,
          title: metadata.episodeTitle || null
        },
        vttSubtitles: [],
        fileName: 'netflix'
      };
      
      setUploadFormData(result);
      setShowUploadForm(true);
      return metadata;
    } catch (error) {
      console.error('[handleLoadSubtitles] Failed:', error.message);
      throw error;
    } finally {
      setIsFetchingNetflix(false);
    }
  };
  
  const handleProcessSubtitles = async (mediaId, season, episodeNumber, episodeTitle, showName) => {
    const { handleProcessSubtitles: processFn } = await import('../01_load-subtitles/load-subtitles-orchestrator.js');
    return await processFn(mediaId, season, episodeNumber, episodeTitle, showName);
  };

  const handleUploadSubmit = async (submitData, vttSubtitles) => {
    // Close upload form immediately
    setShowUploadForm(false);
    
    // Inline validation: validate episode metadata before creating episodeData
    if (!submitData.showName || submitData.showName.trim() === '') {
      throw new Error('handleUploadSubmit: showName is required, cannot be null or empty');
    }
    if (!submitData.mediaId || submitData.mediaId.trim() === '') {
      throw new Error('handleUploadSubmit: mediaId is required, cannot be null or empty');
    }
    if (submitData.season === null || submitData.season === undefined) {
      throw new Error('handleUploadSubmit: season is required, cannot be null or undefined');
    }
    if (submitData.episode === null || submitData.episode === undefined) {
      throw new Error('handleUploadSubmit: episode is required, cannot be null or undefined');
    }
    if (submitData.episodeTitle === null || submitData.episodeTitle === undefined || submitData.episodeTitle.trim() === '') {
      throw new Error('handleUploadSubmit: episodeTitle is required, cannot be null or empty');
    }
    
    // Update episodeLookup metadata BEFORE processing starts
    const { saveEpisodeLookupMetadata } = await import('../05_save/helpers/save-episode-lookup.js');
    const episodeData = {
      season: submitData.season,
      episode: submitData.episode,
      episodeTitle: submitData.episodeTitle
    };
    console.log('Updating episodeLookup metadata:', { showName: submitData.showName, mediaId: submitData.mediaId, episodeData });
    await saveEpisodeLookupMetadata(submitData.showName, submitData.mediaId, episodeData);
    console.log('Successfully updated episodeLookup metadata');
    
    // Show ProcessSubtitles component for sequential processing
    setShowProcessing(true);
    setProcessingData({
      vttSubtitles: vttSubtitles || [],
      showName: submitData.showName,
      mediaId: submitData.mediaId,
      season: submitData.season,
      episode: submitData.episode,
      episodeTitle: submitData.episodeTitle || null,
      srtFilename: submitData.srtFilename,
      reprocessMode: false,
      autoProcessAll: submitData.autoProcessAll || false // Auto-process all if all info is filled
    });
  };

  const handleUploadClose = () => {
    setShowUploadForm(false);
    setUploadFormData(null);
  };

  const handleProcessingComplete = () => {
    setShowProcessing(false);
    setProcessingData(null);
  };

  const handleProcessingCancel = () => {
    setShowProcessing(false);
    setProcessingData(null);
  };


  const handleReprocessTimestampsClick = () => {
    // ReprocessTimestamps component removed - feature deprecated
    console.log('Reprocess timestamps feature has been removed');
  };

  const handleReprocessPhoneticsClick = () => {
    // Reprocess phonetics feature not implemented
    console.log('Reprocess phonetics feature needs Firebase migration');
  };

  const handleFetchEnglish = async () => {
    if (isFetchingEnglish) return;
    
    setIsFetchingEnglish(true);
    try {
      const { fetchEnglishVTTContent, parseEnglishVTTContent } = await import('../03_process/helpers/01_vtt/vtt.js');
      const { getMediaIdFromUrl } = await import('../01_load-subtitles/helpers/extract-metadata.js');
      
      const mediaId = getMediaIdFromUrl();
      if (!mediaId) {
        console.error('No mediaId found in URL');
        return;
      }
      
      const englishVTT = await fetchEnglishVTTContent(mediaId);
      if (!englishVTT || !englishVTT.content) {
        console.error('English subtitles not available');
        return;
      }
      
      const parsedEnglish = parseEnglishVTTContent(englishVTT.content);
      console.log('English VTT fetched successfully!', `Total subtitles: ${parsedEnglish.length}`, `First subtitle: "${parsedEnglish[0]?.text || 'N/A'}"`);
    } catch (error) {
      console.error('Error fetching English VTT:', error.message);
    } finally {
      setIsFetchingEnglish(false);
    }
  };

  return (
    <>
      <div style={{ flexShrink: 0, position: 'relative', zIndex: 1 }}>
          <Taskbar 
          onFetchNetflix={handleLoadSubtitles}
          onReprocessTimestamps={handleReprocessTimestampsClick}
          onReprocessPhonetics={handleReprocessPhoneticsClick}
          onFetchEnglish={handleFetchEnglish}
          isFetching={isFetchingNetflix}
          isReprocessingTimestamps={false}
          isReprocessingPhonetics={false}
          isFetchingEnglish={isFetchingEnglish}
          useThaiSplitIdsMode={useThaiSplitIdsMode}
          onToggleMode={() => setUseThaiSplitIdsMode(!useThaiSplitIdsMode)}
          currentSubtitleId={displaySubtitle?.id}
        />
      </div>
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'auto', 
        minHeight: 0,
        height: '100%',
        position: 'relative',
        zIndex: 1
      }}>
            {showProcessing && processingData ? (
              <ProcessSubtitles
                vttSubtitles={processingData.vttSubtitles || []}
                submitData={{
                  showName: processingData.showName,
                  mediaId: processingData.mediaId,
                  duration: null,
                  season: processingData.season,
                  episode: processingData.episode,
                  episodeTitle: processingData.episodeTitle
                }}
                onComplete={handleProcessingComplete}
                onCancel={handleProcessingCancel}
                autoProcessAll={processingData.autoProcessAll || false}
              />
            ) : showUploadForm && uploadFormData ? (
          <UploadPanel
            isOpen={true}
            onClose={handleUploadClose}
            onSubmit={handleUploadSubmit}
            mediaMeta={uploadFormData.mediaMeta}
            parsedSubtitleCount={uploadFormData.vttSubtitles?.length || 0}
            fileName={uploadFormData.fileName}
            statusSummary={null}
            vttSubtitles={uploadFormData.vttSubtitles || []}
            onProcessSubtitles={handleProcessSubtitles}
            onProcessComplete={async (result) => {
              // Handle reprocess action
              if (result?.action === 'reprocess') {
                // Update episodeLookup metadata when reprocessing
                if (result.showName && result.mediaId) {
                  try {
                    const { saveEpisodeLookupMetadata } = await import('../05_save/helpers/save-episode-lookup.js');
                    await saveEpisodeLookupMetadata(result.showName, result.mediaId, {
                      season: result.season !== undefined ? result.season : null,
                      episode: result.episode !== undefined ? result.episode : null,
                      episodeTitle: result.episodeTitle !== undefined ? result.episodeTitle : null
                    });
                  } catch (error) {
                    console.error('Failed to update episodeLookup metadata:', error);
                  }
                }
                
                setShowUploadForm(false);
                // Show ProcessSubtitles in reprocess mode
                setProcessingData({
                  vttSubtitles: [], // Empty - reprocess mode not implemented yet
                  showName: result.showName,
                  mediaId: result.mediaId,
                  season: result.season !== undefined ? result.season : null,
                  episode: result.episode !== undefined ? result.episode : null,
                  episodeTitle: result.episodeTitle !== undefined ? result.episodeTitle : null,
                  srtFilename: null,
                  reprocessMode: true
                });
                setShowProcessing(true);
              } else {
                // Original behavior - close upload form after processing completes
                setShowUploadForm(false);
                setUploadFormData(null);
              }
            }}
          />
        ) : displaySubtitle ? (
          <SubtitleArea 
            subtitle={displaySubtitle} 
            useThaiSplitIdsMode={useThaiSplitIdsMode}
            onSubtitleChange={null}
          />
        ) : null}
      </div>
    </>
  );
}

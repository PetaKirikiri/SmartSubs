import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function UploadPanel({
  isOpen,
  onClose,
  onSubmit,
  mediaMeta = null,
  parsedSubtitleCount = 0,
  fileName = '',
  statusSummary = null,
  vttSubtitles = [],
  onProcessComplete = null,
  onProcessSubtitles = null
}) {
  const [showName, setShowName] = useState('');
  const [season, setSeason] = useState('');
  const [episode, setEpisode] = useState('');
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isExistingMedia, setIsExistingMedia] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [episodeExists, setEpisodeExists] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ processed: 0, total: 0 });
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [processingStats, setProcessingStats] = useState({ totalTokens: 0, phoneticsCount: 0, meaningsCount: 0, totalWords: 0 });
  const [processingErrors, setProcessingErrors] = useState([]);
  
  // Use refs to track if we've initialized from mediaMeta to prevent unnecessary updates
  const seasonInitialized = useRef(false);
  const episodeInitialized = useRef(false);
  const episodeTitleInitialized = useRef(false);
  const showNameInitialized = useRef(false);

  // Extract mediaId, duration, title early (before useEffect hooks that use them)
  // mediaId can come from mediaMeta prop OR from URL if not provided
  const mediaIdFromProp = mediaMeta?.mediaId || null;
  const mediaIdFromUrl = (() => {
    if (typeof window !== 'undefined') {
      const urlMatch = window.location.pathname.match(/\/watch\/(\d+)/);
      return urlMatch && urlMatch[1] ? urlMatch[1] : null;
    }
    return null;
  })();
  const mediaId = mediaIdFromProp || mediaIdFromUrl;
  const duration = mediaMeta?.duration ? Math.floor(mediaMeta.duration) : null;
  const title = mediaMeta?.title || null;

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowName('');
      setEpisodeTitle('');
      seasonInitialized.current = false;
      episodeInitialized.current = false;
      episodeTitleInitialized.current = false;
      showNameInitialized.current = false;
      setEpisodeExists(false);
    }
  }, [isOpen]);

  // Load metadata: Priority 1) Lookup table, 2) Metadata extraction (if mediaMeta prop not provided or incomplete)
  // Season only comes from lookup table (not available in DOM)
  useEffect(() => {
    if (!isOpen || !mediaId) return;
    
    const loadMetadata = async () => {
      try {
        // Step 1: Load from lookup table first (priority)
        const { getEpisodeMetadataFromMediaId } = await import('../load-subtitles-orchestrator.js');
        const lookupMetadata = await getEpisodeMetadataFromMediaId(mediaId);
        
        if (lookupMetadata) {
          // Season only comes from lookup table (not available in DOM)
          if (lookupMetadata.season !== null && lookupMetadata.season !== undefined && !seasonInitialized.current) {
            setSeason(String(lookupMetadata.season));
            seasonInitialized.current = true;
          }
          
          // ShowName from lookup table (priority)
          if (lookupMetadata.showName && !showNameInitialized.current) {
            setShowName(lookupMetadata.showName);
            showNameInitialized.current = true;
          }
          
          // Episode from lookup table (priority)
          if (lookupMetadata.episode !== null && lookupMetadata.episode !== undefined && !episodeInitialized.current) {
            setEpisode(String(lookupMetadata.episode));
            episodeInitialized.current = true;
          }
          
          // EpisodeTitle from lookup table (priority)
          if (lookupMetadata.episodeTitle && !episodeTitleInitialized.current) {
            setEpisodeTitle(lookupMetadata.episodeTitle);
            episodeTitleInitialized.current = true;
          }
        }
        
        // Step 2: Fill gaps from metadata extraction or mediaMeta prop
        // Priority: Lookup table > mediaMeta prop > metadata extraction
        
        // Check if we need to fill gaps
        const needsShowName = !showNameInitialized.current;
        const needsEpisode = !episodeInitialized.current;
        const needsEpisodeTitle = !episodeTitleInitialized.current;
        
        if (needsShowName || needsEpisode || needsEpisodeTitle) {
          // Try mediaMeta prop first (backward compatibility)
          if (mediaMeta) {
            if (needsShowName && mediaMeta.showName) {
              setShowName(mediaMeta.showName);
              showNameInitialized.current = true;
            }
            
            if (needsEpisode && mediaMeta.episodeNumber !== null && mediaMeta.episodeNumber !== undefined) {
              setEpisode(String(mediaMeta.episodeNumber));
              episodeInitialized.current = true;
            }
            
            if (needsEpisodeTitle && mediaMeta.episodeTitle) {
              setEpisodeTitle(mediaMeta.episodeTitle);
              episodeTitleInitialized.current = true;
            }
          }
          
          // If still missing fields, call extractMediaMetadata
          const stillNeedsShowName = !showNameInitialized.current;
          const stillNeedsEpisode = !episodeInitialized.current;
          const stillNeedsEpisodeTitle = !episodeTitleInitialized.current;
          
          if (stillNeedsShowName || stillNeedsEpisode || stillNeedsEpisodeTitle) {
            const videoElement = document.querySelector('video');
            if (videoElement) {
              const { extractMediaMetadata } = await import('../helpers/extract-metadata.js');
              const extractedMetadata = extractMediaMetadata(videoElement, mediaId);
              
              // Fill remaining gaps: only use extracted metadata if not already set
              // ShowName: lookup table priority, then mediaMeta prop, then extraction
              if (stillNeedsShowName && extractedMetadata.showName) {
                setShowName(extractedMetadata.showName);
                showNameInitialized.current = true;
              }
              
              // Episode: lookup table priority, then mediaMeta prop, then extraction (episodeNumber → episode)
              if (stillNeedsEpisode && extractedMetadata.episodeNumber !== null && extractedMetadata.episodeNumber !== undefined) {
                setEpisode(String(extractedMetadata.episodeNumber));
                episodeInitialized.current = true;
              }
              
              // EpisodeTitle: lookup table priority, then mediaMeta prop, then extraction
              if (stillNeedsEpisodeTitle && extractedMetadata.episodeTitle) {
                setEpisodeTitle(extractedMetadata.episodeTitle);
                episodeTitleInitialized.current = true;
              }
              
              // Do NOT use extracted metadata for season (not available in DOM)
            }
          }
        }
      } catch (error) {
        // Silently fail - metadata loading is optional
      }
    };
    
    loadMetadata();
  }, [isOpen, mediaId, mediaMeta]);

  // Check if episode exists in Firebase (for episodeExists flag only)
  useEffect(() => {
    if (!isOpen || !mediaId || !showName) return;
    
    const checkEpisodeExists = async () => {
      try {
        // TODO: getShowNameFromMediaId function needs to be implemented
        // const { getShowNameFromMediaId } = await import('../load-subtitles-orchestrator.js');
        const firebaseShowName = null; // await getShowNameFromMediaId(mediaId);
        setEpisodeExists(!!firebaseShowName);
      } catch (error) {
        setEpisodeExists(false);
      }
    };
    
    checkEpisodeExists();
  }, [isOpen, mediaId, showName]);

  // No longer checking for existing media - Firebase doesn't need this
  // Set once when modal opens, don't re-run on mediaMeta changes
  useEffect(() => {
    if (isOpen) {
      setIsExistingMedia(false);
    }
  }, [isOpen]);

  // Reset auto-submit flag when modal closes
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      hasAutoSubmittedRef.current = false;
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async () => {
    // Use showName directly (extracted from metadata)
    const finalShowName = showName.trim();
    
    if (!finalShowName || finalShowName === '') {
      console.error('Show name is required. Please ensure metadata extraction is working.');
      return;
    }

    if (!mediaId) {
      console.error('Media ID is required. Please ensure you are on a Netflix watch page.');
      return;
    }

    // Handle Process mode for existing subtitles - redirect to ProcessSubtitles component
    if (isExistingMedia) {
      // Instead of processing here, trigger ProcessSubtitles component via parent
      // The parent will handle showing ProcessSubtitles component
      if (onProcessComplete) {
        // Signal to parent that we want to reprocess
        // Include metadata so episodeLookup can be updated
        onProcessComplete({ 
          action: 'reprocess',
          mediaId: mediaId,
          showName: finalShowName,
          season: season.trim() ? parseInt(season.trim(), 10) : null,
          episode: episode.trim() ? parseInt(episode.trim(), 10) : null,
          episodeTitle: episodeTitle.trim() || null
        });
      }
      return;
    }

    // Handle Upload mode for new subtitles
    // Validate required fields
    if (!finalShowName || finalShowName.trim() === '') {
      console.error('Show name is required.');
      return;
    }
    if (!mediaId) {
      console.error('Media ID is required.');
      return;
    }
    if (!season.trim()) {
      console.error('Season is required.');
      return;
    }
    if (!episode.trim()) {
      console.error('Episode is required.');
      return;
    }
    if (!episodeTitle.trim()) {
      console.error('Episode title is required.');
      return;
    }

    setIsUploading(true);

    // Parse season and episode
    const parsedSeason = parseInt(season.trim(), 10);
    if (isNaN(parsedSeason)) {
      console.error('Season must be a valid number.');
      setIsUploading(false);
      return;
    }
    
    const parsedEpisode = parseInt(episode.trim(), 10);
    if (isNaN(parsedEpisode)) {
      console.error('Episode must be a valid number.');
      setIsUploading(false);
      return;
    }

    try {
      // Call onProcessSubtitles to load subtitles (tries DB first, falls back to VTT)
      const fatBundles = await onProcessSubtitles(mediaId, parsedSeason, parsedEpisode, episodeTitle.trim(), finalShowName);
      
      const submitData = {
        showName: finalShowName,
        mediaId: mediaId,
        duration: duration,
        season: parsedSeason,
        episode: parsedEpisode,
        episodeTitle: episodeTitle.trim(),
        episodeExists: episodeExists,
        autoProcessAll: false
      };

      await onSubmit(submitData, fatBundles);
      setIsUploading(false);
    } catch (error) {
      setIsUploading(false);
      console.error('Failed to process subtitles:', error);
    }
  }, [showName, mediaId, season, episode, episodeTitle, episodeExists, duration, isExistingMedia, onSubmit, onProcessComplete, onProcessSubtitles]);

  // Auto-submit when all required fields are filled (showName, mediaId, season)
  useEffect(() => {
    if (!isOpen || isUploading || isProcessing || hasAutoSubmittedRef.current || isExistingMedia) return;
    if (!vttSubtitles || vttSubtitles.length === 0) return;
    
    const finalShowNameCheck = showName.trim();
    // Check if all required fields are filled: showName, mediaId, and season
    const allFieldsFilled = finalShowNameCheck !== '' && mediaId && season.trim() !== '';
    
    if (allFieldsFilled) {
      hasAutoSubmittedRef.current = true;
      // Small delay to ensure state is settled
      setTimeout(() => {
        handleSubmit();
      }, 100);
    }
  }, [isOpen, showName, mediaId, season, vttSubtitles, isUploading, isProcessing, isExistingMedia, handleSubmit]);

  const finalShowName = showName.trim();
  const canUpload = finalShowName !== '' && mediaId;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '12px 20px',
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      color: '#FFD700',
      boxSizing: 'border-box'
    }}>
      <div style={{
        marginBottom: '12px',
        fontSize: '14px',
        fontWeight: '600',
        color: '#FFD700'
      }}>
        {isExistingMedia ? 'Reprocess Existing Subtitles' : `Upload Subtitles: ${fileName} (${parsedSubtitleCount} subtitles)`}
      </div>

      {isProcessing && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', color: '#FFD700', marginBottom: '4px' }}>
            Processing: {processingProgress.processed}/{processingProgress.total}
          </div>
          <div style={{ width: '100%', backgroundColor: 'rgba(255, 215, 0, 0.1)', borderRadius: '4px', height: '8px' }}>
            <div style={{
              width: `${processingProgress.total > 0 ? (processingProgress.processed / processingProgress.total) * 100 : 0}%`,
              backgroundColor: '#FFD700',
              height: '100%',
              borderRadius: '4px'
            }}></div>
          </div>
          {currentSubtitle && (
            <div style={{ fontSize: '11px', color: '#FFD700', marginTop: '4px', opacity: 0.8 }}>
              Current: {currentSubtitle}
            </div>
          )}
          {processingStats.totalTokens > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginTop: '8px',
              fontSize: '11px',
              color: '#FFD700',
              opacity: 0.8
            }}>
              <div>Tokens: {processingStats.totalTokens}</div>
              <div>Words: {processingStats.totalWords}</div>
              <div>Phonetics: {processingStats.phoneticsCount}/{processingStats.totalWords}</div>
              <div>Meanings: {processingStats.meaningsCount}/{processingStats.totalWords}</div>
            </div>
          )}
          {processingErrors.length > 0 && (
            <div style={{
              backgroundColor: 'rgba(255, 0, 0, 0.1)',
              border: '1px solid rgba(255, 0, 0, 0.3)',
              borderRadius: '4px',
              padding: '8px',
              marginTop: '8px',
              maxHeight: '80px',
              overflowY: 'auto',
              fontSize: '11px',
              color: '#FF6347'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>Errors:</div>
              {processingErrors.map((err, idx) => (
                <div key={idx} style={{ marginBottom: '2px' }}>{err}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {statusSummary && (
        <div style={{
          marginBottom: '10px',
          padding: '6px 10px',
          backgroundColor: 'rgba(255, 215, 0, 0.1)',
          border: '1px solid rgba(255, 215, 0, 0.3)',
          borderRadius: '4px',
          color: 'rgba(255, 215, 0, 0.9)',
          fontSize: '12px'
        }}>
          {statusSummary}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: title ? '1fr 1fr 1fr' : '1fr 1fr',
        gap: '10px',
        marginBottom: '10px'
      }}>
        {title && (
          <div>
            <label style={{
              display: 'block',
              marginBottom: '4px',
              fontSize: '12px',
              fontWeight: '500',
              color: '#FFD700'
            }}>
              Title
            </label>
            <input
              type="text"
              value={title}
              readOnly
              style={{
                width: '100%',
                padding: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 215, 0, 0.3)',
                borderRadius: '4px',
                color: 'rgba(255, 215, 0, 0.7)',
                fontSize: '12px',
                boxSizing: 'border-box'
              }}
            />
          </div>
        )}
        <div>
          <label style={{
            display: 'block',
            marginBottom: '4px',
            fontSize: '12px',
            fontWeight: '500',
            color: '#FFD700'
          }}>
            Media ID *
          </label>
          <input
            type="text"
            value={mediaId || ''}
            readOnly
            style={{
              width: '100%',
              padding: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.3)',
              borderRadius: '4px',
              color: 'rgba(255, 215, 0, 0.7)',
              fontSize: '12px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <div>
          <label style={{
            display: 'block',
            marginBottom: '4px',
            fontSize: '12px',
            fontWeight: '500',
            color: '#FFD700'
          }}>
            Duration (sec)
          </label>
          <input
            type="text"
            value={duration !== null ? String(duration) : ''}
            readOnly
            style={{
              width: '100%',
              padding: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.3)',
              borderRadius: '4px',
              color: 'rgba(255, 215, 0, 0.7)',
              fontSize: '12px',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{
          display: 'block',
          marginBottom: '4px',
          fontSize: '12px',
          fontWeight: '500',
          color: '#FFD700'
        }}>
          Show Name *
        </label>
        <input
          type="text"
          value={showName}
          readOnly
          style={{
            width: '100%',
            padding: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            borderRadius: '4px',
            color: '#FFD700',
            fontSize: '12px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        marginBottom: '12px'
      }}>
        <div>
          <label style={{
            display: 'block',
            marginBottom: '4px',
            fontSize: '12px',
            fontWeight: '500',
            color: '#FFD700'
          }}>
            Season (optional)
          </label>
          <input
            key="season-input"
            type="number"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            placeholder="Season"
            style={{
              width: '100%',
              padding: '6px',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '4px',
              color: '#FFD700',
              fontSize: '12px',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>
        <div>
          <label style={{
            display: 'block',
            marginBottom: '4px',
            fontSize: '12px',
            fontWeight: '500',
            color: '#FFD700'
          }}>
            Episode (optional)
          </label>
          <input
            key="episode-input"
            type="number"
            value={episode}
            onChange={(e) => setEpisode(e.target.value)}
            placeholder="Episode"
            style={{
              width: '100%',
              padding: '6px',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '4px',
              color: '#FFD700',
              fontSize: '12px',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>
        <div>
          <label style={{
            display: 'block',
            marginBottom: '4px',
            fontSize: '12px',
            fontWeight: '500',
            color: '#FFD700'
          }}>
            Episode Title (optional)
          </label>
          <input
            key="episode-title-input"
            type="text"
            value={episodeTitle}
            onChange={(e) => setEpisodeTitle(e.target.value)}
            placeholder="Episode Title"
            style={{
              width: '100%',
              padding: '6px',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '4px',
              color: '#FFD700',
              fontSize: '12px',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: '8px',
        justifyContent: 'flex-end',
        alignItems: 'center'
      }}>
        <button
          onClick={onClose}
          style={{
            padding: '6px 12px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 215, 0, 0.5)',
            borderRadius: '4px',
            color: '#FFD700',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '500'
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={(!canUpload && !isExistingMedia) || isUploading || isProcessing}
          style={{
            padding: '6px 12px',
            backgroundColor: ((canUpload || isExistingMedia) && !isUploading && !isProcessing) ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 215, 0, 0.1)',
            border: '1px solid rgba(255, 215, 0, 0.5)',
            borderRadius: '4px',
            color: '#FFD700',
            cursor: ((canUpload || isExistingMedia) && !isUploading && !isProcessing) ? 'pointer' : 'not-allowed',
            fontSize: '12px',
            fontWeight: '600',
            opacity: ((canUpload || isExistingMedia) && !isUploading && !isProcessing) ? 1 : 0.5
          }}
        >
          {isExistingMedia ? (isProcessing ? 'Reprocessing...' : 'Reprocess') : (isUploading ? 'Uploading...' : 'Upload')}
        </button>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
// Import will be done dynamically to avoid circular dependencies
import { getCachedSubtitle } from '../../05_cache/cache-subtitles.js';
import TableReport from './table-report.jsx';

/**
 * Sequential subtitle processor with Process Next and Process All buttons
 * Auto-processes first subtitle on mount
 */
export default function ProcessSubtitles({
  vttSubtitles = [],
  submitData = null,
  onComplete,
  onCancel,
  isProcessing: externalIsProcessing = false,
  autoProcessAll = false
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [lastReport, setLastReport] = useState(null);
  const hasAutoProcessedRef = useRef(false);
  
  const handleProcessNext = async () => {
    if (!submitData || currentIndex >= vttSubtitles.length || isProcessing) return;
    
    setIsProcessing(true);
    try {
      // Inline validation: validate episode metadata
      if (!submitData.showName || submitData.showName.trim() === '') {
        throw new Error('handleProcessNext: showName is required');
      }
      if (!submitData.mediaId || submitData.mediaId.trim() === '') {
        throw new Error('handleProcessNext: mediaId is required');
      }
      if (submitData.season === null || submitData.season === undefined) {
        throw new Error('handleProcessNext: season is required');
      }
      if (submitData.episode === null || submitData.episode === undefined) {
        throw new Error('handleProcessNext: episode is required');
      }
      if (submitData.episodeTitle === null || submitData.episodeTitle === undefined || submitData.episodeTitle.trim() === '') {
        throw new Error('handleProcessNext: episodeTitle is required');
      }
      
      // Update episodeLookup metadata when processing first subtitle
      if (currentIndex === 0) {
        const { saveEpisodeLookupMetadata } = await import('../../05_save/helpers/save-episode-lookup.js');
        await saveEpisodeLookupMetadata(submitData.showName, submitData.mediaId, {
          season: submitData.season,
          episode: submitData.episode,
          episodeTitle: submitData.episodeTitle
        });
      }
      
      const vttSubtitle = vttSubtitles[currentIndex];
      if (!vttSubtitle) {
        throw new Error(`handleProcessNext: vttSubtitle at index ${currentIndex} is missing`);
      }
      
      // Inline validation: validate vttData
      if (vttSubtitle.startSecThai === null || vttSubtitle.startSecThai === undefined) {
        throw new Error('handleProcessNext: vttSubtitle.startSecThai is required');
      }
      if (vttSubtitle.endSecThai === null || vttSubtitle.endSecThai === undefined) {
        throw new Error('handleProcessNext: vttSubtitle.endSecThai is required');
      }
      if (vttSubtitle.startSecEng === null || vttSubtitle.startSecEng === undefined) {
        throw new Error('handleProcessNext: vttSubtitle.startSecEng is required');
      }
      if (vttSubtitle.endSecEng === null || vttSubtitle.endSecEng === undefined) {
        throw new Error('handleProcessNext: vttSubtitle.endSecEng is required');
      }
      if ((!vttSubtitle.thai || vttSubtitle.thai.trim() === '') && (!vttSubtitle.english || vttSubtitle.english.trim() === '')) {
        throw new Error('handleProcessNext: at least one of vttSubtitle.thai or vttSubtitle.english must be non-empty');
      }
      
      const { ensureShowExists } = await import('../../05_save/helpers/ensure-show-exists.js');
      await ensureShowExists(submitData.showName);
      
      const vttData = {
        thai: vttSubtitle.thai || '',
        english: vttSubtitle.english || '',
        startSecThai: vttSubtitle.startSecThai,
        endSecThai: vttSubtitle.endSecThai,
        startSecEng: vttSubtitle.startSecEng,
        endSecEng: vttSubtitle.endSecEng
      };
      
      const subtitleId = `${submitData.mediaId}-${vttSubtitle.index || currentIndex}`;
      
      const { getEmptyFatBundleTemplate } = await import('../../01_load-subtitles/load-subtitles-orchestrator.js');
      const { mergeData } = await import('../../01_load-subtitles/load-subtitles-orchestrator.js');
      const { generateSchemaWorkMap } = await import('../../03_process/helpers/workmap/schema-work-map-builder.js');
      const { orchestrateSubtitleProcessing } = await import('../../content.js');
      
      const template = await getEmptyFatBundleTemplate(subtitleId);
      const fatBundle = mergeData(template, vttData, subtitleId);
      
      // Inline validation: validate fat bundle
      if (!fatBundle.id || fatBundle.id.trim() === '') {
        throw new Error('handleProcessNext: fatBundle.id is required');
      }
      if (fatBundle.startSecThai === null || fatBundle.startSecThai === undefined) {
        throw new Error('handleProcessNext: fatBundle.startSecThai is required');
      }
      if (fatBundle.endSecThai === null || fatBundle.endSecThai === undefined) {
        throw new Error('handleProcessNext: fatBundle.endSecThai is required');
      }
      if (fatBundle.startSecEng === null || fatBundle.startSecEng === undefined) {
        throw new Error('handleProcessNext: fatBundle.startSecEng is required');
      }
      if (fatBundle.endSecEng === null || fatBundle.endSecEng === undefined) {
        throw new Error('handleProcessNext: fatBundle.endSecEng is required');
      }
      if ((!fatBundle.thai || fatBundle.thai.trim() === '') && (!fatBundle.english || fatBundle.english.trim() === '')) {
        throw new Error('handleProcessNext: at least one of fatBundle.thai or fatBundle.english must be non-empty');
      }
      if (!Array.isArray(fatBundle.wordReferenceIdsThai)) {
        throw new Error('handleProcessNext: fatBundle.wordReferenceIdsThai must be an array');
      }
      if (!Array.isArray(fatBundle.wordReferenceIdsEng)) {
        throw new Error('handleProcessNext: fatBundle.wordReferenceIdsEng must be an array');
      }
      if (!Array.isArray(fatBundle.smartSubsRefs)) {
        throw new Error('handleProcessNext: fatBundle.smartSubsRefs must be an array');
      }
      if (!Array.isArray(fatBundle.matchedWords)) {
        throw new Error('handleProcessNext: fatBundle.matchedWords must be an array');
      }
      if (!fatBundle.tokens || typeof fatBundle.tokens !== 'object') {
        throw new Error('handleProcessNext: fatBundle.tokens must be an object');
      }
      if (!Array.isArray(fatBundle.tokens.displayThai)) {
        throw new Error('handleProcessNext: fatBundle.tokens.displayThai must be an array');
      }
      if (!Array.isArray(fatBundle.tokens.sensesThai)) {
        throw new Error('handleProcessNext: fatBundle.tokens.sensesThai must be an array');
      }
      if (!Array.isArray(fatBundle.tokens.displayEnglish)) {
        throw new Error('handleProcessNext: fatBundle.tokens.displayEnglish must be an array');
      }
      if (!Array.isArray(fatBundle.tokens.sensesEnglish)) {
        throw new Error('handleProcessNext: fatBundle.tokens.sensesEnglish must be an array');
      }
      
      const workmap = await generateSchemaWorkMap(fatBundle, subtitleId, {
        showName: submitData.showName,
        mediaId: submitData.mediaId
      });
      
      const mergedFatBundle = { ...fatBundle, schemaWorkMap: workmap };
      const packageFatBundle = {
        subtitle: mergedFatBundle,
        tokens: mergedFatBundle.tokens || { displayThai: [], sensesThai: [], displayEnglish: [], sensesEnglish: [] }
      };
      
      const result = await orchestrateSubtitleProcessing(packageFatBundle, {
        showName: submitData.showName,
        mediaId: submitData.mediaId,
        episode: submitData.episode,
        season: submitData.season
      }, null);
      
      setLastResult({ success: true, subtitleId });
      
      // Always try to fetch report from content.js
      if (subtitleId && typeof window !== 'undefined' && window.__getSubtitleReport) {
        const report = window.__getSubtitleReport(subtitleId);
        if (report) {
          setLastReport({ raw: report });
        } else {
          setLastReport(null);
        }
      }
      
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      
      if (newIndex >= vttSubtitles.length && onComplete) {
        onComplete();
      }
    } catch (error) {
      setLastResult({ success: false, error });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleProcessAll = async () => {
    // Process All is disabled until single processing is consistent
    console.warn('Process All is not available until single processing is consistent');
    setLastResult({ success: false, error: new Error('Process All is disabled - use Process Next instead') });
    return;
  };
  
  // Auto-process subtitles when component mounts
  useEffect(() => {
    if (!hasAutoProcessedRef.current && 
        currentIndex === 0 && 
        vttSubtitles.length > 0 && 
        submitData && 
        !isProcessing) {
      hasAutoProcessedRef.current = true;
      // Always process single subtitle (Process All is disabled)
      handleProcessNext();
    }
  }, []); // Run once on mount

  const processing = isProcessing || externalIsProcessing;
  const hasMore = currentIndex < vttSubtitles.length;
  // Only show process buttons if auto-processing failed or user needs to review
  // If autoProcessAll is true and we're done, don't show buttons
  const shouldShowProcessButtons = !autoProcessAll || (hasMore && lastResult && !lastResult.success);

  // Copy error to clipboard
  const handleCopyError = async () => {
    if (!lastResult || !lastResult.error) return;
    
    const errorText = lastResult.error.stack || lastResult.error.message || String(lastResult.error);
    
    try {
      await navigator.clipboard.writeText(errorText);
      // Could add a toast notification here if desired
    } catch (err) {
      console.error('Failed to copy error:', err);
      // Fallback: select text programmatically
      const textArea = document.createElement('textarea');
      textArea.value = errorText;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (e) {
        console.error('Fallback copy failed:', e);
      }
      document.body.removeChild(textArea);
    }
  };

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
      {/* Header */}
      <div style={{
        marginBottom: '12px',
        fontSize: '14px',
        fontWeight: '600',
        color: '#FFD700'
      }}>
        Processing subtitle {currentIndex + 1}/{vttSubtitles.length}
        {lastResult && (
          <span style={{ marginLeft: '12px', fontSize: '12px', color: lastResult.success ? 'rgba(100, 255, 100, 0.9)' : 'rgba(255, 100, 100, 0.9)' }}>
            {lastResult.success ? '✓' : '✗'} {lastResult.subtitleId || 'Unknown'}
          </span>
        )}
      </div>

      {/* Last Result Display */}
      {lastResult && lastResult.error && (
        <div style={{
          marginBottom: '12px',
          padding: '12px',
          backgroundColor: 'rgba(255, 100, 100, 0.1)',
          border: '1px solid rgba(255, 100, 100, 0.5)',
          borderRadius: '4px',
          color: 'rgba(255, 100, 100, 0.9)',
          fontSize: '12px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontWeight: '600' }}>Error:</span>
            <button
              onClick={handleCopyError}
              style={{
                padding: '4px 8px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 100, 100, 0.5)',
                borderRadius: '4px',
                color: 'rgba(255, 100, 100, 0.9)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              Copy
            </button>
          </div>
          <pre style={{
            margin: 0,
            padding: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '11px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflow: 'auto',
            maxHeight: '300px',
            userSelect: 'text',
            WebkitUserSelect: 'text',
            MozUserSelect: 'text',
            msUserSelect: 'text',
            color: 'rgba(255, 100, 100, 0.9)',
            lineHeight: '1.4'
          }}>
            {lastResult.error.stack || lastResult.error.message || String(lastResult.error)}
          </pre>
        </div>
      )}

      {/* Control Buttons - Only Cancel button remains here */}
      {onCancel && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onCancel}
            disabled={processing}
            style={{
              padding: '6px 12px',
              backgroundColor: processing ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '4px',
              color: '#FFD700',
              cursor: processing ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              opacity: processing ? 0.5 : 1
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Report Display - Auto-opens in modal */}
      {lastReport && (
        <TableReport 
          report={lastReport} 
          isOpen={true}
          onClose={() => setLastReport(null)}
          onProcessNext={shouldShowProcessButtons ? handleProcessNext : null}
          onProcessAll={shouldShowProcessButtons ? handleProcessAll : null}
          hasMore={hasMore}
          processing={processing}
          currentIndex={currentIndex}
          totalCount={vttSubtitles.length}
        />
      )}
    </div>
  );
}

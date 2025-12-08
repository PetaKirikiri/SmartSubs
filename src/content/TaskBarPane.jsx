import React, { useState, useRef } from 'react';
import { readAndParseSubtitleFile } from './srtUpload.js';
import { showSRTUploadModal } from './srtUploadModal.js';

export default function TaskbarPane({ dependencies, currentStage = 'script' }) {
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef(null);
  
  const getStageLabel = () => {
    if (currentStage === 'script') return 'Stage 1: thaiScript';
    if (currentStage === 'split') return 'Stage 2: thaiSplit';
    if (currentStage === 'sense') return 'Stage 3: thaiSplitIds';
    return '';
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsing(true);

    try {
      const parsedSubtitles = await readAndParseSubtitleFile(file);
      
      const overlay = document.getElementById('smart-subs-overlay');
      if (!overlay) {
        throw new Error('SmartSubs overlay not found');
      }

      const fileInputDomNode = fileInputRef.current;
      if (!fileInputDomNode) {
        throw new Error('File input not found');
      }

      await showSRTUploadModal(dependencies, overlay, fileInputDomNode, file, parsedSubtitles);
    } catch (error) {
      alert('Failed to parse subtitles: ' + error.message);
    } finally {
      setIsParsing(false);
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: '4px 8px',
      backgroundColor: 'transparent',
      minHeight: '24px',
      boxSizing: 'border-box',
      opacity: 0.3
    }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="text/*,.srt,.vtt"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      
      <button
        onClick={handleUploadClick}
        disabled={isParsing}
        title={isParsing ? 'Parsing...' : 'Upload subtitles'}
        style={{
          padding: '4px',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: '2px',
          color: 'rgba(255, 255, 255, 0.3)',
          cursor: isParsing ? 'not-allowed' : 'pointer',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.3,
          transition: 'opacity 0.2s'
        }}
      >
        {isParsing ? (
          <span style={{ fontSize: '12px' }}>⋯</span>
        ) : (
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{ display: 'block' }}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        )}
      </button>
    </div>
  );
}

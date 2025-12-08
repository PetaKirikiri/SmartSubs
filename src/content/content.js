// MINIMAL - Just mount React component

import './content.css'
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { SubtitleStagePanel } from './SubtitleStagePanel.jsx';
import TaskbarPane from './TaskbarPane.jsx';
import { initSubtitleController } from './subtitleController.js';
import { bulkUploadSubtitles } from '../services/bulkUploadSubtitles.js';
import { hideSRTUploadModal } from './srtUploadModal.js';
import { loadEpisode } from '../services/airtableSubtitlePipeline.js';

(function() {
  'use strict';


  // Inject seek bridge into page context (not content script context)
  // This allows it to access Netflix's internal player API
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('netflixSeekBridge.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);

  // Upload handler for SRT files
  async function handleUploadSubmit(submitData, parsedSubtitles) {
    console.log('[SRT Upload] Starting upload:', { 
      tableName: submitData.tableName, 
      mediaId: submitData.mediaId, 
      subtitleCount: parsedSubtitles?.length 
    });
    
    try {
      const result = await bulkUploadSubtitles(
        parsedSubtitles,
        (current, total) => {
          // Progress callback - bulkUploadSubtitles handles logging
        },
        submitData
      );
      
      if (result.failed > 0) {
        alert(`Upload completed with errors: ${result.success} succeeded, ${result.failed} failed.`);
      } else {
        alert(`Successfully uploaded ${result.success} subtitles to Airtable!`);
        hideSRTUploadModal();
        // Reload subtitles to show the new ones
        const videoElement = document.querySelector('video');
        if (videoElement) {
          const urlMatch = window.location.pathname.match(/\/watch\/(\d+)/);
          const mediaId = urlMatch ? urlMatch[1] : null;
          if (mediaId) {
            await loadEpisode(mediaId, videoElement);
          }
        }
      }
    } catch (error) {
      console.error('[SRT Upload] Upload failed:', error);
      alert(`Upload failed: ${error.message}`);
      throw error;
    }
  }

  // Dependencies object - will be expanded by other modules
  const dependencies = {
    videoElementRef: { current: null },
    onInitialLoadSubtitles: null,
    onSetThaiWordsProcessing: null,
    onSetThaiWordsPaused: null,
    onGetThaiWordsPaused: null,
    tables: [],
    currentTableName: null,
    onUploadSubmit: handleUploadSubmit
  };

  // Wrapper component - SubtitleStagePanel is the parent container
  function SubtitlePanelWrapper() {
    const [subtitle, setSubtitle] = useState(null);
    const [currentStage, setCurrentStage] = useState('script');

    useEffect(() => {
      function handleSubtitleUpdate(newSubtitle) {
        if (newSubtitle) {
          setSubtitle(newSubtitle);
        }
      }

      initSubtitleController(handleSubtitleUpdate);
    }, []);

    const handleStageChange = (stage) => {
      setCurrentStage(stage);
    };

    // SubtitleStagePanel is the parent container, it will render TaskbarPane and edit area as children
    return React.createElement(SubtitleStagePanel, { 
      subtitle, 
      onStageChange: handleStageChange,
      dependencies,
      currentStage
    });
  }

  function mountPanel() {
    const oldOverlays = document.querySelectorAll('#smart-subs-overlay, [id^="smart-subs"]');
    oldOverlays.forEach(el => el.remove());
    
    if (document.getElementById('smart-subs-overlay')) {
      return;
    }
    
    const overlay = document.createElement('div');
    overlay.id = 'smart-subs-overlay';
    
    const currentRow = document.createElement('div');
    currentRow.id = 'smart-subs-current';
    
    const textCol = document.createElement('div');
    textCol.className = 'subtitle-text-col';
    
    currentRow.appendChild(textCol);
    overlay.appendChild(currentRow);
    
    if (document.body) {
      document.body.appendChild(overlay);
      const reactRoot = createRoot(textCol);
      reactRoot.render(React.createElement(SubtitlePanelWrapper));
    } else {
      setTimeout(mountPanel, 100);
    }
  }
  
  mountPanel();
})();

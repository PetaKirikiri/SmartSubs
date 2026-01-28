/**
 * useEditModeKeyboard Hook
 * Handles Escape key for toggling edit mode
 */

import { useEffect } from 'react';
import { pauseVideoPlayback, resumeVideoPlayback } from '../../07_tracking/subtitle-tracker-orchestrator.js';

/**
 * Custom hook to handle Escape key for edit mode toggle
 * @param {boolean} isEditMode - Current edit mode state
 * @param {function} onToggleEditMode - Callback to toggle edit mode
 * @param {string} inputValue - Current input value
 * @param {object} originalInputValueRef - Ref to original input value
 * @param {object} wasVideoPlayingRef - Ref to track if video was playing
 */
export function useEditModeKeyboard(isEditMode, onToggleEditMode, inputValue, originalInputValueRef, wasVideoPlayingRef) {
  useEffect(() => {
    const handleKeyDown = async (e) => {
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
      
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      );

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        
        const video = document.querySelector('video');
        
        if (isEditMode) {
          const thaiText = inputValue.trim();
          const originalText = originalInputValueRef.current.trim();
          const hasChanges = thaiText !== originalText;
          
          // Editing functionality removed - subtitle structure doesn't support editing thai text directly
          // Editing should be done through token-level operations
          
          onToggleEditMode(false);
          resumeVideoPlayback();
        } else {
          const video = document.querySelector('video');
          if (video && !video.paused) {
            wasVideoPlayingRef.current = true;
            pauseVideoPlayback();
          } else {
            wasVideoPlayingRef.current = false;
          }
          onToggleEditMode(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isEditMode, inputValue, originalInputValueRef, wasVideoPlayingRef, onToggleEditMode]);
}



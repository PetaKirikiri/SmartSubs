// Three-stage workflow:
// Stage 1: Thai Script Clean-Check - user edits raw Thai text, presses Esc to accept
// Stage 2: Tokenization Check - system auto-tokenizes, user reviews/edits tokens, presses Esc to accept
// Stage 3: Word-by-Word Sense Selection - highlight one token, show candidates, user presses number to confirm (final stage)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SUBTITLE_STAGE } from './subtitle.js';
import { loadLexicon, getCandidates } from '../utils/lexiconLookup.js';
import { romanizeThai } from '../utils/phonetics.js';
import { updateStage, updateSubtitleInCache, findOrCreateThaiWord, syncToAirtable, refreshSubtitle } from '../services/airtableSubtitlePipeline.js';
import { saveStage1 } from '../services/stage1Save.js';
import { saveStage2 } from '../services/stage2Save.js';
import { saveStage3 } from '../services/stage3Save.js';
import { tokenizeThai } from '../utils/tokenizer.js';
import { getSubtitleCache } from './subtitleCache.js';
import TaskbarPane from './TaskbarPane.jsx';
import { runThaiPipeline } from '../utils/thaiPipeline.js';

function parseThaiSplitIds(thaiSplitIds) {
  if (!thaiSplitIds) return [];
  try {
    return typeof thaiSplitIds === 'string' ? JSON.parse(thaiSplitIds) : thaiSplitIds;
  } catch {
    return [];
  }
}

export function SubtitleStagePanel({ 
  subtitle: subtitleProp, 
  displayMode = 'display',
  onScriptConfirmed, 
  onSkip, 
  onSplitRequested, 
  onSplitEditRequested, 
  onSplitConfirmed, 
  onWordDataRequested, 
  onWordReviewConfirmed, 
  onWordClicked, 
  onReopenForEdit,
  onStageChange, // Callback to notify parent of stage changes
  dependencies, // Dependencies object for TaskbarPane
  currentStage // Current stage for TaskbarPane
}) {
  const [subtitle, setSubtitle] = useState(subtitleProp);
  
  // Get previous, current, and next subtitles from cache
  const getSubtitleTriplet = () => {
    if (!subtitle) return { previous: null, current: subtitle, next: null };
    
    const cache = getSubtitleCache();
    const currentIndex = cache.findIndex(s => s.recordId === subtitle.recordId);
    
    if (currentIndex === -1) return { previous: null, current: subtitle, next: null };
    
    const previous = currentIndex > 0 ? cache[currentIndex - 1] : null;
    const current = subtitle;
    const next = currentIndex < cache.length - 1 ? cache[currentIndex + 1] : null;
    
    return { previous, current, next };
  };
  
  const { previous, current, next } = getSubtitleTriplet();
  
  // Internal stage state: "script" | "split" | "sense"
  // Initialize based on fields and flags (aligned with pipeline logic):
  // Stage 1 → !thaiScriptReview
  // Stage 2 → thaiScriptReview && !processed && !thaiSplit (or thaiSplit empty)
  // Stage 3 → thaiScriptReview && !processed && thaiSplit exists (but no thaiSplitIds yet)
  const getInitialStage = (sub) => {
    if (!sub) return 'script';
    
    // TEMPORARILY DISABLED: Stages 2 and 3 - only show Stage 1 for now
    // Stage 3 complete: has thaiSplitIds
    // const hasThaiSplitIds = sub.thaiSplitIds && (
    //   (Array.isArray(sub.thaiSplitIds) && sub.thaiSplitIds.length > 0) ||
    //   (typeof sub.thaiSplitIds === 'string' && sub.thaiSplitIds.trim() !== '' && sub.thaiSplitIds !== '[]')
    // );
    // if (hasThaiSplitIds) return 'sense'; // Already complete, but show sense stage
    
    // Stage 3: thaiScriptReview && !processed && thaiSplit exists
    // const hasThaiSplit = sub.thaiSplit && String(sub.thaiSplit).trim() !== '';
    // if (sub.thaiScriptReview && !sub.processed && hasThaiSplit) return 'sense';
    
    // Stage 2: thaiScriptReview && !processed (thaiSplit may or may not exist yet)
    // if (sub.thaiScriptReview && !sub.processed) return 'split';
    
    // Stage 1: !thaiScriptReview (or no thai field yet)
    // Always return 'script' for now - Stages 2 and 3 disabled
    return 'script';
  };
  
  const [internalStage, setInternalStage] = useState(() => getInitialStage(subtitleProp));
  const [inputValue, setInputValue] = useState(() => subtitleProp?.thai || '');
  const [tokens, setTokens] = useState([]);
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedWordIndex, setSelectedWordIndex] = useState(null);
  const hasEnteredEditModeRef = useRef(false);
  const editedSubtitleIdsRef = useRef(new Set()); // Track which subtitles have been edited/escaped
  const originalInputValueRef = useRef(''); // Track original value to detect changes
  const wasVideoPlayingRef = useRef(false); // Track if video was playing before edit mode
  const inputRef = useRef(null); // Ref for the input element
  const justEnteredEditModeRef = useRef(false); // Track if we just entered edit mode (for initial selection)

  // Update subtitle state ONLY when prop changes to a new subtitle
  // Never reset to null - previous subtitle stays visible until next one arrives
  useEffect(() => {
    if (subtitleProp) {
      const currentRecordId = subtitle?.recordId;
      const newRecordId = subtitleProp.recordId;
      const isNewSubtitle = currentRecordId !== newRecordId;
      
      setSubtitle(subtitleProp);
      // Reset edit mode when subtitle changes to a different one
      if (isNewSubtitle) {
        setIsEditMode(false);
        setSelectedWordIndex(null);
        // Reset edit mode flag for the new subtitle
        hasEnteredEditModeRef.current = editedSubtitleIdsRef.current.has(newRecordId);
        // Store original value for change detection
        originalInputValueRef.current = subtitleProp?.thai || '';
        
        // Run pipeline automatically when new subtitle appears
        if (subtitleProp.thai && subtitleProp.thai.trim()) {
          (async () => {
            try {
              await runThaiPipeline(subtitleProp.thai);
            } catch (pipelineError) {
              // Silently fail - pipeline is experimental
            }
          })();
        }
      }
    }
    // If subtitleProp becomes null/undefined, DO NOT update state
    // Keep showing the previous subtitle - SubtitleController never calls renderCallback with null
  }, [subtitleProp?.recordId]);

  // Reset internal stage and input when subtitle changes
  useEffect(() => {
    if (subtitleProp) {
      const newStage = getInitialStage(subtitleProp);
      setInternalStage(newStage);
      if (newStage === 'script') {
        const thaiValue = subtitleProp?.thai || '';
        setInputValue(thaiValue);
        originalInputValueRef.current = thaiValue; // Store original for change detection
      } else if (newStage === 'split') {
        const splitValue = subtitleProp?.thaiSplit || '';
        setInputValue(splitValue);
        originalInputValueRef.current = splitValue;
      }
      // Notify parent of stage change
      if (onStageChange) {
        onStageChange(newStage);
      }
    }
  }, [subtitleProp?.recordId]);

  // REMOVED: Auto-pause on subtitle end - user manually enters edit mode with Escape

  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  // This ensures hooks are called in the same order on every render
  const handleResumeRef = useRef(() => {
    // Mark this subtitle as edited/escaped so we don't re-enter edit mode for it
    const currentRecordId = subtitle?.recordId;
    if (currentRecordId) {
      editedSubtitleIdsRef.current.add(currentRecordId);
    }
    
    setIsEditMode(false);
    setSelectedWordIndex(null);
    // Don't reset hasEnteredEditModeRef - we've already entered edit mode for this subtitle
    // This prevents re-entering edit mode if user resumes and video is still past end time
    const video = document.querySelector('video');
    if (video && video.paused) {
      video.play();
    }
  });

  // Stable seek handler - use ref to avoid recreating on every render
  const seekToStartTimeRef = useRef(null);
  useEffect(() => {
    seekToStartTimeRef.current = subtitle?.startTime ?? null;
  }, [subtitle?.startTime]);

  const handleSeekToStart = useCallback(() => {
    const startTime = seekToStartTimeRef.current;
    if (startTime == null) return;
    
    window.postMessage({
      type: 'SMARTSUBS_SEEK',
      timeSeconds: startTime
    }, '*');
    
    const video = document.querySelector('video');
    if (video && video.paused) {
      video.play();
    }
  }, []);

  // Compute stage from fields (field-based detection)
  const computeStageFromFields = (sub) => {
    if (!sub) return SUBTITLE_STAGE.RAW_IMPORTED;
    
    const hasThaiSplitIds = sub.thaiSplitIds && (
      (Array.isArray(sub.thaiSplitIds) && sub.thaiSplitIds.length > 0) ||
      (typeof sub.thaiSplitIds === 'string' && sub.thaiSplitIds.trim() !== '' && sub.thaiSplitIds !== '[]')
    );
    const hasThaiSplit = sub.thaiSplit && String(sub.thaiSplit).trim() !== '';
    const hasThai = sub.thai && String(sub.thai).trim() !== '';
    
    if (hasThaiSplitIds) {
      return SUBTITLE_STAGE.SPLIT_CONFIRMED; // Stage 3 complete
    } else if (hasThaiSplit) {
      return SUBTITLE_STAGE.SPLIT_CONFIRMED; // Stage 3
    } else if (hasThai) {
      return SUBTITLE_STAGE.SCRIPT_CONFIRMED; // Stage 2
    } else {
      return SUBTITLE_STAGE.RAW_IMPORTED; // Stage 1
    }
  };
  
  const processingStage = computeStageFromFields(subtitle);
  const words = subtitle?.thaiSplit?.trim() ? subtitle.thaiSplit.split(/\s+/).filter(w => w.trim()) : [];
  const wordIds = subtitle ? parseThaiSplitIds(subtitle.thaiSplitIds) : [];
  const wordMap = subtitle?.phoneticWordMap instanceof Map ? subtitle.phoneticWordMap : new Map();
  const hasWordMap = wordMap.size > 0;

  // Keyboard handler for replaying subtitle (works anytime subtitle is displayed)
  useEffect(() => {
    if (!subtitle) return;

    const handleReplayKeyDown = (e) => {
      // ArrowLeft to replay subtitle/sound bite - works regardless of edit mode
      if (e.key === 'ArrowLeft') {
        // Only trigger if not typing in an input/textarea
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable
        );
        
        if (!isInputFocused) {
          e.preventDefault();
          e.stopPropagation();
          handleSeekToStart();
        }
      }
    };

    window.addEventListener('keydown', handleReplayKeyDown, true);
    return () => window.removeEventListener('keydown', handleReplayKeyDown, true);
  }, [subtitle, handleSeekToStart]);

  // Ensure text stays selected when entering edit mode (only on mode change, not on every keystroke)
  useEffect(() => {
    if (isEditMode && inputRef.current && justEnteredEditModeRef.current) {
      // Use setTimeout to ensure the input is fully rendered and focused
      const selectText = () => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
          // Also set selection range explicitly to ensure it persists
          if (inputRef.current.setSelectionRange) {
            inputRef.current.setSelectionRange(0, inputRef.current.value.length);
          }
        }
      };
      
      // Immediate selection
      selectText();
      
      // Also try after a short delay to catch any focus events that might clear selection
      const timeoutId = setTimeout(() => {
        selectText();
        justEnteredEditModeRef.current = false; // Clear flag after initial selection
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isEditMode]); // Only depend on isEditMode, not inputValue

  // Keyboard handler for Escape key (toggle edit mode for current subtitle)
  useEffect(() => {
    if (!subtitle) return;

    const handleKeyDown = async (e) => {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      );

      // Escape key: toggle edit mode for current subtitle
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        
        const video = document.querySelector('video');
        
        if (isEditMode) {
          // Exit edit mode
          const thaiText = inputValue.trim();
          const originalText = originalInputValueRef.current.trim();
          const hasChanges = thaiText !== originalText;
          
          // Save only if there are changes
          if (hasChanges && thaiText && subtitle.recordId) {
            try {
              // Update cache first
              await saveStage1(subtitle.recordId, thaiText);
              // Then sync to Airtable - only save thai field for Stage 1 edits
              await syncToAirtable(subtitle.recordId, { onlyThai: true });
              editedSubtitleIdsRef.current.add(subtitle.recordId);
              originalInputValueRef.current = thaiText; // Update original value
              
              // EXPERIMENTAL: Run Thai processing pipeline (debugging only, not saved)
              // TODO: Remove or conditionally enable this for testing
              try {
                await runThaiPipeline(thaiText);
              } catch (pipelineError) {
                // Silently fail - pipeline is experimental
              }
            } catch (error) {
              alert(`Failed to save to Airtable: ${error.message}`);
            }
          }
          
          // Exit edit mode and resume video
          setIsEditMode(false);
          if (video) {
            video.play().catch(() => {}); // Always resume playback
          }
        } else {
          // Enter edit mode - pause video
          if (video && !video.paused) {
            wasVideoPlayingRef.current = true;
            video.pause();
          } else {
            wasVideoPlayingRef.current = false;
          }
          setIsEditMode(true);
          hasEnteredEditModeRef.current = true;
          justEnteredEditModeRef.current = true; // Mark that we just entered edit mode
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [subtitle?.recordId, internalStage, inputValue, isEditMode]);

  // Helper function to render a single subtitle component
  const renderSubtitleItem = (sub, isCurrent = false) => {
    if (!sub || !sub.thai) {
      return React.createElement('div', {
        style: {
          flex: 1,
          padding: '8px 0',
          opacity: 0.2,
          fontSize: '24px',
          color: '#FFD700'
        }
      }, '—');
    }
    
    const isEditing = isCurrent && isEditMode;
    const isEdited = sub.Edited === true; // Check if subtitle has been edited
    
    return React.createElement('div', {
      style: {
        flex: 1,
        padding: '8px 0',
        display: 'flex',
        alignItems: 'center',
        opacity: isCurrent ? 1 : 0.6 // Increased opacity for non-current subtitles
      }
    },
      isEditing ? (
        // Edit mode - input field with visible borders and highlighted text
        React.createElement('input', {
          ref: inputRef,
          type: 'text',
          value: inputValue,
          onChange: (e) => {
            setInputValue(e.target.value);
            // Clear the flag once user starts typing so we don't interfere
            justEnteredEditModeRef.current = false;
          },
          autoFocus: true,
          onFocus: (e) => {
            // Only select all text on initial focus when entering edit mode
            // Don't interfere if user is already typing
            if (justEnteredEditModeRef.current) {
              e.target.select();
              // Also set selection range explicitly
              if (e.target.setSelectionRange) {
                e.target.setSelectionRange(0, e.target.value.length);
              }
            }
          },
          style: {
            width: '100%',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '2px solid #FFD700',
            borderRadius: '4px',
            outline: 'none',
            color: '#FFD700',
            fontSize: '32px',
            fontWeight: '600',
            padding: '8px 12px',
            margin: '0',
            boxSizing: 'border-box'
          }
        })
      ) : (
        // Display mode - subtitle text
        React.createElement('div', {
          className: 'subtitle-text',
          style: { 
            color: isEdited ? '#00FF88' : '#FFD700', // Green for edited, gold for normal
            fontSize: isCurrent ? '32px' : '24px',
            fontWeight: '600',
            lineHeight: '1.6',
            display: 'flex',
            alignItems: 'center',
            width: '100%'
          }
        }, sub.thai || '')
      )
    );
  };

  // SubtitleStagePanel is the parent container with light opacity background
  // Children (TaskbarPane and edit area) have lower opacity
  return React.createElement('div', {
    className: 'subtitle-stage-panel',
    style: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%'
    }
  },
    // TaskbarPane as first child - low opacity (subtle, opacity handled by TaskbarPane itself)
    React.createElement(TaskbarPane, { dependencies, currentStage: internalStage }),
    
    // Three subtitle components: previous, current, next
    React.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        width: '100%'
      }
    },
      // Previous subtitle
      renderSubtitleItem(previous, false),
      // Current subtitle (can enter edit mode)
      renderSubtitleItem(current, true),
      // Next subtitle
      renderSubtitleItem(next, false)
    )
  );
}

// TEMPORARILY DISABLED: Unused rendering functions - only Stage 1 is active
// These functions are not called and should be removed or re-enabled when Stages 2/3 are needed
/*
function renderDisplayModeWithEdit(
  subtitle,
  processingStage,
  words,
  wordIds,
  wordMap,
  hasWordMap,
  isEditMode,
  thaiTextDraft,
  setThaiTextDraft,
  thaiSplitDraft,
  setThaiSplitDraft,
  selectedWordIndex,
  setSelectedWordIndex,
  onWordClicked,
  onScriptConfirmed,
  onSplitRequested,
  onSplitEditRequested,
  onSplitConfirmed,
  onWordDataRequested,
  onWordReviewConfirmed,
  handleResumeRef
) {
  // Stage label based on field-based stage detection
  const getStageLabel = () => {
    if (processingStage === SUBTITLE_STAGE.RAW_IMPORTED) return 'Stage 1: thaiScript';
    if (processingStage === SUBTITLE_STAGE.SCRIPT_CONFIRMED) return 'Stage 2: thaiSplit';
    if (processingStage === SUBTITLE_STAGE.SPLIT_CONFIRMED) return 'Stage 3: thaiSplitIds';
    return `[${processingStage}]`;
  };
  const stageLabel = getStageLabel();

  // Stage 1: Input replaces text in same location, Escape to save
  if (processingStage === SUBTITLE_STAGE.RAW_IMPORTED) {
    return (
      <div className="subtitle-text" style={{ opacity: 1, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', maxWidth: '100%', overflow: 'hidden' }}>
        <span className="stage-indicator">{stageLabel}</span>
        {isEditMode ? (
          <input
            type="text"
            value={thaiTextDraft}
            onChange={(e) => setThaiTextDraft(e.target.value)}
            onKeyDown={(e) => {
              // Prevent default behavior for Escape and ArrowLeft
              if (e.key === 'Escape' || e.key === 'ArrowLeft') {
                e.preventDefault();
              }
            }}
            autoFocus
            style={{
              flex: 1,
              minWidth: '200px',
              maxWidth: '100%',
              width: 0, // Allows flex to shrink below minWidth when needed
              padding: '8px 12px',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              border: '2px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '4px',
              color: '#FFD700',
              fontSize: '16px',
              boxSizing: 'border-box',
              outline: 'none'
            }}
            placeholder="Edit Thai text (Escape to save, ← to replay)"
          />
        ) : (
          <span style={{ flex: 1 }}>{subtitle.thai || ''}</span>
        )}
      </div>
    );
  }

  // Stage 2: Input replaces text, shows split
  if (processingStage === SUBTITLE_STAGE.SCRIPT_CONFIRMED) {
    return (
      <div className="subtitle-text" style={{ opacity: 1, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', maxWidth: '100%', overflow: 'hidden' }}>
        <span className="stage-indicator">{stageLabel}</span>
        {isEditMode ? (
          <>
            <input
              type="text"
              value={thaiSplitDraft}
              onChange={(e) => setThaiSplitDraft(e.target.value)}
              autoFocus
              style={{
                flex: 1,
                minWidth: '200px',
                maxWidth: '100%',
                width: 0, // Allows flex to shrink below minWidth when needed
                padding: '8px 12px',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                border: '2px solid rgba(255, 215, 0, 0.5)',
                borderRadius: '4px',
                color: '#FFD700',
                fontSize: '16px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
              placeholder="Words separated by spaces"
            />
            {words.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', width: '100%', marginTop: '8px' }}>
                {words.map((word, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'rgba(255, 215, 0, 0.2)',
                      border: '1px solid rgba(255, 215, 0, 0.5)',
                      borderRadius: '4px',
                      color: '#FFD700',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      const newSplit = thaiSplitDraft.split(/\s+/).filter(w => w.trim());
                      const edited = prompt('Edit word:', word);
                      if (edited !== null) {
                        newSplit[idx] = edited;
                        setThaiSplitDraft(newSplit.join(' '));
                      }
                    }}
                  >
                    {word}
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '8px' }}>
              <button
                onClick={() => onSplitRequested?.(subtitle.recordId)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 215, 0, 0.5)',
                  borderRadius: '4px',
                  color: '#FFD700',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Auto-split
              </button>
              <button
                onClick={() => {
                  onSplitConfirmed?.(subtitle.recordId);
                  handleResumeRef.current();
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'rgba(255, 215, 0, 0.3)',
                  border: '1px solid rgba(255, 215, 0, 0.5)',
                  borderRadius: '4px',
                  color: '#FFD700',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                Save split
              </button>
              <button
                onClick={handleResumeRef.current}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 215, 0, 0.5)',
                  borderRadius: '4px',
                  color: '#FFD700',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Resume
              </button>
            </div>
          </>
        ) : (
          <span style={{ flex: 1 }}>{subtitle.thaiSplit || subtitle.thai || ''}</span>
        )}
      </div>
    );
  }

  // Stage 3: Interactive word-by-word sense selection
  if (processingStage === SUBTITLE_STAGE.SPLIT_CONFIRMED) {
    // Use the new interactive Stage 3 component
    return renderStage3(subtitle, words, wordIds, wordMap, hasWordMap, onWordDataRequested, onWordReviewConfirmed);
  }

  // Stage 3 complete: Show final processed result
  if (processingStage === SUBTITLE_STAGE.SPLIT_CONFIRMED && hasWordMap && wordIds.length > 0) {
    return (
      <div className="subtitle-text" style={{ opacity: 1 }}>
        <span className="stage-indicator">{stageLabel}</span>
        {wordIds.map((wordId, idx) => {
          const wordData = wordMap.get(wordId);
          const text = wordData?.englishPhonetic || wordData?.thaiScript || words[idx] || '';
          return (
            <span 
              key={idx} 
              className="word-span clickable"
              onClick={() => wordId && onWordClicked?.(wordId)}
            >
              {text}
              {idx < wordIds.length - 1 && ' '}
            </span>
          );
        })}
      </div>
    );
  }

  // Fallback
  return (
    <div className="subtitle-text" style={{ opacity: 1 }}>
      <span className="stage-indicator">{stageLabel}</span>
      {subtitle.thaiSplit || subtitle.thai || ''}
    </div>
  );
}
*/

// TEMPORARILY DISABLED: Unused rendering function - not called, only Stage 1 is active
/*
function renderDisplayMode(subtitle, processingStage, words, wordIds, wordMap, hasWordMap, onWordClicked) {
  const getStageLabel = () => {
    if (processingStage === SUBTITLE_STAGE.RAW_IMPORTED) return 'Stage 1: thaiScript';
    if (processingStage === SUBTITLE_STAGE.SCRIPT_CONFIRMED) return 'Stage 2: thaiSplit';
    if (processingStage === SUBTITLE_STAGE.SPLIT_CONFIRMED) return 'Stage 3: thaiSplitIds';
    return `[${processingStage}]`;
  };
  const stageLabel = getStageLabel();
  
  if (processingStage < SUBTITLE_STAGE.SPLIT_CONFIRMED) {
    return (
      <div className="subtitle-text" style={{ opacity: 1 }}>
        <span className="stage-indicator">{stageLabel}</span>
        {subtitle.thai || ''}
      </div>
    );
  }

  if (processingStage >= SUBTITLE_STAGE.SPLIT_CONFIRMED && hasWordMap && wordIds.length > 0) {
    return (
      <div className="subtitle-text" style={{ opacity: 1 }}>
        <span className="stage-indicator">{stageLabel}</span>
        {wordIds.map((wordId, idx) => {
          const wordData = wordMap.get(wordId);
          const text = wordData?.englishPhonetic || wordData?.thaiScript || words[idx] || '';
          return (
            <span 
              key={idx} 
              className="word-span clickable"
              onClick={() => wordId && onWordClicked?.(wordId)}
            >
              {text}
              {idx < wordIds.length - 1 && ' '}
            </span>
          );
        })}
      </div>
    );
  }

  if (subtitle.thaiSplit) {
    return (
      <div className="subtitle-text" style={{ opacity: 1 }}>
        <span className="stage-indicator">{stageLabel}</span>
        {subtitle.thaiSplit}
      </div>
    );
  }

  return (
    <div className="subtitle-text" style={{ opacity: 0.15 }}>
      <span className="stage-indicator">{stageLabel}</span>
      {subtitle.thai || ''}
    </div>
  );
}
*/

// TEMPORARILY DISABLED: Unused render functions - not called, only Stage 1 is active
/*
function renderStage1(subtitle, thaiTextDraft, setThaiTextDraft, onScriptConfirmed, onSkip) {
  return (
    <div className="subtitle-stage-panel stage-1" style={{ opacity: 1 }}>
      <div className="stage-header">Stage 1: thaiScript</div>
      {subtitle.startSec && subtitle.endSec && (
        <div className="time-range">{subtitle.startSec} → {subtitle.endSec}</div>
      )}
      <input
        type="text"
        value={thaiTextDraft}
        onChange={(e) => setThaiTextDraft(e.target.value)}
        className="thai-input"
        placeholder="Thai script text"
      />
      <div className="actions">
        <button onClick={() => onScriptConfirmed?.(subtitle.recordId, thaiTextDraft)} className="primary">
          Confirm text
        </button>
        {onSkip && (
          <button onClick={() => onSkip(subtitle.recordId)} className="secondary">Skip and come back</button>
        )}
      </div>
    </div>
  );
}

function renderStage2(subtitle, words, onSplitRequested, onSplitEditRequested, onSplitConfirmed) {
  return (
    <div className="subtitle-stage-panel stage-2" style={{ opacity: 1 }}>
      <div className="stage-header">Stage 2: thaiSplit</div>
      {words.length === 0 ? (
        <>
          <div className="message">Thai text needs to be split into individual words.</div>
          <button onClick={() => onSplitRequested?.(subtitle.recordId)} className="primary">
            Auto-split line
          </button>
        </>
      ) : (
        <>
          <div className="word-chips">
            {words.map((word, idx) => (
              <span key={idx} className="word-chip">{word}</span>
            ))}
          </div>
          <div className="actions">
            <button onClick={() => onSplitEditRequested?.(subtitle.recordId)} className="secondary">
              Adjust split
            </button>
            <button onClick={() => onSplitConfirmed?.(subtitle.recordId)} className="primary">
              Confirm split
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// TEMPORARILY DISABLED: Stage3SenseSelection is only used by disabled renderStage3
/*
function Stage3SenseSelection({ subtitle, words, wordIds, wordMap, hasWordMap, onWordDataRequested, onWordReviewConfirmed, onStageChange }) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [candidates, setCandidates] = useState([]);
  const [lexiconLoaded, setLexiconLoaded] = useState(false);
  const [tokenLexIds, setTokenLexIds] = useState(() => {
    // Initialize from subtitle.tokenLexIds if it exists
    return subtitle.tokenLexIds || new Array(words.length).fill(null);
  });
  const [thaiWordIds, setThaiWordIds] = useState(() => {
    // Initialize from existing thaiSplitIds if available
    if (subtitle.thaiSplitIds) {
      try {
        const parsed = typeof subtitle.thaiSplitIds === 'string' 
          ? JSON.parse(subtitle.thaiSplitIds) 
          : subtitle.thaiSplitIds;
        return Array.isArray(parsed) ? parsed : new Array(words.length).fill(null);
      } catch {
        return new Array(words.length).fill(null);
      }
    }
    return new Array(words.length).fill(null);
  });
  const [isSaving, setIsSaving] = useState(false);

  // Load lexicon on mount
  useEffect(() => {
    loadLexicon().then(() => {
      setLexiconLoaded(true);
    });
  }, []);

  // Handle Stage 3 completion - save to Airtable
  const handleStage3Complete = useCallback(async (finalThaiWordIds) => {
    if (isSaving) return;
    setIsSaving(true);
    
    try {
      // Use stage3Save module to save thaiSplitIds
      await saveStage3(subtitle.recordId, finalThaiWordIds);
      
      // Refresh subtitle from Airtable to ensure cache is updated with latest fields
      // This ensures getSubtitleAt will skip this completed row
      try {
        await refreshSubtitle(subtitle.recordId);
      } catch (error) {
      }
      
      // Advance to show completion message
      setCurrentWordIndex(words.length);
    } catch (error) {
      alert(`Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [subtitle.recordId, words.length, isSaving]);

  // Update candidates when current word changes
  useEffect(() => {
    if (!lexiconLoaded || currentWordIndex >= words.length) return;
    
    const currentToken = words[currentWordIndex];
    if (currentToken) {
      const cands = getCandidates(currentToken);
      setCandidates(cands);
    } else {
      setCandidates([]);
    }
  }, [currentWordIndex, words, lexiconLoaded]);

  // Keyboard handler for Stage 3 (keyboard-only, no mouse buttons)
  useEffect(() => {
    if (currentWordIndex >= words.length) return;

    const handleKeyDown = (e) => {
      // Only handle if not typing in an input/textarea
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      );
      
      if (isInputFocused) return;

      // Handle number keys 1-9
      if (e.key >= '1' && e.key <= '9') {
        const selectedIndex = parseInt(e.key) - 1;
        if (selectedIndex < candidates.length) {
          e.preventDefault();
          e.stopPropagation();
          
          const selectedCandidate = candidates[selectedIndex];
          const token = words[currentWordIndex];
          
          // Map 50k lexicon fields to ThaiWords field names (exact mapping as specified)
          const sourceLexId = selectedCandidate.id;
          const thaiScript = selectedCandidate['t-entry'] || '';
          const thaiSearch = selectedCandidate['t-search'] || '';
          const english = selectedCandidate['e-entry'] || '';
          const pos = selectedCandidate['t-cat'] || '';
          const classifier = selectedCandidate['t-num'] || '';
          const thaiSynonyms = selectedCandidate['t-syn'] || '';
          const thaiAntonyms = selectedCandidate['t-ant'] || '';
          const thaiDefinition = selectedCandidate['t-def'] || '';
          const thaiSample = selectedCandidate['t-sample'] || '';
          const englishRelated = selectedCandidate['e-related'] || '';
          const notes = selectedCandidate['notes'] || '';
          const sourceBundleJSON = JSON.stringify(selectedCandidate);
          
          // Find or create ThaiWords record (avoids duplicates, creates if needed)
          findOrCreateThaiWord({
            sourceLexId,
            thaiScript,
            thaiSearch,
            english,
            pos,
            classifier,
            thaiSynonyms,
            thaiAntonyms,
            thaiDefinition,
            thaiSample,
            englishRelated,
            notes,
            sourceBundleJSON
          }).then((thaiWordId) => {
            const newLexIds = [...tokenLexIds];
            newLexIds[currentWordIndex] = sourceLexId;
            setTokenLexIds(newLexIds);
            
            const newThaiWordIds = [...thaiWordIds];
            // Store ThaiWords record ID (Airtable record ID)
            newThaiWordIds[currentWordIndex] = thaiWordId;
            setThaiWordIds(newThaiWordIds);
            
            // Save to subtitle cache
            updateSubtitleInCache(subtitle.recordId, (sub) => {
              sub.tokenLexIds = newLexIds;
              sub.thaiSplitIds = newThaiWordIds; // Array of ThaiWords record IDs
              // Store word data per token index
              if (!sub.tokenWordData) sub.tokenWordData = {};
              sub.tokenWordData[currentWordIndex] = {
                lex_id: sourceLexId,
                english,
                pos,
                thai: token,
                thaiWordId,
                sourceLexId,
                sourceBundleJSON
              };
            });
            
            // Advance to next word or complete Stage 3
            if (currentWordIndex < words.length - 1) {
              setCurrentWordIndex(currentWordIndex + 1);
            } else {
              // All words reviewed - save Stage 3 to Airtable
              handleStage3Complete(newThaiWordIds);
            }
          }).catch((error) => {
            alert(`Failed to save word: ${error.message}`);
          });
        }
      }
      
      // Handle 0 or Esc to skip
      if (e.key === '0' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        
        // Advance to next word without setting lex_id (keep null in array)
        if (currentWordIndex < words.length - 1) {
          setCurrentWordIndex(currentWordIndex + 1);
        } else {
          // All words reviewed - save Stage 3 to Airtable (with nulls for skipped tokens)
          handleStage3Complete(thaiWordIds);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [currentWordIndex, words.length, candidates, tokenLexIds, thaiWordIds, subtitle.recordId, subtitle.processingStage, handleStage3Complete]);

  if (currentWordIndex >= words.length) {
    // All words reviewed
    return (
      <div className="subtitle-stage-panel stage-3" style={{ opacity: 1 }}>
        <div className="message" style={{ marginTop: '12px', fontSize: '14px', color: '#FFD700', opacity: 0.8 }}>
          All words have been reviewed. Stage 3 is complete.
        </div>
      </div>
    );
  }

  const currentToken = words[currentWordIndex];
  const currentLexId = tokenLexIds[currentWordIndex];
  const thaiScript = subtitle?.thai || '';

  return (
    <div className="subtitle-stage-panel stage-3" style={{ opacity: 1 }}>
      {subtitle.startSec && subtitle.endSec && (
        <div className="time-range">{subtitle.startSec} → {subtitle.endSec}</div>
      )}
      
      <div style={{
        width: '100%',
        padding: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        border: '1px solid rgba(255, 215, 0, 0.5)',
        borderRadius: '4px',
        fontSize: '16px',
        color: '#FFD700',
        marginTop: '12px',
        minHeight: '48px',
        display: 'flex',
        alignItems: 'center',
        boxSizing: 'border-box'
      }}>
        {thaiScript}
      </div>
      
      // Line 2: thaiSplit (tokens, current word highlighted)
      <div style={{
        width: '100%',
        padding: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        border: '1px solid rgba(255, 215, 0, 0.5)',
        borderRadius: '4px',
        fontSize: '16px',
        color: '#FFD700',
        marginTop: '8px',
        minHeight: '48px',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '4px',
        boxSizing: 'border-box'
      }}>
        {words.map((word, idx) => {
          const isCurrent = idx === currentWordIndex;
          const hasLexId = tokenLexIds[idx] !== null;
          return (
            <span
              key={idx}
              style={{
                padding: '2px 4px',
                backgroundColor: isCurrent 
                  ? 'rgba(255, 215, 0, 0.3)' 
                  : 'transparent',
                border: isCurrent 
                  ? '1px solid rgba(255, 215, 0, 1)' 
                  : 'none',
                borderRadius: '2px',
                fontWeight: isCurrent ? '600' : 'normal'
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
      
      // Line 3: thaiSplitIds (aligned with thaiSplit tokens, current index indicated)
      <div style={{
        width: '100%',
        padding: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        border: '1px solid rgba(255, 215, 0, 0.5)',
        borderRadius: '4px',
        fontSize: '16px',
        color: '#FFD700',
        marginTop: '8px',
        minHeight: '48px',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '4px',
        boxSizing: 'border-box'
      }}>
        {words.map((word, idx) => {
          const isCurrent = idx === currentWordIndex;
          const recordId = thaiWordIds[idx];
          return (
            <span
              key={idx}
              style={{
                padding: '2px 4px',
                backgroundColor: isCurrent 
                  ? 'rgba(255, 215, 0, 0.3)' 
                  : 'transparent',
                border: isCurrent 
                  ? '1px solid rgba(255, 215, 0, 1)' 
                  : 'none',
                borderRadius: '2px',
                fontWeight: isCurrent ? '600' : 'normal',
                fontSize: '14px',
                opacity: recordId ? 1 : 0.4,
                minWidth: recordId ? '60px' : '20px',
                textAlign: 'center'
              }}
            >
              {recordId ? recordId.substring(0, 7) + '...' : '—'}
            </span>
          );
        })}
      </div>
      
      // Word progress label
      <div style={{ marginTop: '12px', marginBottom: '8px', fontSize: '14px', color: '#FFD700', opacity: 0.9 }}>
        <strong>Word {currentWordIndex + 1} of {words.length}:</strong> {currentToken}
      </div>

      // Compact sense options list - single-line entries
      <div style={{ marginTop: '8px' }}>
        {!lexiconLoaded ? (
          <div style={{ color: '#FFD700', fontSize: '14px', opacity: 0.8, padding: '4px 0' }}>Loading lexicon...</div>
        ) : candidates.length === 0 ? (
          <div style={{ 
            color: '#FFD700', 
            fontSize: '14px', 
            padding: '4px 0',
            opacity: 0.8
          }}>
            No dictionary entries found. Press 0 or Esc to skip.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {candidates.slice(0, 9).map((candidate, idx) => {
              const isSelected = currentLexId === candidate.id;
              
              // Map 50k lexicon fields to ThaiWords field names for display
              const thaiScript = candidate['t-entry'] || candidate['t-search'] || '';
              const english = candidate['e-entry'] || '';
              const pos = candidate['t-cat'] || '';
              const classifier = candidate['t-num'] || ''; // Use t-num for classifier (matches save mapping)
              
              // Format display: "1) thaiScript – english (pos, classifier)" or "1) thaiScript – english (pos)"
              const hasClassifier = classifier && classifier.trim();
              const posClassifier = hasClassifier && pos
                ? `${pos}, ${classifier}`
                : hasClassifier
                ? classifier
                : pos;
              const displayText = posClassifier && posClassifier.trim()
                ? `${thaiScript} – ${english} (${posClassifier})`
                : `${thaiScript} – ${english} (${pos || 'N/A'})`;
              
              return (
                <div
                  key={candidate.id}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: isSelected 
                      ? 'rgba(0, 255, 0, 0.15)' 
                      : 'transparent',
                    borderBottom: '1px solid rgba(255, 215, 0, 0.1)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#FFD700',
                    lineHeight: '1.4'
                  }}
                    onClick={async () => {
                      const token = words[currentWordIndex];
                      
                      // Map 50k lexicon fields to ThaiWords field names (exact mapping as specified)
                      const sourceLexId = candidate.id;
                      const thaiScript = candidate['t-entry'] || '';
                      const thaiSearch = candidate['t-search'] || '';
                      const english = candidate['e-entry'] || '';
                      const pos = candidate['t-cat'] || '';
                      const classifier = candidate['t-num'] || '';
                      const thaiSynonyms = candidate['t-syn'] || '';
                      const thaiAntonyms = candidate['t-ant'] || '';
                      const thaiDefinition = candidate['t-def'] || '';
                      const thaiSample = candidate['t-sample'] || '';
                      const englishRelated = candidate['e-related'] || '';
                      const notes = candidate['notes'] || '';
                      const sourceBundleJSON = JSON.stringify(candidate);
                      
                      try {
                        // Find or create ThaiWords record (avoids duplicates, creates if needed)
                        const thaiWordId = await findOrCreateThaiWord({
                          sourceLexId,
                          thaiScript,
                          thaiSearch,
                          english,
                          pos,
                          classifier,
                          thaiSynonyms,
                          thaiAntonyms,
                          thaiDefinition,
                          thaiSample,
                          englishRelated,
                          notes,
                          sourceBundleJSON
                        });
                        
                        const newLexIds = [...tokenLexIds];
                        newLexIds[currentWordIndex] = sourceLexId;
                        setTokenLexIds(newLexIds);
                        
                        const newThaiWordIds = [...thaiWordIds];
                        newThaiWordIds[currentWordIndex] = thaiWordId;
                        setThaiWordIds(newThaiWordIds);
                        
                        updateSubtitleInCache(subtitle.recordId, (sub) => {
                          sub.tokenLexIds = newLexIds;
                          sub.thaiSplitIds = newThaiWordIds; // Array of ThaiWords record IDs
                          // Store word data per token index
                          if (!sub.tokenWordData) sub.tokenWordData = {};
                          sub.tokenWordData[currentWordIndex] = {
                            lex_id: sourceLexId,
                            english,
                            pos,
                            thai: token,
                            thaiWordId,
                            sourceLexId,
                            sourceBundleJSON
                          };
                        });
                        
                        // Advance to next word or complete Stage 3
                        if (currentWordIndex < words.length - 1) {
                          setCurrentWordIndex(currentWordIndex + 1);
                        } else {
                          // All words reviewed - save Stage 3 to Airtable
                          handleStage3Complete(newThaiWordIds);
                        }
                      } catch (error) {
                        alert(`Failed to save word: ${error.message}`);
                      }
                    }}
                  >
                    <strong>{idx + 1})</strong> {displayText}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

function renderStage3(subtitle, words, wordIds, wordMap, hasWordMap, onWordDataRequested, onWordReviewConfirmed) {
  return React.createElement(Stage3SenseSelection, {
    subtitle,
    words,
    wordIds,
    wordMap,
    hasWordMap,
    onWordDataRequested,
    onWordReviewConfirmed
  });
}
*/


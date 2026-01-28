/**
 * Subtitle Area Component
 * Displays current subtitle with editing functionality
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getCachedSubtitleByRecordId, updateCurrentSubtitle, ensureMeaningsLoaded, getCachedSubtitleCache } from '../05_cache/cache-subtitles.js';
import { pauseVideoPlayback, resumeVideoPlayback, getCurrentSubtitle, subscribeToTimelineChanges } from '../07_tracking/subtitle-tracker-orchestrator.js';
import { ThaiSubEditor } from './thai-sub-editor.jsx';
import { ThaiSubUser } from './thai-sub-user.jsx';
import { PhoneticInspector } from './phonetic-inspector.jsx';
import { formatWordReference, parseWordReference } from '../03_process/helpers/02_tokenization/word-reference-utils.js';

export function SubtitleArea({ subtitle: subtitleProp, useThaiSplitIdsMode = false, onSubtitleChange }) {
  // subtitleProp can be metadata (new) or subtitle object (old)
  const recordId = subtitleProp?.id || subtitleProp?.recordId;
  
  // Get fat subtitle directly from cache (cache is source of truth for display)
  const [subtitle, setSubtitle] = useState(null);
  const lastLoggedBundleIdRef = useRef(null);
  
  // Set current subtitle ID for save operations
  useEffect(() => {
    if (recordId && typeof window !== 'undefined') {
      window.__currentSubtitleId = recordId;
    }
  }, [recordId]);
  
  // Get subtitle from cache and react to changes
  useEffect(() => {
    if (!recordId) {
      setSubtitle(null);
      lastLoggedBundleIdRef.current = null;
      return;
    }
    
    // Clear gap report (schemaWorkMap) on subtitle entry
    // Reset to blank state - fresh start for new subtitle
    (async () => {
      const { getCachedSubtitle } = await import('../05_cache/cache-subtitles.js');
      const { makeBlankSchemaWorkMapFromFatBundle } = await import('../03_process/helpers/workmap/schema-work-map-builder.js');
      const { updateCurrentSubtitle } = await import('../05_cache/cache-subtitles.js');
      
      const fatBundle = getCachedSubtitle(recordId);
      if (fatBundle) {
        // Reset schemaWorkMap to blank (all false) on entry
        const blankSchemaWorkMap = await makeBlankSchemaWorkMapFromFatBundle(fatBundle, recordId);
        updateCurrentSubtitle(recordId, (subtitle) => ({
          ...subtitle,
          schemaWorkMap: blankSchemaWorkMap,
          savedAt: fatBundle.savedAt || null  // Preserve savedAt state
        }));
      }
    })();
    
    // Get subtitle from cache
    const cachedBundle = getCachedSubtitleByRecordId(recordId);
    setSubtitle(cachedBundle);
    
    // Report display to content.js when bundle is received
    if (cachedBundle && recordId && typeof window !== 'undefined' && window.__reportDisplay) {
      // Wrap async code in IIFE
      (async () => {
        // Build list of displayed field paths by checking FIELD_REGISTRY
        const { FIELD_REGISTRY } = await import('../05_save/helpers/field-registry.js');
        const displayedFields = [];
        
        // Helper function to check if field exists in fat bundle
        const fieldExistsInFatBundle = (fatBundle, fieldPath) => {
          if (!fatBundle || !fieldPath) return false;
          if (!fieldPath.includes('.')) {
            return fatBundle[fieldPath] !== undefined && fatBundle[fieldPath] !== null ||
                   fatBundle.subtitle?.[fieldPath] !== undefined && fatBundle.subtitle?.[fieldPath] !== null;
          }
          // For nested paths, check if any token has the field
          if (fieldPath.startsWith('tokens.')) {
            const parts = fieldPath.split('.');
            if (parts[1] === 'display' && parts[2]?.includes('g2p')) {
              const tokens = fatBundle.tokens?.displayThai || fatBundle.subtitle?.tokens?.displayThai || [];
              return tokens.some(t => t.g2p !== undefined && t.g2p !== null);
            }
            if (parts[1] === 'display' && parts[2]?.includes('englishPhonetic')) {
              const tokens = fatBundle.tokens?.displayThai || fatBundle.subtitle?.tokens?.displayThai || [];
              return tokens.some(t => t.englishPhonetic !== undefined && t.englishPhonetic !== null);
            }
          }
          return true; // Default to true for other nested paths
        };
        
        // Check top-level and token-level fields
        for (const fieldDef of [...FIELD_REGISTRY.topLevel, ...FIELD_REGISTRY.tokenLevel]) {
          const fieldPath = fieldDef.field;
          if (fieldExistsInFatBundle(cachedBundle, fieldPath)) {
            displayedFields.push(fieldPath);
          }
        }
        
        // Check sense-level fields
        const tokens = cachedBundle.tokens || cachedBundle.subtitle?.tokens || { displayThai: [], sensesThai: [], displayEnglish: [], sensesEnglish: [] };
        const senseTokens = tokens.sensesThai || [];
        const sensesEngTokens = tokens.sensesEnglish || [];
        
        for (const senseFieldDef of FIELD_REGISTRY.senseLevel) {
          // Thai senses
          const thaiSensePath = `tokens.sensesThai[i].senses[i].${senseFieldDef.field}`;
          const thaiExists = senseTokens.some(senseToken => {
            const senses = senseToken?.senses || [];
            return senses.some(sense => sense && sense[senseFieldDef.field] !== undefined && sense[senseFieldDef.field] !== null);
          });
          if (thaiExists) {
            displayedFields.push(thaiSensePath);
          }
          
          // English senses
          const engSensePath = `tokens.sensesEnglish[i].senses[i].${senseFieldDef.field}`;
          const engExists = sensesEngTokens.some(senseToken => {
            const senses = senseToken?.senses || [];
            return senses.some(sense => sense && sense[senseFieldDef.field] !== undefined && sense[senseFieldDef.field] !== null);
          });
          if (engExists) {
            displayedFields.push(engSensePath);
          }
        }
        
        window.__reportDisplay(recordId, displayedFields);
      })();
    }
    
    // Diagnostic logging when subtitle loaded (only when subtitle changes)
    if (recordId !== lastLoggedBundleIdRef.current) {
      const bundles = getCachedSubtitleCache();
      const videoElement = document.querySelector('video');
      const currentTime = videoElement ? videoElement.currentTime : null;
      
      const diagnostics = {
        subtitleId: recordId,
        bundleExists: cachedBundle !== null,
        hasSubtitle: cachedBundle?.subtitle !== undefined,
        hasTokens: cachedBundle?.tokens !== undefined,
        hasDisplayTokens: cachedBundle?.tokens?.displayThai !== undefined,
        hasSenseTokens: cachedBundle?.tokens?.sensesThai !== undefined,
        displayTokensCount: cachedBundle?.tokens?.displayThai?.length || 0,
        senseTokensCount: cachedBundle?.tokens?.sensesThai?.length || 0,
        wordReferenceIdsCount: cachedBundle?.subtitle?.wordReferenceIdsThai?.length || 0,
        cacheBundleCount: bundles.length,
        currentVideoTime: currentTime
      };
      
      const missingFields = [];
      if (!diagnostics.bundleExists) missingFields.push('subtitle');
      if (!diagnostics.hasSubtitle) missingFields.push('subtitle');
      if (!diagnostics.hasTokens) missingFields.push('tokens');
      if (!diagnostics.hasDisplayTokens) missingFields.push('tokens.displayThai');
      if (!diagnostics.hasSenseTokens) missingFields.push('tokens.sensesThai');
      if (diagnostics.displayTokensCount === 0 && diagnostics.wordReferenceIdsCount > 0) missingFields.push('display tokens empty');
      if (diagnostics.senseTokensCount === 0 && diagnostics.wordReferenceIdsCount > 0) missingFields.push('sense tokens empty');
      
      
      lastLoggedBundleIdRef.current = recordId;
    }
    
    // Subscribe to timeline changes to react to navigation
    const unsubscribe = subscribeToTimelineChanges((subtitle) => {
      if (subtitle && subtitle.id === recordId) {
        // Current subtitle changed - refresh subtitle from cache
        const updatedBundle = getCachedSubtitleByRecordId(recordId);
        if (updatedBundle) {
          setSubtitle(updatedBundle);
        }
      }
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [recordId]);
  
  // Editor mode: manage selected token index at parent level (governing architecture)
  const [selectedWordIndex, setSelectedWordIndex] = useState(null);
  const selectedWordIndexRef = useRef(null);
  const isUserActionRef = useRef(false); // Flag to track if action was initiated by user (hotkey/click)
  const prevBundleRef = useRef(null); // Track previous subtitle state to detect initial load
  
  
  const getInitialStage = (sub) => {
    if (!sub) return 'script';
    return 'script';
  };
  
  const [internalStage, setInternalStage] = useState(() => getInitialStage(subtitleProp));
  const [inputValue, setInputValue] = useState(() => subtitleProp?.thai || '');
  const [tokens, setTokens] = useState([]);
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [isEditSubMode, setIsEditSubMode] = useState(false);
  const [editSubText, setEditSubText] = useState('');
  const hasEnteredEditModeRef = useRef(false);
  const editedSubtitleIdsRef = useRef(new Set());
  const originalInputValueRef = useRef('');
  const wasVideoPlayingRef = useRef(false);
  const inputRef = useRef(null);
  const editSubInputRef = useRef(null);
  const justEnteredEditModeRef = useRef(false);

  // Reset selectedWordIndex when recordId changes
  useEffect(() => {
    if (!recordId) {
      setSelectedWordIndex(null);
      selectedWordIndexRef.current = null;
    }
  }, [recordId]);

  // Register token selection callback to sync with subtitle-tracker
  useEffect(() => {
    if (!recordId) return;
    
    (async () => {
      const { registerTokenSelectionCallback, unregisterTokenSelectionCallback } = await import('../07_tracking/subtitle-tracker-orchestrator.js');
      
      const callback = (subtitleRecordId, tokenIndex) => {
        if (subtitleRecordId === recordId) {
          setSelectedWordIndex(tokenIndex);
          selectedWordIndexRef.current = tokenIndex;
        }
      };
      
      registerTokenSelectionCallback(recordId, callback);
      
      return () => {
        unregisterTokenSelectionCallback(recordId);
      };
    })();
  }, [recordId]);

  // Handler for normalized senses - receives updated subtitle
  const handleSensesNormalized = useCallback(async (updatedBundle) => {
    if (!updatedBundle || !recordId) {
      return;
    }
    
    // Update subtitle cache with normalized subtitle
    // Reset schemaWorkMap by default, then mark senses as changed
    const cachedBundle = updateCurrentSubtitle(recordId, (subtitle) => {
      const updated = {
        ...updatedBundle,
        savedAt: null  // Mark as dirty
      };
      
      // After reset, mark senses fields as true for all tokens that have senses
      // If senses array doesn't exist yet → set senses = true (boolean) for full processing
      // If senses array exists → set senses = true (boolean) for full reprocessing
      if (updated.schemaWorkMap && updated.schemaWorkMap.tokens && updated.schemaWorkMap.tokens.sensesThai) {
        if (updated.tokens && updated.tokens.sensesThai) {
          for (let i = 0; i < updated.tokens.sensesThai.length; i++) {
            const senseToken = updated.tokens.sensesThai[i];
            if (updated.schemaWorkMap.tokens.sensesThai[i]) {
              // Set to boolean true - indicates full processing needed
              // TODO: In future, could convert to array structure for granular tracking if only specific fields changed
              updated.schemaWorkMap.tokens.sensesThai[i].senses = true;
            }
          }
        }
      }
      
      return updated;
    });
    
    // Update local state with the returned subtitle
    if (cachedBundle) {
      setSubtitle(cachedBundle);
    }
    
    // Subtitle save mechanism will handle saving normalized senses through saveSubtitle
    // updateCurrentSubtitle triggers onSubtitleCached → saveSubtitle, which will save words from fat subtitle tokens
  }, [recordId]);
  
  // Stable handler for meaning edits - receives updated subtitle
  const handleMeaningEdited = useCallback(async (updatedBundleOrIndex, updatedMeaningOrIndex, isAddingMeaning) => {
    if (!subtitle || !recordId) {
      return;
    }
    
    // Check if first parameter is a subtitle (new signature)
    if (updatedBundleOrIndex && typeof updatedBundleOrIndex === 'object' && updatedBundleOrIndex.tokens) {
      // New signature: receive updated subtitle directly
      const updatedBundle = updatedBundleOrIndex;
      
      // Handle delete: extract senseId and delete from Firestore if needed
      const currentSenseToken = subtitle?.tokens?.sensesThai?.[selectedWordIndex];
      const updatedSenseToken = updatedBundle?.tokens?.sensesThai?.[selectedWordIndex];
      const currentSenses = currentSenseToken?.senses || [];
      const updatedSenses = updatedSenseToken?.senses || [];
      
      // If senses were deleted, find which one and delete from Firestore
      if (updatedSenses.length < currentSenses.length && selectedWordIndex !== null) {
        const deletedSenses = currentSenses.filter(cs => 
          !updatedSenses.some(us => 
            (us.senseId && cs.senseId && us.senseId === cs.senseId) ||
            (us.id !== undefined && cs.id !== undefined && us.id === cs.id)
          )
        );
        
        for (const deletedSense of deletedSenses) {
          const senseId = deletedSense?.senseId || deletedSense?.id;
          const displayToken = subtitle?.tokens?.displayThai?.[selectedWordIndex];
          const thaiScript = displayToken?.thaiScript?.split(',')[0]?.trim() || displayToken?.thaiScript;
          
          if (senseId && thaiScript) {
            try {
              const { deleteSense } = await import('../05_save/save-subtitles.js');
              await deleteSense(thaiScript, senseId);
            } catch (error) {
              // Failed to delete sense
            }
          }
        }
      }
      
      // Update subtitle cache with received subtitle
      // UI resets schemaWorkMap by default, then marks changed fields
      const cachedBundle = updateCurrentSubtitle(recordId, (subtitle) => {
        // Reset schemaWorkMap by default - updateCurrentSubtitle will handle this
        // Mark senses as changed for the selected token
        const updated = {
          ...updatedBundle,
          savedAt: null  // Mark as dirty
        };
        
        // After reset, mark senses field as true for this token
        // Set to boolean true - indicates full processing needed
        if (updated.schemaWorkMap && updated.schemaWorkMap.tokens && updated.schemaWorkMap.tokens.sensesThai && selectedWordIndex !== null) {
          if (updated.schemaWorkMap.tokens.sensesThai[selectedWordIndex]) {
              updated.schemaWorkMap.tokens.sensesThai[selectedWordIndex].senses = true;
          }
        }
        
        return updated;
      });
      
      // Update local state
      if (cachedBundle) {
        setSubtitle(cachedBundle);
      }
    } else {
      // Old signature: (editingIndex, updatedMeaningOrIndex, isAddingMeaning) - backward compatibility
      if (selectedWordIndex === null) {
        return;
      }
      
      const editingIndex = updatedBundleOrIndex;
      const currentSenseToken = subtitle?.tokens?.sensesThai?.[selectedWordIndex];
      const currentSenses = currentSenseToken?.senses || [];
      
      let updatedSenses;
      
      // Check if this is a delete operation (updatedMeaningOrIndex is null)
      if (updatedMeaningOrIndex === null) {
        // Delete operation: editingIndex is the index to delete
        const deleteIndex = editingIndex;
        if (deleteIndex >= 0 && deleteIndex < currentSenses.length) {
          // Extract senseId before removing from array
          const senseToDelete = currentSenses[deleteIndex];
          const senseId = senseToDelete?.senseId || senseToDelete?.id;
          
          // Get thaiScript from display token for wordId
          const displayToken = subtitle?.tokens?.displayThai?.[selectedWordIndex];
          const thaiScript = displayToken?.thaiScript?.split(',')[0]?.trim() || displayToken?.thaiScript;
          
          // Delete sense document from Firestore if senseId exists
          if (senseId && thaiScript) {
            try {
              const { deleteSense } = await import('../05_save/save-subtitles.js');
              await deleteSense(thaiScript, senseId);
            } catch (error) {
              // Failed to delete sense
            }
          }
          
          updatedSenses = currentSenses.filter((_, idx) => idx !== deleteIndex);
        } else {
          return;
        }
      } else if (isAddingMeaning) {
        // Add new sense
        updatedSenses = [...currentSenses, {
          ...updatedMeaningOrIndex,
          id: currentSenses.length,
          selected: false,
          index: currentSenses.length
        }];
      } else if (editingIndex >= 0 && editingIndex < currentSenses.length) {
        // Edit existing sense
        updatedSenses = currentSenses.map((m, idx) => 
          idx === editingIndex 
            ? { ...updatedMeaningOrIndex, id: m.id, selected: m.selected, index: m.index }
            : m
        );
      } else {
        return;
      }
      
      // Reindex senses to ensure proper ordering
      updatedSenses = updatedSenses.map((m, idx) => ({ ...m, id: idx, index: idx }));
      
      // Update subtitle cache
      // UI resets schemaWorkMap by default, then marks changed fields
      const updatedBundle = updateCurrentSubtitle(recordId, (subtitle) => {
        // Reset schemaWorkMap by default - updateCurrentSubtitle will handle this
        const updated = {
          ...subtitle,
          tokens: {
            ...subtitle.tokens,
            senses: subtitle.tokens.sensesThai.map((senseToken, idx) => 
              idx === selectedWordIndex
                ? { ...senseToken, senses: updatedSenses }
                : senseToken
            )
          },
          savedAt: null  // Mark as dirty
        };
        
        // After reset, mark senses field as true for this token
        // Set to boolean true - indicates full processing needed
        if (updated.schemaWorkMap && updated.schemaWorkMap.tokens && updated.schemaWorkMap.tokens.sensesThai && selectedWordIndex !== null) {
          if (updated.schemaWorkMap.tokens.sensesThai[selectedWordIndex]) {
              updated.schemaWorkMap.tokens.sensesThai[selectedWordIndex].senses = true;
          }
        }
        
        return updated;
      });
      
      // Update local state
      if (updatedBundle) {
        setBundle(updatedBundle);
      }
    }
  }, [subtitle, recordId, selectedWordIndex]);

  // Handle reprocess meaning - scrape ORST and update subtitle
  const handleReprocessMeaning = useCallback(async () => {
    if (!subtitle || !recordId || selectedWordIndex === null) {
      return;
    }
    
    const displayTokens = subtitle.tokens?.displayThai || [];
    const displayToken = displayTokens[selectedWordIndex];
    
    if (!displayToken || !displayToken.thaiScript) {
      return;
    }
    
    const thaiScript = displayToken.thaiScript.trim();
    
    // TODO: loadWord function needs to be implemented
    // const { loadWord } = await import('../01_load-subtitles/load-subtitles-orchestrator.js');
    const existingWordData = null; // await loadWord(thaiScript, 'wordsThai');
    const hasNormalized = existingWordData?.senses?.some(s => 
      s && s.descriptionEnglish !== undefined && s.descriptionEnglish !== null
    );
    
    if (!hasNormalized) {
      // Scrape ORST
      const { scrapeOrstDictionary } = await import('../03_process/helpers/06_dictionary/06a_orst/orst.js');
      const orstEntries = await scrapeOrstDictionary(thaiScript);
      
      if (!orstEntries || !Array.isArray(orstEntries)) {
        return;
      }
      
      // Add id, selected, index fields to meanings for UI consistency
      const meaningsWithIds = orstEntries.map((m, idx) => ({
        ...m,
        id: idx,
        selected: false,
        index: idx
      }));
      
      // Update subtitle cache using updateCurrentSubtitle (non-silent, triggers save)
      const updatedBundle = updateCurrentSubtitle(recordId, (subtitle) => ({
        ...subtitle,
        tokens: {
          ...subtitle.tokens,
            senses: subtitle.tokens.sensesThai.map((senseToken, idx) =>
            idx === selectedWordIndex
              ? { ...senseToken, senses: meaningsWithIds }
              : senseToken
          )
        }
      }));
      
      // Update local state with the returned subtitle
      if (updatedBundle) {
        setSubtitle(updatedBundle);
      }
    } else {
      // Skip ORST scraping - word already has normalized senses
      return;
    }
    
  }, [subtitle, recordId, selectedWordIndex]);

  // Get sense selection data for selected token
  const senseSelectionData = useMemo(() => {
    if (useThaiSplitIdsMode || !subtitle || selectedWordIndex === null) {
      return { meanings: [] };
    }
    
    if (!subtitle.tokens) {
      return { meanings: [] };
    }
    
    const displayTokens = subtitle.tokens.displayThai || [];
    const senseTokens = subtitle.tokens.sensesThai || [];
    
    if (selectedWordIndex >= displayTokens.length || selectedWordIndex >= senseTokens.length) {
      return { meanings: [] };
    }
    
    const displayToken = displayTokens[selectedWordIndex];
    const senseToken = senseTokens[selectedWordIndex];
    
    if (!displayToken || !senseToken) {
      return { meanings: [] };
    }
    
    return {
      senses: senseToken.senses || []
    };
  }, [selectedWordIndex, subtitle, useThaiSplitIdsMode]);

  // Fast entry mode detection and auto-select first unreviewed token
  useEffect(() => {
    if (useThaiSplitIdsMode || !subtitle || !recordId || isEditSubMode) return; // Only in editor mode, not editing subtitle text
    
    const activeElement = document.activeElement;
    const isInputFocused = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.isContentEditable
    );
    
    if (isInputFocused) return; // Don't auto-select if input focused
    
    const displayTokens = subtitle?.tokens?.display || [];
    if (displayTokens.length === 0) return; // No tokens to select
    
    // Fast entry mode is active - auto-select first unreviewed token if none selected
    if (selectedWordIndex === null) {
      (async () => {
        const { advanceToNextToken } = await import('../07_tracking/subtitle-tracker-orchestrator.js');
        const firstUnreviewed = await advanceToNextToken(recordId, null);
        if (firstUnreviewed !== null) {
          setSelectedWordIndex(firstUnreviewed);
          selectedWordIndexRef.current = firstUnreviewed;
        }
      })();
    }
  }, [useThaiSplitIdsMode, subtitle, recordId, isEditSubMode, selectedWordIndex]);

  // Fast entry mode: Handle number keys for sequential token meaning selection
  useEffect(() => {
    if (useThaiSplitIdsMode || isEditSubMode) return; // Only in editor mode, not editing subtitle text
    
    const handleFastEntryKeyDown = async (e) => {
      // CRITICAL: Check for input focus FIRST, before any other logic
      // This must happen at the very beginning to prevent interference with input fields
      const activeElement = document.activeElement;
      
      // Check if we're inside the upload modal container FIRST - if so, completely ignore this handler
      const uploadModalContainer = document.getElementById('smart-subs-upload-modal-container');
      const isInUploadModal = uploadModalContainer && (
        uploadModalContainer.contains(activeElement) ||
        uploadModalContainer.contains(e.target) ||
        e.target.closest('#smart-subs-upload-modal-container')
      );
      
      // If in upload modal, completely ignore - let all keys pass through normally
      if (isInUploadModal) {
        return;
      }
      
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable ||
        // Check if element is inside an input/textarea (for nested structures)
        activeElement.closest('input') ||
        activeElement.closest('textarea') ||
        // Check if inside upload panel or modal (explicit check for upload panel inputs)
        activeElement.closest('[id*="upload"]') ||
        activeElement.closest('[id*="modal"]') ||
        activeElement.closest('[class*="upload"]') ||
        activeElement.closest('[class*="modal"]') ||
        // Check if element has input-like attributes
        activeElement.getAttribute('contenteditable') === 'true' ||
        activeElement.getAttribute('role') === 'textbox'
      );
      
      // Return immediately if any input is focused - don't interfere with typing
      // This check happens BEFORE any key processing to ensure inputs work normally
      if (isInputFocused) {
        return;
      }
      
      // Additional safety: If the key is NOT a number (0-9), return immediately
      // This ensures we only handle number keys and let all other keys pass through
      if (!/^[0-9]$/.test(e.key)) {
        return;
      }
      
      // At this point, we know it's a number key (0-9) and NOT in an input
      // Only handle if no modifier keys are pressed
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!subtitle || !recordId) return;
        
        const displayTokens = subtitle?.tokens?.display || [];
        if (displayTokens.length === 0) return;
        
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Map number key to meaning index
        const keyPressed = parseInt(e.key, 10);
        let meaningIndex;
        if (keyPressed === 0) {
          meaningIndex = 9; // 0 key = 10th meaning (index 9)
        } else {
          meaningIndex = keyPressed - 1; // 1-9 keys = 1st-9th meanings (index 0-8)
        }
        
        // Get current token index - use selectedWordIndex or find first unreviewed
        let currentTokenIndex = selectedWordIndex;
        
        if (currentTokenIndex === null) {
          // Auto-select first unreviewed token
          const { advanceToNextToken } = await import('../07_tracking/subtitle-tracker-orchestrator.js');
          currentTokenIndex = await advanceToNextToken(recordId, null);
          if (currentTokenIndex !== null) {
            setSelectedWordIndex(currentTokenIndex);
            selectedWordIndexRef.current = currentTokenIndex;
          }
        }
        
        if (currentTokenIndex !== null) {
          // Update both tokens.senses AND wordReferenceIds
          const updatedBundle = await updateCurrentSubtitle(recordId, async (subtitle) => {
            // Get display token and sense token to extract thaiScript and senseIndex
            const displayToken = subtitle.tokens.displayThai[currentTokenIndex];
            // Clean thaiScript: split on comma and take first word (defensive fix for comma-separated values)
            const rawThaiScript = displayToken?.thaiScript;
            const thaiScript = rawThaiScript?.split(',')[0]?.trim() || rawThaiScript || null;
            const senseToken = subtitle.tokens.sensesThai[currentTokenIndex];
            const selectedSense = senseToken?.senses?.[meaningIndex];
            
            // Extract index from document ID (senseId format: sense-{wordId}-{index})
            // Use document ID index as address, not array position
            let senseIndex = null;
            if (selectedSense?.senseId) {
              const senseIdParts = selectedSense.senseId.split('-');
              if (senseIdParts.length >= 3 && senseIdParts[0] === 'sense') {
                senseIndex = parseInt(senseIdParts[senseIdParts.length - 1], 10);
                if (isNaN(senseIndex)) {
                  senseIndex = null;
                }
              }
            }
            
            // Fallback to id or index if senseId parsing failed
            if (senseIndex === null) {
              senseIndex = selectedSense?.id !== undefined ? selectedSense.id : (selectedSense?.index !== undefined ? selectedSense.index : meaningIndex);
            }
            
            const newWordReferenceIdsThai = [...(subtitle.subtitle.wordReferenceIdsThai || [])];
            if (thaiScript && senseIndex !== undefined && senseIndex !== null) {
              newWordReferenceIdsThai[currentTokenIndex] = formatWordReference(thaiScript, senseIndex);
            }
            
            // Update fatBundle with new data
            const updated = {
              ...subtitle,
              subtitle: {
                ...subtitle.subtitle,
                wordReferenceIdsThai: newWordReferenceIdsThai
              },
              tokens: {
                ...subtitle.tokens,
                senses: subtitle.tokens.sensesThai.map((senseToken, idx) => 
                  idx === currentTokenIndex
                    ? {
                        ...senseToken,
                        senses: senseToken.senses.map((m, mIdx) => ({
                          ...m,
                          selected: mIdx === meaningIndex
                        }))
                      }
                    : senseToken
                )
              },
              savedAt: null  // Mark as dirty
            };
            
            return updated;
          });
          
          // Regenerate workmap from updated fatBundle (single source of truth)
          if (updatedBundle) {
            const { generateSchemaWorkMap } = await import('../03_process/helpers/workmap/schema-work-map-builder.js');
            const showName = updatedBundle?.metadata?.showName || null;
            const mediaId = updatedBundle?.metadata?.mediaId || (() => {
              const subId = updatedBundle?.subtitle?.id;
              if (subId) {
                const parts = subId.split('-');
                if (parts.length >= 2) {
                  return parts.slice(0, -1).join('-');
                }
              }
              return null;
            })();
            const regeneratedWorkMap = await generateSchemaWorkMap(updatedBundle, recordId, { showName, mediaId });
            
            // Update with regenerated workmap
            const finalBundle = await updateCurrentSubtitle(recordId, (subtitle) => ({
              ...subtitle,
              schemaWorkMap: regeneratedWorkMap
            }));
            
            // Update local state with the returned subtitle
            if (finalBundle) {
              setBundle(finalBundle);
            }
          }
          
          // Mark token as reviewed
            const { markTokenAsReviewed, handleTokenProcessed, advanceToNextToken } = await import('../07_tracking/subtitle-tracker-orchestrator.js');
            markTokenAsReviewed(recordId, currentTokenIndex);
            
            // Advance to next unreviewed token
            const nextTokenIndex = await advanceToNextToken(recordId, currentTokenIndex);
            if (nextTokenIndex !== null) {
              // Next token found - select it
              setSelectedWordIndex(nextTokenIndex);
              selectedWordIndexRef.current = nextTokenIndex;
            } else {
              // No next token - all tokens reviewed
              // handleTokenProcessed will check and resume video
              setSelectedWordIndex(null);
              selectedWordIndexRef.current = null;
            }
            
            // Call handleTokenProcessed to check if all tokens reviewed and resume video
            await handleTokenProcessed(recordId, currentTokenIndex, true);
          }
        }
    };
    
    window.addEventListener('keydown', handleFastEntryKeyDown, true);
    return () => window.removeEventListener('keydown', handleFastEntryKeyDown, true);
  }, [useThaiSplitIdsMode, isEditSubMode, subtitle, recordId, selectedWordIndex]);

  // Ensure meanings are loaded when word is selected
  useEffect(() => {
    if (useThaiSplitIdsMode || !subtitle || !recordId || selectedWordIndex === null) {
      prevBundleRef.current = subtitle;
      return;
    }
    
    if (!subtitle.tokens) return;
    
    const displayTokens = subtitle.tokens.displayThai || [];
    const senseTokens = subtitle.tokens.sensesThai || [];
    if (selectedWordIndex >= displayTokens.length) return;
    
    // Check if meanings are already loaded in sense token
    const senseToken = senseTokens[selectedWordIndex];
    if (senseToken && senseToken.meanings && Array.isArray(senseToken.meanings) && senseToken.meanings.length > 0) {
      prevBundleRef.current = subtitle;
      return; // Meanings already loaded
    }
    
    // Don't call ensureMeaningsLoaded if subtitle just appeared (initial load)
    // Only call if subtitle existed before and selectedWordIndex changed (user action)
    const isInitialLoad = prevBundleRef.current === null && subtitle !== null;
    if (isInitialLoad) {
      prevBundleRef.current = subtitle;
      return;
    }
    
    // Use helper function to match token to recordId (avoids accessing thaiWordsRecords directly)
    (async () => {
      const { matchTokenToRecordId } = await import('../05_save/save-subtitles.js');
      const thaiWordsRecordId = matchTokenToRecordId(subtitle, selectedWordIndex);
      if (thaiWordsRecordId) {
        await ensureMeaningsLoaded(recordId, thaiWordsRecordId);
      }
    })();
    
    prevBundleRef.current = subtitle;
  }, [selectedWordIndex, subtitle, recordId, useThaiSplitIdsMode]);


  // Keep video paused in editor mode when token is selected (event-based, not polling)
  useEffect(() => {
    if (useThaiSplitIdsMode) return; // Only in editor mode (when useThaiSplitIdsMode is false)
    if (selectedWordIndex === null) return; // Only pause when actively editing a token
    
    pauseVideoPlayback();
  }, [useThaiSplitIdsMode, selectedWordIndex]);

  useEffect(() => {
    if (subtitleProp) {
      const newStage = getInitialStage(subtitleProp);
      setInternalStage(newStage);
      // Editor mode uses thaiSplit (from thaiSplitIds reconstruction)
      if (newStage === 'script' || newStage === 'split') {
        const splitValue = subtitleProp?.thaiSplit || '';
        setInputValue(splitValue);
        originalInputValueRef.current = splitValue;
      }
    }
  }, [subtitleProp?.recordId]);

  const handleResumeRef = useRef(() => {
    const currentRecordId = recordId;
    if (currentRecordId) {
      editedSubtitleIdsRef.current.add(currentRecordId);
    }
    
    setIsEditMode(false);
    setSelectedWordIndex(null);
    resumeVideoPlayback();
  });


  // Extract display tokens and sense tokens from subtitle
  const displayTokens = subtitle?.tokens?.displayThai || [];
  const senseTokens = subtitle?.tokens?.sensesThai || [];
  
  // Extract wordReferenceIdsThai from subtitle (source of truth for sense selection)
  const wordReferenceIdsThai = subtitle?.subtitle?.wordReferenceIdsThai || [];
  
  // Create simple array: same size as tokens, each element is senseIndex or null
  const senseSelectedIndices = useMemo(() => {
    const result = wordReferenceIdsThai.map(wordRef => {
      if (wordRef && typeof wordRef === 'string') {
        const parsed = parseWordReference(wordRef);
        return parsed.senseIndex; // Number or null
      }
      return null;
    });
    return result;
  }, [wordReferenceIdsThai]);
  
  // Get current subtitle text from subtitle.subtitle.thai (SmartSubs/thai field)
  // Only use thai field from metadata - don't fall back to reconstructing from tokens
  const currentSubtitleText = useMemo(() => {
    return subtitle?.subtitle?.thai?.trim() || '';
  }, [subtitle]);
  
  // Store original text when entering edit mode
  const originalEditTextRef = useRef('');

  // Initialize edit text when entering edit mode
  useEffect(() => {
    if (isEditSubMode && currentSubtitleText) {
      setEditSubText(currentSubtitleText);
      originalEditTextRef.current = currentSubtitleText;
      // Focus input after state update
      setTimeout(() => {
        if (editSubInputRef.current) {
          editSubInputRef.current.focus();
          editSubInputRef.current.select();
        }
      }, 100);
    }
  }, [isEditSubMode, currentSubtitleText]);
  
  // Handle saving edited subtitle text
  const handleSaveEditSub = useCallback(async () => {
    if (!recordId || !editSubText.trim()) {
      setIsEditSubMode(false);
      return;
    }
    
    try {
      const currentBundle = getCachedSubtitleByRecordId(recordId) || subtitle;
      
      // Check if text actually changed
      const currentThai = currentBundle?.subtitle?.thai || '';
      const newThai = editSubText.trim();
      
      if (currentThai === newThai) {
        // No changes, just exit edit mode
        setIsEditSubMode(false);
        return;
      }
      
      // Update subtitle cache using updateCurrentSubtitle
      // UI resets schemaWorkMap by default, then marks changed fields
      const updatedBundle = updateCurrentSubtitle(recordId, (subtitle) => {
        // Reset schemaWorkMap by default - updateCurrentSubtitle will handle this
        const updated = {
          ...subtitle,
          subtitle: {
            ...subtitle.subtitle,
            thai: editSubText.trim()
          },
          savedAt: null  // Mark as dirty
        };
        
        // After reset, mark thai field as true
        if (updated.schemaWorkMap) {
          updated.schemaWorkMap.thai = true;
        }
        
        return updated;
      });
      
      // Update local state with the returned subtitle
      if (updatedBundle) {
        setSubtitle(updatedBundle);
      }
      
      // Exit edit mode
      setIsEditSubMode(false);
      
    } catch (error) {
      setIsEditSubMode(false); // Still exit edit mode even on error
    }
  }, [recordId, editSubText, subtitle]);

  // Handle saving edited phonetic for a token
  const handleSaveTokenPhonetic = useCallback(async (tokenIndex, phoneticValue) => {
    if (!subtitle || !recordId) return;
    
    try {
      // Update subtitle cache using updateCurrentSubtitle
      // UI resets schemaWorkMap by default, then marks changed fields
      const updatedBundle = updateCurrentSubtitle(recordId, (subtitle) => {
        // Reset schemaWorkMap by default - updateCurrentSubtitle will handle this
        const updated = {
          ...subtitle,
          tokens: {
            ...subtitle.tokens,
            display: subtitle.tokens.displayThai.map((displayToken, idx) => 
              idx === tokenIndex
                ? { ...displayToken, englishPhonetic: phoneticValue }
                : displayToken
            )
          },
          savedAt: null  // Mark as dirty
        };
        
        // After reset, mark englishPhonetic field as true for this token
        if (updated.schemaWorkMap && updated.schemaWorkMap.tokens && updated.schemaWorkMap.tokens.displayThai && updated.schemaWorkMap.tokens.displayThai[tokenIndex]) {
          updated.schemaWorkMap.tokens.displayThai[tokenIndex].englishPhonetic = true;
        }
        
        return updated;
      });
      
      // Update local state with the returned subtitle
      if (updatedBundle) {
        setSubtitle(updatedBundle);
      }
      
    } catch (error) {
      // Silent error handling
    }
  }, [subtitle, recordId]);


  useEffect(() => {
    if (isEditMode && inputRef.current && justEnteredEditModeRef.current) {
      const selectText = () => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
          if (inputRef.current.setSelectionRange) {
            inputRef.current.setSelectionRange(0, inputRef.current.value.length);
          }
        }
      };
      
      selectText();
      
      const timeoutId = setTimeout(() => {
        selectText();
        justEnteredEditModeRef.current = false;
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isEditMode]);


  // Handle Escape key for edit mode toggle
  const handleToggleEditMode = useCallback((newEditMode) => {
    setIsEditMode(newEditMode);
    if (newEditMode) {
          hasEnteredEditModeRef.current = true;
          justEnteredEditModeRef.current = true;
        }
  }, []);

  // Handle Escape key for subtitle text edit mode (editor mode only)
  useEffect(() => {
    if (useThaiSplitIdsMode) return; // Only in editor mode
    
    const handleKeyDown = (e) => {
      // CRITICAL: Check for upload modal FIRST - if in upload modal, completely ignore this handler
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
      
      // CRITICAL: Check for input focus FIRST for non-Escape keys
      // This prevents interference with typing in input fields
      const activeElement = document.activeElement;
      
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable ||
        // Also check if element is inside an input container (for React portals)
        activeElement.closest('input') ||
        activeElement.closest('textarea') ||
        // Check if inside upload panel (explicit check for upload panel inputs)
        activeElement.closest('[id*="upload"]') ||
        activeElement.closest('[class*="upload"]')
      );
      
      // For Escape key, handle it even if input is focused (for edit mode toggle)
      if (e.key === 'Escape') {
        // Only prevent default if NOT in an input (allow Escape to work in inputs normally)
        if (!isInputFocused) {
          e.preventDefault();
          e.stopPropagation();
          
          if (isEditSubMode) {
            // Exit edit mode and save
            handleSaveEditSub();
          } else {
            // Enter edit mode
            setIsEditSubMode(true);
          }
        }
        return;
      }
      
      // For all other keys, return immediately if input is focused - don't interfere
      if (isInputFocused) {
        return;
      }
      
      // Handle other keys here if needed...
    };
    
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [useThaiSplitIdsMode, isEditSubMode, handleSaveEditSub]);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'stretch',
        minHeight: 0,
        height: '100%',
        padding: '10px 20px 20px 20px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        position: 'relative',
        overflow: 'auto',
        boxSizing: 'border-box'
      }}
    >
      <div
        className="subtitle-stage-panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            width: '100%'
          }}
        >
          {isEditSubMode ? (
            // Edit mode: Show input field with plain text
            React.createElement('div', {
              style: {
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                gap: '12px'
              }
            },
              React.createElement('input', {
                ref: editSubInputRef,
                type: 'text',
                value: editSubText,
                onChange: (e) => setEditSubText(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEditSub();
                  }
                  // Escape is handled by global handler - no need to handle it here
                },
                style: {
                  width: '100%',
                  padding: '12px',
                  fontSize: '32px',
                  fontWeight: '600',
                  color: '#FFD700',
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  border: '2px solid rgba(255, 215, 0, 0.5)',
                  borderRadius: '6px',
                  fontFamily: 'inherit',
                  outline: 'none'
                },
                placeholder: 'Edit subtitle text...'
              })
            )
          ) : useThaiSplitIdsMode ? (
            // User mode: TWO ZONES - sub area and display area
            React.createElement('div', {
              style: {
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                gap: '16px'
              }
            },
              React.createElement('div', {
                key: `sub-${recordId || 'null'}`,
                style: {
                  width: '100%'
                }
              },
                React.createElement(ThaiSubUser, { 
                  displayTokens: displayTokens,
                  senseTokens: senseTokens,
                  selectedWordIndex: selectedWordIndex,
                  onSelectionChange: (index) => {
                    // Token selection locked down - no movement triggers
                    setSelectedWordIndex(index);
                  },
                  subtitle: subtitle,
                  onSavePhonetic: handleSaveTokenPhonetic
                }),
                // Phonetic Inspector panel (replaces SenseSelection in user mode)
                React.createElement(PhoneticInspector, {
                  subtitle: subtitle,
                  selectedWordIndex: selectedWordIndex,
                  displayTokens: displayTokens,
                  onSavePhonetic: handleSaveTokenPhonetic
                })
              )
            )
          ) : (
            // Editor mode: TWO ZONES - sub area and display area
            React.createElement('div', {
              style: {
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                gap: '16px'
              }
            },
              React.createElement('div', {
                key: `sub-${recordId || 'null'}`,
                style: {
                  width: '100%'
                }
              },
                React.createElement(ThaiSubEditor, {
                  subtitle: subtitle,
                  selectedWordIndex: selectedWordIndex,
                  senseSelectedIndices: senseSelectedIndices,
                  isEditMode: isEditSubMode,
                  editText: editSubText,
                  onEditTextChange: setEditSubText,
                  editInputRef: editSubInputRef,
                  onSaveEdit: handleSaveEditSub,
                  onSelectionChange: (index) => {
                    // Token selection locked down - no movement triggers
                    setSelectedWordIndex(index);
                  },
                  onMeaningEdited: handleMeaningEdited,
                  onReprocessMeaning: handleReprocessMeaning,
                  onSensesNormalized: handleSensesNormalized,
                  showName: subtitle?.metadata?.showName || null,
                  episode: subtitle?.metadata?.episode || null,
                  season: subtitle?.metadata?.season || null,
                  mediaId: subtitle?.metadata?.mediaId || (() => {
                    // Extract mediaId from subId if not in metadata (subId format: mediaId-index)
                    const subId = subtitle?.subtitle?.id;
                    if (subId) {
                      const parts = subId.split('-');
                      if (parts.length >= 2) {
                        return parts.slice(0, -1).join('-');
                      }
                    }
                    return null;
                  })(),
                  onSenseSelected: async (tokenIndex, meaningIndex) => {
                    if (!subtitle || !recordId) return;
                    
                    // Update both tokens.senses AND wordReferenceIds
                    const updatedBundle = await updateCurrentSubtitle(recordId, (subtitle) => {
                      // Get display token and sense token to extract thaiScript and senseIndex
                      const displayToken = subtitle.tokens.displayThai[tokenIndex];
                      // Clean thaiScript: split on comma and take first word (defensive fix for comma-separated values)
                      const rawThaiScript = displayToken?.thaiScript;
                      const thaiScript = rawThaiScript?.split(',')[0]?.trim() || rawThaiScript || null;
                      const senseToken = subtitle.tokens.sensesThai[tokenIndex];
                      const selectedSense = senseToken?.senses?.[meaningIndex];
                      
                      // Extract index from document ID (senseId format: sense-{wordId}-{index})
                      // Use document ID index as address, not array position
                      let senseIndex = null;
                      if (selectedSense?.senseId) {
                        const senseIdParts = selectedSense.senseId.split('-');
                        if (senseIdParts.length >= 3 && senseIdParts[0] === 'sense') {
                          senseIndex = parseInt(senseIdParts[senseIdParts.length - 1], 10);
                          if (isNaN(senseIndex)) {
                            senseIndex = null;
                          }
                        }
                      }
                      
                      // Fallback to id or index if senseId parsing failed
                      if (senseIndex === null) {
                        senseIndex = selectedSense?.id !== undefined ? selectedSense.id : (selectedSense?.index !== undefined ? selectedSense.index : meaningIndex);
                      }
                      
                      const newWordReferenceIdsThai = [...(subtitle.subtitle.wordReferenceIdsThai || [])];
                      if (thaiScript && senseIndex !== undefined && senseIndex !== null) {
                        newWordReferenceIdsThai[tokenIndex] = formatWordReference(thaiScript, senseIndex);
                      }
                      
                      // Update fatBundle with new data
                      const updated = {
                        ...subtitle,
                        subtitle: {
                          ...subtitle.subtitle,
                          wordReferenceIdsThai: newWordReferenceIdsThai
                        },
                        tokens: {
                          ...subtitle.tokens,
                          senses: subtitle.tokens.sensesThai.map((senseToken, idx) => 
                            idx === tokenIndex
                              ? {
                                  ...senseToken,
                                  senses: senseToken.senses.map((m, mIdx) => ({
                                    ...m,
                                    selected: mIdx === meaningIndex
                                  }))
                                }
                              : senseToken
                          )
                        },
                        savedAt: null  // Mark as dirty
                      };
                      
                      return updated;
                    });
                    
                    // Regenerate workmap from updated fatBundle (single source of truth)
                    if (updatedBundle) {
                      const { generateSchemaWorkMap } = await import('../03_process/helpers/workmap/schema-work-map-builder.js');
                      const showName = updatedBundle?.metadata?.showName || null;
                      const mediaId = updatedBundle?.metadata?.mediaId || (() => {
                        const subId = updatedBundle?.subtitle?.id;
                        if (subId) {
                          const parts = subId.split('-');
                          if (parts.length >= 2) {
                            return parts.slice(0, -1).join('-');
                          }
                        }
                        return null;
                      })();
                      const regeneratedWorkMap = await generateSchemaWorkMap(updatedBundle, recordId, { showName, mediaId });
                      
                      // Update with regenerated workmap
                      const finalBundle = await updateCurrentSubtitle(recordId, (subtitle) => ({
                        ...subtitle,
                        schemaWorkMap: regeneratedWorkMap
                      }));
                      
                      // Update local state with the returned subtitle
                      if (finalBundle) {
                        setBundle(finalBundle);
                      }
                    }
                    
                    // Mark token as reviewed and advance to next token
                    const { handleTokenProcessed, markTokenAsReviewed } = await import('../07_tracking/subtitle-tracker-orchestrator.js');
                    markTokenAsReviewed(recordId, tokenIndex);
                    await handleTokenProcessed(recordId, tokenIndex, true);
                    
                    isUserActionRef.current = false;
                  }
                })
              )
            )
          )}
        </div>
      </div>
    </div>
  );
}

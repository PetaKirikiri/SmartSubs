/**
 * Sense Selection Component
 * Inline component for selecting/editing word meanings from ThaiWords meanings field
 * Key-based entry (0-9) - no buttons needed
 * Editable meanings with add/delete functionality
 * Cache-first saves for snappy UI
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { parseWordReference, formatWordReference } from '../03_process/helpers/02_tokenization/word-reference-utils.js';
import { analyzeSenseSelectionFromSubtitle } from './helpers/gpt-sense-selection.js';
import { normalizeSense, normalizeSensesWithGPT, normalizeSubtitleSensesWithGPT } from '../03_process/helpers/07_normalize/gpt-normalize-senses.js';
import { createSenseWithGPTFromSubtitle } from '../03_process/helpers/06_dictionary/06c_gpt_meaning/gpt-meaning.js';
import { GPTSensePopup } from './gpt-sense-popup.jsx';
import { MeaningsList } from './meanings-list.jsx';
import { SenseSelectionTaskbar } from './sense-selection-taskbar.jsx';
import { POS_OPTIONS } from './sense-constants.js';

// Memoize SenseSelection to prevent unnecessary re-renders
export const SenseSelection = React.memo(function SenseSelection({ isOpen, onClose, senseToken: senseTokenProp, senseSelectionData, senseSelectedIndices, selectedWordIndex, onMeaningSelected, onMeaningEdited, onReprocessMeaning, inline = false, wordReferenceIdsThai: wordReferenceIdsThaiProp, fullThaiText: fullThaiTextProp, showName, episode, season, onSensesNormalized, mediaId, subId: subIdProp, subtitle }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState({ 
    pos: '', 
    posEnglish: '', 
    descriptionThai: '', 
    descriptionEnglish: '',
    meaningThai: '',
    meaningEnglish: ''
  });
  const [languageMode, setLanguageMode] = useState('english');
  const [isAddingMeaning, setIsAddingMeaning] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [gptAnalysis, setGptAnalysis] = useState(null);
  const [isAnalyzingGPT, setIsAnalyzingGPT] = useState(false);
  const [showGPTPopup, setShowGPTPopup] = useState(false);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [isGeneratingMeaning, setIsGeneratingMeaning] = useState(false);
  const [matchedWords, setMatchedWords] = useState([]);
  
  // Extract data from subtitle internally (subtitle-in, subtitle-out pattern)
  // If subtitle is provided, extract from it; otherwise fall back to props
  const senseToken = subtitle && selectedWordIndex !== null && subtitle.tokens?.senses
    ? subtitle.tokens.sensesThai[selectedWordIndex] || null
    : senseTokenProp;
  
  const wordReferenceIdsThai = subtitle?.subtitle?.wordReferenceIdsThai || wordReferenceIdsThaiProp || [];
  const fullThaiText = subtitle?.subtitle?.thai || fullThaiTextProp || '';
  const subId = subtitle?.subtitle?.id || subIdProp || null;
  
  // Only log when token is selected
  useEffect(() => {
    // Track selectedWordIndex and senseSelectedIndices changes
  }, [selectedWordIndex, senseSelectedIndices]);
  
  // Load matched words when word is selected
  useEffect(() => {
    if (selectedWordIndex !== null && subId && thaiWord) {
      const loadMatchedWords = async () => {
        try {
          // TODO: loadWord function needs to be implemented
          // const { loadWord } = await import('../01_load-subtitles/load-subtitles-orchestrator.js');
          const { getMatchedWordsForSubtitle } = await import('../05_save/save-subtitles.js');
          
          const wordData = null; // await loadWord(thaiWord, 'wordsThai');
          if (wordData) {
            const matches = await getMatchedWordsForSubtitle(wordData, subId, selectedWordIndex);
            setMatchedWords(matches);
          } else {
            setMatchedWords([]);
          }
        } catch (error) {
          setMatchedWords([]);
        }
      };
      
      loadMatchedWords();
    } else {
      setMatchedWords([]);
    }
  }, [selectedWordIndex, subId, thaiWord]);
  
  // Stable input change handlers using useCallback
  // These ONLY update local state - never trigger subtitle updates
  const handlePosChange = useCallback((e) => {
    setEditForm(prev => ({ ...prev, pos: e.target.value }));
  }, []);


  const handlePosEnglishChange = useCallback((e) => {
    setEditForm(prev => ({ ...prev, posEnglish: e.target.value }));
  }, []);

  const handleDescriptionThaiChange = useCallback((e) => {
    setEditForm(prev => ({ ...prev, descriptionThai: e.target.value }));
  }, []);
  
  const handleDescriptionEnglishChange = useCallback((e) => {
    setEditForm(prev => ({ ...prev, descriptionEnglish: e.target.value }));
  }, []);

  const handleMeaningThaiChange = useCallback((e) => {
    setEditForm(prev => ({ ...prev, meaningThai: e.target.value }));
  }, []);

  const handleMeaningEnglishChange = useCallback((e) => {
    setEditForm(prev => ({ ...prev, meaningEnglish: e.target.value }));
  }, []);


  // Extract meanings from senseToken (now extracted from subtitle internally)
  const rawMeanings = senseToken?.senses || senseSelectionData?.senses || [];
  // Normalize all senses to ensure consistent structure
  const meanings = rawMeanings.map(normalizeSense);
  const isLoading = !meanings.length && !senseToken && !senseSelectionData;

  // Extract Thai word from subtitle or wordReferenceIdsThai (computed early for use in callbacks)
  const thaiWord = (() => {
    // First try to get from subtitle display token
      if (subtitle && selectedWordIndex !== null && subtitle.tokens?.displayThai?.[selectedWordIndex]) {
      return subtitle.tokens.displayThai[selectedWordIndex].thaiScript || '';
    }
    // Fallback to wordReferenceIdsThai
    if (selectedWordIndex !== null && wordReferenceIdsThai && wordReferenceIdsThai[selectedWordIndex]) {
      const wordRef = wordReferenceIdsThai[selectedWordIndex];
      const parsedRef = parseWordReference(wordRef);
      return parsedRef?.thaiScript || '';
    }
    return '';
  })();

  // Check if a meaning is already selected
  const getSelectedMeaningIndex = () => {
    if (selectedWordIndex !== null && senseSelectedIndices) {
      // Use explicit check to handle 0 values correctly (0 is falsy but valid)
      const value = senseSelectedIndices[selectedWordIndex] !== undefined && senseSelectedIndices[selectedWordIndex] !== null 
        ? senseSelectedIndices[selectedWordIndex] 
        : null;
      return value;
    }
    return null;
  };

  const handleSelectMeaning = useCallback(async (meaningIndex) => {
    if (!onMeaningSelected) return;
    await onMeaningSelected(meaningIndex);
  }, [onMeaningSelected]);

  const handleStartEdit = (index) => {
    const meaning = meanings[index];
    setEditingIndex(index);
    setIsAddingMeaning(false);
    // Populate all normalized fields with fallbacks to old fields
    setEditForm({
      pos: meaning.pos || '',
      posEnglish: meaning.posEnglish || '',
      descriptionThai: meaning.descriptionThai || meaning.definition || '',
      descriptionEnglish: meaning.descriptionEnglish || '',
      meaningThai: meaning.meaningThai || '',
      meaningEnglish: meaning.meaningEnglish || '',
      notesThai: meaning.notesThai || '',
      notesEnglish: meaning.notesEnglish || ''
    });
  };

  const handleSaveEdit = async () => {
    if ((editingIndex === null || editingIndex === undefined) && !isAddingMeaning) return;

    setIsSaving(true);
    try {
      let updatedMeaning;
      if (isAddingMeaning) {
        // Get thaiWord from first meaning if available, or use empty string
        const thaiWord = meanings.length > 0 && meanings[0].thaiWord ? meanings[0].thaiWord : '';
        updatedMeaning = {
          thaiWord: thaiWord,
          pos: editForm.pos.trim(),
          posEnglish: editForm.posEnglish.trim(),
          descriptionThai: editForm.descriptionThai.trim(),
          descriptionEnglish: editForm.descriptionEnglish.trim(),
          meaningThai: editForm.meaningThai.trim(),
          meaningEnglish: editForm.meaningEnglish.trim(),
          // Keep old fields for backward compatibility
          definition: editForm.descriptionThai.trim(),
          english: editForm.descriptionEnglish.trim(),
          source: 'MANUAL',
          index: meanings.length,
          normalized: true
        };
      } else {
        if (editingIndex >= 0 && editingIndex < meanings.length) {
          updatedMeaning = {
            ...meanings[editingIndex],
            pos: editForm.pos.trim(),
            posEnglish: editForm.posEnglish.trim(),
            descriptionThai: editForm.descriptionThai.trim(),
            descriptionEnglish: editForm.descriptionEnglish.trim(),
            meaningThai: editForm.meaningThai.trim(),
            meaningEnglish: editForm.meaningEnglish.trim(),
            // Keep old fields for backward compatibility
            definition: editForm.descriptionThai.trim(),
            english: editForm.descriptionEnglish.trim(),
            normalized: true
          };
        } else {
          return;
        }
      }

      // Update subtitle and pass to callback
      if (onMeaningEdited && subtitle && selectedWordIndex !== null && selectedWordIndex !== undefined) {
        const updatedSenses = isAddingMeaning
          ? [...meanings, updatedMeaning]
          : meanings.map((sense, idx) => idx === editingIndex ? updatedMeaning : sense);
        
        const updatedSubtitle = {
          ...subtitle,
          tokens: {
            ...subtitle.tokens,
            senses: subtitle.tokens.sensesThai.map((senseToken, idx) =>
              idx === selectedWordIndex
                ? { ...senseToken, senses: updatedSenses }
                : senseToken
            )
          }
        };
        
        await onMeaningEdited(updatedSubtitle);
      } else if (onMeaningEdited) {
        // Fallback to old signature if no subtitle
        await onMeaningEdited(editingIndex, updatedMeaning, isAddingMeaning);
      }

      setEditingIndex(null);
      setIsAddingMeaning(false);
      setEditForm({ 
        pos: '', 
        posEnglish: '', 
        descriptionThai: '', 
        descriptionEnglish: '' 
      });
    } catch (err) {
      // Error handling in parent
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setIsAddingMeaning(false);
    setEditForm({
      pos: '', 
      posEnglish: '', 
      descriptionThai: '', 
      descriptionEnglish: '',
      meaningThai: '',
      meaningEnglish: ''
    });
  };

  const handleLanguageToggle = () => {
    setLanguageMode(prev => prev === 'english' ? 'thai' : 'english');
  };

  const handleDeleteMeaning = async (index) => {
    if (meanings.length <= 1) return;

    setIsSaving(true);
    try {
      // Update subtitle and pass to callback
      if (onMeaningEdited && subtitle && selectedWordIndex !== null && selectedWordIndex !== undefined) {
        const updatedSenses = meanings.filter((_, idx) => idx !== index);
        
        const updatedSubtitle = {
          ...subtitle,
          tokens: {
            ...subtitle.tokens,
            senses: subtitle.tokens.sensesThai.map((senseToken, idx) =>
              idx === selectedWordIndex
                ? { ...senseToken, senses: updatedSenses }
                : senseToken
            )
          }
        };
        
        await onMeaningEdited(updatedSubtitle);
      } else if (onMeaningEdited) {
        // Fallback to old signature if no subtitle
        await onMeaningEdited(index, null, false);
      }
    } catch (err) {
      // Error handled by cache
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMeaning = () => {
    setIsAddingMeaning(true);
    setEditingIndex(-1); // Use -1 to indicate "new" meaning
    
    // Check if all existing meanings share the same POS
    const posValues = meanings
      .map(m => m.pos)
      .filter(pos => pos && pos.trim()); // Only non-empty POS values
    
    let initialPos = '';
    if (posValues.length > 0 && posValues.length === meanings.length) {
      // All meanings have POS - check if they're all the same
      const uniquePos = [...new Set(posValues)];
      if (uniquePos.length === 1) {
        // All meanings share the same POS - pre-populate it
        initialPos = uniquePos[0];
      }
    }
    
    setEditForm({ 
      pos: initialPos, 
      posEnglish: '', 
      descriptionThai: '', 
      descriptionEnglish: '',
      meaningThai: '',
      meaningEnglish: ''
    });
  };

  const handleReprocessMeaning = async () => {
    if (!onReprocessMeaning) return;
    
    setIsReprocessing(true);
    try {
      await onReprocessMeaning();
    } catch (err) {
      // Error handled by parent
    } finally {
      setIsReprocessing(false);
    }
  };

  // GPT analysis function (subtitle-in pattern)
  const triggerGPTAnalysis = useCallback(async (forceRefresh = false) => {
    if (!subtitle || !subtitle.tokens) return;
    if (selectedWordIndex === null) return;
    
    const senseToken = subtitle.tokens.sensesThai?.[selectedWordIndex];
    if (!senseToken?.senses || senseToken.senses.length === 0) return;
    
    setIsAnalyzingGPT(true);
    try {
      const analysis = await analyzeSenseSelectionFromSubtitle(
        subtitle,
        selectedWordIndex,
        { forceRefresh },
        {
          showName,
          episode,
          season,
          mediaId,
          subId
        }
      );
      setGptAnalysis(analysis);
      setShowGPTPopup(true); // Auto-show popup
    } catch (error) {
      setGptAnalysis({
        recommendedSenseIndex: null,
        senseScores: [],
        overallReasoning: `Error: ${error.message}`
      });
      setShowGPTPopup(true); // Show popup with error
    } finally {
      setIsAnalyzingGPT(false);
    }
  }, [subtitle, selectedWordIndex, showName, episode, season, mediaId, subId]);

  // Handler for GPT button click
  const handleGPTAnalysis = useCallback(() => {
    triggerGPTAnalysis(false); // Use cache if available
  }, [triggerGPTAnalysis]);

  // GPT Meaning Generation handler (subtitle-in pattern)
  const handleGPTMeaningGeneration = useCallback(async () => {
    if (!subtitle || !subtitle.tokens) return;
    if (selectedWordIndex === null) return;
    
    setIsGeneratingMeaning(true);
    try {
      const generatedSenses = await createSenseWithGPTFromSubtitle(
        subtitle,
        selectedWordIndex,
        {
          showName,
          episode,
          season,
          subId
        }
      );
      
      if (generatedSenses && generatedSenses.length > 0) {
        
        // Convert GPT senses to normalized format with proper IDs
        const normalizedSenses = generatedSenses.map((sense, idx) => {
          const baseIndex = meanings.length + idx;
          const normalized = normalizeSense({
            ...sense,
            index: baseIndex,
            source: sense.source || 'GPT',
            // Ensure senseId is set (will be generated deterministically on save)
            senseId: sense.senseId || `sense-${thaiWord}-${baseIndex}`
          });
          return normalized;
        });
        
        
        // Merge with existing meanings (or use just generated if no existing)
        const allSenses = meanings.length > 0 
          ? [...meanings, ...normalizedSenses]
          : normalizedSenses;
        
        
        // Add generated senses via onSensesNormalized or onMeaningEdited
        if (onSensesNormalized) {
          await onSensesNormalized(allSenses);
        } else if (onMeaningEdited) {
          // Fallback: add each sense individually
          for (let i = 0; i < normalizedSenses.length; i++) {
            await onMeaningEdited(meanings.length + i, normalizedSenses[i], false);
          }
        } else {
        }
      } else {
      }
    } catch (error) {
      // Generation failed
    } finally {
      setIsGeneratingMeaning(false);
    }
  }, [selectedWordIndex, thaiWord, wordReferenceIdsThai, fullThaiText, showName, episode, season, subId, meanings, onSensesNormalized, onMeaningEdited]);

  // Normalize handler wrapper (for GPT dropdown)
  const handleNormalize = useCallback(async () => {
    if (!meanings || meanings.length === 0) return;
    if (selectedWordIndex === null || selectedWordIndex === undefined) return;
    
    setIsNormalizing(true);
    try {
      // Use subtitle-based normalization if subtitle is available
      if (subtitle && subtitle.tokens) {
        const updatedSubtitle = await normalizeSubtitleSensesWithGPT(subtitle, selectedWordIndex, {
          fullThaiText: fullThaiText,
          showName: showName,
          episode: episode,
          season: season
        });
        
        // Pass updated subtitle to callback
        if (onSensesNormalized) {
          await onSensesNormalized(updatedSubtitle);
        }
      } else {
        // Fallback to old method if no subtitle (shouldn't happen in UI)
        const enhancedSenses = await normalizeSensesWithGPT(meanings, {
          thaiWord: thaiWord,
          fullThaiText: fullThaiText,
          showName: showName,
          episode: episode,
          season: season
        });
        
        if (onSensesNormalized) {
          await onSensesNormalized(enhancedSenses);
        } else if (onMeaningEdited) {
          // Fallback: update each sense individually
          for (let i = 0; i < enhancedSenses.length; i++) {
            await onMeaningEdited(i, enhancedSenses[i], false);
          }
        }
      }
    } catch (error) {
      // Normalization failed
    } finally {
      setIsNormalizing(false);
    }
  }, [subtitle, meanings, thaiWord, selectedWordIndex, fullThaiText, showName, episode, season, onSensesNormalized, onMeaningEdited]);

  // Compute if GPT analysis exists and is valid
  const hasGPTAnalysis = gptAnalysis && 
    gptAnalysis.senseScores && 
    Array.isArray(gptAnalysis.senseScores) && 
    gptAnalysis.senseScores.length > 0;

  // Always render in inline mode (editor mode), even if no word selected
  if (!isOpen && !inline) return null;

  const selectedMeaningIndex = getSelectedMeaningIndex();

  // Compute isSelected for each meaning (meaning ID extraction logic stays in parent)
  const meaningsWithSelection = meanings.map((meaning, index) => {
    let meaningDocIndex = null;
    if (meaning?.senseId) {
      const senseIdParts = meaning.senseId.split('-');
      if (senseIdParts.length >= 3 && senseIdParts[0] === 'sense') {
        meaningDocIndex = parseInt(senseIdParts[senseIdParts.length - 1], 10);
        if (isNaN(meaningDocIndex)) {
          meaningDocIndex = null;
        }
      }
    }
    
    // Fallback to id or index if senseId parsing failed
    const meaningId = meaningDocIndex !== null ? meaningDocIndex : (meaning?.id !== undefined ? meaning.id : (meaning?.index !== undefined ? meaning.index : index));
    const isSelected = selectedMeaningIndex !== null && selectedMeaningIndex === meaningId;
    
    return {
      meaning,
      index,
      isSelected
    };
  });

  // Inline mode: render below subtitle
  if (inline) {
    return React.createElement('div', {
      style: {
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        borderRadius: '8px',
        padding: '16px',
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }
    },
      // Header with reprocess and normalize buttons
      React.createElement(SenseSelectionTaskbar, {
        languageMode: languageMode,
        isReprocessing: isReprocessing,
        isSaving: isSaving,
        isNormalizing: isNormalizing,
        isAddingMeaning: isAddingMeaning,
        editingIndex: editingIndex,
        meanings: meanings,
        thaiWord: thaiWord,
        fullThaiText: fullThaiText,
        showName: showName,
        episode: episode,
        season: season,
        onLanguageToggle: handleLanguageToggle,
        onReprocess: handleReprocessMeaning,
        onGPTAnalysis: handleGPTAnalysis,
        onGPTMeaningGeneration: handleGPTMeaningGeneration,
        onNormalize: handleNormalize,
        isAnalyzingGPT: isAnalyzingGPT,
        isGeneratingMeaning: isGeneratingMeaning,
        hasGPTAnalysis: hasGPTAnalysis,
        selectedWordIndex: selectedWordIndex,
        mediaId: mediaId,
        subId: subId,
        onNormalized: async (enhancedSenses) => {
          setIsNormalizing(true);
          try {
            // Update senses via onSensesNormalized callback (preferred)
            if (onSensesNormalized) {
              await onSensesNormalized(enhancedSenses);
            } else if (onMeaningEdited) {
              // Fallback: update each sense individually
              for (let i = 0; i < enhancedSenses.length; i++) {
                await onMeaningEdited(i, enhancedSenses[i], false);
              }
            } else {
            }
          } catch (error) {
            throw error; // Re-throw so normalize button can handle
          } finally {
            setIsNormalizing(false);
          }
        },
        onAddMeaning: handleAddMeaning,
        onSensesNormalized: onSensesNormalized,
        onMeaningEdited: onMeaningEdited
      }),

      // Matched words display
      matchedWords.length > 0 && React.createElement('div', {
        key: 'matched-words',
        style: {
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: 'rgba(0, 255, 136, 0.1)',
          borderRadius: '4px',
          border: '1px solid rgba(0, 255, 136, 0.3)'
        }
      },
        React.createElement('div', {
          style: {
            fontSize: '12px',
            color: '#888888',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '8px'
          }
        }, 'Matched Words'),
        React.createElement('div', {
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px'
          }
        },
          matchedWords.map((word, idx) => React.createElement('span', {
            key: idx,
            style: {
              padding: '4px 8px',
              backgroundColor: 'rgba(0, 255, 136, 0.2)',
              borderRadius: '4px',
              fontSize: '14px',
              color: '#FFFFFF',
              fontWeight: '500'
            }
          }, word))
        )
      ),
      React.createElement(MeaningsList, {
        meaningsWithSelection: meaningsWithSelection,
        isLoading: isLoading,
        isAddingMeaning: isAddingMeaning,
        editingIndex: editingIndex,
        isSaving: isSaving,
        editForm: editForm,
        languageMode: languageMode,
        onStartEdit: handleStartEdit,
        onDelete: handleDeleteMeaning,
        onSave: handleSaveEdit,
        onCancel: handleCancelEdit,
        onFormChange: {
          handlePosChange: handlePosChange,
          handlePosEnglishChange: handlePosEnglishChange,
          handleDescriptionThaiChange: handleDescriptionThaiChange,
          handleDescriptionEnglishChange: handleDescriptionEnglishChange,
          handleMeaningThaiChange: handleMeaningThaiChange,
          handleMeaningEnglishChange: handleMeaningEnglishChange,
          handleNotesThaiChange: handleNotesThaiChange,
          handleNotesEnglishChange: handleNotesEnglishChange
        },
        POS_OPTIONS: POS_OPTIONS
      }),

      // GPT Sense Popup
      React.createElement(GPTSensePopup, {
        key: 'gpt-popup',
        isOpen: showGPTPopup,
        onClose: () => setShowGPTPopup(false),
        analysis: gptAnalysis,
        senses: meanings,
        isLoading: isAnalyzingGPT,
        onRefresh: () => triggerGPTAnalysis(true)
      })
  );
}

  // Modal mode (fallback - not used in inline mode)
  return null;
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  // Only re-render if these props actually changed
  // Subtitle is the primary source - if subtitle changes, re-render
  // Also check selectedWordIndex since senseToken is extracted from subtitle[selectedWordIndex]
  return (
    prevProps.subtitle === nextProps.subtitle &&
    prevProps.selectedWordIndex === nextProps.selectedWordIndex &&
    prevProps.senseSelectedIndices === nextProps.senseSelectedIndices &&
    prevProps.isOpen === nextProps.isOpen &&
    prevProps.inline === nextProps.inline &&
    prevProps.onMeaningEdited === nextProps.onMeaningEdited &&
    prevProps.onMeaningSelected === nextProps.onMeaningSelected &&
    prevProps.onReprocessMeaning === nextProps.onReprocessMeaning &&
    prevProps.showName === nextProps.showName &&
    prevProps.episode === nextProps.episode &&
    prevProps.season === nextProps.season &&
    prevProps.onSensesNormalized === nextProps.onSensesNormalized &&
    prevProps.mediaId === nextProps.mediaId
  );
});

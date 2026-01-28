/**
 * SenseSelectionTaskbar - Header/taskbar with action buttons (presentational only)
 */

import React from 'react';
import { GPTDropdown } from './gpt-dropdown.jsx';

export function SenseSelectionTaskbar({ languageMode, isReprocessing, isSaving, isNormalizing, isAddingMeaning, editingIndex, meanings, thaiWord, fullThaiText, showName, episode, season, onLanguageToggle, onReprocess, onNormalize, onAddMeaning, onSensesNormalized, onMeaningEdited, onGPTAnalysis, isAnalyzingGPT, isGeneratingMeaning, hasGPTAnalysis, selectedWordIndex, mediaId, subId, onGPTMeaningGeneration }) {
  return React.createElement('div', {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginBottom: '8px',
      paddingBottom: '8px',
      borderBottom: '1px solid rgba(255, 215, 0, 0.3)',
      gap: '6px',
      flexShrink: 0
    }
  },
    React.createElement('button', {
      onClick: onLanguageToggle,
      style: {
        padding: '4px 8px',
        backgroundColor: languageMode === 'english' ? '#FFD700' : 'transparent',
        border: '1px solid #FFD700',
        borderRadius: '4px',
        color: languageMode === 'english' ? '#000000' : '#FFD700',
        cursor: 'pointer',
        fontSize: '10px',
        fontWeight: 'bold',
        textTransform: 'uppercase'
      }
    }, languageMode === 'english' ? 'EN' : 'TH'),
    React.createElement('button', {
      onClick: onReprocess,
      disabled: isReprocessing,
      style: {
        padding: '4px 8px',
        backgroundColor: isReprocessing ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 215, 0, 0.2)',
        border: '1px solid #FFD700',
        borderRadius: '4px',
        color: isReprocessing ? '#AAAAAA' : '#FFD700',
        cursor: isReprocessing ? 'not-allowed' : 'pointer',
        fontSize: '10px',
        fontWeight: 'bold',
        opacity: isReprocessing ? 0.5 : 1
      },
      title: 'Reprocess ORST scrape for this token'
    }, isReprocessing ? 'Reprocessing...' : 'Reprocess'),
    // GPT Dropdown (contains Sense Analysis, Meaning Generation, Normalize)
    React.createElement(GPTDropdown, {
      onSenseAnalysis: onGPTAnalysis,
      onMeaningGeneration: onGPTMeaningGeneration,
      onNormalize: onNormalize,
      isAnalyzingGPT: isAnalyzingGPT || isGeneratingMeaning,
      isNormalizing: isNormalizing,
      hasGPTAnalysis: hasGPTAnalysis,
      meanings: meanings,
      isSaving: isSaving,
      isReprocessing: isReprocessing,
      senses: meanings,
      thaiWord: thaiWord
    }),
    // Add Meaning button (+ button in taskbar)
    !isAddingMeaning ? React.createElement('button', {
      onClick: onAddMeaning,
      disabled: isSaving || editingIndex !== null,
      style: {
        padding: '4px 8px',
        backgroundColor: (editingIndex !== null || isSaving) ? 'rgba(255, 215, 0, 0.3)' : '#FFD700',
        border: 'none',
        borderRadius: '4px',
        color: (editingIndex !== null || isSaving) ? '#AAAAAA' : '#000000',
        cursor: (editingIndex !== null || isSaving) ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        width: '28px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: (editingIndex !== null || isSaving) ? 0.5 : 1
      },
      title: (editingIndex !== null || isSaving) ? 'Cannot add meaning (editing or saving)' : 'Add meaning'
    }, '+') : null
  );
}

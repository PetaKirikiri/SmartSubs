/**
 * MeaningsList - Container for all meaning cards and add form (presentational only)
 */

import React from 'react';
import { SenseCard } from './sense-card.jsx';
import { AddSenseForm } from './add-sense-form.jsx';
import { POS_OPTIONS } from './sense-constants.js';

export function MeaningsList({ meaningsWithSelection, isLoading, isAddingMeaning, editingIndex, isSaving, editForm, languageMode, onStartEdit, onDelete, onSave, onCancel, onFormChange, POS_OPTIONS: posOptions }) {
  const meanings = meaningsWithSelection.map(item => item.meaning);
  
  // Empty state
  if (meanings.length === 0) {
    return React.createElement('div', {
      style: { color: '#AAAAAA', textAlign: 'center', padding: '20px' }
    }, 'No meanings available');
  }
  
  // Loading state
  if (isLoading) {
    return React.createElement('div', {
      style: { color: '#FFD700', textAlign: 'center', padding: '20px' }
    }, 'Loading meanings...');
  }
  
  // Meanings list
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      flex: 1,
      overflowY: 'auto',
      minHeight: 0
    }
  },
    meanings.length === 0 && !isAddingMeaning ? React.createElement('div', {
      style: { color: '#AAAAAA', textAlign: 'center', padding: '20px' }
    }, 'No meanings found. Click "Add Meaning" below.') :
    meaningsWithSelection.map(({ meaning, index, isSelected }) => {
      const isEditing = editingIndex === index;
      
      return React.createElement(SenseCard, {
        key: index,
        meaning: meaning,
        index: index,
        isEditing: isEditing,
        isSelected: isSelected,
        isSaving: isSaving,
        meaningsLength: meanings.length,
        editForm: editForm,
        languageMode: languageMode,
        onStartEdit: onStartEdit,
        onDelete: onDelete,
        onSave: onSave,
        onCancel: onCancel,
        onFormChange: onFormChange,
        POS_OPTIONS: posOptions
      });
    }),
    
    // Add meaning form (when isAddingMeaning is true)
    isAddingMeaning ? React.createElement(AddSenseForm, {
      editForm: editForm,
      isSaving: isSaving,
      onSave: onSave,
      onCancel: onCancel,
      onFormChange: onFormChange,
      POS_OPTIONS: posOptions
    }) : null
  );
}

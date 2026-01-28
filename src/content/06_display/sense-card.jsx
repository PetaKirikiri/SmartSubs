/**
 * SenseCard - Individual meaning card component (presentational only)
 */

import React from 'react';
import { SenseEditForm } from './sense-edit-form.jsx';
import { SenseDisplay } from './sense-display.jsx';
import { POS_OPTIONS } from './sense-constants.js';

export function SenseCard({ meaning, index, isEditing, isSelected, isSaving, meaningsLength, editForm, languageMode, onStartEdit, onDelete, onSave, onCancel, onFormChange, POS_OPTIONS: posOptions }) {
  return React.createElement('div', {
    key: index,
    style: {
      padding: '16px',
      backgroundColor: isSelected 
        ? 'rgba(0, 255, 136, 0.2)' 
        : 'rgba(255, 255, 255, 0.05)',
      border: isSelected 
        ? '2px solid #00FF88' 
        : '1px solid rgba(255, 215, 0, 0.3)',
      borderRadius: '4px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      width: '100%',
      boxSizing: 'border-box'
    }
  },
    // Meaning content
    React.createElement('div', {
      style: {
        width: '100%',
        minWidth: 0,
        overflow: 'hidden'
      }
    },
      isEditing ? (
        // Edit mode
        React.createElement(SenseEditForm, {
          editForm: editForm,
          isSaving: isSaving,
          meaningsLength: meaningsLength,
          editingIndex: index,
          onSave: onSave,
          onCancel: onCancel,
          onDelete: onDelete,
          onFormChange: onFormChange,
          POS_OPTIONS: posOptions
        })
      ) : (
        // Display mode
        React.createElement(SenseDisplay, {
          meaning: meaning,
          languageMode: languageMode,
          onClick: () => onStartEdit(index),
          index: index,
          onDelete: onDelete,
          meaningsLength: meaningsLength,
          isEditing: isEditing,
          isSaving: isSaving
        })
      )
    )
  );
}

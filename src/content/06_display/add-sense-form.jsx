/**
 * AddSenseForm - Form for adding a new meaning (presentational only)
 * Uses descriptionThai/descriptionEnglish fields only (no legacy english/definition)
 */

import React from 'react';
import { POS_OPTIONS } from './sense-constants.js';

export function AddSenseForm({ editForm, isSaving, onSave, onCancel, onFormChange, POS_OPTIONS: posOptions }) {
  return React.createElement('div', {
    style: {
      padding: '12px',
      backgroundColor: 'rgba(255, 215, 0, 0.1)',
      border: '2px dashed rgba(255, 215, 0, 0.5)',
      borderRadius: '4px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }
  },
    // Meaning (Thai) - compact gloss
    React.createElement('input', {
      key: 'meaning-thai-input-add',
      type: 'text',
      value: editForm.meaningThai || '',
      onChange: onFormChange.handleMeaningThaiChange,
      placeholder: 'Meaning (Thai) - compact gloss',
      style: {
        padding: '6px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        border: '1px solid #FFD700',
        borderRadius: '4px',
        color: '#FFFFFF',
        fontSize: '14px'
      }
    }),
    // Meaning (English) - compact gloss
    React.createElement('input', {
      key: 'meaning-english-input-add',
      type: 'text',
      value: editForm.meaningEnglish || '',
      onChange: onFormChange.handleMeaningEnglishChange,
      placeholder: 'Meaning (English) - compact gloss',
      style: {
        padding: '6px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        border: '1px solid #FFD700',
        borderRadius: '4px',
        color: '#FFFFFF',
        fontSize: '14px'
      }
    }),
    // Description (Thai)
    React.createElement('textarea', {
      key: 'description-thai-textarea-add',
      value: editForm.descriptionThai,
      onChange: onFormChange.handleDescriptionThaiChange,
      placeholder: 'Description (Thai)',
      rows: 3,
      style: {
        padding: '6px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        border: '1px solid #FFD700',
        borderRadius: '4px',
        color: '#FFFFFF',
        fontSize: '14px',
        resize: 'vertical',
        fontFamily: 'inherit'
      }
    }),
    // Description (English)
    React.createElement('textarea', {
      key: 'description-english-textarea-add',
      value: editForm.descriptionEnglish,
      onChange: onFormChange.handleDescriptionEnglishChange,
      placeholder: 'Description (English)',
      rows: 3,
      style: {
        padding: '6px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        border: '1px solid #FFD700',
        borderRadius: '4px',
        color: '#FFFFFF',
        fontSize: '14px',
        resize: 'vertical',
        fontFamily: 'inherit'
      }
    }),
    // POS (Thai)
    React.createElement('select', {
      key: 'pos-select-add',
      value: editForm.pos,
      onChange: onFormChange.handlePosChange,
      style: {
        padding: '6px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        border: '1px solid #FFD700',
        borderRadius: '4px',
        color: '#FFFFFF',
        fontSize: '14px'
      }
    },
      posOptions.map(option => 
        React.createElement('option', {
          key: option || 'empty',
          value: option
        }, option || 'Select POS...')
      )
    ),
    // POS (English)
    React.createElement('input', {
      key: 'pos-english-input-add',
      type: 'text',
      value: editForm.posEnglish,
      onChange: onFormChange.handlePosEnglishChange,
      placeholder: 'POS (English)',
      style: {
        padding: '6px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        border: '1px solid #FFD700',
        borderRadius: '4px',
        color: '#FFFFFF',
        fontSize: '14px'
      }
    }),
    React.createElement('div', {
      style: {
        display: 'flex',
        gap: '8px'
      }
    },
      React.createElement('button', {
        onClick: onSave,
        disabled: isSaving,
        style: {
          padding: '6px 12px',
          backgroundColor: '#FFD700',
          border: 'none',
          borderRadius: '4px',
          color: '#000000',
          cursor: isSaving ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: 'bold'
        }
      }, 'Save'),
      React.createElement('button', {
        onClick: onCancel,
        disabled: isSaving,
        style: {
          padding: '6px 12px',
          backgroundColor: 'transparent',
          border: '1px solid #FFD700',
          borderRadius: '4px',
          color: '#FFD700',
          cursor: isSaving ? 'not-allowed' : 'pointer',
          fontSize: '14px'
        }
      }, 'Cancel')
    )
  );
}

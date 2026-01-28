/**
 * SenseEditForm - Form for editing an existing sense (presentational only)
 */

import React from 'react';
import { POS_OPTIONS } from './sense-constants.js';

export function SenseEditForm({ editForm, isSaving, meaningsLength, editingIndex, onSave, onCancel, onDelete, onFormChange, POS_OPTIONS: posOptions }) {
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      width: '100%'
    }
  },
    // Meaning (Thai) - compact gloss
    React.createElement('div', {
      style: { display: 'flex', flexDirection: 'column', gap: '4px' }
    },
      React.createElement('label', {
        style: {
          fontSize: '12px',
          textTransform: 'uppercase',
          color: '#888888',
          letterSpacing: '0.5px'
        }
      }, 'Meaning (Thai)'),
      React.createElement('input', {
        key: 'meaning-thai-input-edit',
        type: 'text',
        value: editForm.meaningThai || '',
        onChange: onFormChange.handleMeaningThaiChange,
        placeholder: 'Compact gloss word/phrase',
        style: {
          padding: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          border: '1px solid #FFD700',
          borderRadius: '4px',
          color: '#FFFFFF',
          fontSize: '14px'
        }
      })
    ),
    // Meaning (English) - compact gloss
    React.createElement('div', {
      style: { display: 'flex', flexDirection: 'column', gap: '4px' }
    },
      React.createElement('label', {
        style: {
          fontSize: '12px',
          textTransform: 'uppercase',
          color: '#888888',
          letterSpacing: '0.5px'
        }
      }, 'Meaning (English)'),
      React.createElement('input', {
        key: 'meaning-english-input-edit',
        type: 'text',
        value: editForm.meaningEnglish || '',
        onChange: onFormChange.handleMeaningEnglishChange,
        placeholder: 'Compact gloss word/phrase',
        style: {
          padding: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          border: '1px solid #FFD700',
          borderRadius: '4px',
          color: '#FFFFFF',
          fontSize: '14px'
        }
      })
    ),
    // Thai Description
    React.createElement('div', {
      style: { display: 'flex', flexDirection: 'column', gap: '4px' }
    },
      React.createElement('label', {
        style: {
          fontSize: '12px',
          textTransform: 'uppercase',
          color: '#888888',
          letterSpacing: '0.5px'
        }
      }, 'Description (Thai)'),
      React.createElement('textarea', {
        key: 'description-thai-textarea-edit',
        value: editForm.descriptionThai,
        onChange: onFormChange.handleDescriptionThaiChange,
        placeholder: 'Thai description/definition',
        rows: 3,
        style: {
          padding: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          border: '1px solid #FFD700',
          borderRadius: '4px',
          color: '#FFFFFF',
          fontSize: '14px',
          resize: 'vertical',
          fontFamily: 'inherit'
        }
      })
    ),
    // English Description
    React.createElement('div', {
      style: { display: 'flex', flexDirection: 'column', gap: '4px' }
    },
      React.createElement('label', {
        style: {
          fontSize: '12px',
          textTransform: 'uppercase',
          color: '#888888',
          letterSpacing: '0.5px'
        }
      }, 'Description (English)'),
      React.createElement('textarea', {
        key: 'description-english-textarea-edit',
        value: editForm.descriptionEnglish,
        onChange: onFormChange.handleDescriptionEnglishChange,
        placeholder: 'English description/definition',
        rows: 3,
        style: {
          padding: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          border: '1px solid #FFD700',
          borderRadius: '4px',
          color: '#FFFFFF',
          fontSize: '14px',
          resize: 'vertical',
          fontFamily: 'inherit'
        }
      })
    ),
    // Thai POS
    React.createElement('div', {
      style: { display: 'flex', flexDirection: 'column', gap: '4px' }
    },
      React.createElement('label', {
        style: {
          fontSize: '12px',
          textTransform: 'uppercase',
          color: '#888888',
          letterSpacing: '0.5px'
        }
      }, 'POS (Thai)'),
      React.createElement('select', {
        key: 'pos-select-edit',
        value: editForm.pos,
        onChange: onFormChange.handlePosChange,
        style: {
          padding: '8px',
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
      )
    ),
    // English POS
    React.createElement('div', {
      style: { display: 'flex', flexDirection: 'column', gap: '4px' }
    },
      React.createElement('label', {
        style: {
          fontSize: '12px',
          textTransform: 'uppercase',
          color: '#888888',
          letterSpacing: '0.5px'
        }
      }, 'POS (English)'),
      React.createElement('input', {
        key: 'pos-english-input-edit',
        type: 'text',
        value: editForm.posEnglish,
        onChange: onFormChange.handlePosEnglishChange,
        placeholder: 'noun, verb, adjective, etc.',
        style: {
          padding: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          border: '1px solid #FFD700',
          borderRadius: '4px',
          color: '#FFFFFF',
          fontSize: '14px'
        }
      })
    ),
    React.createElement('div', {
      style: {
        display: 'flex',
        gap: '8px',
        marginTop: '8px'
      }
    },
      React.createElement('button', {
        onClick: onSave,
        disabled: isSaving,
        style: {
          padding: '8px 16px',
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
          padding: '8px 16px',
          backgroundColor: 'transparent',
          border: '1px solid #FFD700',
          borderRadius: '4px',
          color: '#FFD700',
          cursor: isSaving ? 'not-allowed' : 'pointer',
          fontSize: '14px'
        }
      }, 'Cancel'),
      meaningsLength > 1 && React.createElement('button', {
        onClick: () => onDelete(editingIndex),
        disabled: isSaving,
        style: {
          padding: '8px 16px',
          backgroundColor: 'transparent',
          border: '1px solid #FF4444',
          borderRadius: '4px',
          color: '#FF4444',
          cursor: isSaving ? 'not-allowed' : 'pointer',
          fontSize: '14px'
        }
      }, 'Delete')
    )
  );
}

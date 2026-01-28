/**
 * SenseDisplay - Display view of a sense (read-only, presentational)
 * Shows sense fields based on language mode
 */

import React from 'react';

export function SenseDisplay({ meaning, languageMode, onClick, index, onDelete, meaningsLength, isEditing, isSaving }) {
  // Helper function to capitalize first letter
  const capitalizeFirstLetter = (str) => {
    if (!str || typeof str !== 'string') return str;
    const trimmed = str.trim();
    if (trimmed.length === 0) return str;
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  };
  
  // Helper function to render a field row (inline: label: value with wrapping)
  const renderFieldRow = (label, value) => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return null;
    }
    const capitalizedValue = capitalizeFirstLetter(value);
    return React.createElement('div', {
      key: label,
      style: {
        width: '100%',
        minWidth: 0,
        lineHeight: '1.5',
        wordWrap: 'break-word',
        overflowWrap: 'break-word',
        fontSize: '14px',
        color: '#FFFFFF'
      }
    },
      // Label with colon (inline, doesn't wrap)
      React.createElement('span', {
        style: {
          fontSize: '12px',
          color: '#888888',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          whiteSpace: 'nowrap',
          marginRight: '4px'
        }
      }, `${label}:`),
      // Value (wraps naturally underneath label when long)
      capitalizedValue
    );
  };
  
  const rows = [];
  
  if (languageMode === 'english') {
    // MEANING first (compact gloss for quick scanning)
    if (meaning.meaningEnglish) {
      rows.push(renderFieldRow('MEANING', meaning.meaningEnglish));
    }
    // DESCRIPTION second (short clarification)
    if (meaning.descriptionEnglish) {
      rows.push(renderFieldRow('DESCRIPTION', meaning.descriptionEnglish));
    }
    // POS last - custom row with sense number and delete button
    const posValue = meaning.posEnglish || meaning.pos;
    if (posValue) {
      rows.push(renderPOSRowWithControls('POS', posValue));
    }
  } else {
    // MEANING first (compact gloss for quick scanning)
    if (meaning.meaningThai) {
      rows.push(renderFieldRow('MEANING', meaning.meaningThai));
    }
    // DESCRIPTION second (short clarification)
    if (meaning.descriptionThai) {
      rows.push(renderFieldRow('DESCRIPTION', meaning.descriptionThai));
    }
    // POS last - custom row with sense number and delete button
    const posValue = meaning.pos || meaning.posEnglish;
    if (posValue) {
      rows.push(renderPOSRowWithControls('POS', posValue));
    }
  }
  
  // Helper function to render POS row with sense number and delete button
  function renderPOSRowWithControls(label, value) {
    const capitalizedValue = capitalizeFirstLetter(value);
    return React.createElement('div', {
      key: label,
      style: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        flexWrap: 'nowrap'
      }
    },
      // Left group: POS label | POS value (can wrap, but won't push right group off screen)
      React.createElement('div', {
        style: {
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '8px',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden'
        }
      },
        // POS label
        React.createElement('span', {
          style: {
            fontSize: '12px',
            color: '#888888',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }
        }, label),
        // POS value (can wrap if long, but constrained to not push right group off screen)
        React.createElement('span', {
          style: {
            fontSize: '14px',
            color: '#FFFFFF',
            lineHeight: '1.5',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            minWidth: 0
          }
        }, capitalizedValue)
      ),
      // Right group: Sense number | Delete button (delete button anchored to right edge)
      React.createElement('div', {
        style: {
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '0px',
          flexShrink: 0,
          marginLeft: '8px'
        }
      },
        // Sense number (immediately left of delete button)
        React.createElement('span', {
          style: {
            fontSize: '14px',
            color: '#FFFFFF',
            fontWeight: 'bold',
            marginRight: meaningsLength > 1 && !isEditing ? '2px' : '0'
          }
        }, index !== undefined ? index + 1 : ''),
        // Delete button (anchored to right edge, always visible)
        meaningsLength > 1 && !isEditing ? React.createElement('button', {
          onClick: (e) => {
            e.stopPropagation(); // Prevent triggering onClick on parent
            if (onDelete && index !== undefined) {
              onDelete(index);
            }
          },
          disabled: isSaving,
          style: {
            fontSize: '14px',
            color: '#FF4444',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            padding: '0',
            margin: '0',
            lineHeight: '1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          },
          title: 'Delete meaning'
        }, '×') : null
      )
    );
  }
  
  // If no fields to display, show "Click to edit"
  if (rows.length === 0) {
    return React.createElement('div', {
      style: {
        fontSize: '14px',
        color: '#888888',
        fontStyle: 'italic'
      }
    }, 'Click to edit');
  }
  
  return React.createElement('div', {
    onClick: onClick,
    style: {
      cursor: 'pointer',
      width: '100%',
      minWidth: 0,
      overflow: 'hidden'
    }
  },
    React.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '100%',
        minWidth: 0
      }
    },
      rows
    )
  );
}

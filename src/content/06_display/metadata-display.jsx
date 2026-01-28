/**
 * Metadata Display Component
 * Shows ThaiWords data in a table format below subtitle
 * Used in user mode (not a popup)
 */

import React from 'react';

export function MetadataDisplay({ wordData }) {
  if (!wordData) return null;

  return React.createElement('div', {
    style: {
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      border: '2px solid #FFD700',
      borderRadius: '8px',
      padding: '12px',
      marginTop: '16px',
      minWidth: '300px',
      maxWidth: '500px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
    }
  },
    React.createElement('table', {
      style: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '12px',
        color: '#FFFFFF'
      }
    },
      // Header
      React.createElement('thead', null,
        React.createElement('tr', {
          style: {
            borderBottom: '1px solid #FFD700',
            marginBottom: '8px'
          }
        },
          React.createElement('th', {
            style: {
              textAlign: 'left',
              padding: '4px 8px',
              color: '#FFD700',
              fontWeight: 'bold'
            }
          }, 'Field'),
          React.createElement('th', {
            style: {
              textAlign: 'left',
              padding: '4px 8px',
              color: '#FFD700',
              fontWeight: 'bold'
            }
          }, 'Value')
        )
      ),
      // Body
      React.createElement('tbody', null,
        wordData.thaiScript && React.createElement('tr', null,
          React.createElement('td', { style: { padding: '4px 8px', color: '#AAAAAA' } }, 'Thai Script'),
          React.createElement('td', { style: { padding: '4px 8px' } }, wordData.thaiScript)
        ),
        wordData.english && React.createElement('tr', null,
          React.createElement('td', { style: { padding: '4px 8px', color: '#AAAAAA' } }, 'English'),
          React.createElement('td', { style: { padding: '4px 8px' } }, wordData.english)
        ),
        wordData.englishPhonetic && React.createElement('tr', null,
          React.createElement('td', { style: { padding: '4px 8px', color: '#AAAAAA' } }, 'Phonetic'),
          React.createElement('td', { style: { padding: '4px 8px', color: '#61dafb' } }, wordData.englishPhonetic)
        ),
        wordData.meanings && Array.isArray(wordData.meanings) && wordData.meanings.length > 0 && React.createElement('tr', null,
          React.createElement('td', { style: { padding: '4px 8px', color: '#AAAAAA', verticalAlign: 'top' } }, 'Meanings'),
          React.createElement('td', { style: { padding: '4px 8px' } },
            React.createElement('div', {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                maxHeight: '200px',
                overflowY: 'auto'
              }
            },
              wordData.meanings.map((meaning, idx) => React.createElement('div', {
                key: idx,
                style: {
                  padding: '4px',
                  backgroundColor: 'rgba(255, 215, 0, 0.1)',
                  borderRadius: '2px',
                  fontSize: '11px'
                }
              },
                meaning.english && React.createElement('div', { style: { fontWeight: 'bold', color: '#FFD700' } }, meaning.english),
                meaning.pos && React.createElement('div', { style: { color: '#AAAAAA' } }, `POS: ${meaning.pos}`),
                meaning.definition && React.createElement('div', { style: { color: '#CCCCCC', marginTop: '2px' } }, meaning.definition)
              ))
            )
          )
        ),
        wordData.status && React.createElement('tr', null,
          React.createElement('td', { style: { padding: '4px 8px', color: '#AAAAAA' } }, 'Status'),
          React.createElement('td', { style: { padding: '4px 8px' } }, wordData.status)
        )
      )
    )
  );
}


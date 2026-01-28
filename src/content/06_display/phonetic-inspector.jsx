/**
 * Phonetic Inspector Component
 * Panel for inspecting and editing token-level phonetic data
 * Appears in user mode below ThaiSubUser (replaces SenseSelection position)
 */

import React, { useState, useRef, useEffect } from 'react';
import { parsePhoneticToEnglish } from '../03_process/helpers/03_phonetics/phonetic-parser.js';

/**
 * Extract vowel+tone from a G2P syllable
 * Finds vowel token that includes/ends with tone digit (0-4)
 * @param {string} syllable - G2P syllable (e.g., "w-aa2", "s-v1-k^", "ii0")
 * @returns {{vowel: string, tone: number|null}} Vowel token (includes digit) and tone digit
 */
function extractVowelTone(syllable) {
  if (!syllable || typeof syllable !== 'string') {
    return { vowel: '', tone: null };
  }
  
  // Look for vowel pattern ending with digit 0-4
  // Pattern: one or more lowercase letters followed by digit 0-4 (not followed by another digit)
  // Examples: "aa2", "v1", "ii0", "uu3"
  // Find all matches and take the last one (most likely the vowel+tone)
  let lastMatch = null;
  let searchIndex = 0;
  
  while (true) {
    const match = syllable.substring(searchIndex).match(/([a-z]+)([0-4])(?![0-9])/);
    if (!match) break;
    
    lastMatch = {
      full: match[0], // Full match including digit (e.g., "aa2", "v1")
      vowel: match[1], // Vowel part (e.g., "aa", "v")
      tone: parseInt(match[2], 10), // Tone digit (0-4)
      index: searchIndex + match.index
    };
    
    searchIndex += match.index + match[0].length;
  }
  
  if (lastMatch) {
    // Return vowel token that includes the tone digit (e.g., "aa2", "v1")
    return { vowel: lastMatch.full, tone: lastMatch.tone };
  }
  
  // No tone digit found - default to tone 0 (Mid)
  return { vowel: '', tone: 0 };
}

/**
 * Parse G2P string into syllables and extract vowel+tone for each
 * Handles '*' by appending it to previous syllable instead of creating separate syllable
 * @param {string} g2p - G2P string (e.g., "w-aa2|*" or "s-v1-k^")
 * @returns {Array<{raw: string, vowel: string, tone: number|null, hasAsterisk: boolean}>} Array of syllable objects with vowel+tone
 */
function parseG2PVowelTone(g2p) {
  if (!g2p || typeof g2p !== 'string' || g2p.trim() === '') {
    return [];
  }
  
  // Split by | delimiter (syllables)
  const rawSyllables = g2p.split('|').map(s => s.trim()).filter(s => s);
  
  // Process syllables, handling '*' by appending to previous
  const processedSyllables = [];
  let asteriskSuffix = '';
  
  for (let i = 0; i < rawSyllables.length; i++) {
    const syllable = rawSyllables[i];
    
    // If this is just '*', append it to previous syllable or save for later
    if (syllable === '*') {
      if (processedSyllables.length > 0) {
        // Append to previous syllable
        const prev = processedSyllables[processedSyllables.length - 1];
        prev.raw = prev.raw + '|*';
        prev.hasAsterisk = true;
      } else {
        // No previous syllable - save for inline display in raw G2P only
        asteriskSuffix = '|*';
      }
      continue;
    }
    
    // Regular syllable
    const syllableWithSuffix = syllable + asteriskSuffix;
    const hasAsterisk = asteriskSuffix !== '';
    asteriskSuffix = ''; // Reset after appending
    
    // Extract vowel+tone from this syllable
    const { vowel, tone } = extractVowelTone(syllableWithSuffix);
    
    processedSyllables.push({
      raw: syllableWithSuffix,
      vowel: vowel || '(unknown)',
      tone: tone,
      hasAsterisk: hasAsterisk
    });
  }
  
  return processedSyllables;
}

/**
 * Parse G2P string into syllables and segment each syllable
 * Handles '*' by appending it to previous syllable instead of creating separate syllable
 * @param {string} g2p - G2P string (e.g., "w-aa2|*" or "s-v1-k^")
 * @returns {Array<{raw: string, parts: Array<string>, hasAsterisk: boolean}>} Array of syllable objects
 */
function parseG2PShape(g2p) {
  if (!g2p || typeof g2p !== 'string' || g2p.trim() === '') {
    return [];
  }
  
  // Split by | delimiter (syllables)
  const rawSyllables = g2p.split('|').map(s => s.trim()).filter(s => s);
  
  // Process syllables, handling '*' by appending to previous
  const processedSyllables = [];
  let asteriskSuffix = '';
  
  for (let i = 0; i < rawSyllables.length; i++) {
    const syllable = rawSyllables[i];
    
    // If this is just '*', append it to previous syllable or save for later
    if (syllable === '*') {
      if (processedSyllables.length > 0) {
        // Append to previous syllable
        const prev = processedSyllables[processedSyllables.length - 1];
        prev.raw = prev.raw + '|*';
        prev.hasAsterisk = true;
      } else {
        // No previous syllable - save for inline display in raw G2P only
        asteriskSuffix = '|*';
      }
      continue;
    }
    
    // Regular syllable
    const processed = {
      raw: syllable + asteriskSuffix,
      hasAsterisk: asteriskSuffix !== ''
    };
    asteriskSuffix = ''; // Reset after appending
    
    // Basic segmentation: split by obvious delimiters
    // Look for patterns: hyphen (-), trailing digits, caret (^)
    const parts = [];
    let currentPart = '';
    let j = 0;
    const syllableToSegment = processed.raw;
    
    while (j < syllableToSegment.length) {
      const char = syllableToSegment[j];
      
      // Hyphen delimiter - start new part
      if (char === '-') {
        if (currentPart) {
          parts.push(currentPart);
          currentPart = '';
        }
        j++;
        continue;
      }
      
      // Digit - could be tone marker, add to current part
      if (/[0-9]/.test(char)) {
        currentPart += char;
        j++;
        continue;
      }
      
      // Caret (^) - coda marker, add to current part
      if (char === '^') {
        currentPart += char;
        j++;
        continue;
      }
      
      // Regular character
      currentPart += char;
      j++;
    }
    
    // Add remaining part
    if (currentPart) {
      parts.push(currentPart);
    }
    
    processed.parts = parts.length > 0 ? parts : [syllableToSegment];
    processedSyllables.push(processed);
  }
  
  return processedSyllables;
}

export function PhoneticInspector({ subtitle, selectedWordIndex, displayTokens, onSavePhonetic }) {
  // Editing state for English Phonetic
  const [isEditingPhonetic, setIsEditingPhonetic] = useState(false);
  const [editedPhoneticValue, setEditedPhoneticValue] = useState('');
  const phoneticInputRef = useRef(null);
  
  // Extract token data when selected
  let tokenData = null;
  if (selectedWordIndex !== null && subtitle?.tokens?.displayThai) {
    const displayToken = subtitle.tokens.displayThai[selectedWordIndex];
    if (displayToken) {
      tokenData = {
        index: selectedWordIndex,
        thaiScript: displayToken.thaiScript || null,
        englishPhonetic: displayToken.englishPhonetic || null,
        g2p: displayToken.g2p || null
      };
    }
  }
  
  // Reset editing state when selected token changes
  useEffect(() => {
    setIsEditingPhonetic(false);
    setEditedPhoneticValue('');
  }, [selectedWordIndex]);
  
  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingPhonetic && phoneticInputRef.current) {
      phoneticInputRef.current.focus();
      phoneticInputRef.current.select();
    }
  }, [isEditingPhonetic]);
  
  // Handle starting edit mode
  const handleStartEditPhonetic = () => {
    if (!tokenData) return;
    const currentPhonetic = tokenData.englishPhonetic || '';
    setEditedPhoneticValue(parsePhoneticToEnglish(currentPhonetic));
    setIsEditingPhonetic(true);
  };
  
  // Handle saving edited phonetic
  const handleSavePhonetic = async () => {
    if (!onSavePhonetic || !tokenData) return;
    
    const trimmedValue = editedPhoneticValue.trim();
    await onSavePhonetic(tokenData.index, trimmedValue);
    
    setIsEditingPhonetic(false);
    setEditedPhoneticValue('');
  };
  
  // Handle canceling edit
  const handleCancelEditPhonetic = () => {
    setIsEditingPhonetic(false);
    setEditedPhoneticValue('');
  };
  
  // Parse G2P if available - extract vowel+tone per syllable
  const g2pVowelTones = tokenData?.g2p ? parseG2PVowelTone(tokenData.g2p) : [];
  const rawG2P = tokenData?.g2p || '';
  
  // Tone options for dropdown
  const toneOptions = [
    { value: '', label: '' },
    { value: '0', label: 'Mid' },
    { value: '1', label: 'Low' },
    { value: '2', label: 'Falling' },
    { value: '3', label: 'High' },
    { value: '4', label: 'Rising' }
  ];
  
  // Copy-paste CSS properties
  const copyPasteStyle = {
    userSelect: 'text',
    WebkitUserSelect: 'text',
    MozUserSelect: 'text',
    msUserSelect: 'text'
  };
  
  return React.createElement('div', {
    style: {
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      border: '2px solid #FFD700',
      borderRadius: '8px',
      padding: '16px',
      marginTop: '16px',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      overflowX: 'hidden'
    }
  },
    // Header
    React.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid rgba(255, 215, 0, 0.3)'
      }
    },
      React.createElement('h3', {
        style: {
          color: '#FFD700',
          fontSize: '18px',
          fontWeight: 'bold',
          margin: 0
        }
      }, 'Phonetic Inspector')
    ),
    
    // Body content
    tokenData === null ? (
      // No token selected
      React.createElement('div', {
        style: {
          color: '#CCCCCC',
          fontSize: '14px',
          textAlign: 'center',
          padding: '20px'
        }
      }, 'Select a token above')
    ) : (
      // Token data display - 2-column grid layout
      React.createElement('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: '140px 1fr',
          gap: '8px 16px',
          alignItems: 'start'
        }
      },
        // Token Index Label
        React.createElement('div', {
          style: {
            color: '#AAAAAA',
            fontSize: '11px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            paddingTop: '2px'
          }
        }, 'Token Index'),
        // Token Index Value
        React.createElement('div', {
          style: {
            color: '#FFD700',
            fontSize: '14px',
            fontFamily: 'monospace',
            ...copyPasteStyle
          }
        }, tokenData.index),
        
        // Thai Script Label
        React.createElement('div', {
          style: {
            color: '#AAAAAA',
            fontSize: '11px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            paddingTop: '2px'
          }
        }, 'Thai Script'),
        // Thai Script Value
        React.createElement('div', {
          style: {
            color: '#FFD700',
            fontSize: '18px',
            fontWeight: '600',
            ...copyPasteStyle
          }
        }, tokenData.thaiScript || '(missing)'),
        
        // English Phonetic Label
        React.createElement('div', {
          style: {
            color: '#AAAAAA',
            fontSize: '11px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            paddingTop: '2px'
          }
        }, 'English Phonetic'),
        // English Phonetic Value (editable)
        isEditingPhonetic ? (
          React.createElement('input', {
            ref: phoneticInputRef,
            type: 'text',
            value: editedPhoneticValue,
            onChange: (e) => setEditedPhoneticValue(e.target.value),
            onKeyDown: (e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSavePhonetic();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancelEditPhonetic();
              }
            },
            onBlur: () => {
              // Auto-save on blur if value changed
              const trimmedValue = editedPhoneticValue.trim();
              const originalValue = tokenData.englishPhonetic ? parsePhoneticToEnglish(tokenData.englishPhonetic) : '';
              if (trimmedValue !== originalValue && trimmedValue) {
                handleSavePhonetic();
              } else {
                handleCancelEditPhonetic();
              }
            },
            style: {
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              border: '2px solid rgba(255, 215, 0, 0.8)',
              borderRadius: '4px',
              color: '#CCCCCC',
              fontSize: '14px',
              fontFamily: 'monospace',
              padding: '4px 6px',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
              ...copyPasteStyle
            }
          })
        ) : (
          React.createElement('div', {
            onClick: handleStartEditPhonetic,
            style: {
              color: tokenData.englishPhonetic ? '#CCCCCC' : '#888888',
              fontSize: '14px',
              fontFamily: 'monospace',
              fontStyle: tokenData.englishPhonetic ? 'normal' : 'italic',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: '4px',
              transition: 'background-color 0.2s',
              ...copyPasteStyle
            },
            onMouseEnter: (e) => {
              e.target.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
            },
            onMouseLeave: (e) => {
              e.target.style.backgroundColor = 'transparent';
            },
            title: 'Click to edit'
          }, tokenData.englishPhonetic ? parsePhoneticToEnglish(tokenData.englishPhonetic) : '(missing)')
        ),
        
        // G2P Label
        React.createElement('div', {
          style: {
            color: '#AAAAAA',
            fontSize: '11px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            paddingTop: '2px'
          }
        }, 'G2P'),
        // G2P Value
        tokenData.g2p ? (
          React.createElement('div', {
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }
          },
            // Raw G2P string (with inline '*' if standalone)
            React.createElement('div', {
              style: {
                color: '#CCCCCC',
                fontSize: '12px',
                fontFamily: 'monospace',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                padding: '4px 6px',
                borderRadius: '4px',
                marginBottom: '4px',
                ...copyPasteStyle
              }
            }, rawG2P),
            
            // Vowel+Tone rows
            g2pVowelTones.length > 0 ? (
              React.createElement('div', {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }
              },
                g2pVowelTones.map((syllable, idx) => 
                  React.createElement('div', {
                    key: idx,
                    style: {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }
                  },
                    // G2P Vowel text
                    React.createElement('div', {
                      style: {
                        color: '#CCCCCC',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        ...copyPasteStyle
                      }
                    }, syllable.vowel),
                    // Tone dropdown
                    React.createElement('select', {
                      defaultValue: String(syllable.tone),
                      disabled: true, // Read-only
                      style: {
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 215, 0, 0.3)',
                        borderRadius: '4px',
                        color: '#CCCCCC',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        padding: '4px 6px',
                        cursor: 'not-allowed',
                        outline: 'none',
                        ...copyPasteStyle
                      }
                    },
                      toneOptions.filter(opt => opt.value !== '').map(option =>
                        React.createElement('option', {
                          key: option.value,
                          value: option.value
                        }, `${option.value} = ${option.label}`)
                      )
                    )
                  )
                )
              )
            ) : null
          )
        ) : (
          React.createElement('div', {
            style: {
              color: '#888888',
              fontSize: '14px',
              fontStyle: 'italic'
            }
          }, '(missing)')
        )
      )
    )
  );
}


/**
 * Thai Subtitle User Component
 * User mode: Uses thaiSplitIds to display phonetics when meaning is selected
 * Shows ONE subtitle at a time with metadata-display below
 * For end users viewing subtitles
 */

import React from 'react';
import { parsePhoneticToEnglish } from '../03_process/helpers/03_phonetics/phonetic-parser.js';
import { parseWordReference } from '../03_process/helpers/02_tokenization/word-reference-utils.js';

export function ThaiSubUser({ displayTokens, senseTokens, selectedWordIndex: selectedWordIndexProp = null, onSelectionChange, onProcessPhonetic, subtitle, onSavePhonetic }) {
  const selectedWordIndex = selectedWordIndexProp;

  // Early return AFTER all hooks are called
  if (!displayTokens || displayTokens.length === 0) {
    return React.createElement('div', {
      style: {
        color: '#FFD700',
        fontSize: '32px',
        fontWeight: '600',
        padding: '8px 0',
        opacity: 0.2,
        textAlign: 'center'
      }
    }, '—');
  }

  const textColor = '#FFD700';
  const englishTextColor = '#B0B0B0';

  // Extract English tokens from subtitle
  const englishDisplayTokens = subtitle?.tokens?.displayEnglish || [];
  
  // Get thaiScript for a token from subtitle (use fat subtitle structure)
  const getThaiScriptForToken = (tokenIndex) => {
    if (!subtitle || !subtitle.tokens?.displayThai) return null;
    
    const displayToken = subtitle.tokens.displayThai[tokenIndex];
    return displayToken?.thaiScript || null;
  };

  return React.createElement(React.Fragment, null,
    // Thai subtitle text with phonetics display
    React.createElement('div', {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        alignItems: 'center',
        fontSize: '32px',
        fontWeight: '600',
        lineHeight: '1.6',
        color: textColor,
        padding: '8px 0'
      }
    },
      displayTokens.map((token, index) => {
        // Filter out empty tokens (text starts with [empty: or [missing:)
        if (!token) return null;
        if (token.thaiScript && (token.thaiScript.startsWith('[empty:') || token.thaiScript.startsWith('[missing:'))) {
          return null; // Don't render empty tokens
        }
        
        const isSelected = selectedWordIndex === index;
        const isFailedWord = token.orstFailed || false;
        
        // Get display value: englishPhonetic if present, otherwise thaiScript
        const englishPhonetic = token.englishPhonetic;
        const thaiScript = getThaiScriptForToken(index);
        const hasPhonetic = englishPhonetic && englishPhonetic.trim();
        const displayValue = hasPhonetic ? parsePhoneticToEnglish(englishPhonetic) : (thaiScript || token.text);
        const showRedBackground = !hasPhonetic && thaiScript;
        
        // Color: red for failed words, otherwise gold
        const tokenColor = isFailedWord ? '#FF6666' : textColor;
        // Border: red for failed words, otherwise default
        const tokenBorder = isFailedWord 
          ? '2px solid rgba(255, 0, 0, 0.6)' 
          : '1px solid rgba(255, 255, 255, 0.2)';
        
        // Display mode: Show span (clickable for selection only, no editing)
        return React.createElement('span', {
          key: index,
          onClick: () => {
            if (onSelectionChange) {
              onSelectionChange(index);
            }
          },
          style: {
            cursor: 'pointer',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '32px',
            fontWeight: '600',
            backgroundColor: showRedBackground 
              ? 'rgba(255, 0, 0, 0.3)' 
              : isSelected 
                ? 'rgba(255, 215, 0, 0.2)' 
                : 'rgba(0, 0, 0, 0.1)',
            border: tokenBorder,
            transition: 'all 0.2s',
            display: 'inline-block',
            color: tokenColor,
            minWidth: '40px',
            textAlign: 'center',
            userSelect: 'text',
            WebkitUserSelect: 'text',
            MozUserSelect: 'text',
            msUserSelect: 'text'
          }
        }, displayValue);
      })
    ),
    // English tokens row (below Thai tokens)
    englishDisplayTokens.length > 0 && React.createElement('div', {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        alignItems: 'center',
        fontSize: '24px',
        fontWeight: '600',
        lineHeight: '1.6',
        color: englishTextColor,
        padding: '4px 0'
      }
    },
      englishDisplayTokens.map((token, index) => {
        // Filter out empty/missing English tokens
        if (!token) return null;
        const englishWord = token.englishWord || '';
        if (englishWord.startsWith('[empty:') || englishWord.startsWith('[missing:')) {
          return null; // Don't render empty tokens
        }
        if (!englishWord || englishWord.trim() === '') {
          return null; // Skip tokens without englishWord
        }
        
        const isFailedWord = token.orstFailed || false;
        
        // Color: red for failed words, otherwise gray
        const tokenColor = isFailedWord ? '#FF6666' : englishTextColor;
        // Border: red for failed words, otherwise subtle gray
        const tokenBorder = isFailedWord 
          ? '2px solid rgba(255, 0, 0, 0.6)' 
          : '1px solid rgba(176, 176, 176, 0.3)';
        
        // English tokens are read-only (not clickable)
        return React.createElement('span', {
          key: index,
          style: {
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '24px',
            fontWeight: '600',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            border: tokenBorder,
            transition: 'all 0.2s',
            display: 'inline-block',
            color: tokenColor,
            minWidth: '40px',
            textAlign: 'center',
            userSelect: 'text',
            WebkitUserSelect: 'text',
            MozUserSelect: 'text',
            msUserSelect: 'text'
          }
        }, englishWord);
      })
    )
  );
}

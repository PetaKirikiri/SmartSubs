/**
 * Thai Subtitle Editor Component
 * Editor mode: Uses thaiSplitIds to reference ThaiWords/thaiScript
 * Shows ONE subtitle at a time with sense-selection below (inline, not modal)
 * Uses keyboard 0-9 to select senses
 * Updates thaiSplitIds to ref:x format when sense is selected
 * For Thai staff member doing sense selection
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { SenseSelection } from './sense-selection.jsx';

export function ThaiSubEditor({ subtitle, selectedWordIndex: selectedWordIndexProp, senseSelectedIndices, onSelectionChange, onSenseSelected, onMeaningEdited, onReprocessMeaning, onSensesNormalized, isEditMode, editText, onEditTextChange, editInputRef, onSaveEdit, showName, episode, season, mediaId }) {
  const selectedWordIndex = selectedWordIndexProp;
  
  // Extract from fat subtitle
  const displayTokens = subtitle?.tokens?.displayThai || [];
  const senseTokens = subtitle?.tokens?.sensesThai || [];
  const englishDisplayTokens = subtitle?.tokens?.displayEnglish || [];
  const wordReferenceIdsThai = subtitle?.subtitle?.wordReferenceIdsThai || [];
  const fullThaiText = subtitle?.subtitle?.thai || '';
  const subId = subtitle?.subtitle?.id || null;
  
  // Extract mediaId from subId if not provided (subId format: mediaId-index)
  let resolvedMediaId = mediaId || null;
  if (!resolvedMediaId && subId) {
    const parts = subId.split('-');
    if (parts.length >= 2) {
      // Remove last part (index) and join rest as mediaId
      resolvedMediaId = parts.slice(0, -1).join('-');
    }
  }
  
  const handleWordClick = (index) => {
    if (onSelectionChange) {
      onSelectionChange(index);
    }
  };

  const selectedSenseToken = selectedWordIndex !== null ? senseTokens[selectedWordIndex] : null;
  const textColor = '#FFD700';
  const englishTextColor = '#B0B0B0';
  
  // Edit mode: Show input field in place of token spans
  if (isEditMode) {
    return React.createElement(React.Fragment, null,
      // Input field replacing token display
      React.createElement('div', {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          alignItems: 'center',
          padding: '8px 0'
        }
      },
        React.createElement('input', {
          ref: editInputRef,
          type: 'text',
          value: editText || '',
          onChange: (e) => {
            if (onEditTextChange) {
              onEditTextChange(e.target.value);
            }
          },
          onKeyDown: (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (onSaveEdit) {
                onSaveEdit();
              }
            } else if (e.key === 'Escape') {
              e.preventDefault();
              // Escape handled by parent component
              if (onSaveEdit) {
                onSaveEdit();
              }
            }
          },
          style: {
            flex: 1,
            minWidth: '200px',
            padding: '4px 10px',
            fontSize: '32px',
            fontWeight: '600',
            color: textColor,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            border: '2px solid rgba(255, 215, 0, 0.5)',
            borderRadius: '6px',
            fontFamily: 'inherit',
            outline: 'none',
            lineHeight: '1.6'
          },
          placeholder: 'Edit subtitle text...'
        })
      ),
      // Sense selection remains visible below (editor mode only)
      (() => {
        const rightDockContainer = typeof window !== 'undefined' ? window.__rightDockContainer : null;
        const senseSelectionElement = React.createElement(SenseSelection, {
          isOpen: true,
          onClose: () => {},
          senseSelectedIndices: senseSelectedIndices,
          selectedWordIndex: selectedWordIndex,
          onMeaningSelected: async (meaningIndex) => {
            if (selectedWordIndex === null || !onSenseSelected) return;
            await onSenseSelected(selectedWordIndex, meaningIndex);
          },
          onMeaningEdited: onMeaningEdited,
          onReprocessMeaning: onReprocessMeaning,
          onSensesNormalized: onSensesNormalized,
          inline: true,
          showName: showName,
          episode: episode,
          season: season,
          mediaId: resolvedMediaId,
          subtitle: subtitle
        });
        
        if (rightDockContainer) {
          // Portal to right dock AND render null inline (where SenseSelection used to be)
          return [
            ReactDOM.createPortal(senseSelectionElement, rightDockContainer),
            null
          ];
        } else {
          // Render inline as before
          return senseSelectionElement;
        }
      })()
    );
  }

  // Normal mode: Show token spans
  // NOW we can do early returns (after all hooks are called)
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

  if (!senseTokens || senseTokens.length === 0) {
    return React.createElement('div', {
      style: {
        color: '#FFD700',
        fontSize: '32px',
        fontWeight: '600',
        padding: '8px 0',
        textAlign: 'center'
      }
    }, 'No words available');
  }
  
  return React.createElement(React.Fragment, null,
    // Inject CSS keyframes for pulsing border animation
    React.createElement('style', {
      dangerouslySetInnerHTML: {
        __html: `
          @keyframes pulseBorder {
            0%, 100% {
              border-color: rgba(255, 215, 0, 1);
            }
            50% {
              border-color: rgba(255, 215, 0, 0.4);
            }
          }
        `
      }
    }),
    // Subtitle text with clickable tokens
    React.createElement('div', {
      style: {
        color: textColor,
        fontSize: '32px',
        fontWeight: '600',
        lineHeight: '1.6',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        alignItems: 'center',
        padding: '8px 0',
        userSelect: 'text', // Allow text selection for copy/paste
        WebkitUserSelect: 'text',
        MozUserSelect: 'text',
        msUserSelect: 'text'
      }
    },
      displayTokens.map((token, index) => {
        // Filter out empty tokens (text starts with [empty: or [missing:)
        if (!token) return null;
        if (token.thaiScript && (token.thaiScript.startsWith('[empty:') || token.thaiScript.startsWith('[missing:'))) {
          return null; // Don't render empty tokens
        }
        
        // Handle click - only trigger if user isn't selecting text
        const handleClick = (e) => {
          // Don't trigger if user is selecting text (has text selection)
          const selection = window.getSelection();
          if (selection && selection.toString().length > 0) {
            return; // User is selecting text, don't trigger token click
          }
          handleWordClick(index);
        };
        
        const senseToken = senseTokens[index];
        const isFailedWord = token.orstFailed || false;
        
        // Check if this token has a selected sense (source of truth: wordReferenceIdsThai)
        // Format is "word:senseNumber" - just check if it contains ":"
        const wordRef = wordReferenceIdsThai?.[index];
        const hasSelectedSense = wordRef && typeof wordRef === 'string' && wordRef.includes(':');
        const isSelected = selectedWordIndex === index;
        
        // Visual styling: 
        // - Green if hasSelectedSense (contains ":senseNumber" in wordReferenceIdsThai)
        // - Yellow/Orange if no selected sense (even if senses exist)
        // - Red text color if failed word (orstFailed)
        const baseBackgroundColor = hasSelectedSense 
          ? 'rgba(0, 255, 136, 0.35)' // Green when sense selected
          : 'rgba(255, 165, 0, 0.25)'; // Orange when no sense selected
        
        const baseBorder = hasSelectedSense 
          ? '2px solid #00FF88' // Green border when sense selected
          : '2px dashed rgba(255, 165, 0, 0.6)'; // Dashed orange border when needs selection
        
        // For selected tokens, use gold border that will pulse
        const selectedBorder = isSelected 
          ? '3px solid rgba(255, 215, 0, 1)' // Gold border for selected (will pulse)
          : baseBorder;
        
        // Color: red for failed words, otherwise gold
        const tokenColor = isFailedWord ? '#FF6666' : textColor;
        // Border: red for failed words (override other borders), otherwise use selected/base border
        const finalBorder = isFailedWord 
          ? '2px solid rgba(255, 0, 0, 0.6)' 
          : selectedBorder;
        
        return React.createElement('span', {
          key: index,
          style: {
            cursor: 'pointer',
            padding: '4px 10px',
            borderRadius: '6px',
            backgroundColor: baseBackgroundColor,
            border: finalBorder,
            animation: isSelected && !isFailedWord ? 'pulseBorder 1.5s ease-in-out infinite' : 'none',
            transition: 'all 0.2s',
            fontWeight: hasSelectedSense ? '700' : '600', // Bolder when has selected sense
            boxShadow: hasSelectedSense 
              ? '0 2px 4px rgba(0, 255, 136, 0.3)' 
              : 'none',
            userSelect: 'text',
            WebkitUserSelect: 'text',
            MozUserSelect: 'text',
            msUserSelect: 'text',
            color: tokenColor
          },
          onClick: handleClick,
          title: isFailedWord
            ? 'Failed word (ORST scraping failed)'
            : (isSelected 
              ? (hasSelectedSense ? '✓ Selected (has sense)' : 'Selected - Click to select meaning')
              : (hasSelectedSense ? '✓ Has selected sense' : 'Click to select meaning'))
        }, token.thaiScript);
      })
    ),
    
    // English tokens row (below Thai tokens, read-only)
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
        padding: '4px 0',
        userSelect: 'text',
        WebkitUserSelect: 'text',
        MozUserSelect: 'text',
        msUserSelect: 'text'
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
            padding: '4px 10px',
            borderRadius: '6px',
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
    ),
    
    // Sense selection ALWAYS visible in editor mode (inline, not modal)
    // Show even if no token is selected - it will display "Select a word above"
    (() => {
      const rightDockContainer = typeof window !== 'undefined' ? window.__rightDockContainer : null;
      const senseSelectionElement = React.createElement(SenseSelection, {
        isOpen: true,
        onClose: () => {},
        senseSelectedIndices: senseSelectedIndices,
        selectedWordIndex: selectedWordIndex,
        onMeaningSelected: async (meaningIndex) => {
          if (selectedWordIndex === null || !onSenseSelected) return;
          
          await onSenseSelected(selectedWordIndex, meaningIndex);
        },
        onMeaningEdited: onMeaningEdited,
        onReprocessMeaning: onReprocessMeaning,
        onSensesNormalized: onSensesNormalized,
        inline: true,
        showName: showName,
        episode: episode,
        season: season,
        mediaId: resolvedMediaId,
        subtitle: subtitle
      });
      
      if (rightDockContainer) {
        // Portal to right dock AND render null inline (where SenseSelection used to be)
        return [
          ReactDOM.createPortal(senseSelectionElement, rightDockContainer),
          null
        ];
      } else {
        // Render inline as before
        return senseSelectionElement;
      }
    })()
  );
}
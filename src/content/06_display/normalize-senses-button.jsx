/**
 * Normalize Senses Button Component
 * Button for manually triggering sense normalization
 */

import React, { useState } from 'react';
import { normalizeSensesWithGPT } from '../03_process/helpers/07_normalize/gpt-normalize-senses.js';

export function NormalizeSensesButton({ senses, thaiWord, onNormalized, isLoading: externalLoading, disabled, context }) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = externalLoading || internalLoading;
  
  // Only show if senses exist and are from ORST (source: 'ORST' or no source)
  const hasOrstSenses = senses && Array.isArray(senses) && senses.length > 0 && 
    senses.some(sense => !sense.source || sense.source === 'ORST');
  
  // Check if ALL senses are already normalized (for visual indication only)
  const areAllNormalized = senses && senses.length > 0 && 
    senses.every(sense => {
      const hasNormalizedFields = sense.descriptionThai && sense.descriptionEnglish;
      return hasNormalizedFields;
    });
  
  if (!hasOrstSenses) {
    return null; // Don't show button if no ORST senses
  }
  
  // Disable button only for external reasons (not because senses are normalized)
  const shouldDisable = disabled || isLoading;
  
  const handleClick = async () => {
    if (shouldDisable || !onNormalized) return;
    
    setInternalLoading(true);
    try {
      // Normalize senses with context
      const enhancedSenses = await normalizeSensesWithGPT(senses, {
        thaiWord: thaiWord,
        ...(context || {})
      });
      
      // Call callback with normalized senses
      if (onNormalized) {
        try {
          await onNormalized(enhancedSenses);
        } catch (callbackError) {
          throw callbackError; // Re-throw so parent can handle
        }
      }
    } catch (error) {
      // Error handling is done by parent component
    } finally {
      setInternalLoading(false);
    }
  };
  
  return React.createElement('button', {
    onClick: handleClick,
    disabled: shouldDisable,
    style: {
      padding: '4px 8px',
      backgroundColor: isLoading 
        ? 'rgba(255, 215, 0, 0.3)' 
        : shouldDisable 
          ? 'rgba(100, 100, 100, 0.3)' 
          : areAllNormalized 
            ? 'rgba(255, 215, 0, 0.2)' 
            : 'rgba(255, 215, 0, 0.2)',
      border: `1px solid ${shouldDisable ? '#666666' : '#FFD700'}`,
      borderRadius: '4px',
      color: isLoading || shouldDisable ? '#AAAAAA' : '#FFD700',
      cursor: shouldDisable ? 'not-allowed' : 'pointer',
      fontSize: '10px',
      fontWeight: 'bold',
      opacity: shouldDisable ? 0.5 : 1
    },
    title: shouldDisable
      ? 'Cannot normalize (processing or disabled)'
      : areAllNormalized 
        ? 'Renormalize senses with GPT (update/improve existing normalization)'
        : 'Normalize senses with GPT (add English translations and clean formatting)'
  }, isLoading ? 'Normalizing...' : (areAllNormalized ? 'Renormalize' : 'Normalize'));
}

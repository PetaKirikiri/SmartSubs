/**
 * GPT Dropdown Component
 * Dropdown menu for GPT processing options: Sense Analysis, Meaning Generation, Normalize
 */

import React, { useState, useRef, useEffect } from 'react';

export function GPTDropdown({ onSenseAnalysis, onMeaningGeneration, onNormalize, isAnalyzingGPT, isNormalizing, hasGPTAnalysis, meanings, isSaving, isReprocessing, senses, thaiWord }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);
  
  // Check if all senses are normalized (for Normalize option)
  const areAllNormalized = senses && senses.length > 0 && 
    senses.every(sense => {
      const hasNormalizedFields = sense.descriptionThai && sense.descriptionEnglish;
      return hasNormalizedFields;
    });
  
  // Check if has ORST senses (for Normalize option)
  const hasOrstSenses = senses && Array.isArray(senses) && senses.length > 0 && 
    senses.some(sense => !sense.source || sense.source === 'ORST');
  
  const isAnyOperationInProgress = isAnalyzingGPT || isNormalizing || isSaving || isReprocessing;
  const isSenseAnalysisDisabled = isAnyOperationInProgress || meanings.length === 0;
  const isMeaningGenerationDisabled = isAnyOperationInProgress || !thaiWord;
  const isNormalizeDisabled = isAnyOperationInProgress || !hasOrstSenses;
  
  const handleOptionClick = (callback) => {
    if (callback && !isAnyOperationInProgress) {
      callback();
      setIsOpen(false);
    }
  };
  
  const buttonText = isNormalizing ? 'Normalizing...' : (isAnalyzingGPT ? 'Analyzing...' : 'GPT');
  const buttonColor = hasGPTAnalysis ? '#00FF88' : '#FFD700';
  const buttonBg = hasGPTAnalysis ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 215, 0, 0.2)';
  const buttonBorder = hasGPTAnalysis ? '1px solid #00FF88' : '1px solid #FFD700';
  
  return React.createElement('div', {
    ref: dropdownRef,
    style: {
      position: 'relative',
      display: 'inline-block'
    }
  },
    // Main GPT button
    React.createElement('button', {
      onClick: () => setIsOpen(!isOpen),
      disabled: isAnyOperationInProgress,
      style: {
        padding: '4px 8px',
        backgroundColor: isAnyOperationInProgress ? 'rgba(255, 215, 0, 0.3)' : buttonBg,
        border: buttonBorder,
        borderRadius: '4px',
        color: isAnyOperationInProgress ? '#AAAAAA' : buttonColor,
        cursor: isAnyOperationInProgress ? 'not-allowed' : 'pointer',
        fontSize: '10px',
        fontWeight: 'bold',
        opacity: isAnyOperationInProgress ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      },
      title: isAnyOperationInProgress 
        ? 'GPT operation in progress...'
        : 'GPT processing options'
    },
      buttonText,
      React.createElement('span', {
        style: {
          fontSize: '8px',
          marginLeft: '2px'
        }
      }, '▼')
    ),
    
    // Dropdown menu
    isOpen ? React.createElement('div', {
      style: {
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: '4px',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        border: '1px solid rgba(255, 215, 0, 0.5)',
        borderRadius: '4px',
        minWidth: '160px',
        zIndex: 1000,
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
      }
    },
      // Sense Analysis option
      React.createElement('button', {
        onClick: () => handleOptionClick(onSenseAnalysis),
        disabled: isSenseAnalysisDisabled,
        style: {
          width: '100%',
          padding: '8px 12px',
          textAlign: 'left',
          backgroundColor: 'transparent',
          border: 'none',
          color: isSenseAnalysisDisabled ? '#666666' : '#FFFFFF',
          cursor: isSenseAnalysisDisabled ? 'not-allowed' : 'pointer',
          fontSize: '11px',
          fontWeight: 'normal',
          borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
          opacity: isSenseAnalysisDisabled ? 0.5 : 1
        },
        onMouseEnter: (e) => {
          if (!isSenseAnalysisDisabled) {
            e.target.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
          }
        },
        onMouseLeave: (e) => {
          e.target.style.backgroundColor = 'transparent';
        },
        title: meanings.length === 0 
          ? 'No senses available for analysis'
          : 'Analyze which sense best fits the context'
      }, 'Sense Analysis'),
      
      // Meaning Generation option
      React.createElement('button', {
        onClick: () => handleOptionClick(onMeaningGeneration),
        disabled: isMeaningGenerationDisabled,
        style: {
          width: '100%',
          padding: '8px 12px',
          textAlign: 'left',
          backgroundColor: 'transparent',
          border: 'none',
          color: isMeaningGenerationDisabled ? '#666666' : '#FFFFFF',
          cursor: isMeaningGenerationDisabled ? 'not-allowed' : 'pointer',
          fontSize: '11px',
          fontWeight: 'normal',
          borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
          opacity: isMeaningGenerationDisabled ? 0.5 : 1
        },
        onMouseEnter: (e) => {
          if (!isMeaningGenerationDisabled) {
            e.target.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
          }
        },
        onMouseLeave: (e) => {
          e.target.style.backgroundColor = 'transparent';
        },
        title: !thaiWord 
          ? 'No word selected'
          : 'Generate sense definitions using GPT (for failed words)'
      }, 'Meaning Generation'),
      
      // Normalize option (always show, but disable if no ORST senses)
      React.createElement('button', {
        onClick: () => handleOptionClick(onNormalize),
        disabled: isNormalizeDisabled,
        style: {
          width: '100%',
          padding: '8px 12px',
          textAlign: 'left',
          backgroundColor: 'transparent',
          border: 'none',
          color: isNormalizeDisabled ? '#666666' : '#FFFFFF',
          cursor: isNormalizeDisabled ? 'not-allowed' : 'pointer',
          fontSize: '11px',
          fontWeight: 'normal',
          opacity: isNormalizeDisabled ? 0.5 : 1
        },
        onMouseEnter: (e) => {
          if (!isNormalizeDisabled) {
            e.target.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
          }
        },
        onMouseLeave: (e) => {
          e.target.style.backgroundColor = 'transparent';
        },
        title: isNormalizeDisabled
          ? (hasOrstSenses 
            ? 'Cannot normalize (processing or disabled)'
            : 'No ORST senses to normalize')
          : areAllNormalized 
            ? 'Renormalize senses with GPT'
            : 'Normalize senses with GPT'
      }, areAllNormalized ? 'Renormalize' : 'Normalize')
    ) : null
  );
}

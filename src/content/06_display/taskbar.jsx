/**
 * Taskbar Component
 * Visual buttons only - calls onFetchNetflix, onReprocessTimestamps, and onReprocessPhonetics props
 */

import React from 'react';


const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const PhoneticIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
  </svg>
);

const ToggleSwitch = ({ isOn, onToggle, isHovered }) => {
  return (
    <div
      onClick={onToggle}
      style={{
        position: 'relative',
        width: '36px',
        height: '18px',
        backgroundColor: isOn ? 'rgba(0, 191, 255, 0.6)' : 'rgba(255, 255, 255, 0.2)',
        borderRadius: '9px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        border: isHovered ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: isHovered ? '0 0 4px rgba(0, 191, 255, 0.4)' : 'none'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '2px',
          left: isOn ? '20px' : '2px',
          width: '12px',
          height: '12px',
          backgroundColor: '#FFFFFF',
          borderRadius: '50%',
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '2px',
          left: '4px',
          fontSize: '8px',
          color: isOn ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.6)',
          fontWeight: 'bold',
          transition: 'color 0.2s ease',
          pointerEvents: 'none',
          userSelect: 'none'
        }}
      >
        📝
      </div>
      <div
        style={{
          position: 'absolute',
          top: '2px',
          right: '4px',
          fontSize: '8px',
          color: isOn ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.3)',
          fontWeight: 'bold',
          transition: 'color 0.2s ease',
          pointerEvents: 'none',
          userSelect: 'none'
        }}
      >
        🔗
      </div>
    </div>
  );
};

const buttonStyle = {
  padding: '0',
  margin: '0',
  backgroundColor: 'transparent',
  border: 'none',
  color: 'rgba(255, 255, 255, 0.8)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '20px',
  width: '20px',
  flexShrink: 0,
  transition: 'all 0.2s ease',
  outline: 'none',
  verticalAlign: 'top',
  borderRadius: '2px'
};

export function Taskbar({ onFetchNetflix, onReprocessTimestamps, onReprocessPhonetics, onFetchEnglish, isFetching, isReprocessingTimestamps, isReprocessingPhonetics, isFetchingEnglish, useThaiSplitIdsMode, onToggleMode, currentSubtitleId }) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        height: '20px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        flexShrink: 0,
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: 'rgba(97, 218, 251, 0.3)' // Light blue background to show taskbar boundaries
      }}
    >
      {currentSubtitleId && (
        <div
          style={{
            marginLeft: '8px',
            marginRight: 'auto',
            display: 'flex',
            alignItems: 'center',
            height: '20px',
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '11px',
            fontFamily: 'monospace',
            userSelect: 'text',
            cursor: 'text'
          }}
          title={`Current subtitle ID: ${currentSubtitleId}`}
        >
          {currentSubtitleId}
        </div>
      )}
      <div
        style={{
          marginRight: '8px',
          display: 'flex',
          alignItems: 'center',
          height: '20px'
        }}
        title={useThaiSplitIdsMode ? "User mode (phonetics display)" : "Editor mode (sense selection)"}
      >
        <ToggleSwitch 
          isOn={useThaiSplitIdsMode} 
          onToggle={onToggleMode}
          isHovered={isHovered}
        />
      </div>
      <button
        onClick={onFetchEnglish}
        disabled={isFetchingEnglish}
        title="Fetch English VTT subtitles (test)"
        style={{
          ...buttonStyle,
          marginLeft: '8px',
          padding: '0 4px',
          width: 'auto',
          fontSize: '11px',
          opacity: isFetchingEnglish ? 0.3 : (isHovered ? 1 : 0.8),
          cursor: isFetchingEnglish ? 'not-allowed' : 'pointer',
          backgroundColor: isHovered && !isFetchingEnglish ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
          transform: isHovered && !isFetchingEnglish ? 'scale(1.1)' : 'scale(1)'
        }}
      >
        eng
      </button>
      <button
        onClick={onFetchNetflix}
        disabled={isFetching}
        title="Fetch subtitles from Netflix"
        style={{
          ...buttonStyle,
          marginLeft: '8px',
          opacity: isFetching ? 0.3 : (isHovered ? 1 : 0.8),
          cursor: isFetching ? 'not-allowed' : 'pointer',
          backgroundColor: isHovered && !isFetching ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
          transform: isHovered && !isFetching ? 'scale(1.15)' : 'scale(1)',
          fontSize: isHovered && !isFetching ? '18px' : '16px'
        }}
      >
        ⬇
      </button>
      <button
        onClick={onReprocessTimestamps}
        disabled={isReprocessingTimestamps}
        title="Reprocess timestamps (fix integer startSec/endSec)"
        style={{
          ...buttonStyle,
          marginLeft: '8px',
          opacity: isReprocessingTimestamps ? 0.3 : (isHovered ? 1 : 0.8),
          cursor: isReprocessingTimestamps ? 'not-allowed' : 'pointer',
          backgroundColor: isHovered && !isReprocessingTimestamps ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
          transform: isHovered && !isReprocessingTimestamps ? 'scale(1.15)' : 'scale(1)'
        }}
      >
        <ClockIcon />
      </button>
      <button
        onClick={onReprocessPhonetics}
        disabled={isReprocessingPhonetics}
        title="Reprocess phonetics for all words (ignores existing englishPhonetic)"
        style={{
          ...buttonStyle,
          marginLeft: '8px',
          opacity: isReprocessingPhonetics ? 0.3 : (isHovered ? 1 : 0.8),
          cursor: isReprocessingPhonetics ? 'not-allowed' : 'pointer',
          backgroundColor: isHovered && !isReprocessingPhonetics ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
          transform: isHovered && !isReprocessingPhonetics ? 'scale(1.15)' : 'scale(1)'
        }}
      >
        <PhoneticIcon />
      </button>
    </div>
  );
}

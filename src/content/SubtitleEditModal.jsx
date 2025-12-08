import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { SUBTITLE_STAGE } from './subtitle.js';

let editModalRoot = null;

function getEditModalRoot() {
  if (editModalRoot) return editModalRoot;

  let modalContainer = document.getElementById('smart-subs-edit-modal-container');
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'smart-subs-edit-modal-container';
    modalContainer.style.position = 'fixed';
    modalContainer.style.top = '0';
    modalContainer.style.left = '0';
    modalContainer.style.right = '0';
    modalContainer.style.bottom = '0';
    modalContainer.style.width = '100vw';
    modalContainer.style.height = '100vh';
    modalContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
    modalContainer.style.zIndex = '2147483648';
    modalContainer.style.display = 'flex';
    modalContainer.style.alignItems = 'center';
    modalContainer.style.justifyContent = 'center';
    modalContainer.style.overflowY = 'auto';
    document.body.appendChild(modalContainer);
  }

  editModalRoot = createRoot(modalContainer);
  return editModalRoot;
}

function parseThaiSplitIds(thaiSplitIds) {
  if (!thaiSplitIds) return [];
  try {
    return typeof thaiSplitIds === 'string' ? JSON.parse(thaiSplitIds) : thaiSplitIds;
  } catch {
    return [];
  }
}

function SubtitleEditModalContent({
  subtitle,
  onClose,
  onScriptConfirmed,
  onSplitRequested,
  onSplitEditRequested,
  onSplitConfirmed,
  onWordDataRequested,
  onWordReviewConfirmed,
  onReopenForEdit
}) {
  const [thaiTextDraft, setThaiTextDraft] = useState(subtitle?.thai || '');
  const [thaiSplitDraft, setThaiSplitDraft] = useState(subtitle?.thaiSplit || '');

  useEffect(() => {
    if (subtitle?.thai) {
      setThaiTextDraft(subtitle.thai);
    }
  }, [subtitle?.thai]);

  useEffect(() => {
    if (subtitle?.thaiSplit) {
      setThaiSplitDraft(subtitle.thaiSplit);
    }
  }, [subtitle?.thaiSplit]);

  if (!subtitle) return null;

  const processingStage = subtitle.processingStage ?? SUBTITLE_STAGE.RAW_IMPORTED;
  const words = subtitle.thaiSplit?.trim() ? subtitle.thaiSplit.split(/\s+/).filter(w => w.trim()) : [];
  const wordIds = parseThaiSplitIds(subtitle.thaiSplitIds);
  const wordMap = subtitle.phoneticWordMap instanceof Map ? subtitle.phoneticWordMap : new Map();

  // Stage 1: RAW_IMPORTED - Edit thai text
  if (processingStage === SUBTITLE_STAGE.RAW_IMPORTED) {
    return (
      <div style={{
        width: '90%',
        maxWidth: '800px',
        padding: '24px',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        borderRadius: '8px',
        border: '2px solid rgba(255, 215, 0, 0.5)',
        color: '#FFD700'
      }}>
        <h2 style={{
          marginTop: '0',
          marginBottom: '20px',
          fontSize: '20px',
          fontWeight: '600',
          color: '#FFD700'
        }}>
          Edit Subtitle - Stage 1
        </h2>

        {subtitle.startSec && subtitle.endSec && (
          <div style={{
            marginBottom: '16px',
            fontSize: '14px',
            color: 'rgba(255, 215, 0, 0.7)'
          }}>
            Time: {subtitle.startSec} → {subtitle.endSec}
          </div>
        )}

        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '14px',
          fontWeight: '500',
          color: '#FFD700'
        }}>
          Thai Text
        </label>
        <textarea
          value={thaiTextDraft}
          onChange={(e) => setThaiTextDraft(e.target.value)}
          style={{
            width: '100%',
            minHeight: '200px',
            padding: '12px',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            border: '1px solid rgba(255, 215, 0, 0.5)',
            borderRadius: '4px',
            color: '#FFD700',
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            boxSizing: 'border-box',
            outline: 'none',
            resize: 'vertical'
          }}
          placeholder="Enter Thai script text"
        />

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          marginTop: '20px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '4px',
              color: '#FFD700',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onScriptConfirmed?.(subtitle.recordId, thaiTextDraft);
              onClose();
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: 'rgba(255, 215, 0, 0.3)',
              border: '1px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '4px',
              color: '#FFD700',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Save text and close
          </button>
        </div>
      </div>
    );
  }

  // Stage 2: SCRIPT_CONFIRMED - Edit split
  if (processingStage === SUBTITLE_STAGE.SCRIPT_CONFIRMED) {
    return (
      <div style={{
        width: '90%',
        maxWidth: '800px',
        padding: '24px',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        borderRadius: '8px',
        border: '2px solid rgba(255, 215, 0, 0.5)',
        color: '#FFD700'
      }}>
        <h2 style={{
          marginTop: '0',
          marginBottom: '20px',
          fontSize: '20px',
          fontWeight: '600',
          color: '#FFD700'
        }}>
          Edit Subtitle - Stage 2
        </h2>

        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#FFD700'
          }}>
            Original Thai Text (read-only)
          </label>
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            borderRadius: '4px',
            color: 'rgba(255, 215, 0, 0.8)',
            fontSize: '16px',
            minHeight: '60px'
          }}>
            {subtitle.thai || ''}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#FFD700'
          }}>
            Word Split
          </label>
          <input
            type="text"
            value={thaiSplitDraft}
            onChange={(e) => setThaiSplitDraft(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '4px',
              color: '#FFD700',
              fontSize: '16px',
              boxSizing: 'border-box',
              outline: 'none'
            }}
            placeholder="Words separated by spaces"
          />
          {words.length > 0 && (
            <div style={{
              marginTop: '12px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              {words.map((word, idx) => (
                <span
                  key={idx}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'rgba(255, 215, 0, 0.2)',
                    border: '1px solid rgba(255, 215, 0, 0.5)',
                    borderRadius: '4px',
                    color: '#FFD700',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    const newSplit = thaiSplitDraft.split(/\s+/).filter(w => w.trim());
                    const edited = prompt('Edit word:', word);
                    if (edited !== null) {
                      newSplit[idx] = edited;
                      setThaiSplitDraft(newSplit.join(' '));
                    }
                  }}
                >
                  {word}
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          marginTop: '20px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '4px',
              color: '#FFD700',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Cancel
          </button>
          {onSplitEditRequested && (
            <button
              onClick={() => onSplitEditRequested(subtitle.recordId)}
              style={{
                padding: '10px 20px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 215, 0, 0.5)',
                borderRadius: '4px',
                color: '#FFD700',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Manual split
            </button>
          )}
          <button
            onClick={() => onSplitRequested?.(subtitle.recordId)}
            style={{
              padding: '10px 20px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '4px',
              color: '#FFD700',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Auto-split again
          </button>
          <button
            onClick={() => {
              onSplitConfirmed?.(subtitle.recordId);
              onClose();
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: 'rgba(255, 215, 0, 0.3)',
              border: '1px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '4px',
              color: '#FFD700',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Save split
          </button>
        </div>
      </div>
    );
  }

  // Stage 3: SPLIT_CONFIRMED - Generate word data
  if (processingStage === SUBTITLE_STAGE.SPLIT_CONFIRMED) {
    return (
      <div style={{
        width: '90%',
        maxWidth: '800px',
        padding: '24px',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        borderRadius: '8px',
        border: '2px solid rgba(255, 215, 0, 0.5)',
        color: '#FFD700',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <h2 style={{
          marginTop: '0',
          marginBottom: '20px',
          fontSize: '20px',
          fontWeight: '600',
          color: '#FFD700'
        }}>
          Edit Subtitle - Stage 3
        </h2>

        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '20px'
          }}>
            {words.map((word, idx) => {
              const wordId = wordIds[idx];
              const wordData = wordId ? wordMap.get(wordId) : null;
              return (
                <div
                  key={idx}
                  style={{
                    padding: '12px',
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    border: '1px solid rgba(255, 215, 0, 0.5)',
                    borderRadius: '4px',
                    minWidth: '200px'
                  }}
                >
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#FFD700',
                    marginBottom: '8px'
                  }}>
                    {word}
                  </div>
                  {wordId && (
                    <div style={{
                      fontSize: '12px',
                      color: 'rgba(255, 215, 0, 0.6)',
                      marginBottom: '4px'
                    }}>
                      ID: {wordId}
                    </div>
                  )}
                  {wordData && (
                    <>
                      {wordData.englishPhonetic && (
                        <div style={{
                          fontSize: '14px',
                          color: 'rgba(255, 215, 0, 0.8)',
                          marginBottom: '4px'
                        }}>
                          Phonetic: {wordData.englishPhonetic}
                        </div>
                      )}
                      {wordData.english && (
                        <div style={{
                          fontSize: '14px',
                          color: 'rgba(255, 215, 0, 0.8)',
                          marginBottom: '4px'
                        }}>
                          Translation: {wordData.english}
                        </div>
                      )}
                    </>
                  )}
                  {!wordData && (
                    <div style={{
                      fontSize: '12px',
                      color: 'rgba(255, 215, 0, 0.5)',
                      fontStyle: 'italic'
                    }}>
                      No data yet
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          marginTop: '20px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '4px',
              color: '#FFD700',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onWordDataRequested?.(subtitle.recordId)}
            style={{
              padding: '10px 20px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '4px',
              color: '#FFD700',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Generate / refresh word data
          </button>
          {wordMap.size > 0 && (
            <button
              onClick={() => {
                onWordReviewConfirmed?.(subtitle.recordId);
                onClose();
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: 'rgba(255, 215, 0, 0.3)',
                border: '1px solid rgba(255, 215, 0, 0.5)',
                borderRadius: '4px',
                color: '#FFD700',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Mark words reviewed
            </button>
          )}
        </div>
      </div>
    );
  }

  // Stage 3 complete: Show final processed result (read-only)
  if (processingStage === SUBTITLE_STAGE.SPLIT_CONFIRMED && wordIds.length > 0 && wordMap.size > 0) {
    return (
      <div style={{
        width: '90%',
        maxWidth: '800px',
        padding: '24px',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        borderRadius: '8px',
        border: '2px solid rgba(255, 215, 0, 0.5)',
        color: '#FFD700',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <h2 style={{
          marginTop: '0',
          marginBottom: '20px',
          fontSize: '20px',
          fontWeight: '600',
          color: '#FFD700'
        }}>
          Edit Subtitle - Stage 3 Complete (Read-only)
        </h2>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px'
        }}>
          {words.map((word, idx) => {
            const wordId = wordIds[idx];
            const wordData = wordId ? wordMap.get(wordId) : null;
            const statusClass = wordData?.status?.toLowerCase() === 'known' ? 'known' : 'unknown';
            return (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  backgroundColor: statusClass === 'known' 
                    ? 'rgba(74, 222, 128, 0.2)' 
                    : 'rgba(0, 0, 0, 0.6)',
                  border: `1px solid ${statusClass === 'known' 
                    ? 'rgba(74, 222, 128, 0.5)' 
                    : 'rgba(255, 215, 0, 0.5)'}`,
                  borderRadius: '4px',
                  minWidth: '200px'
                }}
              >
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: statusClass === 'known' ? 'rgba(74, 222, 128, 1)' : '#FFD700',
                  marginBottom: '8px'
                }}>
                  {word}
                </div>
                {wordData && (
                  <>
                    {wordData.englishPhonetic && (
                      <div style={{
                        fontSize: '14px',
                        color: 'rgba(255, 215, 0, 0.8)',
                        marginBottom: '4px'
                      }}>
                        {wordData.englishPhonetic}
                      </div>
                    )}
                    {wordData.english && (
                      <div style={{
                        fontSize: '14px',
                        color: 'rgba(255, 215, 0, 0.8)',
                        marginBottom: '4px'
                      }}>
                        {wordData.english}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          marginTop: '20px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '4px',
              color: '#FFD700',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Cancel
          </button>
          {onReopenForEdit && (
            <button
              onClick={() => {
                onReopenForEdit(subtitle.recordId);
                onClose();
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: 'rgba(255, 215, 0, 0.3)',
                border: '1px solid rgba(255, 215, 0, 0.5)',
                borderRadius: '4px',
                color: '#FFD700',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Re-open for edit
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export function showSubtitleEditModal({
  subtitle,
  onClose,
  onScriptConfirmed,
  onSplitRequested,
  onSplitEditRequested,
  onSplitConfirmed,
  onWordDataRequested,
  onWordReviewConfirmed,
  onReopenForEdit
}) {
  const root = getEditModalRoot();
  if (!root) return;

  const modalContainer = document.getElementById('smart-subs-edit-modal-container');
  if (modalContainer) {
    modalContainer.style.display = 'flex';
  }

  root.render(
    React.createElement(SubtitleEditModalContent, {
      subtitle,
      onClose,
      onScriptConfirmed,
      onSplitRequested,
      onSplitEditRequested,
      onSplitConfirmed,
      onWordDataRequested,
      onWordReviewConfirmed,
      onReopenForEdit
    })
  );
}

export function hideSubtitleEditModal() {
  const modalContainer = document.getElementById('smart-subs-edit-modal-container');
  if (modalContainer) {
    modalContainer.style.display = 'none';
  }

  if (editModalRoot) {
    editModalRoot.render(null);
  }
}


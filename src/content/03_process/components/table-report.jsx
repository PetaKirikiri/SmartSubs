import React, { useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Table Report Component
 * Displays subtitle report in three distinct visual sections: Subtitle Level, Token Level, Sense Level
 * Matches FIELD_REGISTRY structure exactly
 * Supports both inline and modal display modes
 */
export default function TableReport({ 
  report, 
  isOpen, 
  onClose,
  onProcessNext,
  onProcessAll,
  hasMore,
  processing,
  currentIndex,
  totalCount
}) {
  const [showRawJson, setShowRawJson] = useState(false);

  if (!report || !report.raw) {
    return null;
  }

  const { raw } = report;
  // Report structure is helper-first - flat by helper name

  // Helper function to copy JSON to clipboard
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      // Visual feedback could be added here if needed
      console.log(`Copied ${label} to clipboard`);
    });
  };

  // Helper function to render fields in a table format
  const renderFieldTable = (fields) => {
    if (!fields || fields.length === 0) return null;
    
    return (
      <div style={{ marginTop: '8px', overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: isOpen ? '11px' : '10px',
          border: '1px solid rgba(255, 215, 0, 0.2)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)'
        }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255, 215, 0, 0.1)', borderBottom: '2px solid rgba(255, 215, 0, 0.3)' }}>
              <th style={{ padding: isOpen ? '8px 6px' : '6px 4px', textAlign: 'left', borderRight: '1px solid rgba(255, 215, 0, 0.2)', fontWeight: '600', color: '#FFD700' }}>Field</th>
              <th style={{ padding: isOpen ? '8px 6px' : '6px 4px', textAlign: 'center', borderRight: '1px solid rgba(255, 215, 0, 0.2)', fontWeight: '600', color: '#FFD700' }}>Workmap</th>
              <th style={{ padding: isOpen ? '8px 6px' : '6px 4px', textAlign: 'left', borderRight: '1px solid rgba(255, 215, 0, 0.2)', fontWeight: '600', color: '#FFD700' }}>Status</th>
              <th style={{ padding: isOpen ? '8px 6px' : '6px 4px', textAlign: 'left', borderRight: '1px solid rgba(255, 215, 0, 0.2)', fontWeight: '600', color: '#FFD700' }}>Value</th>
              <th style={{ padding: isOpen ? '8px 6px' : '6px 4px', textAlign: 'left', borderRight: '1px solid rgba(255, 215, 0, 0.2)', fontWeight: '600', color: '#FFD700' }}>Helper Called</th>
              <th style={{ padding: isOpen ? '8px 6px' : '6px 4px', textAlign: 'center', borderRight: '1px solid rgba(255, 215, 0, 0.2)', fontWeight: '600', color: '#FFD700' }}>Cached</th>
              <th style={{ padding: isOpen ? '8px 6px' : '6px 4px', textAlign: 'center', borderRight: '1px solid rgba(255, 215, 0, 0.2)', fontWeight: '600', color: '#FFD700' }}>Saved</th>
              <th style={{ padding: isOpen ? '8px 6px' : '6px 4px', textAlign: 'center', borderRight: '1px solid rgba(255, 215, 0, 0.2)', fontWeight: '600', color: '#FFD700' }}>Displayed</th>
              <th style={{ padding: isOpen ? '8px 6px' : '6px 4px', textAlign: 'center', borderRight: '1px solid rgba(255, 215, 0, 0.2)', fontWeight: '600', color: '#FFD700' }}>Present</th>
              <th style={{ padding: isOpen ? '8px 6px' : '6px 4px', textAlign: 'center', borderRight: '1px solid rgba(255, 215, 0, 0.2)', fontWeight: '600', color: '#FFD700' }}>Data Loaded</th>
              <th style={{ padding: isOpen ? '8px 6px' : '6px 4px', textAlign: 'left', fontWeight: '600', color: '#FFD700' }}>Error</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, idx) => (
              <tr 
                key={idx}
                style={{
                  borderBottom: '1px solid rgba(255, 215, 0, 0.1)',
                  backgroundColor: idx % 2 === 0 ? 'rgba(0, 0, 0, 0.1)' : 'transparent'
                }}
              >
                <td style={{ 
                  padding: isOpen ? '6px' : '4px', 
                  borderRight: '1px solid rgba(255, 215, 0, 0.1)',
                  fontFamily: 'monospace', 
                  color: '#FFD700',
                  fontWeight: '500'
                }}>
                  {field.field}
                </td>
                <td style={{ 
                  padding: isOpen ? '6px' : '4px', 
                  borderRight: '1px solid rgba(255, 215, 0, 0.1)',
                  textAlign: 'center',
                  color: field.workmap ? '#ef4444' : '#4ade80',
                  fontWeight: '500'
                }}>
                  {field.workmap ? 'true' : 'false'}
                </td>
                <td style={{ 
                  padding: isOpen ? '6px' : '4px', 
                  borderRight: '1px solid rgba(255, 215, 0, 0.1)',
                  color: field.dataStatus === 'clean' ? '#4ade80' : 'rgba(255, 200, 100, 0.9)'
                }}>
                  {field.dataStatus}
                </td>
                <td style={{ 
                  padding: isOpen ? '6px' : '4px', 
                  borderRight: '1px solid rgba(255, 215, 0, 0.1)',
                  color: 'rgba(255, 215, 0, 0.7)',
                  maxWidth: isOpen ? '200px' : '150px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }} title={field.value}>
                  {field.value}
                </td>
                <td style={{ 
                  padding: isOpen ? '6px' : '4px', 
                  borderRight: '1px solid rgba(255, 215, 0, 0.1)',
                  color: field.helperCalled && field.helperCalled !== 'none' ? '#4ade80' : 'rgba(150, 150, 150, 0.7)'
                }}>
                  {field.helperCalled || 'none'}
                </td>
                <td style={{ 
                  padding: isOpen ? '6px' : '4px', 
                  borderRight: '1px solid rgba(255, 215, 0, 0.1)',
                  textAlign: 'center',
                  color: field.cached ? '#4ade80' : '#ef4444',
                  fontWeight: '500'
                }}>
                  {field.cached ? 'true' : 'false'}
                </td>
                <td style={{ 
                  padding: isOpen ? '6px' : '4px', 
                  borderRight: '1px solid rgba(255, 215, 0, 0.1)',
                  textAlign: 'center',
                  color: field.saved ? '#4ade80' : '#ef4444',
                  fontWeight: '500'
                }}>
                  {field.saved ? 'true' : 'false'}
                </td>
                <td style={{ 
                  padding: isOpen ? '6px' : '4px', 
                  borderRight: '1px solid rgba(255, 215, 0, 0.1)',
                  textAlign: 'center',
                  color: field.displayed ? '#4ade80' : '#ef4444',
                  fontWeight: '500'
                }}>
                  {field.displayed ? 'true' : 'false'}
                </td>
                <td style={{ 
                  padding: isOpen ? '6px' : '4px', 
                  borderRight: '1px solid rgba(255, 215, 0, 0.1)',
                  textAlign: 'center',
                  color: field.present ? '#4ade80' : '#ef4444',
                  fontWeight: '500'
                }}>
                  {field.present ? 'true' : 'false'}
                </td>
                <td style={{ 
                  padding: isOpen ? '6px' : '4px', 
                  borderRight: '1px solid rgba(255, 215, 0, 0.1)',
                  textAlign: 'center',
                  color: field.dataLoaded ? '#4ade80' : '#ef4444',
                  fontWeight: '500'
                }}>
                  {field.dataLoaded ? 'true' : 'false'}
                </td>
                <td style={{ 
                  padding: isOpen ? '6px' : '4px',
                  color: field.error ? '#ef4444' : 'rgba(150, 150, 150, 0.7)',
                  fontSize: isOpen ? '10px' : '9px'
                }}>
                  {field.error || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Helper function to render helper groups section
  // Report structure is helper-first - flat by helper name
  const renderHelperGroups = (helpers) => {
    if (!helpers || typeof helpers !== 'object') {
      return null;
    }
    
    // Helpers are already flat by helper name - no flattening needed
    const helperNames = Object.keys(helpers);
    
    if (helperNames.length === 0) {
      return null;
    }

    // Sort helpers by name for consistent display
    const sortedHelperNames = helperNames.sort();
    
    return (
      <div style={{ marginTop: '32px', marginBottom: '24px' }}>
        <div style={{
          padding: isOpen ? '12px' : '10px',
          backgroundColor: 'rgba(100, 200, 255, 0.15)',
          borderBottom: '2px solid rgba(100, 200, 255, 0.3)',
          fontWeight: '600',
          fontSize: isOpen ? '15px' : '13px',
          color: '#64C8FF',
          textTransform: 'capitalize',
          borderRadius: '4px 4px 0 0'
        }}>
          Helper Groups
        </div>
        <div style={{
          padding: isOpen ? '16px' : '12px',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(100, 200, 255, 0.2)',
          borderTop: 'none',
          borderRadius: '0 0 4px 4px'
        }}>
          {/* All Helpers - Flat List */}
          {sortedHelperNames.map((helperName) => {
            const helperGroup = helpers[helperName];
            return (
              <div key={helperName} style={{
                marginBottom: '12px',
                padding: isOpen ? '12px' : '10px',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(100, 200, 255, 0.2)',
                borderRadius: '4px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: isOpen ? '13px' : '11px',
                    color: '#64C8FF',
                    fontWeight: '500'
                  }}>
                    {helperName}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{
                      padding: '4px 8px',
                      fontSize: isOpen ? '11px' : '10px',
                      backgroundColor: helperGroup.needsWork ? 'rgba(239, 68, 68, 0.2)' : 'rgba(74, 222, 128, 0.2)',
                      border: `1px solid ${helperGroup.needsWork ? 'rgba(239, 68, 68, 0.5)' : 'rgba(74, 222, 128, 0.5)'}`,
                      borderRadius: '4px',
                      color: helperGroup.needsWork ? '#ef4444' : '#4ade80',
                      fontWeight: '500'
                    }}>
                      {helperGroup.needsWork ? 'Needs Work' : 'Clean'}
                    </span>
                    <span style={{
                      padding: '4px 8px',
                      fontSize: isOpen ? '11px' : '10px',
                      backgroundColor: helperGroup.needsSave ? 'rgba(255, 165, 0, 0.2)' : 'rgba(100, 100, 100, 0.2)',
                      border: `1px solid ${helperGroup.needsSave ? 'rgba(255, 165, 0, 0.5)' : 'rgba(100, 100, 100, 0.5)'}`,
                      borderRadius: '4px',
                      color: helperGroup.needsSave ? '#ffa500' : 'rgba(150, 150, 150, 0.7)',
                      fontWeight: '500'
                    }}>
                      {helperGroup.needsSave ? 'Needs Save' : 'No Save'}
                    </span>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify({ helper: helperName, ...helperGroup }, null, 2), `${helperName} helper group`)}
                      style={{
                        padding: isOpen ? '6px 10px' : '4px 8px',
                        fontSize: isOpen ? '12px' : '10px',
                        backgroundColor: 'rgba(100, 200, 255, 0.2)',
                        border: '1px solid rgba(100, 200, 255, 0.5)',
                        borderRadius: '4px',
                        color: '#FFD700',
                        cursor: 'pointer'
                      }}
                      title="Copy helper group JSON"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                {helperGroup.fields && helperGroup.fields.length > 0 && (
                  renderFieldTable(helperGroup.fields)
                )}
              </div>
            );
          })}
          
        </div>
      </div>
    );
  };

  // Render content (shared between inline and modal)
  const renderContent = () => (
    <>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{
          fontSize: isOpen ? '16px' : '12px',
          fontWeight: '600',
          color: '#FFD700',
          flex: 1,
          minWidth: '200px'
        }}>
          Subtitle Report: {raw.subtitleId || 'Unknown'}
          {raw.reportVersion && (
            <span style={{ marginLeft: '8px', fontSize: isOpen ? '12px' : '10px', color: 'rgba(150, 150, 150, 0.7)' }}>
              v{raw.reportVersion}
            </span>
          )}
          {raw.errors && (raw.errors.missingFields.length > 0 || raw.errors.invalidFields.length > 0) && (
            <span style={{ marginLeft: '8px', fontSize: isOpen ? '12px' : '10px', color: 'rgba(255, 100, 100, 0.9)' }}>
              ({raw.errors.missingFields.length + raw.errors.invalidFields.length} errors)
            </span>
          )}
          {isOpen && currentIndex !== undefined && totalCount !== undefined && (
            <div style={{ marginTop: '4px', fontSize: isOpen ? '13px' : '11px', color: 'rgba(150, 150, 150, 0.7)' }}>
              Processing subtitle {currentIndex + 1}/{totalCount}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Process Next and Process All buttons - only show in modal */}
          {isOpen && onProcessNext && onProcessAll && (
            <>
              <button
                onClick={onProcessNext}
                disabled={!hasMore || processing}
                style={{
                  padding: isOpen ? '8px 12px' : '6px 10px',
                  fontSize: isOpen ? '14px' : '12px',
                  fontWeight: '500',
                  backgroundColor: (hasMore && !processing) ? 'rgba(100, 255, 100, 0.2)' : 'rgba(100, 255, 100, 0.1)',
                  border: '1px solid rgba(100, 255, 100, 0.5)',
                  borderRadius: '4px',
                  color: '#FFD700',
                  cursor: (hasMore && !processing) ? 'pointer' : 'not-allowed',
                  opacity: (hasMore && !processing) ? 1 : 0.5
                }}
              >
                Process Next
              </button>
              <button
                onClick={onProcessAll}
                disabled={!hasMore || processing}
                style={{
                  padding: isOpen ? '8px 12px' : '6px 10px',
                  fontSize: isOpen ? '14px' : '12px',
                  fontWeight: '500',
                  backgroundColor: (hasMore && !processing) ? 'rgba(100, 200, 255, 0.2)' : 'rgba(100, 200, 255, 0.1)',
                  border: '1px solid rgba(100, 200, 255, 0.5)',
                  borderRadius: '4px',
                  color: '#FFD700',
                  cursor: (hasMore && !processing) ? 'pointer' : 'not-allowed',
                  opacity: (hasMore && !processing) ? 1 : 0.5
                }}
              >
                Process All
              </button>
            </>
          )}
          {raw && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(raw, null, 2));
              }}
              style={{
                padding: isOpen ? '6px 10px' : '4px 8px',
                fontSize: isOpen ? '13px' : '11px',
                backgroundColor: 'rgba(100, 200, 255, 0.2)',
                border: '1px solid rgba(100, 200, 255, 0.5)',
                borderRadius: '4px',
                color: '#FFD700',
                cursor: 'pointer'
              }}
            >
              Copy JSON
            </button>
          )}
          <button
            onClick={() => setShowRawJson(!showRawJson)}
            style={{
              padding: isOpen ? '6px 10px' : '4px 8px',
              fontSize: isOpen ? '13px' : '11px',
              backgroundColor: 'rgba(255, 215, 0, 0.2)',
              border: '1px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '4px',
              color: '#FFD700',
              cursor: 'pointer'
            }}
          >
            {showRawJson ? 'Hide' : 'Show'} Raw JSON
          </button>
          {isOpen && onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '8px 12px',
                fontSize: '16px',
                fontWeight: '600',
                backgroundColor: 'rgba(255, 100, 100, 0.2)',
                border: '1px solid rgba(255, 100, 100, 0.5)',
                borderRadius: '4px',
                color: '#FFD700',
                cursor: 'pointer',
                lineHeight: '1'
              }}
              title="Close"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Helper Groups Section - Primary View */}
      {raw.helpers ? (
        <div style={{
          marginBottom: showRawJson ? '8px' : '0',
          overflowX: 'auto',
          overflowY: 'auto',
          flex: 1,
          minHeight: 0
        }}>
          {(() => {
            try {
              return renderHelperGroups(raw.helpers);
            } catch (err) {
              return <div style={{color:'red',padding:'10px'}}>Error rendering helpers: {err.message}</div>;
            }
          })()}
        </div>
      ) : null}

      {/* Raw JSON Display */}
      {showRawJson && raw && (
        <div style={{
          marginTop: '8px',
          flexShrink: 0
        }}>
          <pre style={{
            fontFamily: 'monospace',
            fontSize: isOpen ? '13px' : '11px',
            color: '#FFD700',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            padding: isOpen ? '12px' : '8px',
            borderRadius: '4px',
            overflowX: 'auto',
            maxHeight: isOpen ? '400px' : '200px',
            overflowY: 'auto',
            whiteSpace: 'pre',
            border: '1px solid rgba(255, 215, 0, 0.2)'
          }}>
            {JSON.stringify(raw, null, 2)}
          </pre>
          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(raw, null, 2));
            }}
            style={{
              marginTop: '4px',
              padding: isOpen ? '6px 10px' : '4px 8px',
              fontSize: isOpen ? '13px' : '11px',
              backgroundColor: 'rgba(100, 200, 255, 0.2)',
              border: '1px solid rgba(100, 200, 255, 0.5)',
              borderRadius: '4px',
              color: '#FFD700',
              cursor: 'pointer'
            }}
          >
            Copy Raw JSON
          </button>
        </div>
      )}
    </>
  );

  // If modal mode, render with overlay using portal to document.body
  if (isOpen) {
    return createPortal(
      <>
        {/* Modal Overlay */}
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {/* Modal Container */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '95vw',
              maxWidth: '1800px',
              height: '95vh',
              maxHeight: '95vh',
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              border: '2px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              overflow: 'hidden'
            }}>
              {renderContent()}
            </div>
          </div>
        </div>
      </>,
      document.body
    );
  }

  // Inline mode (backward compatibility)
  return (
    <div style={{
      marginTop: '12px',
      padding: '12px',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      border: '1px solid rgba(255, 215, 0, 0.3)',
      borderRadius: '4px'
    }}>
      {renderContent()}
    </div>
  );
}

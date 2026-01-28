/**
 * GPT Sense Popup Component
 * Displays GPT analysis and recommendations for sense selection
 */

import React, { useState } from 'react';

export function GPTSensePopup({ isOpen, onClose, analysis, senses, isLoading, onRefresh }) {
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  
  if (!isOpen) return null;
  
  // Loading state
  if (isLoading) {
    return React.createElement('div', {
      style: {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        border: '2px solid #FFD700',
        borderRadius: '8px',
        padding: '24px',
        minWidth: '400px',
        maxWidth: '600px',
        zIndex: 10000,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
      }
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }
      },
        React.createElement('div', {
          style: {
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255, 215, 0, 0.3)',
            borderTop: '3px solid #FFD700',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }
        }),
        React.createElement('style', {
          dangerouslySetInnerHTML: {
            __html: `
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            `
          }
        }),
        React.createElement('div', {
          style: {
            color: '#FFD700',
            fontSize: '18px',
            fontWeight: 'bold'
          }
        }, 'Analyzing with GPT...')
      )
    );
  }
  
  // Error or no analysis state
  if (!analysis || !analysis.senseScores || analysis.senseScores.length === 0) {
    return React.createElement('div', {
      style: {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        border: '2px solid #FFD700',
        borderRadius: '8px',
        padding: '24px',
        minWidth: '400px',
        maxWidth: '600px',
        zIndex: 10000,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
      }
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '1px solid rgba(255, 215, 0, 0.3)'
        }
      },
        React.createElement('h3', {
          style: {
            color: '#FFD700',
            fontSize: '20px',
            fontWeight: 'bold',
            margin: 0
          }
        }, 'GPT Sense Recommendation'),
        React.createElement('button', {
          onClick: onClose,
          style: {
            background: 'transparent',
            border: 'none',
            color: '#FFD700',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '0',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }
        }, '×')
      ),
      React.createElement('div', {
        style: {
          color: '#AAAAAA',
          textAlign: 'center',
          padding: '20px'
        }
      }, analysis?.overallReasoning || 'Unable to analyze. Please try again.'),
      onRefresh && React.createElement('button', {
        onClick: onRefresh,
        style: {
          marginTop: '16px',
          padding: '8px 16px',
          backgroundColor: '#FFD700',
          border: 'none',
          borderRadius: '4px',
          color: '#000000',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          width: '100%'
        }
      }, 'Retry Analysis')
    );
  }
  
  const recommendedIndex = analysis.recommendedSenseIndex;
  const senseScores = analysis.senseScores || [];
  
  return React.createElement('div', {
    style: {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      border: '2px solid #FFD700',
      borderRadius: '8px',
      padding: '24px',
      minWidth: '500px',
      maxWidth: '700px',
      maxHeight: '80vh',
      zIndex: 10000,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
      display: 'flex',
      flexDirection: 'column'
    }
  },
    // Header
    React.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid rgba(255, 215, 0, 0.3)'
      }
    },
      React.createElement('h3', {
        style: {
          color: '#FFD700',
          fontSize: '20px',
          fontWeight: 'bold',
          margin: 0
        }
      }, 'GPT Sense Recommendation'),
      React.createElement('button', {
        onClick: onClose,
        style: {
          background: 'transparent',
          border: 'none',
          color: '#FFD700',
          fontSize: '24px',
          cursor: 'pointer',
          padding: '0',
          width: '30px',
          height: '30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }
      }, '×')
    ),
    
    // Overall reasoning (collapsible)
    analysis.overallReasoning && React.createElement('div', {
      style: {
        marginBottom: '16px'
      }
    },
      React.createElement('button', {
        onClick: () => setIsReasoningExpanded(!isReasoningExpanded),
        style: {
          width: '100%',
          padding: '8px 12px',
          backgroundColor: 'rgba(255, 215, 0, 0.1)',
          border: '1px solid rgba(255, 215, 0, 0.3)',
          borderRadius: '4px',
          color: '#FFD700',
          cursor: 'pointer',
          fontSize: '14px',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }
      },
        React.createElement('span', {
          style: {
            fontWeight: 'bold'
          }
        }, 'Overall Analysis'),
        React.createElement('span', {
          style: {
            fontSize: '18px'
          }
        }, isReasoningExpanded ? '−' : '+')
      ),
      isReasoningExpanded && React.createElement('div', {
        style: {
          marginTop: '8px',
          padding: '12px',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '4px',
          color: '#CCCCCC',
          fontSize: '14px',
          lineHeight: '1.6'
        }
      }, analysis.overallReasoning)
    ),
    
    // Sense scores list
    React.createElement('div', {
      style: {
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginBottom: '16px'
      }
    },
      senseScores.map((score, idx) => {
        const sense = senses && senses[score.index] ? senses[score.index] : null;
        const isRecommended = recommendedIndex !== null && score.index === recommendedIndex;
        const confidence = score.confidence || 0;
        
        return React.createElement('div', {
          key: score.index,
          style: {
            padding: '12px',
            backgroundColor: isRecommended 
              ? 'rgba(0, 255, 136, 0.15)' 
              : 'rgba(255, 255, 255, 0.05)',
            border: isRecommended 
              ? '2px solid #00FF88' 
              : '1px solid rgba(255, 215, 0, 0.3)',
            borderRadius: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }
        },
          // Header with number badge and confidence
          React.createElement('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }
          },
            React.createElement('div', {
              style: {
                backgroundColor: isRecommended ? '#00FF88' : '#FFD700',
                color: '#000000',
                borderRadius: '4px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '18px',
                flexShrink: 0
              }
            }, score.index + 1),
            React.createElement('div', {
              style: {
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }
            },
              React.createElement('div', {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }
              },
                React.createElement('div', {
                  style: {
                    flex: 1,
                    height: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }
                },
                  React.createElement('div', {
                    style: {
                      width: `${confidence}%`,
                      height: '100%',
                      backgroundColor: confidence >= 70 ? '#00FF88' : confidence >= 40 ? '#FFD700' : '#FF6B6B',
                      transition: 'width 0.3s ease'
                    }
                  })
                ),
                React.createElement('div', {
                  style: {
                    color: '#CCCCCC',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    minWidth: '45px',
                    textAlign: 'right'
                  }
                }, `${confidence}%`)
              )
            ),
            isRecommended && React.createElement('div', {
              style: {
                color: '#00FF88',
                fontSize: '12px',
                fontWeight: 'bold',
                padding: '4px 8px',
                backgroundColor: 'rgba(0, 255, 136, 0.2)',
                borderRadius: '4px'
              }
            }, 'RECOMMENDED')
          ),
          
          // Sense details
          sense && React.createElement('div', {
            style: {
              marginLeft: '44px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }
          },
            sense.pos && React.createElement('div', {
              style: {
                color: '#AAAAAA',
                fontSize: '14px'
              }
            }, `POS: ${sense.pos}`),
            sense.definition && React.createElement('div', {
              style: {
                color: '#CCCCCC',
                fontSize: '14px',
                lineHeight: '1.5'
              }
            }, sense.definition)
          ),
          
          // Reasoning
          score.reasoning && React.createElement('div', {
            style: {
              marginLeft: '44px',
              marginTop: '4px',
              padding: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '4px',
              color: '#AAAAAA',
              fontSize: '12px',
              fontStyle: 'italic',
              lineHeight: '1.5'
            }
          }, score.reasoning)
        );
      })
    ),
    
    // Footer with refresh button
    React.createElement('div', {
      style: {
        display: 'flex',
        gap: '8px',
        paddingTop: '12px',
        borderTop: '1px solid rgba(255, 215, 0, 0.3)'
      }
    },
      onRefresh && React.createElement('button', {
        onClick: onRefresh,
        style: {
          flex: 1,
          padding: '10px',
          backgroundColor: 'rgba(255, 215, 0, 0.2)',
          border: '1px solid #FFD700',
          borderRadius: '4px',
          color: '#FFD700',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold'
        }
      }, 'Refresh Analysis'),
      React.createElement('button', {
        onClick: onClose,
        style: {
          flex: 1,
          padding: '10px',
          backgroundColor: '#FFD700',
          border: 'none',
          borderRadius: '4px',
          color: '#000000',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold'
        }
      }, 'Close')
    )
  );
}


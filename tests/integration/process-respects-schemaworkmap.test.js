/**
 * Test A: Process Respects SchemaWorkMap and Never Clears Signals
 * 
 * Purpose: Prove that processSubtitleToFat fills missing data based on schemaWorkMap 
 * signals and never modifies the work map.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock modules BEFORE importing code that uses them (Vitest hoists vi.mock() calls)
// Use relative paths from project root - Vitest resolves these to match imports
// Create mocks inside factory to avoid hoisting issues
vi.mock('../../src/content/02_process-subtitle/helpers/ai4thai-g2p.js', async () => {
  const { vi } = await import('vitest');
  return {
    getPhonetics: vi.fn(),
    handleThaiApiCall: vi.fn()
  };
});

vi.mock('../../src/content/02_process-subtitle/helpers/phonetic-parser.js', async () => {
  const { vi } = await import('vitest');
  return {
    parsePhoneticToEnglish: vi.fn()
  };
});

vi.mock('../../src/content/02_process-subtitle/helpers/orst.js', async () => {
  const { vi } = await import('vitest');
  return {
    scrapeOrstDictionary: vi.fn()
  };
});

vi.mock('../../src/content/02_process-subtitle/helpers/gpt-normalize-senses.js', async () => {
  const { vi } = await import('vitest');
  return {
    normalizeSensesWithGPT: vi.fn()
  };
});

// Import mocks for other dependencies
import '../mocks/chrome.js';
import '../mocks/firebase.js';
import '../mocks/load-helpers.js';
import '../mocks/gpt-config.js';

// Now import the code under test (mocks are already registered)
import { processSubtitleToFat } from '../../src/content/02_process-subtitle/process-subtitle-orchestrator.js';
import { setupMockWord, clearLoadMocks, mockLoadWord } from '../mocks/load-helpers.js';
import fatBundleWithGaps from '../fixtures/fat-bundle-with-gaps.json' assert { type: 'json' };

// Get mock references after importing the mocked modules
import * as ai4thaiG2P from '../../src/content/02_process-subtitle/helpers/ai4thai-g2p.js';
import * as phoneticParser from '../../src/content/02_process-subtitle/helpers/phonetic-parser.js';
import * as orst from '../../src/content/02_process-subtitle/helpers/orst.js';
import * as gptNormalize from '../../src/content/02_process-subtitle/helpers/gpt-normalize-senses.js';

const mockGetPhonetics = vi.mocked(ai4thaiG2P.getPhonetics);
const mockParsePhoneticToEnglish = vi.mocked(phoneticParser.parsePhoneticToEnglish);
const mockScrapeOrstDictionary = vi.mocked(orst.scrapeOrstDictionary);
const mockNormalizeSensesWithGPT = vi.mocked(gptNormalize.normalizeSensesWithGPT);

describe('Process Respects SchemaWorkMap and Never Clears Signals', () => {
  beforeEach(() => {
    // Clear call history but keep implementations
    vi.clearAllMocks();
    clearLoadMocks();
    
    // Reset mock implementations (vi.clearAllMocks() clears implementations too)
    mockGetPhonetics.mockImplementation((word) => {
      const fixedReturns = {
        'รถ': 'r-@@4-t',
        'ไฟ': 'f-a0-j',
      };
      return Promise.resolve(fixedReturns[word] || 'mocked-g2p');
    });
    
    mockParsePhoneticToEnglish.mockImplementation((g2p) => {
      const fixedReturns = {
        'r-@@4-t': 'rot',
        'f-a0-j': 'fai',
      };
      return fixedReturns[g2p] || 'mocked-phonetic';
    });
    
    mockScrapeOrstDictionary.mockResolvedValue([
      {
        thaiWord: 'รถ',
        senseNumber: 1,
        pos: 'น.',
        meaningThai: 'ยานพาหนะ',
        meaningEnglish: 'vehicle',
        source: 'orst',
        normalized: false
      }
    ]);
    
    mockNormalizeSensesWithGPT.mockResolvedValue([
      {
        thaiWord: 'รถ',
        senseNumber: 1,
        normalized: true,
        descriptionThai: 'ยานพาหนะ',
        descriptionEnglish: 'vehicle',
        meaningThai: 'ยานพาหนะ',
        meaningEnglish: 'vehicle',
        pos: 'น.',
        posEnglish: 'noun',
        source: 'orst',
        normalizedAt: new Date().toISOString(),
        normalizationVersion: '1.0',
        confidence: 95
      }
    ]);
  });

  it('should fill missing data based on schemaWorkMap signals', async () => {
    // Arrange
    const fatBundle = JSON.parse(JSON.stringify(fatBundleWithGaps));
    const schemaWorkMap = {
      id: false,
      startSecThai: false,
      endSecThai: false,
      startSecEng: false,
      endSecEng: false,
      thai: false,
      english: false,
      wordReferenceIdsThai: false,
      wordReferenceIdsEng: false,
      tokens: {
        display: [
          {
            index: false,
            thaiScript: false,
            g2p: true,  // Signal: needs G2P
            englishPhonetic: true  // Signal: needs English phonetic
          }
        ],
        senses: [
          {
            index: false,
            senses: true  // Signal: needs senses
          }
        ],
        displayEng: [],
        sensesEng: []
      }
    };

    const options = {
      showName: 'test-show',
      mediaId: 'test-mediaId',
      episode: null,
      season: null
    };

    // Set up mock to return processed data after first null call
    // Simulates: first call (word doesn't exist) -> processTokens processes -> reload returns processed data
    let callCount = 0;
    mockLoadWord.mockImplementation((id, collection) => {
      if (id === 'รถ' && collection === 'wordsThai') {
        callCount++;
        // First call: word doesn't exist yet (called from processTokens)
        if (callCount === 1) {
          return Promise.resolve(null);
        }
        // Second+ call: word has been processed and "saved" (called from reload after processTokens)
        return Promise.resolve({
          wordId: 'รถ',
          thaiScript: 'รถ',
          g2p: 'r-@@4-t',
          englishPhonetic: 'rot',
          senses: [
            {
              thaiWord: 'รถ',
              senseNumber: 1,
              normalized: true,
              descriptionThai: 'ยานพาหนะ',
              descriptionEnglish: 'vehicle',
              meaningThai: 'ยานพาหนะ',
              meaningEnglish: 'vehicle',
              pos: 'น.',
              posEnglish: 'noun',
              source: 'orst',
              normalizedAt: new Date().toISOString(),
              normalizationVersion: '1.0',
              confidence: 95
            }
          ]
        });
      }
      return Promise.resolve(null);
    });

    // Act
    const result = await processSubtitleToFat(
      { subtitle: fatBundle },
      schemaWorkMap,
      options,
      null // progressCallback
    );

    // Assert - Bundle should be filled (tokens were updated after processTokens + reload)
    // The code reloads word data after processTokens, so tokens should reflect the processed data
    expect(result.tokens.display[0].g2p).toBe('r-@@4-t');
    expect(result.tokens.display[0].englishPhonetic).toBe('rot');
    expect(result.tokens.senses[0].senses).toHaveLength(1);
    expect(result.tokens.senses[0].senses[0].thaiWord).toBe('รถ');
    expect(result.tokens.senses[0].senses[0].normalized).toBe(true);
    
    // Assert - Return structure
    expect(result).toHaveProperty('subtitle');
    expect(result).toHaveProperty('tokens');
    expect(result).toHaveProperty('schemaWorkMap');

    // Assert - schemaWorkMap should be unchanged
    expect(schemaWorkMap.tokens.display[0].g2p).toBe(true); // Unchanged
    expect(schemaWorkMap.tokens.display[0].englishPhonetic).toBe(true); // Unchanged
    expect(schemaWorkMap.tokens.senses[0].senses).toBe(true); // Unchanged

    // Assert - Mock functions were called
    expect(mockGetPhonetics).toHaveBeenCalledWith('รถ');
    expect(mockParsePhoneticToEnglish).toHaveBeenCalledWith('r-@@4-t');
    expect(mockScrapeOrstDictionary).toHaveBeenCalledWith('รถ');
    expect(mockNormalizeSensesWithGPT).toHaveBeenCalled();
  });

  it('should not modify unrelated fields when signals are false', async () => {
    // Arrange
    const fatBundle = JSON.parse(JSON.stringify(fatBundleWithGaps));
    // Add a second token that should NOT be processed
    fatBundle.tokens.display.push({
      index: 1,
      thaiScript: 'ไฟ',
      g2p: null,
      englishPhonetic: null
    });
    fatBundle.tokens.senses.push({
      index: 1,
      senses: []
    });
    fatBundle.wordReferenceIdsThai.push('ไฟ:0');

    const schemaWorkMap = {
      id: false,
      startSecThai: false,
      endSecThai: false,
      startSecEng: false,
      endSecEng: false,
      thai: false,
      english: false,
      wordReferenceIdsThai: false,
      wordReferenceIdsEng: false,
      tokens: {
        display: [
          {
            index: false,
            thaiScript: false,
            g2p: true,  // Token 0 needs work
            englishPhonetic: true
          },
          {
            index: false,
            thaiScript: false,
            g2p: false,  // Token 1 does NOT need work
            englishPhonetic: false
          }
        ],
        senses: [
          {
            index: false,
            senses: true  // Token 0 needs senses
          },
          {
            index: false,
            senses: false  // Token 1 does NOT need senses
          }
        ],
        displayEng: [],
        sensesEng: []
      }
    };

    const options = {
      showName: 'test-show',
      mediaId: 'test-mediaId',
      episode: null,
      season: null
    };

    // Set up mock to return processed data after first null call
    // Track calls per word: 'รถ' gets processed, 'ไฟ' doesn't
    const wordCallCounts = new Map();
    mockLoadWord.mockImplementation((id, collection) => {
      if ((id === 'รถ' || id === 'ไฟ') && collection === 'wordsThai') {
        const key = `${id}:${collection}`;
        const count = (wordCallCounts.get(key) || 0) + 1;
        wordCallCounts.set(key, count);
        
        // First call: word doesn't exist yet
        if (count === 1) {
          return Promise.resolve(null);
        }
        // Second+ call: return processed data for 'รถ' only (it was processed)
        if (id === 'รถ') {
          return Promise.resolve({
            wordId: 'รถ',
            thaiScript: 'รถ',
            g2p: 'r-@@4-t',
            englishPhonetic: 'rot',
            senses: [
              {
                thaiWord: 'รถ',
                senseNumber: 1,
                normalized: true,
                descriptionThai: 'ยานพาหนะ',
                descriptionEnglish: 'vehicle',
                meaningThai: 'ยานพาหนะ',
                meaningEnglish: 'vehicle',
                pos: 'น.',
                posEnglish: 'noun',
                source: 'orst',
                normalizedAt: new Date().toISOString(),
                normalizationVersion: '1.0',
                confidence: 95
              }
            ]
          });
        }
        // 'ไฟ' wasn't processed, so return null
        return Promise.resolve(null);
      }
      return Promise.resolve(null);
    });

    // Act
    const result = await processSubtitleToFat(
      { subtitle: fatBundle },
      schemaWorkMap,
      options,
      null
    );

    // Assert - Token 0 should be filled
    expect(result.tokens.display[0].g2p).toBe('r-@@4-t');
    expect(result.tokens.display[0].englishPhonetic).toBe('rot');
    expect(result.tokens.senses[0].senses).toHaveLength(1);

    // Assert - Token 1 should remain unchanged (null)
    expect(result.tokens.display[1].g2p).toBeNull();
    expect(result.tokens.display[1].englishPhonetic).toBeNull();
    expect(result.tokens.senses[1].senses).toHaveLength(0);

    // Assert - schemaWorkMap unchanged
    expect(schemaWorkMap.tokens.display[0].g2p).toBe(true);
    expect(schemaWorkMap.tokens.display[1].g2p).toBe(false);
  });
});

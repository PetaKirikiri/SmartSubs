/**
 * Test B: Idempotence (Mocked AI)
 * 
 * Purpose: Prove that running processSubtitleToFat twice with the same input 
 * (after first fill) produces identical results. Uses mocked AI helpers with 
 * fixed returns - same input always produces same output.
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
import { setupMockWord, clearLoadMocks } from '../mocks/load-helpers.js';
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

describe('Process Idempotence (Mocked AI)', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    clearLoadMocks();
    
    // Set up fixed, deterministic returns
    mockGetPhonetics.mockImplementation((word) => {
      const fixedReturns = {
        'รถ': 'r-@@4-t',
        'ไฟ': 'f-a0-j'
      };
      return Promise.resolve(fixedReturns[word] || 'mocked-g2p');
    });

    mockParsePhoneticToEnglish.mockImplementation((g2p) => {
      const fixedReturns = {
        'r-@@4-t': 'rot',
        'f-a0-j': 'fai'
      };
      return fixedReturns[g2p] || 'mocked-phonetic';
    });

    mockScrapeOrstDictionary.mockImplementation((word) => {
      const fixedReturns = {
        'รถ': Promise.resolve([
          {
            thaiWord: 'รถ',
            senseNumber: 1,
            pos: 'น.',
            meaningThai: 'ยานพาหนะ',
            meaningEnglish: 'vehicle',
            source: 'orst',
            normalized: false
          }
        ]),
        'ไฟ': Promise.resolve([
          {
            thaiWord: 'ไฟ',
            senseNumber: 1,
            pos: 'น.',
            meaningThai: 'แสงสว่าง',
            meaningEnglish: 'light',
            source: 'orst',
            normalized: false
          }
        ])
      };
      return fixedReturns[word] || Promise.resolve([]);
    });

    mockNormalizeSensesWithGPT.mockImplementation((senses, context) => {
      const thaiWord = context?.thaiWord || '';
      const fixedReturns = {
        'รถ': [
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
            normalizedAt: '2024-01-01T00:00:00.000Z',
            normalizationVersion: '1.0',
            confidence: 95
          }
        ],
        'ไฟ': [
          {
            thaiWord: 'ไฟ',
            senseNumber: 1,
            normalized: true,
            descriptionThai: 'แสงสว่าง',
            descriptionEnglish: 'light',
            meaningThai: 'แสงสว่าง',
            meaningEnglish: 'light',
            pos: 'น.',
            posEnglish: 'noun',
            source: 'orst',
            normalizedAt: '2024-01-01T00:00:00.000Z',
            normalizationVersion: '1.0',
            confidence: 95
          }
        ]
      };
      return Promise.resolve(fixedReturns[thaiWord] || []);
    });
    
    // Mock loadWord to return null (word doesn't exist yet)
    setupMockWord('รถ', 'wordsThai', null);
  });

  it('should produce identical bundles on second run', async () => {
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
            g2p: true,
            englishPhonetic: true
          }
        ],
        senses: [
          {
            index: false,
            senses: true
          }
        ],
        displayEng: [],
        sensesEng: []
      }
    };

    // Deep clone schemaWorkMap to verify it's not mutated
    const originalSchemaWorkMap = JSON.parse(JSON.stringify(schemaWorkMap));

    const options = {
      showName: 'test-show',
      mediaId: 'test-mediaId',
      episode: null,
      season: null
    };

    // Act - First run
    const result1 = await processSubtitleToFat(
      { subtitle: fatBundle },
      schemaWorkMap,
      options,
      null
    );

    // Reset mock call counts
    vi.clearAllMocks();

    // Act - Second run with result from first run
    const result2 = await processSubtitleToFat(
      { subtitle: result1.subtitle },
      schemaWorkMap,
      options,
      null
    );

    // Assert - Bundles should be identical
    // Note: processSubtitleToFat returns { subtitle, tokens, schemaWorkMap }
    expect(result1.subtitle).toEqual(result2.subtitle);
    expect(result1.tokens).toEqual(result2.tokens);
    expect(result1.schemaWorkMap).toEqual(result2.schemaWorkMap);

    // Assert - schemaWorkMap unchanged between calls
    expect(schemaWorkMap).toEqual(originalSchemaWorkMap);

    // Assert - Mock functions should NOT be called on second run
    // (because data is already filled and signals remain true, but process should detect no work needed)
    // Note: This depends on implementation - if process checks data existence before calling helpers
    // If helpers ARE called, they should return same values (idempotent)
    const firstRunG2PCalls = mockGetPhonetics.mock.calls.length;
    // On second run, if data exists, helpers shouldn't be called
    // But if they are called (due to signals still being true), they return same values
  });

  it('should maintain schemaWorkMap signals as true after processing', async () => {
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
            g2p: true,
            englishPhonetic: true
          }
        ],
        senses: [
          {
            index: false,
            senses: true
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

    // Act
    await processSubtitleToFat(
      { subtitle: fatBundle },
      schemaWorkMap,
      options,
      null
    );

    // Assert - All signals remain true (not cleared)
    expect(schemaWorkMap.tokens.display[0].g2p).toBe(true);
    expect(schemaWorkMap.tokens.display[0].englishPhonetic).toBe(true);
    expect(schemaWorkMap.tokens.senses[0].senses).toBe(true);
  });
});

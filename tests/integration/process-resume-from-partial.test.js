/**
 * Test: Resume from Partial State (Recovery Guarantee)
 * 
 * Purpose: Prove that a partially filled fat bundle (from crash, cancel, network error)
 * when re-run through the same real process code will:
 * - Skip completed work
 * - Only run missing helpers
 * - Not regress or overwrite good data
 * - Converge to a fully filled state
 * 
 * This is a resume/recovery guarantee test - not AI-dependent, tests pipeline behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock modules BEFORE importing code that uses them (Vitest hoists vi.mock() calls)
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
import { generateSchemaWorkMap } from '../../src/content/02_process-subtitle/helpers/schema-work-map-builder.js';
import { setupMockWord, clearLoadMocks, mockLoadWord } from '../mocks/load-helpers.js';

// Get mock references after importing the mocked modules
import * as ai4thaiG2P from '../../src/content/02_process-subtitle/helpers/ai4thai-g2p.js';
import * as phoneticParser from '../../src/content/02_process-subtitle/helpers/phonetic-parser.js';
import * as orst from '../../src/content/02_process-subtitle/helpers/orst.js';
import * as gptNormalize from '../../src/content/02_process-subtitle/helpers/gpt-normalize-senses.js';

const mockGetPhonetics = vi.mocked(ai4thaiG2P.getPhonetics);
const mockParsePhoneticToEnglish = vi.mocked(phoneticParser.parsePhoneticToEnglish);
const mockScrapeOrstDictionary = vi.mocked(orst.scrapeOrstDictionary);
const mockNormalizeSensesWithGPT = vi.mocked(gptNormalize.normalizeSensesWithGPT);

describe('Process Resume from Partial State (Recovery Guarantee)', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    clearLoadMocks();
    
    // Set up fixed, deterministic returns for helpers
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
  });

  it('should skip completed work and only run missing helpers', async () => {
    // Arrange: Create partially filled fat bundle (simulating interrupted state)
    // Tokenized ✓, G2P ✓, Phonetics ✗
    const partialFatBundle = {
      id: 'test-mediaId-0',
      startSecThai: 0.0,
      endSecThai: 5.0,
      startSecEng: null,
      endSecEng: null,
      thai: 'รถ',
      english: '',
      wordReferenceIdsThai: ['รถ:0'],
      wordReferenceIdsEng: [],
      tokens: {
        display: [
          {
            index: 0,
            thaiScript: 'รถ',
            g2p: 'r-@@4-t', // ✓ G2P already filled
            englishPhonetic: null // ✗ Phonetics missing
          }
        ],
        senses: [
          {
            index: 0,
            senses: [] // Empty - will be processed if schemaWorkMap indicates work needed
          }
        ],
        displayEng: [],
        sensesEng: []
      }
    };

    // Store original G2P value to verify it's preserved
    const originalG2P = partialFatBundle.tokens.display[0].g2p;

    // Set up mock loadWord to return word data with G2P already filled
    // This simulates the word existing in Firebase with G2P but missing other fields
    let callCount = 0;
    mockLoadWord.mockImplementation((id, collection) => {
      if (id === 'รถ' && collection === 'wordsThai') {
        callCount++;
        // First call: return existing word data with G2P
        if (callCount === 1) {
          return Promise.resolve({
            wordId: 'รถ',
            thaiScript: 'รถ',
            g2p: 'r-@@4-t', // G2P exists (completed work)
            englishPhonetic: null, // Phonetics missing
            senses: [] // Senses missing
          });
        }
        // Subsequent calls: return updated data after processing
        return Promise.resolve({
          wordId: 'รถ',
          thaiScript: 'รถ',
          g2p: 'r-@@4-t',
          englishPhonetic: 'rot', // Now filled
          senses: [
            {
              thaiWord: 'รถ',
              senseNumber: 1,
              normalized: true,
              descriptionThai: 'ยานพาหนะ',
              descriptionEnglish: 'vehicle',
              pos: 'น.',
              posEnglish: 'noun',
              source: 'orst'
            }
          ]
        });
      }
      return Promise.resolve(null);
    });

    // Generate schemaWorkMap from partial bundle - should detect missing fields
    const schemaWorkMap = await generateSchemaWorkMap(partialFatBundle, 'test-mediaId-0', {
      showName: 'test-show',
      mediaId: 'test-mediaId'
    });

    // Verify schemaWorkMap correctly identifies what needs work
    expect(schemaWorkMap.tokens.display[0].g2p).toBe(false); // G2P complete
    expect(schemaWorkMap.tokens.display[0].englishPhonetic).toBe(true); // Phonetics needs work

    const options = {
      showName: 'test-show',
      mediaId: 'test-mediaId',
      episode: null,
      season: null
    };

    // Act: Process the partial bundle
    const result = await processSubtitleToFat(
      { subtitle: partialFatBundle },
      schemaWorkMap,
      options,
      null
    );

    // Assert: Completed work preserved
    // G2P value should remain unchanged (not overwritten)
    expect(result.tokens.display[0].g2p).toBe(originalG2P);
    expect(result.tokens.display[0].g2p).toBe('r-@@4-t');

    // Assert: Only missing helpers were called
    // G2P helper should NOT be called (already complete)
    expect(mockGetPhonetics).not.toHaveBeenCalled();

    // Phonetics parser SHOULD be called (missing field)
    expect(mockParsePhoneticToEnglish).toHaveBeenCalledWith('r-@@4-t');
    
    // Assert: Bundle converges - phonetics filled (G2P was already complete)
    expect(result.tokens.display[0].englishPhonetic).toBe('rot'); // Phonetics filled
    expect(result.tokens.display[0].g2p).toBe(originalG2P); // G2P preserved
  });

  it('should preserve existing data when resuming from partial state', async () => {
    // Arrange: Create partial bundle with more complex state
    // Multiple tokens, some complete, some partial
    const partialFatBundle = {
      id: 'test-mediaId-1',
      startSecThai: 0.0,
      endSecThai: 5.0,
      startSecEng: null,
      endSecEng: null,
      thai: 'รถไฟ',
      english: '',
      wordReferenceIdsThai: ['รถ:0', 'ไฟ:0'],
      wordReferenceIdsEng: [],
      tokens: {
        display: [
          {
            index: 0,
            thaiScript: 'รถ',
            g2p: 'r-@@4-t', // ✓ Complete
            englishPhonetic: 'rot' // ✓ Complete
          },
          {
            index: 1,
            thaiScript: 'ไฟ',
            g2p: 'f-a0-j', // ✓ Complete
            englishPhonetic: null // ✗ Missing
          }
        ],
        senses: [
          {
            index: 0,
            senses: [
              {
                thaiWord: 'รถ',
                senseNumber: 1,
                normalized: true,
                descriptionThai: 'ยานพาหนะ',
                descriptionEnglish: 'vehicle',
                pos: 'น.',
                posEnglish: 'noun',
                source: 'orst'
              }
            ] // ✓ Complete for token 0
          },
          {
            index: 1,
            senses: [] // ✗ Missing for token 1
          }
        ],
        displayEng: [],
        sensesEng: []
      }
    };

    // Store original values
    const originalToken0G2P = partialFatBundle.tokens.display[0].g2p;
    const originalToken0Phonetic = partialFatBundle.tokens.display[0].englishPhonetic;
    const originalToken0Senses = JSON.parse(JSON.stringify(partialFatBundle.tokens.senses[0].senses));
    const originalToken1G2P = partialFatBundle.tokens.display[1].g2p;

    // Set up mock loadWord to return existing data
    mockLoadWord.mockImplementation((id, collection) => {
      if (collection === 'wordsThai') {
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
                pos: 'น.',
                posEnglish: 'noun',
                source: 'orst'
              }
            ]
          });
        }
        if (id === 'ไฟ') {
          return Promise.resolve({
            wordId: 'ไฟ',
            thaiScript: 'ไฟ',
            g2p: 'f-a0-j',
            englishPhonetic: null, // Missing
            senses: [] // Missing
          });
        }
      }
      return Promise.resolve(null);
    });

    // Generate schemaWorkMap
    const schemaWorkMap = await generateSchemaWorkMap(partialFatBundle, 'test-mediaId-1', {
      showName: 'test-show',
      mediaId: 'test-mediaId'
    });

    // Verify schemaWorkMap correctly identifies work needed
    expect(schemaWorkMap.tokens.display[0].g2p).toBe(false); // Complete
    expect(schemaWorkMap.tokens.display[0].englishPhonetic).toBe(false); // Complete
    expect(schemaWorkMap.tokens.display[1].g2p).toBe(false); // Complete
    expect(schemaWorkMap.tokens.display[1].englishPhonetic).toBe(true); // Needs work
    expect(Array.isArray(schemaWorkMap.tokens.senses[0].senses)).toBe(true); // Token 0 has senses
    expect(schemaWorkMap.tokens.senses[1].senses).toEqual([]); // Token 1 needs senses

    const options = {
      showName: 'test-show',
      mediaId: 'test-mediaId',
      episode: null,
      season: null
    };

    // Act: Process the partial bundle
    const result = await processSubtitleToFat(
      { subtitle: partialFatBundle },
      schemaWorkMap,
      options,
      null
    );

    // Assert: Token 0 data preserved (all complete, no helpers called for it)
    expect(result.tokens.display[0].g2p).toBe(originalToken0G2P);
    expect(result.tokens.display[0].englishPhonetic).toBe(originalToken0Phonetic);
    expect(result.tokens.senses[0].senses).toEqual(originalToken0Senses);

    // Assert: Token 1 missing fields filled
    expect(result.tokens.display[1].g2p).toBe(originalToken1G2P); // Preserved
    expect(result.tokens.display[1].englishPhonetic).toBe('fai'); // Filled
    expect(result.tokens.senses[1].senses).toHaveLength(1); // Filled

    // Assert: Only helpers for token 1 missing fields were called
    // Token 0: No helpers called (all complete)
    // Token 1: Phonetics parser and ORST/GPT called
    expect(mockGetPhonetics).not.toHaveBeenCalled(); // G2P already exists for both
    expect(mockParsePhoneticToEnglish).toHaveBeenCalledWith('f-a0-j'); // Only for token 1
    expect(mockScrapeOrstDictionary).toHaveBeenCalledWith('ไฟ'); // Only for token 1
    expect(mockNormalizeSensesWithGPT).toHaveBeenCalled(); // Only for token 1
  });

  it('should converge to fully filled state from any partial state', async () => {
    // Arrange: Create bundle with only tokenization complete
    const minimalFatBundle = {
      id: 'test-mediaId-2',
      startSecThai: 0.0,
      endSecThai: 5.0,
      startSecEng: null,
      endSecEng: null,
      thai: 'รถ',
      english: '',
      wordReferenceIdsThai: ['รถ:0'],
      wordReferenceIdsEng: [],
      tokens: {
        display: [
          {
            index: 0,
            thaiScript: 'รถ',
            g2p: null, // ✗ Missing
            englishPhonetic: null // ✗ Missing
          }
        ],
        senses: [
          {
            index: 0,
            senses: [] // ✗ Missing
          }
        ],
        displayEng: [],
        sensesEng: []
      }
    };

    // Set up mock loadWord to return null (word doesn't exist)
    mockLoadWord.mockImplementation(() => Promise.resolve(null));

    // Generate schemaWorkMap
    const schemaWorkMap = await generateSchemaWorkMap(minimalFatBundle, 'test-mediaId-2', {
      showName: 'test-show',
      mediaId: 'test-mediaId'
    });

    // Verify all fields need work
    expect(schemaWorkMap.tokens.display[0].g2p).toBe(true);
    expect(schemaWorkMap.tokens.display[0].englishPhonetic).toBe(true);
    expect(schemaWorkMap.tokens.senses[0].senses).toEqual([]);

    const options = {
      showName: 'test-show',
      mediaId: 'test-mediaId',
      episode: null,
      season: null
    };

    // Act: Process from minimal state
    const result = await processSubtitleToFat(
      { subtitle: minimalFatBundle },
      schemaWorkMap,
      options,
      null
    );

    // Assert: All helpers called (all fields missing)
    expect(mockGetPhonetics).toHaveBeenCalledWith('รถ');
    expect(mockParsePhoneticToEnglish).toHaveBeenCalledWith('r-@@4-t');
    expect(mockScrapeOrstDictionary).toHaveBeenCalledWith('รถ');
    expect(mockNormalizeSensesWithGPT).toHaveBeenCalled();

    // Assert: Bundle fully filled
    expect(result.tokens.display[0].g2p).toBe('r-@@4-t');
    expect(result.tokens.display[0].englishPhonetic).toBe('rot');
    expect(result.tokens.senses[0].senses).toHaveLength(1);
    expect(result.tokens.senses[0].senses[0].normalized).toBe(true);
  });
});

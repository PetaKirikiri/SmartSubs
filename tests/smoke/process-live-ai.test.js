/**
 * Test D: Smoke Test with Live AI (Optional)
 * 
 * Purpose: Verify the pipeline doesn't crash with real AI services.
 * Does NOT assert exact output matching (AI responses vary).
 * 
 * Note: This test requires API keys in .env file.
 * Skip if API keys are not available.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { processSubtitleToFat } from '../../src/content/02_process-subtitle/process-subtitle-orchestrator.js';
import { validateFatSubtitle } from '../../src/content/02_process-subtitle/helpers/schema-work-map-builder.js';
import fatBundleWithGaps from '../fixtures/fat-bundle-with-gaps.json' assert { type: 'json' };

// Import mocks (but don't mock AI helpers - use real APIs)
import '../mocks/chrome.js';
import '../mocks/firebase.js';
import '../mocks/load-helpers.js';

describe.skip('Smoke Test with Live AI', () => {
  // Skip by default - uncomment describe.skip to enable
  // Requires: VITE_AI4THAI_API_KEY, VITE_OPENAI_API_KEY in .env

  beforeAll(() => {
    // Check if API keys are available
    // If not, skip all tests in this suite
  });

  it('should not crash with real AI services', async () => {
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

    // Act & Assert - Should not throw
    await expect(
      processSubtitleToFat(
        { subtitle: fatBundle },
        schemaWorkMap,
        options,
        null
      )
    ).resolves.toBeDefined();

    const result = await processSubtitleToFat(
      { subtitle: fatBundle },
      schemaWorkMap,
      options,
      null
    );

    // Assert - Sanity checks only (no exact output matching)
    expect(() => validateFatSubtitle(result)).not.toThrow();
    expect(result.tokens.display[0].g2p).toBeTruthy();
    expect(result.tokens.display[0].englishPhonetic).toBeTruthy();
    expect(result.tokens.senses[0].senses.length).toBeGreaterThan(0);
    
    // Assert - SchemaWorkMap signals remain true (not cleared)
    expect(schemaWorkMap.tokens.display[0].g2p).toBe(true);
    expect(schemaWorkMap.tokens.display[0].englishPhonetic).toBe(true);
    expect(schemaWorkMap.tokens.senses[0].senses).toBe(true);
  });
});

/**
 * Test E: Completeness Test with Live AI (Optional)
 * 
 * Purpose: After processing with live AI, verify no new work flags are created.
 * Tests completeness, not identical phrasing.
 * 
 * Note: This test requires API keys in .env file.
 * Skip if API keys are not available.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { processSubtitleToFat } from '../../src/content/02_process-subtitle/process-subtitle-orchestrator.js';
import { generateSchemaWorkMap } from '../../src/content/02_process-subtitle/helpers/schema-work-map-builder.js';
import fatBundleWithGaps from '../fixtures/fat-bundle-with-gaps.json' assert { type: 'json' };

// Import mocks (but don't mock AI helpers - use real APIs)
import '../mocks/chrome.js';
import '../mocks/firebase.js';
import '../mocks/load-helpers.js';

describe.skip('Completeness Test with Live AI', () => {
  // Skip by default - uncomment describe.skip to enable
  // Requires: VITE_AI4THAI_API_KEY, VITE_OPENAI_API_KEY in .env

  beforeAll(() => {
    // Check if API keys are available
    // If not, skip all tests in this suite
  });

  it('should have no work flags after processing', async () => {
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

    // Act - Process with live AI
    const result = await processSubtitleToFat(
      { subtitle: fatBundle },
      schemaWorkMap,
      options,
      null
    );

    // Simulate save and reload (in real scenario, would save to Firestore and reload)
    // For test, just generate new schemaWorkMap from processed bundle
    const newSchemaWorkMap = await generateSchemaWorkMap(
      result.subtitle,
      result.subtitle.id,
      options
    );

    // Assert - All work flags should be false (complete)
    expect(newSchemaWorkMap.tokens.display[0].g2p).toBe(false); // Complete
    expect(newSchemaWorkMap.tokens.display[0].englishPhonetic).toBe(false); // Complete
    expect(newSchemaWorkMap.tokens.senses[0].senses).toBe(false); // Complete (or empty array if using adaptive structure)

    // Assert - No new work was created (completeness check)
    // All fields that were processed should now be false
    expect(newSchemaWorkMap.wordReferenceIdsThai).toBe(false);
  });
});

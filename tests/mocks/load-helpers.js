/**
 * Load Helpers Mock for Node Tests
 * Mocks loadWord and related functions for testing without real Firebase
 */

import { vi } from 'vitest';

export const mockLoadWord = vi.fn();
export const mockCheckIfOrstFailed = vi.fn();

// Mock load-helpers.js
vi.mock('../../src/content/01_load-subtitles/helpers/load-helpers.js', () => ({
  loadWord: mockLoadWord,
  loadWordsByIds: vi.fn(() => Promise.resolve([])),
  fetchWordMetadataForSubtitle: vi.fn(() => Promise.resolve(new Map()))
}));

// Mock load-subtitles-orchestrator.js (also exports loadWord)
vi.mock('../../src/content/01_load-subtitles/load-subtitles-orchestrator.js', () => ({
  loadWord: mockLoadWord
}));

// Mock word-save-helpers.js
vi.mock('../../src/content/02_process-subtitle/helpers/word-save-helpers.js', () => ({
  checkIfOrstFailed: mockCheckIfOrstFailed,
  updateWordMatchesSave: vi.fn(() => Promise.resolve())
}));

// Helper to set up mock word data
export function setupMockWord(wordId, collectionName, data) {
  mockLoadWord.mockImplementation((id, collection) => {
    if (id === wordId && collection === collectionName) {
      return Promise.resolve(data);
    }
    return Promise.resolve(null);
  });
}

// Helper to clear mocks
export function clearLoadMocks() {
  mockLoadWord.mockClear();
  mockCheckIfOrstFailed.mockClear();
  mockCheckIfOrstFailed.mockResolvedValue(false); // Default: not failed
}

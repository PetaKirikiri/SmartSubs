/**
 * Helper Function Mocks for Node Tests
 * Mocks AI helpers with fixed, deterministic returns for idempotence testing
 */

import { vi } from 'vitest';

export const mockGetPhonetics = vi.fn();
export const mockParsePhoneticToEnglish = vi.fn();
export const mockScrapeOrstDictionary = vi.fn();
export const mockNormalizeSensesWithGPT = vi.fn();

// Fixed returns - same input always produces same output
mockGetPhonetics.mockImplementation((word) => {
  const fixedReturns = {
    'รถ': 'r-@@4-t',
    'ไฟ': 'f-a0-j',
    'น้ำ': 'n-a0-m',
    'คน': 'kh-o0-n',
    // Add more fixed mappings as needed
  };
  return Promise.resolve(fixedReturns[word] || 'mocked-g2p');
});

mockParsePhoneticToEnglish.mockImplementation((g2p) => {
  const fixedReturns = {
    'r-@@4-t': 'rot',
    'f-a0-j': 'fai',
    'n-a0-m': 'nam',
    'kh-o0-n': 'khon',
    // Add more fixed mappings as needed
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
    descriptionThai: 'ยานพาหนะที่ใช้ในการเดินทาง',
    descriptionEnglish: 'A vehicle used for transportation',
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
    confidence: 95,
    originalData: {
      thaiWord: 'รถ',
      senseNumber: 1,
      pos: 'น.',
      meaningThai: 'ยานพาหนะ',
      meaningEnglish: 'vehicle'
    }
  }
]);

// Mock ai4thai-g2p.js
vi.mock('../../src/content/02_process-subtitle/helpers/ai4thai-g2p.js', () => ({
  getPhonetics: mockGetPhonetics,
  handleThaiApiCall: vi.fn()
}));

// Mock phonetic-parser.js
vi.mock('../../src/content/02_process-subtitle/helpers/phonetic-parser.js', () => ({
  parsePhoneticToEnglish: mockParsePhoneticToEnglish
}));

// Mock orst.js
vi.mock('../../src/content/02_process-subtitle/helpers/orst.js', () => ({
  scrapeOrstDictionary: mockScrapeOrstDictionary
}));

// Mock gpt-normalize-senses.js
vi.mock('../../src/content/02_process-subtitle/helpers/gpt-normalize-senses.js', () => ({
  normalizeSensesWithGPT: mockNormalizeSensesWithGPT
}));

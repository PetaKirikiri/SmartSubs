/**
 * GPT Config Mock for Node Tests
 */

import { vi } from 'vitest';

export const mockGetOpenAIApiKey = vi.fn(() => process.env.VITE_OPENAI_API_KEY || null);

vi.mock('../../src/content/utils/gpt-config.js', () => ({
  getOpenAIApiKey: mockGetOpenAIApiKey
}));

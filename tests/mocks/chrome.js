/**
 * Chrome APIs Mock for Node Tests
 * Mocks Chrome extension APIs for testing without browser runtime
 */

import { vi } from 'vitest';

// Mock chrome.runtime
global.chrome = {
  runtime: {
    sendMessage: vi.fn((message, callback) => {
      // Mock response handler based on message type
      if (callback) {
        if (message.type === 'THAI_API_CALL') {
          // Mock AI4Thai API response
          callback({ 
            success: true, 
            data: { 
              result: message.body || 'mocked-result',
              phoneme: 'mocked-phoneme'
            } 
          });
        } else if (message.type === 'ORST_SCRAPE') {
          // Mock ORST scrape response
          callback({ 
            success: true, 
            data: { 
              html: '<html><body>Mocked ORST HTML</body></html>' 
            } 
          });
        } else {
          // Default response
          callback({ success: true, data: {} });
        }
      }
    }),
    lastError: null
  }
};

// Mock localStorage (both global and window.localStorage for compatibility)
global.localStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn()
};

// Mock window object
global.window = {
  __AI4THAI_API_KEY__: null,
  __OPENAI_API_KEY__: null,
  location: {
    href: 'https://test.com'
  },
  localStorage: global.localStorage
};

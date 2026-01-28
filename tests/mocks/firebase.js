/**
 * Firebase/Firestore Mock for Node Tests
 * Mocks Firestore operations for testing without real Firebase connection
 */

import { vi } from 'vitest';

// Mock Firestore collections as in-memory Maps
const mockCollections = {
  wordsThai: new Map(),
  wordsEng: new Map(),
  shows: new Map(),
  episodes: new Map(),
  subtitles: new Map(),
  episodeLookup: new Map()
};

export const mockGetDoc = vi.fn();
export const mockSetDoc = vi.fn();
export const mockWriteBatch = vi.fn();
export const mockServerTimestamp = vi.fn(() => new Date());
export const mockCollection = vi.fn();
export const mockDoc = vi.fn();

// Mock Firebase module
vi.mock('../../src/content/utils/firebaseConfig.js', () => ({
  db: {},
  getFirestore: vi.fn(() => ({}))
}));

// Mock firebase/firestore module
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((db, ...pathSegments) => ({ 
    path: pathSegments.join('/'),
    id: pathSegments[pathSegments.length - 1]
  })),
  collection: vi.fn((db, ...pathSegments) => ({
    path: pathSegments.join('/')
  })),
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  writeBatch: mockWriteBatch,
  serverTimestamp: mockServerTimestamp,
  deleteField: vi.fn(),
  deleteDoc: vi.fn()
}));

// Helper to set up mock data
export function setupMockWordData(wordId, collectionName, data) {
  const key = `${collectionName}/${wordId}`;
  mockCollections[collectionName] = mockCollections[collectionName] || new Map();
  mockCollections[collectionName].set(wordId, data);
  
  mockGetDoc.mockImplementation((docRef) => {
    const path = docRef.path || '';
    if (path.includes(collectionName) && path.includes(wordId)) {
      return Promise.resolve({
        exists: () => true,
        data: () => data,
        id: wordId
      });
    }
    return Promise.resolve({
      exists: () => false,
      data: () => null,
      id: wordId
    });
  });
}

// Helper to clear all mock data
export function clearMockData() {
  Object.keys(mockCollections).forEach(key => {
    mockCollections[key].clear();
  });
  mockGetDoc.mockClear();
  mockSetDoc.mockClear();
  mockWriteBatch.mockClear();
}

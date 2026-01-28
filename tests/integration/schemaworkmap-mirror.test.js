/**
 * Test C: 1:1 Mirror of SchemaWorkMap to Fat Bundle (Shape)
 * 
 * Purpose: Hard-assert that schemaWorkMap structure mirrors fat bundle structure 
 * exactly (1:1 key matching).
 */

import { describe, it, expect } from 'vitest';
import { generateSchemaWorkMap, makeBlankSchemaWorkMapFromFatBundle } from '../../src/content/02_process-subtitle/helpers/schema-work-map-builder.js';
import fatBundleComplete from '../fixtures/fat-bundle-complete.json' assert { type: 'json' };

// Import mocks to ensure they're registered
import '../mocks/chrome.js';
import '../mocks/firebase.js';

describe('SchemaWorkMap 1:1 Mirror of Fat Bundle', () => {
  /**
   * Recursive assertion that every key in fatBundle exists in schemaWorkMap
   * and schemaWorkMap values are booleans (or arrays of booleans for senses)
   */
  function assertShapeMirror(fatBundle, schemaWorkMap, path = '') {
    if (fatBundle === null || fatBundle === undefined) {
      return; // Skip null/undefined values
    }

    if (Array.isArray(fatBundle)) {
      // Arrays: check length match and recurse into elements
      expect(schemaWorkMap).toBeInstanceOf(Array);
      expect(schemaWorkMap.length).toBe(fatBundle.length);
      
      fatBundle.forEach((item, index) => {
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          assertShapeMirror(item, schemaWorkMap[index], `${path}[${index}]`);
        }
      });
      return;
    }

    if (typeof fatBundle === 'object') {
      // Objects: check all keys exist in schemaWorkMap
      Object.keys(fatBundle).forEach(key => {
        const newPath = path ? `${path}.${key}` : key;
        
        // Skip if value is null/undefined
        if (fatBundle[key] === null || fatBundle[key] === undefined) {
          return;
        }

        // Check key exists in schemaWorkMap
        expect(schemaWorkMap).toHaveProperty(key);
        
        const fatValue = fatBundle[key];
        const schemaValue = schemaWorkMap[key];

        // Handle arrays
        if (Array.isArray(fatValue)) {
          expect(Array.isArray(schemaValue) || typeof schemaValue === 'boolean').toBe(true);
          
          // For senses array, check if it's boolean (adaptive) or array structure
          if (key === 'senses' && typeof schemaValue === 'boolean') {
            // Adaptive structure: boolean true means needs work
            return;
          }
          
          // Otherwise, recurse into array
          if (Array.isArray(schemaValue)) {
            assertShapeMirror(fatValue, schemaValue, newPath);
          }
          return;
        }

        // Handle nested objects
        if (typeof fatValue === 'object' && fatValue !== null) {
          // Check if schemaValue is boolean (top-level field) or object (nested)
          if (typeof schemaValue === 'boolean') {
            // This is a top-level boolean field - valid
            return;
          }
          
          // Recurse into nested object
          assertShapeMirror(fatValue, schemaValue, newPath);
          return;
        }

        // Primitive values: schemaWorkMap should have boolean
        expect(typeof schemaValue).toBe('boolean');
      });
    }
  }

  it('should generate schemaWorkMap that mirrors fat bundle structure exactly', async () => {
    // Arrange
    const fatBundle = JSON.parse(JSON.stringify(fatBundleComplete));
    const subtitleId = fatBundle.id;

    // Act
    const schemaWorkMap = await generateSchemaWorkMap(fatBundle, subtitleId, {
      showName: 'test-show',
      mediaId: 'test-mediaId'
    });

    // Assert - Array lengths match
    expect(schemaWorkMap.tokens.display.length).toBe(fatBundle.tokens.display.length);
    expect(schemaWorkMap.tokens.senses.length).toBe(fatBundle.tokens.senses.length);
    expect(schemaWorkMap.tokens.displayEng.length).toBe(fatBundle.tokens.displayEng.length);
    expect(schemaWorkMap.tokens.sensesEng.length).toBe(fatBundle.tokens.sensesEng.length);

    // Assert - Recursive shape mirror
    assertShapeMirror(fatBundle, schemaWorkMap);

    // Assert - Top-level fields exist
    expect(schemaWorkMap).toHaveProperty('id');
    expect(schemaWorkMap).toHaveProperty('startSecThai');
    expect(schemaWorkMap).toHaveProperty('endSecThai');
    expect(schemaWorkMap).toHaveProperty('thai');
    expect(schemaWorkMap).toHaveProperty('wordReferenceIdsThai');
    expect(schemaWorkMap).toHaveProperty('tokens');

    // Assert - Token fields exist
    fatBundle.tokens.display.forEach((token, i) => {
      Object.keys(token).forEach(key => {
        expect(schemaWorkMap.tokens.display[i]).toHaveProperty(key);
        // Index field should be boolean if present
        if (key === 'index') {
          expect(typeof schemaWorkMap.tokens.display[i][key]).toBe('boolean');
        } else {
          expect(typeof schemaWorkMap.tokens.display[i][key]).toBe('boolean');
        }
      });
    });

    fatBundle.tokens.senses.forEach((token, i) => {
      Object.keys(token).forEach(key => {
        expect(schemaWorkMap.tokens.senses[i]).toHaveProperty(key);
        if (key === 'senses') {
          // Senses can be boolean (adaptive) or array structure
          const schemaSenses = schemaWorkMap.tokens.senses[i][key];
          expect(typeof schemaSenses === 'boolean' || Array.isArray(schemaSenses)).toBe(true);
        } else if (key === 'index') {
          expect(typeof schemaWorkMap.tokens.senses[i][key]).toBe('boolean');
        }
      });
    });
  });

  it('should create blank schemaWorkMap that mirrors fat bundle structure', async () => {
    // Arrange
    const fatBundle = JSON.parse(JSON.stringify(fatBundleComplete));
    const subtitleId = fatBundle.id;

    // Act
    const blankSchemaWorkMap = await makeBlankSchemaWorkMapFromFatBundle(fatBundle, subtitleId);

    // Assert - Array lengths match
    expect(blankSchemaWorkMap.tokens.display.length).toBe(fatBundle.tokens.display.length);
    expect(blankSchemaWorkMap.tokens.senses.length).toBe(fatBundle.tokens.senses.length);

    // Assert - All values should be false (blank)
    expect(blankSchemaWorkMap.id).toBe(false);
    expect(blankSchemaWorkMap.tokens.display[0].g2p).toBe(false);
    expect(blankSchemaWorkMap.tokens.display[0].englishPhonetic).toBe(false);
    // When senses exist in fat bundle, blankSchemaWorkMap creates array structure (adaptive)
    // When senses are empty/missing, it should be false
    if (fatBundle.tokens.senses[0].senses && fatBundle.tokens.senses[0].senses.length > 0) {
      expect(Array.isArray(blankSchemaWorkMap.tokens.senses[0].senses)).toBe(true);
      expect(blankSchemaWorkMap.tokens.senses[0].senses.length).toBe(fatBundle.tokens.senses[0].senses.length);
    } else {
      expect(blankSchemaWorkMap.tokens.senses[0].senses).toBe(false);
    }

    // Assert - Structure mirrors fat bundle
    assertShapeMirror(fatBundle, blankSchemaWorkMap);
  });

  it('should include index field in schemaWorkMap when fat bundle has index', async () => {
    // Arrange
    const fatBundle = JSON.parse(JSON.stringify(fatBundleComplete));
    const subtitleId = fatBundle.id;

    // Act
    const schemaWorkMap = await generateSchemaWorkMap(fatBundle, subtitleId, {
      showName: 'test-show',
      mediaId: 'test-mediaId'
    });

    // Assert - Index field exists in schemaWorkMap
    expect(schemaWorkMap.tokens.display[0]).toHaveProperty('index');
    expect(typeof schemaWorkMap.tokens.display[0].index).toBe('boolean');
    expect(schemaWorkMap.tokens.senses[0]).toHaveProperty('index');
    expect(typeof schemaWorkMap.tokens.senses[0].index).toBe('boolean');
  });
});

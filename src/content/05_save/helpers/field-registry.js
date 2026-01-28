/**
 * Field Registry - Central registry of all fields in the system
 * Maps fields to their helpers, validation types, and processing levels
 */

/**
 * Field Registry Structure
 * topLevel: Top-level subtitle fields
 * tokenLevel: Token-level fields (display tokens)
 * senseLevel: Sense-level fields (within sense arrays)
 */
export const FIELD_REGISTRY = {
  topLevel: [
    {
      field: 'thai',
      helper: 'parse-vtt.js',
      validation: 'presence+content'
    },
    {
      field: 'english',
      helper: 'parse-vtt.js',
      validation: 'presence+content'
    },
    {
      field: 'startSecThai',
      helper: 'parse-vtt.js',
      validation: 'presence'
    },
    {
      field: 'endSecThai',
      helper: 'parse-vtt.js',
      validation: 'presence'
    },
    {
      field: 'startSecEng',
      helper: 'parse-vtt.js',
      validation: 'presence'
    },
    {
      field: 'endSecEng',
      helper: 'parse-vtt.js',
      validation: 'presence'
    },
    {
      field: 'wordReferenceIdsThai',
      helper: 'ai4thai-tokenizer.js',
      validation: 'presence+type+length-when-workmap-true'
    },
    {
      field: 'wordReferenceIdsEng',
      helper: 'english-tokenizer.js',
      validation: 'presence+type+length-when-workmap-true'
    },
    {
      field: 'matchedWords',
      helper: 'gpt-match-words.js',
      validation: 'presence+type'
    },
    {
      field: 'smartSubsRefs',
      helper: 'smartsubsrefs-builder.js',
      validation: 'presence+type'
    }
  ],
  tokenLevel: [
    {
      field: 'tokens.displayThai[i].g2p',
      helper: 'ai4thai-g2p.js',
      validation: 'presence'
    },
    {
      field: 'tokens.displayThai[i].englishPhonetic',
      helper: 'phonetic-parser.js',
      validation: 'presence'
    },
    {
      field: 'tokens.displayEnglish[i].englishWord',
      helper: 'english-tokenizer.js',
      validation: 'presence+content'
    }
  ],
  senseLevel: [
    // Dictionary fields (ORST)
    {
      field: 'thaiWord',
      helper: 'orst.js',
      validation: 'presence+content'
    },
    {
      field: 'senseNumber',
      helper: 'orst.js',
      validation: 'presence+content'
    },
    {
      field: 'pos',
      helper: 'orst.js',
      validation: 'presence+content'
    },
    {
      field: 'definition',
      helper: 'orst.js',
      validation: 'presence+content'
    },
    {
      field: 'source',
      helper: 'orst.js',
      validation: 'presence+content'
    },
    {
      field: 'originalData',
      helper: 'orst.js',
      validation: 'presence+type'
    },
    // Normalized fields (GPT normalization)
    {
      field: 'posEnglish',
      helper: 'gpt-normalize-senses.js',
      validation: 'presence+content'
    },
    {
      field: 'meaningThai',
      helper: 'gpt-normalize-senses.js',
      validation: 'presence+content'
    },
    {
      field: 'meaningEnglish',
      helper: 'gpt-normalize-senses.js',
      validation: 'presence+content'
    },
    {
      field: 'descriptionThai',
      helper: 'gpt-normalize-senses.js',
      validation: 'presence+content'
    },
    {
      field: 'descriptionEnglish',
      helper: 'gpt-normalize-senses.js',
      validation: 'presence+content'
    },
    {
      field: 'confidence',
      helper: 'gpt-normalize-senses.js',
      validation: 'presence'
    }
  ]
};

/**
 * Get field registry grouped by helper
 * Returns object: { topLevel: { helpers: { 'helper-name.js': [fieldDefs] } }, tokenLevel: {...}, senseLevel: {...} }
 */
export function getFieldRegistryByHelper() {
  const result = {
    topLevel: { helpers: {} },
    tokenLevel: { helpers: {} },
    senseLevel: { helpers: {} }
  };

  // Group top-level fields by helper
  for (const fieldDef of FIELD_REGISTRY.topLevel) {
    const helper = fieldDef.helper;
    if (helper) {
      if (!result.topLevel.helpers[helper]) {
        result.topLevel.helpers[helper] = [];
      }
      result.topLevel.helpers[helper].push(fieldDef);
    }
  }

  // Group token-level fields by helper
  for (const fieldDef of FIELD_REGISTRY.tokenLevel) {
    const helper = fieldDef.helper;
    if (helper) {
      if (!result.tokenLevel.helpers[helper]) {
        result.tokenLevel.helpers[helper] = [];
      }
      result.tokenLevel.helpers[helper].push(fieldDef);
    }
  }

  // Group sense-level fields by helper
  for (const fieldDef of FIELD_REGISTRY.senseLevel) {
    const helper = fieldDef.helper;
    if (helper) {
      if (!result.senseLevel.helpers[helper]) {
        result.senseLevel.helpers[helper] = [];
      }
      result.senseLevel.helpers[helper].push(fieldDef);
    }
  }

  return result;
}

/**
 * Get fields for a specific helper
 * @param {string} helperName - Helper name (e.g., 'ai4thai-g2p.js')
 * @returns {Array} Array of field definitions for this helper
 */
export function getFieldsForHelper(helperName) {
  const allFields = [
    ...FIELD_REGISTRY.topLevel,
    ...FIELD_REGISTRY.tokenLevel,
    ...FIELD_REGISTRY.senseLevel
  ];
  
  return allFields.filter(fieldDef => {
    if (!fieldDef.helper) return false;
    // Handle multiple helpers separated by ' / '
    const helpers = fieldDef.helper.split(' / ').map(h => h.trim());
    return helpers.includes(helperName);
  });
}


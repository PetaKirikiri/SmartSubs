/**
 * GPT Sense Normalization - Clean and normalize ORST senses
 * Converts inconsistent user-contributed ORST data into standardized format
 * Adds English translations and normalizes Thai fields
 */

import { getOpenAIApiKey } from '../../../utils/gpt-config.js';

/**
 * Normalize subtitle senses using GPT - accepts subtitle and returns updated subtitle
 * @param {object} subtitle - Fat subtitle containing tokens
 * @param {number} selectedWordIndex - Index of the word token to normalize
 * @param {object} [context] - Additional context for normalization
 * @param {string} [context.fullThaiText] - Full subtitle sentence for context
 * @param {string} [context.showName] - Show name for context
 * @param {number} [context.episode] - Episode number
 * @param {number} [context.season] - Season number
 * @returns {Promise<object>} Updated subtitle with normalized senses
 */
export async function normalizeSubtitleSensesWithGPT(subtitle, selectedWordIndex, context = {}) {
  if (!subtitle || !subtitle.tokens || !subtitle.tokens.senses || selectedWordIndex === null || selectedWordIndex === undefined) {
    return subtitle;
  }
  
  const senseToken = subtitle.tokens.senses[selectedWordIndex];
  const displayToken = subtitle.tokens.display[selectedWordIndex];
  
  if (!senseToken || !displayToken) {
    return subtitle;
  }
  
  const senses = senseToken.senses || [];
  const thaiWord = displayToken.thaiScript?.split(',')[0]?.trim() || displayToken.thaiScript || '';
  
  // Call the internal normalization function
  const enhancedSenses = await normalizeSensesWithGPT(senses, {
    thaiWord: thaiWord,
    ...context
  });
  
  // Return updated subtitle with normalized senses
  return {
    ...subtitle,
    tokens: {
      ...subtitle.tokens,
      senses: subtitle.tokens.senses.map((token, idx) =>
        idx === selectedWordIndex
          ? { ...token, senses: enhancedSenses }
          : token
      )
    }
  };
}

/**
 * Normalize ORST senses using GPT - adds English translations and cleans Thai fields
 * @param {Array} senses - Array of raw ORST sense objects
 * @param {object} context - Context for better normalization
 * @param {string} context.thaiWord - The Thai word these senses belong to
 * @param {string} [context.fullThaiText] - Full subtitle sentence for context
 * @param {string} [context.showName] - Show name for context
 * @param {number} [context.episode] - Episode number
 * @param {number} [context.season] - Season number
 * @returns {Promise<Array>} Array of enhanced sense objects with English/Thai field pairs
 */
export async function normalizeSensesWithGPT(senses, context = {}) {
  // Clean thaiWord: split on comma and take first word (defensive fix for comma-separated values)
  const rawThaiWord = context.thaiWord || '';
  const primaryThaiWord = rawThaiWord?.split(',')[0]?.trim() || rawThaiWord || '';
  
  if (!senses || !Array.isArray(senses) || senses.length === 0) {
    return senses;
  }
  
  // Note: Allow renormalizing already normalized senses (removed early return)
  // GPT will process and potentially improve/update existing normalized senses
  
  const apiKey = getOpenAIApiKey();
  
  if (!apiKey) {
    return senses; // Return original senses if no API key
  }
  
  const systemPrompt = 'You are an expert Thai-English dictionary editor specializing in normalizing dictionary entries into three distinct fields:\n\n1. MEANING: One compact gloss word or tight noun phrase (e.g., "paternal grandmother"). This is the label for indexing/scanning, NOT an explanation.\n2. DESCRIPTION: Short human clarification (1-2 lines maximum). Just enough context to disambiguate (e.g., "The mother of your father"). No essays, no culture dump.\n3. NOTES: Optional cultural context or extended explanations. Often empty. Only include if necessary for understanding.\n\nKeep meaning and description SEPARATE - do not collapse them into one field.\n\nReturn ONLY valid JSON matching the exact structure provided. Do not include explanations or markdown formatting.';
  
  // Build context info
  // Use cleaned primaryThaiWord (the actual word) as the primary word, not sense.thaiWord which may contain comma-separated alternatives
  const contextInfo = {
    thaiWord: primaryThaiWord,
    fullThaiText: context.fullThaiText || '',
    showName: context.showName || null,
    episode: context.episode || null,
    season: context.season || null,
    rawSenses: senses.map((sense, index) => ({
      index: index,
      // ALWAYS use primary word from context (token data) - NEVER use sense.thaiWord which may have commas
      thaiWord: primaryThaiWord || '',
      pos: sense.pos || '',
      definition: sense.definition || '',
      senseNumber: sense.senseNumber || '',
      source: sense.source || 'ORST'
    }))
  };
  
  const userPrompt = JSON.stringify({
    task: 'Normalize and enhance ORST dictionary senses with English translations',
    context: contextInfo,
    requiredStructure: {
      senses: [
        {
          thaiWord: 'string',
          pos: 'string (standardized Thai POS)',
          posEnglish: 'string (English POS: noun, verb, adjective, etc.)',
          meaningThai: 'string (ONE compact gloss word or tight noun phrase - the label, NOT an explanation)',
          meaningEnglish: 'string (ONE compact gloss word or tight noun phrase - the label, NOT an explanation)',
          descriptionThai: 'string (short human clarification, 1-2 lines max - just enough to disambiguate)',
          descriptionEnglish: 'string (short human clarification, 1-2 lines max - just enough to disambiguate)',
          senseNumber: 'string (Arabic numerals)',
          confidence: 'number (0-100)'
        }
      ]
    },
    instructions: [
      'MEANING: Extract ONE compact gloss word or tight noun phrase from definition field → meaningThai/meaningEnglish (e.g., "paternal grandmother"). This is the label for indexing/scanning, NOT an explanation. Keep it concise.',
      'DESCRIPTION: Provide short human clarification (1-2 lines max) → descriptionThai/descriptionEnglish (e.g., "The mother of your father"). Just enough to disambiguate. No essays, no culture dump.',
      'Keep meaning and description SEPARATE - do not collapse them into one field.',
      'Standardize POS to standard Thai terms → pos',
      'Add English POS → posEnglish',
      'Convert Thai numerals to Arabic → senseNumber',
      'Meaning and description fields are REQUIRED.',
      'Ensure consistent formatting across all senses'
    ]
  });
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return senses; // Return original senses on error
    }
    
    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content?.trim() || '';
    
    if (!resultText) {
      return senses; // Return original senses
    }
    
    // Parse JSON response
    let normalizedData;
    try {
      normalizedData = JSON.parse(resultText);
    } catch (parseError) {
      return senses; // Return original senses
    }
    
    // Extract normalized senses array
    const normalizedSenses = normalizedData.senses || [];
    
    if (!Array.isArray(normalizedSenses) || normalizedSenses.length === 0) {
      return senses; // Return original senses
    }
    
    // Merge normalized fields with original senses, preserving originalData
    const enhancedSenses = senses.map((originalSense, index) => {
      // Try to match normalized sense by index first, then by senseNumber
      // NEVER match by thaiWord - originalSense.thaiWord may have commas from previous bad normalization
      const normalizedSense = normalizedSenses[index] || normalizedSenses.find(ns => {
        // Match by senseNumber if available
        if (originalSense.senseNumber && ns.senseNumber) {
          return ns.senseNumber === originalSense.senseNumber;
        }
        // Don't match by thaiWord - it's unreliable (may have commas)
        return false;
      }) || {};
      
      
      // Preserve original data - ensure all fields use proper undefined checks
      const originalData = {
        definition: originalSense.definition !== undefined ? originalSense.definition : '',
        pos: originalSense.pos !== undefined ? originalSense.pos : '',
        senseNumber: originalSense.senseNumber !== undefined ? originalSense.senseNumber : ''
      };
      
      // Build enhanced sense object - normalized structure only (old ORST fields excluded)
      const enhanced = {
        // Core identification - ALWAYS use primary word from context (never use originalSense.thaiWord which may have commas)
        thaiWord: primaryThaiWord || '',
        index: originalSense.index !== undefined ? originalSense.index : index,
        senseNumber: normalizedSense.senseNumber || originalSense.senseNumber || String(index + 1),
        
        // Part of Speech (standardized)
        pos: normalizedSense.pos || originalSense.pos || '',
        posEnglish: normalizedSense.posEnglish || (originalSense.posEnglish || ''),
        
        // Meaning fields (compact gloss - English/Thai pairs)
        // Preserve existing normalized fields if GPT doesn't return them
        meaningThai: normalizedSense.meaningThai || (originalSense.meaningThai || ''),
        meaningEnglish: normalizedSense.meaningEnglish || (originalSense.meaningEnglish || ''),
        
        // Description fields (short clarification - English/Thai pairs)
        // Overwrite with ORST definition/english if available, otherwise preserve existing normalized
        descriptionThai: normalizedSense.descriptionThai || 
          (originalSense.definition || originalSense.descriptionThai || ''),
        descriptionEnglish: normalizedSense.descriptionEnglish !== undefined && normalizedSense.descriptionEnglish !== null
          ? normalizedSense.descriptionEnglish
          : (originalSense.english !== undefined ? originalSense.english : (originalSense.descriptionEnglish || '')),
        
        // Metadata
        source: originalSense.source || 'ORST',
        normalized: true,
        normalizedAt: new Date().toISOString(),
        normalizationVersion: '1.0',
        confidence: normalizedSense.confidence !== undefined 
          ? normalizedSense.confidence 
          : (originalSense.confidence !== undefined ? originalSense.confidence : 0),
        
        // Original ORST data preservation - ALWAYS ensure originalData exists
        originalData: originalData,
        
        // Preserve any other original fields (id, selected, etc.)
        id: originalSense.id,
        selected: originalSense.selected
      };
      
      // Force clean thaiWord if it has commas - should never happen but defensive
      if (enhanced.thaiWord && enhanced.thaiWord.includes(',')) {
        enhanced.thaiWord = primaryThaiWord || '';
      }
      
      // CRITICAL: Ensure originalData is always present (data integrity check)
      if (!enhanced.originalData || typeof enhanced.originalData !== 'object') {
        enhanced.originalData = originalData;
      }
      
      return enhanced;
    });
    
    // Validate enhanced senses integrity before returning
    const validatedSenses = [];
    for (const enhanced of enhancedSenses) {
      // Check originalData is included
      if (!enhanced.originalData || typeof enhanced.originalData !== 'object') {
        continue;
      }
      
      // Check normalized fields are present
      // Thai fields must have content (not empty), English fields can be empty strings
      const requiredThaiFields = ['descriptionThai'];
      const hasThaiFields = requiredThaiFields.every(field => 
        enhanced[field] !== undefined && enhanced[field] !== null && enhanced[field].trim() !== ''
      );
      
      const requiredEnglishFields = ['descriptionEnglish'];
      const hasEnglishFields = requiredEnglishFields.every(field => 
        enhanced[field] !== undefined && enhanced[field] !== null
      );
      
      if (!hasThaiFields || !hasEnglishFields) {
        continue;
      }
      
      // Check required metadata
      if (!enhanced.thaiWord || !enhanced.senseNumber || enhanced.normalized !== true) {
        continue;
      }
      
      validatedSenses.push(enhanced);
    }
    
    // Validate normalized senses against schema
    const { validateSenseAgainstSchema } = await import('../workmap/schema-work-map-builder.js');
    for (let i = 0; i < validatedSenses.length; i++) {
      const sense = validatedSenses[i];
      const context = `word: ${sense.thaiWord}, senseIndex: ${i}`;
      await validateSenseAgainstSchema(sense, 'normalized-sense', context);
    }
    
    // If validation fails for all senses, still return enhanced senses (with fallback values)
    // updateSensesWithNormalization will handle validation and fallback to original if needed
    if (validatedSenses.length === 0) {
      // Return enhanced senses anyway - they have fallback values and normalized structure
      return enhancedSenses;
    }
    
    return validatedSenses;
  } catch (error) {
    return senses; // Return original senses on error
  }
}

/**
 * Normalize sense object to always have normalized structure
 * Maps old ORST fields (definition, english, example) to normalized fields
 * @param {object} sense - Sense object (old or new structure)
 * @returns {object} Normalized sense object
 */
export function normalizeSense(sense) {
  if (!sense || typeof sense !== 'object') return sense;
  
  // If already normalized (has normalized fields), return as-is
  if (sense.normalized === true || sense.descriptionThai || sense.descriptionEnglish) {
    return {
      ...sense,
      // Ensure all normalized fields exist
      meaningThai: sense.meaningThai || '',
      meaningEnglish: sense.meaningEnglish || '',
      descriptionThai: sense.descriptionThai || sense.definition || '',
      descriptionEnglish: sense.descriptionEnglish || '',
      posEnglish: sense.posEnglish || '',
      // Keep definition for backward compatibility
      definition: sense.definition || sense.descriptionThai || ''
    };
  }
  
  // Old ORST structure - map to normalized
  return {
    ...sense,
    // Map old fields to normalized structure
    descriptionThai: sense.definition || '',
    descriptionEnglish: '',
    posEnglish: '',
    // Keep old fields for backward compatibility
    normalized: false
  };
}

/**
 * Update senses with normalized data from GPT
 * This is processing logic - transforms ORST senses to normalized format and saves them
 * @param {string} thaiScript - Thai word script
 * @param {Array} enhancedSenses - Enhanced senses from GPT normalization
 * @param {string} collectionName - Collection identifier: 'wordsThai', 'wordsEng', 'failedWords', or 'failedWordsEng'
 */
export async function updateSensesWithNormalization(thaiScript, enhancedSenses, collectionName = 'wordsThai') {
  const trimmed = thaiScript?.trim();
  
  if (!thaiScript || !trimmed || !enhancedSenses || !Array.isArray(enhancedSenses) || enhancedSenses.length === 0) {
    return;
  }
  
  try {
    // TODO: loadWord function needs to be implemented
    // Import save functions
    const { saveWordSave } = await import('./save-word.js');
    const { validateNormalizedSenseStrict } = await import('../workmap/schema-work-map-builder.js');
    
    // Helper function to validate normalized sense
    function validateNormalizedSense(sense) {
      const errors = [];
      
      if (!sense.originalData || typeof sense.originalData !== 'object') {
        errors.push('Missing originalData field');
      } else {
        const originalData = sense.originalData;
        const expectedOriginalFields = ['definition', 'pos', 'senseNumber', 'english'];
        for (const field of expectedOriginalFields) {
          if (originalData[field] === undefined) {
            errors.push(`Missing originalData.${field}`);
          }
        }
      }
      
      const requiredThaiFields = ['descriptionThai'];
      for (const field of requiredThaiFields) {
        if (sense[field] === undefined || sense[field] === null || sense[field].trim() === '') {
          errors.push(`Missing or empty normalized Thai field: ${field}`);
        }
      }
      
      const requiredEnglishFields = ['descriptionEnglish'];
      for (const field of requiredEnglishFields) {
        if (sense[field] === undefined || sense[field] === null) {
          errors.push(`Missing normalized English field: ${field}`);
        }
      }
      
      return {
        valid: errors.length === 0,
        errors: errors
      };
    }
    
    // TODO: loadWord function needs to be implemented
    // const existingWordData = await loadWord(trimmed, collectionName);
    const existingWordData = null;
    
    if (!existingWordData || !existingWordData.senses || !Array.isArray(existingWordData.senses)) {
      const validatedSenses = [];
      for (const sense of enhancedSenses) {
        const validation = validateNormalizedSense(sense);
        if (validation.valid) {
          const cleaned = { ...sense };
          delete cleaned.definition;
          delete cleaned.english;
          validatedSenses.push(cleaned);
        }
      }
      
      if (validatedSenses.length === 0) {
        return;
      }
      
      await saveWordSave(trimmed, {
        senses: validatedSenses
      }, null, collectionName);
      return;
    }
    
    const updatedSenses = existingWordData.senses.map((existingSense, index) => {
      const isAlreadyNormalized = existingSense.descriptionEnglish !== undefined && existingSense.descriptionEnglish !== null;
      
      const enhancedSense = enhancedSenses[index] || enhancedSenses.find(es => 
        es.senseNumber === existingSense.senseNumber ||
        (existingSense.index !== undefined && es.index === existingSense.index)
      );
      
      if (!enhancedSense) {
        if (isAlreadyNormalized) {
          return existingSense;
        } else {
          const normalizedSense = {
            ...existingSense,
            descriptionThai: existingSense.definition || '',
            descriptionEnglish: existingSense.english !== undefined ? existingSense.english : '',
            normalized: true,
            normalizedAt: new Date().toISOString(),
            normalizationVersion: '1.0',
            normalizationUsedFallback: true,
            originalData: {
              definition: existingSense.definition !== undefined ? existingSense.definition : '',
              pos: existingSense.pos !== undefined ? existingSense.pos : '',
              senseNumber: existingSense.senseNumber !== undefined ? existingSense.senseNumber : '',
              english: existingSense.english !== undefined ? existingSense.english : '',
              example: existingSense.example !== undefined ? existingSense.example : ''
            }
          };
          
          delete normalizedSense.definition;
          delete normalizedSense.english;
          delete normalizedSense.example;
          
          return normalizedSense;
        }
      }
      
      const usedFallbackThai = !enhancedSense.descriptionThai || enhancedSense.descriptionThai.trim() === '';
      const usedFallbackEnglish = enhancedSense.descriptionEnglish === undefined || enhancedSense.descriptionEnglish === null;
      
      const normalizedSense = {
        id: existingSense.id,
        selected: existingSense.selected !== undefined ? existingSense.selected : false,
        senseId: existingSense.senseId,
        wordId: existingSense.wordId,
        index: existingSense.index !== undefined ? existingSense.index : index,
        source: existingSense.source || 'ORST',
        ...(existingSense.updatedAt !== undefined && { updatedAt: existingSense.updatedAt }),
        ...(existingSense.createdAt !== undefined && { createdAt: existingSense.createdAt }),
        
        thaiWord: (() => {
          const cleanedEnhanced = enhancedSense.thaiWord?.split(',')[0]?.trim() || enhancedSense.thaiWord || '';
          const result = cleanedEnhanced || trimmed;
          return result;
        })(),
        senseNumber: enhancedSense.senseNumber || existingSense.senseNumber || String(index + 1),
        
        pos: enhancedSense.pos || existingSense.pos || '',
        posEnglish: enhancedSense.posEnglish || (existingSense.posEnglish || ''),
        
        // Description fields: Overwrite with ORST definition/english if available, otherwise preserve existing normalized
        descriptionThai: enhancedSense.descriptionThai || 
          (existingSense.definition || existingSense.descriptionThai || ''),
        descriptionEnglish: usedFallbackEnglish 
          ? (existingSense.english !== undefined ? existingSense.english : (existingSense.descriptionEnglish || ''))
          : enhancedSense.descriptionEnglish,
        
        // Meaning fields: Preserve existing if enhancedSense doesn't have them
        meaningThai: enhancedSense.meaningThai || (existingSense.meaningThai || ''),
        meaningEnglish: enhancedSense.meaningEnglish || (existingSense.meaningEnglish || ''),
        
        normalized: true,
        normalizedAt: enhancedSense.normalizedAt || new Date().toISOString(),
        normalizationVersion: enhancedSense.normalizationVersion || '1.0',
        normalizationUsedFallback: usedFallbackThai || usedFallbackEnglish,
        confidence: enhancedSense.confidence !== undefined 
          ? enhancedSense.confidence 
          : (existingSense.confidence !== undefined ? existingSense.confidence : 0),
        
        originalData: enhancedSense.originalData || existingSense.originalData || {
          definition: existingSense.definition !== undefined ? existingSense.definition : '',
          pos: existingSense.pos !== undefined ? existingSense.pos : '',
          senseNumber: existingSense.senseNumber !== undefined ? existingSense.senseNumber : '',
          english: existingSense.english !== undefined ? existingSense.english : '',
          example: existingSense.example !== undefined ? existingSense.example : ''
        }
      };
      
      delete normalizedSense.definition;
      delete normalizedSense.english;
      delete normalizedSense.example;
      
      return normalizedSense;
    });
    
    const validatedSenses = [];
    for (let i = 0; i < updatedSenses.length; i++) {
      const sense = updatedSenses[i];
      const context = `word: ${trimmed}, senseIndex: ${i}`;
      
      await validateNormalizedSenseStrict(sense, context);
      
      const cleaned = { ...sense };
      cleaned.normalized = true;
      delete cleaned.definition;
      delete cleaned.english;
      delete cleaned.example;
      validatedSenses.push(cleaned);
    }
    
    if (validatedSenses.length === 0) {
      return;
    }
    
    
    await saveWordSave(trimmed, {
      senses: validatedSenses
    }, null, collectionName);
    
  } catch (error) {
    throw error;
  }
}

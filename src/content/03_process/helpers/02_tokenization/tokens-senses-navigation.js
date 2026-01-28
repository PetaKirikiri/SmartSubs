/**
 * Tokens and Senses Navigation Utilities
 * 
 * Provides utilities for navigating, accessing, modifying, adding, and deleting
 * tokens and senses in fat bundle structures.
 * 
 * All utilities work with package format: { subtitle: {...}, tokens: {...} }
 * Supports both Thai and English tokens (displayThai/sensesThai and displayEnglish/sensesEnglish)
 */

/**
 * Get display token at index
 * @param {object} fatBundle - Fat bundle in package format
 * @param {number} tokenIndex - Token index
 * @param {string} language - Language ('thai' or 'english'), defaults to 'thai'
 * @returns {object|null} Display token or null if not found
 */
export function getDisplayToken(fatBundle, tokenIndex, language = 'thai') {
  if (!fatBundle || !fatBundle.tokens) return null;
  
  const tokens = fatBundle.tokens;
  const displayArray = language === 'english' ? tokens.displayEnglish : tokens.displayThai;
  
  if (!Array.isArray(displayArray) || tokenIndex < 0 || tokenIndex >= displayArray.length) {
    return null;
  }
  
  return displayArray[tokenIndex] || null;
}

/**
 * Get sense token at index
 * @param {object} fatBundle - Fat bundle in package format
 * @param {number} tokenIndex - Token index
 * @param {string} language - Language ('thai' or 'english'), defaults to 'thai'
 * @returns {object|null} Sense token or null if not found
 */
export function getSenseToken(fatBundle, tokenIndex, language = 'thai') {
  if (!fatBundle || !fatBundle.tokens) return null;
  
  const tokens = fatBundle.tokens;
  const sensesArray = language === 'english' ? tokens.sensesEnglish : tokens.sensesThai;
  
  if (!Array.isArray(sensesArray) || tokenIndex < 0 || tokenIndex >= sensesArray.length) {
    return null;
  }
  
  return sensesArray[tokenIndex] || null;
}

/**
 * Get specific sense from token
 * @param {object} fatBundle - Fat bundle in package format
 * @param {number} tokenIndex - Token index
 * @param {number} senseIndex - Sense index
 * @param {string} language - Language ('thai' or 'english'), defaults to 'thai'
 * @returns {object|null} Sense object or null if not found
 */
export function getSense(fatBundle, tokenIndex, senseIndex, language = 'thai') {
  const senseToken = getSenseToken(fatBundle, tokenIndex, language);
  if (!senseToken || !Array.isArray(senseToken.senses)) return null;
  
  if (senseIndex < 0 || senseIndex >= senseToken.senses.length) {
    return null;
  }
  
  return senseToken.senses[senseIndex] || null;
}

/**
 * Get all tokens for language
 * @param {object} fatBundle - Fat bundle in package format
 * @param {string} language - Language ('thai' or 'english'), defaults to 'thai'
 * @returns {Array} Array of display tokens
 */
export function getAllTokens(fatBundle, language = 'thai') {
  if (!fatBundle || !fatBundle.tokens) return [];
  
  const tokens = fatBundle.tokens;
  const displayArray = language === 'english' ? tokens.displayEnglish : tokens.displayThai;
  
  return Array.isArray(displayArray) ? displayArray : [];
}

/**
 * Get all senses for token
 * @param {object} fatBundle - Fat bundle in package format
 * @param {number} tokenIndex - Token index
 * @param {string} language - Language ('thai' or 'english'), defaults to 'thai'
 * @returns {Array} Array of sense objects
 */
export function getAllSenses(fatBundle, tokenIndex, language = 'thai') {
  const senseToken = getSenseToken(fatBundle, tokenIndex, language);
  if (!senseToken || !Array.isArray(senseToken.senses)) return [];
  
  return senseToken.senses;
}

/**
 * Add display token
 * @param {object} fatBundle - Fat bundle in package format
 * @param {object} tokenData - Display token data
 * @param {string} language - Language ('thai' or 'english'), defaults to 'thai'
 * @returns {object} New fat bundle with added token
 */
export function addDisplayToken(fatBundle, tokenData, language = 'thai') {
  if (!fatBundle || !fatBundle.tokens) {
    throw new Error('Fat bundle must have tokens structure');
  }
  
  const newBundle = JSON.parse(JSON.stringify(fatBundle)); // Deep copy
  const tokens = newBundle.tokens;
  const displayArray = language === 'english' ? tokens.displayEnglish : tokens.displayThai;
  
  // Ensure array exists
  if (!Array.isArray(displayArray)) {
    if (language === 'english') {
      tokens.displayEnglish = [];
    } else {
      tokens.displayThai = [];
    }
  }
  
  // Add token with correct index
  const index = language === 'english' ? tokens.displayEnglish.length : tokens.displayThai.length;
  const token = { ...tokenData, index };
  
  if (language === 'english') {
    tokens.displayEnglish.push(token);
  } else {
    tokens.displayThai.push(token);
  }
  
  return newBundle;
}

/**
 * Add sense token
 * @param {object} fatBundle - Fat bundle in package format
 * @param {object} tokenData - Sense token data (should include senses array)
 * @param {string} language - Language ('thai' or 'english'), defaults to 'thai'
 * @returns {object} New fat bundle with added token
 */
export function addSenseToken(fatBundle, tokenData, language = 'thai') {
  if (!fatBundle || !fatBundle.tokens) {
    throw new Error('Fat bundle must have tokens structure');
  }
  
  const newBundle = JSON.parse(JSON.stringify(fatBundle)); // Deep copy
  const tokens = newBundle.tokens;
  const sensesArray = language === 'english' ? tokens.sensesEnglish : tokens.sensesThai;
  
  // Ensure array exists
  if (!Array.isArray(sensesArray)) {
    if (language === 'english') {
      tokens.sensesEnglish = [];
    } else {
      tokens.sensesThai = [];
    }
  }
  
  // Add token with correct index
  const index = language === 'english' ? tokens.sensesEnglish.length : tokens.sensesThai.length;
  const token = { ...tokenData, index, senses: tokenData.senses || [] };
  
  if (language === 'english') {
    tokens.sensesEnglish.push(token);
  } else {
    tokens.sensesThai.push(token);
  }
  
  return newBundle;
}

/**
 * Add sense to token
 * @param {object} fatBundle - Fat bundle in package format
 * @param {number} tokenIndex - Token index
 * @param {object} senseData - Sense data
 * @param {string} language - Language ('thai' or 'english'), defaults to 'thai'
 * @returns {object} New fat bundle with added sense
 */
export function addSense(fatBundle, tokenIndex, senseData, language = 'thai') {
  if (!fatBundle || !fatBundle.tokens) {
    throw new Error('Fat bundle must have tokens structure');
  }
  
  const newBundle = JSON.parse(JSON.stringify(fatBundle)); // Deep copy
  const tokens = newBundle.tokens;
  const sensesArray = language === 'english' ? tokens.sensesEnglish : tokens.sensesThai;
  
  if (!Array.isArray(sensesArray) || tokenIndex < 0 || tokenIndex >= sensesArray.length) {
    throw new Error(`Invalid token index: ${tokenIndex}`);
  }
  
  const senseToken = sensesArray[tokenIndex];
  if (!senseToken) {
    throw new Error(`Sense token not found at index ${tokenIndex}`);
  }
  
  // Ensure senses array exists
  if (!Array.isArray(senseToken.senses)) {
    senseToken.senses = [];
  }
  
  // Add sense with correct index
  const senseIndex = senseToken.senses.length;
  const sense = { ...senseData, index: senseIndex };
  senseToken.senses.push(sense);
  
  return newBundle;
}

/**
 * Update display token fields
 * @param {object} fatBundle - Fat bundle in package format
 * @param {number} tokenIndex - Token index
 * @param {object} updates - Fields to update
 * @param {string} language - Language ('thai' or 'english'), defaults to 'thai'
 * @returns {object} New fat bundle with updated token
 */
export function updateDisplayToken(fatBundle, tokenIndex, updates, language = 'thai') {
  if (!fatBundle || !fatBundle.tokens) {
    throw new Error('Fat bundle must have tokens structure');
  }
  
  const newBundle = JSON.parse(JSON.stringify(fatBundle)); // Deep copy
  const tokens = newBundle.tokens;
  const displayArray = language === 'english' ? tokens.displayEnglish : tokens.displayThai;
  
  if (!Array.isArray(displayArray) || tokenIndex < 0 || tokenIndex >= displayArray.length) {
    throw new Error(`Invalid token index: ${tokenIndex}`);
  }
  
  const token = displayArray[tokenIndex];
  if (!token) {
    throw new Error(`Display token not found at index ${tokenIndex}`);
  }
  
  // Update fields (preserve index)
  Object.assign(token, updates);
  token.index = tokenIndex; // Ensure index matches position
  
  return newBundle;
}

/**
 * Update sense token
 * @param {object} fatBundle - Fat bundle in package format
 * @param {number} tokenIndex - Token index
 * @param {object} updates - Fields to update
 * @param {string} language - Language ('thai' or 'english'), defaults to 'thai'
 * @returns {object} New fat bundle with updated token
 */
export function updateSenseToken(fatBundle, tokenIndex, updates, language = 'thai') {
  if (!fatBundle || !fatBundle.tokens) {
    throw new Error('Fat bundle must have tokens structure');
  }
  
  const newBundle = JSON.parse(JSON.stringify(fatBundle)); // Deep copy
  const tokens = newBundle.tokens;
  const sensesArray = language === 'english' ? tokens.sensesEnglish : tokens.sensesThai;
  
  if (!Array.isArray(sensesArray) || tokenIndex < 0 || tokenIndex >= sensesArray.length) {
    throw new Error(`Invalid token index: ${tokenIndex}`);
  }
  
  const token = sensesArray[tokenIndex];
  if (!token) {
    throw new Error(`Sense token not found at index ${tokenIndex}`);
  }
  
  // Update fields (preserve index and senses array)
  Object.assign(token, updates);
  token.index = tokenIndex; // Ensure index matches position
  if (!Array.isArray(token.senses)) {
    token.senses = updates.senses || [];
  }
  
  return newBundle;
}

/**
 * Update specific sense
 * @param {object} fatBundle - Fat bundle in package format
 * @param {number} tokenIndex - Token index
 * @param {number} senseIndex - Sense index
 * @param {object} updates - Fields to update
 * @param {string} language - Language ('thai' or 'english'), defaults to 'thai'
 * @returns {object} New fat bundle with updated sense
 */
export function updateSense(fatBundle, tokenIndex, senseIndex, updates, language = 'thai') {
  if (!fatBundle || !fatBundle.tokens) {
    throw new Error('Fat bundle must have tokens structure');
  }
  
  const newBundle = JSON.parse(JSON.stringify(fatBundle)); // Deep copy
  const tokens = newBundle.tokens;
  const sensesArray = language === 'english' ? tokens.sensesEnglish : tokens.sensesThai;
  
  if (!Array.isArray(sensesArray) || tokenIndex < 0 || tokenIndex >= sensesArray.length) {
    throw new Error(`Invalid token index: ${tokenIndex}`);
  }
  
  const senseToken = sensesArray[tokenIndex];
  if (!senseToken || !Array.isArray(senseToken.senses)) {
    throw new Error(`Sense token not found at index ${tokenIndex}`);
  }
  
  if (senseIndex < 0 || senseIndex >= senseToken.senses.length) {
    throw new Error(`Invalid sense index: ${senseIndex}`);
  }
  
  const sense = senseToken.senses[senseIndex];
  if (!sense) {
    throw new Error(`Sense not found at index ${senseIndex}`);
  }
  
  // Update fields (preserve index)
  Object.assign(sense, updates);
  sense.index = senseIndex; // Ensure index matches position
  
  return newBundle;
}

/**
 * Delete display token (and corresponding sense token)
 * @param {object} fatBundle - Fat bundle in package format
 * @param {number} tokenIndex - Token index
 * @param {string} language - Language ('thai' or 'english'), defaults to 'thai'
 * @returns {object} New fat bundle with deleted token
 */
export function deleteDisplayToken(fatBundle, tokenIndex, language = 'thai') {
  if (!fatBundle || !fatBundle.tokens) {
    throw new Error('Fat bundle must have tokens structure');
  }
  
  const newBundle = JSON.parse(JSON.stringify(fatBundle)); // Deep copy
  const tokens = newBundle.tokens;
  const displayArray = language === 'english' ? tokens.displayEnglish : tokens.displayThai;
  const sensesArray = language === 'english' ? tokens.sensesEnglish : tokens.sensesThai;
  
  if (!Array.isArray(displayArray) || tokenIndex < 0 || tokenIndex >= displayArray.length) {
    throw new Error(`Invalid token index: ${tokenIndex}`);
  }
  
  // Delete display token
  displayArray.splice(tokenIndex, 1);
  
  // Reindex remaining tokens
  for (let i = tokenIndex; i < displayArray.length; i++) {
    if (displayArray[i]) {
      displayArray[i].index = i;
    }
  }
  
  // Delete corresponding sense token if it exists
  if (Array.isArray(sensesArray) && tokenIndex < sensesArray.length) {
    sensesArray.splice(tokenIndex, 1);
    
    // Reindex remaining sense tokens
    for (let i = tokenIndex; i < sensesArray.length; i++) {
      if (sensesArray[i]) {
        sensesArray[i].index = i;
      }
    }
  }
  
  return newBundle;
}

/**
 * Delete sense token
 * @param {object} fatBundle - Fat bundle in package format
 * @param {number} tokenIndex - Token index
 * @param {string} language - Language ('thai' or 'english'), defaults to 'thai'
 * @returns {object} New fat bundle with deleted token
 */
export function deleteSenseToken(fatBundle, tokenIndex, language = 'thai') {
  if (!fatBundle || !fatBundle.tokens) {
    throw new Error('Fat bundle must have tokens structure');
  }
  
  const newBundle = JSON.parse(JSON.stringify(fatBundle)); // Deep copy
  const tokens = newBundle.tokens;
  const sensesArray = language === 'english' ? tokens.sensesEnglish : tokens.sensesThai;
  
  if (!Array.isArray(sensesArray) || tokenIndex < 0 || tokenIndex >= sensesArray.length) {
    throw new Error(`Invalid token index: ${tokenIndex}`);
  }
  
  // Delete sense token
  sensesArray.splice(tokenIndex, 1);
  
  // Reindex remaining tokens
  for (let i = tokenIndex; i < sensesArray.length; i++) {
    if (sensesArray[i]) {
      sensesArray[i].index = i;
    }
  }
  
  return newBundle;
}

/**
 * Delete specific sense
 * @param {object} fatBundle - Fat bundle in package format
 * @param {number} tokenIndex - Token index
 * @param {number} senseIndex - Sense index
 * @param {string} language - Language ('thai' or 'english'), defaults to 'thai'
 * @returns {object} New fat bundle with deleted sense
 */
export function deleteSense(fatBundle, tokenIndex, senseIndex, language = 'thai') {
  if (!fatBundle || !fatBundle.tokens) {
    throw new Error('Fat bundle must have tokens structure');
  }
  
  const newBundle = JSON.parse(JSON.stringify(fatBundle)); // Deep copy
  const tokens = newBundle.tokens;
  const sensesArray = language === 'english' ? tokens.sensesEnglish : tokens.sensesThai;
  
  if (!Array.isArray(sensesArray) || tokenIndex < 0 || tokenIndex >= sensesArray.length) {
    throw new Error(`Invalid token index: ${tokenIndex}`);
  }
  
  const senseToken = sensesArray[tokenIndex];
  if (!senseToken || !Array.isArray(senseToken.senses)) {
    throw new Error(`Sense token not found at index ${tokenIndex}`);
  }
  
  if (senseIndex < 0 || senseIndex >= senseToken.senses.length) {
    throw new Error(`Invalid sense index: ${senseIndex}`);
  }
  
  // Delete sense
  senseToken.senses.splice(senseIndex, 1);
  
  // Reindex remaining senses
  for (let i = senseIndex; i < senseToken.senses.length; i++) {
    if (senseToken.senses[i]) {
      senseToken.senses[i].index = i;
    }
  }
  
  return newBundle;
}

/**
 * Iterate through tokens
 * @param {object} fatBundle - Fat bundle in package format
 * @param {Function} callback - Callback function (token, index) => void
 * @param {string} language - Language ('thai' or 'english'), defaults to 'thai'
 */
export function iterateTokens(fatBundle, callback, language = 'thai') {
  if (!fatBundle || !fatBundle.tokens) return;
  
  const tokens = fatBundle.tokens;
  const displayArray = language === 'english' ? tokens.displayEnglish : tokens.displayThai;
  
  if (!Array.isArray(displayArray)) return;
  
  displayArray.forEach((token, index) => {
    callback(token, index);
  });
}

/**
 * Iterate through senses for token
 * @param {object} fatBundle - Fat bundle in package format
 * @param {number} tokenIndex - Token index
 * @param {Function} callback - Callback function (sense, index) => void
 * @param {string} language - Language ('thai' or 'english'), defaults to 'thai'
 */
export function iterateSenses(fatBundle, tokenIndex, callback, language = 'thai') {
  const senseToken = getSenseToken(fatBundle, tokenIndex, language);
  if (!senseToken || !Array.isArray(senseToken.senses)) return;
  
  senseToken.senses.forEach((sense, index) => {
    callback(sense, index);
  });
}

/**
 * Validate token structure - ensure arrays match lengths
 * @param {object} fatBundle - Fat bundle in package format
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateTokenStructure(fatBundle) {
  const errors = [];
  
  if (!fatBundle || !fatBundle.tokens) {
    errors.push('Fat bundle must have tokens structure');
    return { valid: false, errors };
  }
  
  const tokens = fatBundle.tokens;
  
  // Check Thai tokens
  const displayLength = tokens.displayThai?.length || 0;
  const sensesLength = tokens.sensesThai?.length || 0;
  if (displayLength !== sensesLength) {
    errors.push(`Thai tokens: displayThai length (${displayLength}) does not match sensesThai length (${sensesLength})`);
  }
  
  // Check English tokens
  const displayEngLength = tokens.displayEnglish?.length || 0;
  const sensesEngLength = tokens.sensesEnglish?.length || 0;
  if (displayEngLength !== sensesEngLength) {
    errors.push(`English tokens: displayEnglish length (${displayEngLength}) does not match sensesEnglish length (${sensesEngLength})`);
  }
  
  // Check wordReferenceIdsThai length matches displayThai length
  const wordRefsThaiLength = fatBundle.wordReferenceIdsThai?.length || fatBundle.subtitle?.wordReferenceIdsThai?.length || 0;
  if (wordRefsThaiLength !== displayLength) {
    errors.push(`wordReferenceIdsThai length (${wordRefsThaiLength}) does not match displayThai tokens length (${displayLength})`);
  }
  
  // Check wordReferenceIdsEng length matches displayEnglish length
  const wordRefsEngLength = fatBundle.wordReferenceIdsEng?.length || fatBundle.subtitle?.wordReferenceIdsEng?.length || 0;
  if (wordRefsEngLength !== displayEngLength) {
    errors.push(`wordReferenceIdsEng length (${wordRefsEngLength}) does not match displayEnglish tokens length (${displayEngLength})`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate sense token structure
 * @param {object} fatBundle - Fat bundle in package format
 * @param {number} tokenIndex - Token index
 * @param {string} language - Language ('thai' or 'english'), defaults to 'thai'
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateSenseStructure(fatBundle, tokenIndex, language = 'thai') {
  const errors = [];
  
  const senseToken = getSenseToken(fatBundle, tokenIndex, language);
  if (!senseToken) {
    errors.push(`Sense token not found at index ${tokenIndex}`);
    return { valid: false, errors };
  }
  
  if (senseToken.index !== tokenIndex) {
    errors.push(`Sense token index mismatch: expected ${tokenIndex}, got ${senseToken.index}`);
  }
  
  if (!Array.isArray(senseToken.senses)) {
    errors.push(`Sense token at index ${tokenIndex} does not have senses array`);
    return { valid: false, errors };
  }
  
  // Validate each sense has correct index
  senseToken.senses.forEach((sense, idx) => {
    if (sense.index !== idx) {
      errors.push(`Sense at token ${tokenIndex}, sense ${idx} has incorrect index: expected ${idx}, got ${sense.index}`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

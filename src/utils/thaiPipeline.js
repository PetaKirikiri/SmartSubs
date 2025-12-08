/**
 * Three-Step Thai Subtitle Processing Pipeline
 * 
 * Step 1: Tokenize Thai sentence using AI4Thai Longan Tokenizer
 * Step 2: POS tag each token using AI4Thai POS tagging
 * Step 3: Get phonetics (G2P) for each token
 * Step 4: Get dictionary candidates for each token+POS pair
 * 
 * This is a debugging/experimentation module - NOT wired into save logic yet.
 * To integrate: call runThaiPipeline(thaiSentence) after getting raw Thai text.
 */

import { romanizeThai } from './phonetics.js';

/**
 * Get AI4Thai API key from localStorage or environment variable
 * Priority: localStorage > environment variable
 * @returns {string|null} API key or null
 */
function getAI4ThaiApiKey() {
  // First check localStorage (user override)
  const stored = localStorage.getItem('smartSubs_ai4thai_apiKey');
  if (stored && stored.trim()) {
    return stored.trim();
  }
  
  // Fall back to environment variable (injected at build time by Vite)
  const envKey = import.meta.env.VITE_AI4THAI_API_KEY;
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }
  
  return null;
}

/**
 * Set AI4Thai API key in localStorage
 * Call this from browser console: setAI4ThaiApiKey('your-key-here')
 * @param {string} apiKey - API key to store
 */
export function setAI4ThaiApiKey(apiKey) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('smartSubs_ai4thai_apiKey', apiKey);
    console.log('[Thai Pipeline] API key set successfully');
  }
}

/**
 * Build authenticated headers for AI4Thai API requests
 * Validates API key and hard-fails if missing
 * @param {string} contentType - Content-Type header value ('application/json' or 'application/x-www-form-urlencoded')
 * @returns {Object} Headers object with Apikey and Content-Type
 * @throws {Error} If API key is missing
 */
function buildAuthenticatedHeaders(contentType) {
  const apiKey = getAI4ThaiApiKey();
  
  if (!apiKey || !apiKey.trim()) {
    const error = new Error('[Thai Pipeline] ❌ API key is missing. Set it using: setAI4ThaiApiKey("your-key-here")');
    console.error(error.message);
    throw error;
  }
  
  const headers = {
    'Apikey': apiKey.trim(),
    'Content-Type': contentType
  };
  
  // Log final headers with masked API key
  const maskedKey = apiKey.length > 4 ? '***' + apiKey.slice(-4) : '***';
  console.log('[Thai Pipeline] Request headers:', {
    'Apikey': maskedKey,
    'Content-Type': contentType
  });
  
  return headers;
}

/**
 * Make API call via background script to bypass CORS
 */
async function callThaiApiViaBackground(endpoint, method, headers, body) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'THAI_API_CALL',
      endpoint,
      method,
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body)
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response && response.success) {
        resolve(response.data);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}

/**
 * Step 1: Tokenize Thai sentence using AI4Thai Longan Tokenizer
 * API: https://api.aiforthai.in.th/longan/tokenize
 * @param {string} thaiSentence - Raw Thai sentence
 * @returns {Promise<string[]>} Array of tokens
 */
async function tokenizeThaiSentence(thaiSentence) {
  try {
    // Build authenticated headers (validates API key)
    const headers = buildAuthenticatedHeaders('application/x-www-form-urlencoded');
    
    // Clean the text - remove newlines and extra whitespace
    const cleanText = thaiSentence.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    // AI4Thai Longan tokenize API expects form-urlencoded data
    const formData = new URLSearchParams();
    formData.append('text', cleanText);
    formData.append('sep', '|');
    formData.append('wordseg', 'true');
    formData.append('sentseg', 'false');
    
    console.log('[Thai Pipeline] Tokenize Request:', {
      url: 'https://api.aiforthai.in.th/longan/tokenize',
      method: 'POST',
      textLength: cleanText.length,
      textPreview: cleanText.substring(0, 50)
    });
    
    // Use background script to bypass CORS
    const data = await callThaiApiViaBackground(
      'https://api.aiforthai.in.th/longan/tokenize',
      'POST',
      headers,
      formData.toString()
    );
    
    console.log('[Thai Pipeline] Tokenize API response:', JSON.stringify(data, null, 2));
    
    // Parse the response - AI4Thai Longan tokenize API returns:
    // { result: ["token1|token2", "token3|token4", ...] }
    // Each string in the array is a sentence with pipe-separated tokens
    let tokens = [];
    
    if (data.result && Array.isArray(data.result)) {
      // result is an array of strings, each string contains pipe-separated tokens
      data.result.forEach(sentenceTokens => {
        if (typeof sentenceTokens === 'string') {
          const sentenceTokenArray = sentenceTokens.split('|').filter(t => t && t.trim());
          tokens.push(...sentenceTokenArray);
        }
      });
    } else if (data.result && typeof data.result === 'string') {
      // Fallback: if result is a single string
      tokens = data.result.split('|').filter(t => t && t.trim());
    }
    
    return tokens.filter(t => t && t.trim());
  } catch (error) {
    console.log('[Thai Pipeline] Tokenization error:', error);
    throw error;
  }
}

/**
 * Step 2: POS tag tokens using AI4Thai POS tagging
 * Uses Longan Tagger API endpoint
 * API: https://api.aiforthai.in.th/longan/tagger
 * @param {string[]} tokens - Array of Thai tokens
 * @returns {Promise<Array<{token: string, pos: string}>>} Array of token+POS pairs
 */
async function tagTokensWithPOS(tokens) {
  try {
    if (tokens.length === 0) {
      return [];
    }
    
    // Build authenticated headers (validates API key)
    const headers = buildAuthenticatedHeaders('application/x-www-form-urlencoded');
    
    // Join tokens with | separator - POS tagger expects pre-tokenized text
    const tokenText = tokens.join('|');
    const formData = new URLSearchParams();
    formData.append('text', tokenText);
    formData.append('sep', '|');
    formData.append('tag_sep', '/');
    formData.append('pos', 'true');
    formData.append('ner', 'false');
    formData.append('sent', 'false');
    
    console.log('[Thai Pipeline] POS tagger input text:', tokenText);
    console.log('[Thai Pipeline] POS tagger tokens:', tokens);
    
    console.log('[Thai Pipeline] POS Tag Request:', {
      url: 'https://api.aiforthai.in.th/longan/tagger',
      method: 'POST',
      tokenCount: tokens.length,
      textPreview: tokenText.substring(0, 50)
    });
    
    // Use background script to bypass CORS
    const data = await callThaiApiViaBackground(
      'https://api.aiforthai.in.th/longan/tagger',
      'POST',
      headers,
      formData.toString()
    );
    
    console.log('[Thai Pipeline] POS Tag API Response (RAW):', JSON.stringify(data, null, 2));
    
    // Parse response - AI4Thai Longan Tagger returns:
    // { result: ["token1/POS1|token2/POS2|token3/POS3", ...] }
    // Each string in the array contains pipe-separated token/POS pairs
    let tagged = [];
    
    if (data.result && Array.isArray(data.result)) {
      // result is an array of strings, each string contains pipe-separated token/POS pairs
      console.log('[Thai Pipeline] POS result array length:', data.result.length);
      data.result.forEach((resultStr, idx) => {
        console.log(`[Thai Pipeline] POS result[${idx}]:`, resultStr);
        if (typeof resultStr === 'string') {
          const pairs = resultStr.split('|');
          console.log(`[Thai Pipeline] POS pairs (${pairs.length}):`, pairs);
          pairs.forEach((pair, pairIdx) => {
            const trimmed = pair.trim();
            if (!trimmed) return; // Skip empty pairs
            
            const parts = trimmed.split('/');
            const token = parts[0] ? parts[0].trim() : '';
            // POS tag is the second part (index 1)
            const pos = parts.length > 1 && parts[1] ? parts[1].trim() : 'UNKNOWN';
            
            console.log(`[Thai Pipeline] Pair ${pairIdx}: "${trimmed}" → token="${token}", pos="${pos}" (parts.length=${parts.length})`);
            
            if (token) {
              tagged.push({ token, pos });
            }
          });
        }
      });
    } else if (data.result && typeof data.result === 'string') {
      // Fallback: if result is a single string
      const pairs = data.result.split('|');
      pairs.forEach(pair => {
        const trimmed = pair.trim();
        if (!trimmed) return;
        
        const parts = trimmed.split('/');
        const token = parts[0] ? parts[0].trim() : '';
        const pos = parts[1] ? parts[1].trim() : (parts.length > 1 ? parts[1] : 'UNKNOWN');
        if (token) {
          tagged.push({ token, pos });
        }
      });
    } else {
      console.log('[Thai Pipeline] Unexpected POS response format:', typeof data.result, data.result);
    }
    
    // Filter out empty tokens
    tagged = tagged.filter(item => item.token && item.token.trim());
    
    // Map POS tags to input tokens by matching token text
    // This handles cases where POS API returns different tokenization
    const tokenMap = new Map();
    tagged.forEach(({ token, pos }) => {
      tokenMap.set(token, pos);
    });
    
    // Create result matching input token order
    const result = tokens.map(token => ({
      token,
      pos: tokenMap.get(token) || 'UNKNOWN'
    }));
    
    // Log mapping info
    if (tagged.length !== tokens.length) {
      console.log(`[Thai Pipeline] POS mapping: ${tagged.length} tagged → ${tokens.length} tokens`);
      console.log(`[Thai Pipeline] Tagged tokens:`, tagged.map(t => `${t.token}/${t.pos}`));
      console.log(`[Thai Pipeline] Input tokens:`, tokens);
    }
    
    return result;
  } catch (error) {
    // Fallback: return tokens with unknown POS
    return tokens.map(token => ({ token, pos: 'UNKNOWN' }));
  }
}

/**
 * Step 3: Get phonetics (G2P) for Thai text
 * API: https://api.aiforthai.in.th/g2p
 * @param {string} thaiText - Thai text to convert to phonetics
 * @returns {Promise<{src_text: string, nor_text: string, phoneme: string}>} G2P result
 */
/**
 * Filter out punctuation and non-lexical tokens
 * @param {string[]} tokens - Array of tokens
 * @returns {string[]} Filtered tokens (lexical only)
 */
function filterLexicalTokens(tokens) {
  // Filter out punctuation, spaces, and special characters
  return tokens.filter(token => {
    const trimmed = token.trim();
    if (!trimmed) return false;
    // Exclude single punctuation marks, Thai repeaters, etc.
    if (/^[-.,;:!?()\[\]{}"']$/.test(trimmed)) return false;
    if (trimmed === 'ๆ') return false; // Thai repeater
    if (trimmed === ' ') return false;
    return true;
  });
}

/**
 * Get phonetics for a single token
 */
async function getPhoneticsForToken(token) {
  // Build authenticated headers (validates API key)
  const headers = buildAuthenticatedHeaders('application/json');
  
  const requestBody = {
    text: token,
    output_type: 'phoneme'
  };
  
  const data = await callThaiApiViaBackground(
    'https://api.aiforthai.in.th/g2p',
    'POST',
    headers,
    requestBody
  );
  
  return data;
}

async function getPhonetics(thaiText, lexicalTokens) {
  try {
    // Build authenticated headers (validates API key)
    const headers = buildAuthenticatedHeaders('application/json');
    
    // Try batch mode first: send all tokens joined with |
    const g2pInput = lexicalTokens.join('|');
    
    const requestBody = {
      text: g2pInput,
      output_type: 'phoneme' // phoneme version 9.0 with syllable segmentation
    };
    
    console.log('[Thai Pipeline] G2P Request (BATCH MODE):', {
      url: 'https://api.aiforthai.in.th/g2p',
      method: 'POST',
      inputText: g2pInput,
      inputLength: g2pInput.length,
      tokenCount: lexicalTokens.length,
      tokens: lexicalTokens
    });
    
    // Use background script to bypass CORS
    const batchData = await callThaiApiViaBackground(
      'https://api.aiforthai.in.th/g2p',
      'POST',
      headers,
      requestBody
    );
    
    console.log('[Thai Pipeline] G2P API Response (BATCH):', JSON.stringify(batchData, null, 2));
    
    // Check alignment: count phonemes in response
    if (batchData.phoneme) {
      const phonemeParts = batchData.phoneme.split('|').filter(p => p && p.trim() && p !== '*');
      const phonemeCount = phonemeParts.length;
      
      console.log(`[Thai Pipeline] G2P Alignment Check: ${phonemeCount} phonemes vs ${lexicalTokens.length} tokens`);
      
      if (phonemeCount === lexicalTokens.length) {
        // Perfect alignment - use batch result
        console.log('[Thai Pipeline] ✅ G2P BATCH MODE: Perfect alignment');
        return batchData;
      } else {
        // Misalignment - fall back to per-token mode
        console.log(`[Thai Pipeline] ⚠️ G2P BATCH MODE: Misalignment detected (${phonemeCount} ≠ ${lexicalTokens.length})`);
        console.log('[Thai Pipeline] 🔄 Falling back to PER-TOKEN MODE for perfect alignment');
        
        // Fetch phonetics for each token individually
        const perTokenResults = await Promise.all(
          lexicalTokens.map(async (token, idx) => {
            console.log(`[Thai Pipeline] G2P Request (PER-TOKEN ${idx + 1}/${lexicalTokens.length}):`, token);
            const tokenData = await getPhoneticsForToken(token);
            return {
              token,
              phoneme: tokenData.phoneme || '',
              src_text: tokenData.src_text || token,
              nor_text: tokenData.nor_text || token
            };
          })
        );
        
        // Combine per-token results into batch-like format
        const combinedPhonemes = perTokenResults.map(r => r.phoneme).filter(p => p).join('|');
        const combinedSrcText = perTokenResults.map(r => r.src_text).join('|');
        const combinedNorText = perTokenResults.map(r => r.nor_text).join('|');
        
        console.log('[Thai Pipeline] ✅ G2P PER-TOKEN MODE: Combined results');
        console.log(`[Thai Pipeline] Combined phonemes: ${combinedPhonemes}`);
        
        return {
          src_text: combinedSrcText,
          nor_text: combinedNorText,
          phoneme: combinedPhonemes,
          _mode: 'per-token',
          _perTokenResults: perTokenResults
        };
      }
    } else {
      // No phoneme in response - fall back to per-token
      console.log('[Thai Pipeline] ⚠️ G2P BATCH MODE: No phoneme in response');
      console.log('[Thai Pipeline] 🔄 Falling back to PER-TOKEN MODE');
      
      const perTokenResults = await Promise.all(
        lexicalTokens.map(async (token, idx) => {
          console.log(`[Thai Pipeline] G2P Request (PER-TOKEN ${idx + 1}/${lexicalTokens.length}):`, token);
          const tokenData = await getPhoneticsForToken(token);
          return {
            token,
            phoneme: tokenData.phoneme || '',
            src_text: tokenData.src_text || token,
            nor_text: tokenData.nor_text || token
          };
        })
      );
      
      const combinedPhonemes = perTokenResults.map(r => r.phoneme).filter(p => p).join('|');
      const combinedSrcText = perTokenResults.map(r => r.src_text).join('|');
      const combinedNorText = perTokenResults.map(r => r.nor_text).join('|');
      
      return {
        src_text: combinedSrcText,
        nor_text: combinedNorText,
        phoneme: combinedPhonemes,
        _mode: 'per-token',
        _perTokenResults: perTokenResults
      };
    }
  } catch (error) {
    console.log('[Thai Pipeline] G2P error:', error);
    throw error;
  }
}

/**
 * Step 4: Get dictionary candidates for a token+POS pair
 * 
 * PLUG-IN POINT: Replace this stub with real dictionary API integration
 * Options: ORST Dictionary (https://dictionary.orst.go.th/), Longdo, etc.
 * 
 * INTEGRATION NOTES:
 * - May require web scraping or API key
 * - Consider CORS issues - may need proxy/backend endpoint
 * - Filter results by POS tag if dictionary supports it
 * - Cache results to avoid repeated API calls for same token
 * - Handle rate limiting if dictionary has API limits
 * 
 * @param {string} token - Thai token
 * @param {string} pos - Part-of-speech tag
 * @returns {Promise<Array>} Array of dictionary candidates (stub returns mock data)
 */
async function getDictionaryCandidates(token, pos) {
  // STUB IMPLEMENTATION - Replace with real dictionary API call
  // TODO: Implement dictionary lookup (ORST, Longdo, etc.)
  
  // For now, return mock data for debugging
  return [
    {
      word: token,
      pos: pos,
      definition: `[Mock definition for ${token}]`,
      example: `[Mock example sentence]`,
      source: 'ORST_STUB'
    }
  ];
  
  /* 
   * REAL IMPLEMENTATION EXAMPLE (commented out):
   * 
   * try {
   *   // Option 1: Direct API call (if available)
   *   const response = await fetch(
   *     `https://dictionary.orst.go.th/api/search?word=${encodeURIComponent(token)}&pos=${pos}`,
   *     { 
   *       headers: { 
   *         'Authorization': 'Bearer YOUR_API_KEY', // If required
   *         'Content-Type': 'application/json'
   *       }
   *     }
   *   );
   *   const data = await response.json();
   *   // Filter by POS if ORST returns multiple senses
   *   const filtered = data.results?.filter(r => !pos || r.pos === pos) || [];
   *   return filtered;
   *   
   *   // Option 2: Web scraping (if no API available)
   *   // Use a backend proxy to avoid CORS issues:
   *   // const response = await fetch(`/api/orst-proxy?word=${encodeURIComponent(token)}`);
   *   // const html = await response.text();
   *   // Parse HTML to extract dictionary entries
   *   // return parseOrstResults(html, pos);
   *   
   * } catch (error) {
   *   console.error(`[ORST] Failed to fetch candidates for ${token}:`, error);
   *   return [];
   * }
   */
}

/**
 * Parse phoneme string into individual word phonetics
 * Phoneme format: "c-qq0|k-a0-n^|phr-u2-ng^|n-ii3|n-a3|*" (pipe-separated)
 * G2P tokenizes differently than our tokenizer, so we need to match by character position
 * @param {string} phonemeStr - Phoneme string from G2P API
 * @param {string[]} tokens - Array of tokens to match phonemes to
 * @param {string} originalText - Original Thai text for alignment
 * @returns {Array<{token: string, phoneme: string}>} Array of token-phoneme pairs
 */
/**
 * Parse phoneme string into individual word phonetics
 * Phoneme format: "c-qq0|k-a0-n^|phr-u2-ng^|n-ii3|n-a3|*" (pipe-separated)
 * G2P input was lexicalTokens.join('|'), so phonemes align 1:1 with lexical tokens
 * @param {string} phonemeStr - Phoneme string from G2P API
 * @param {string[]} lexicalTokens - Array of lexical tokens (no punctuation) that match G2P input
 * @param {string[]} allTokens - All tokens including punctuation (for mapping back)
 * @returns {Array<{token: string, phoneme: string, romanization: string}>} Array of token-phoneme-romanization pairs
 */
function parsePhonemesToTokens(phonemeStr, lexicalTokens, allTokens, phoneticsData) {
  // Create map of lexical tokens to phonemes
  const lexicalPhonemeMap = new Map();
  
  // Check if we used per-token mode (which guarantees 1:1 alignment)
  if (phoneticsData && phoneticsData._mode === 'per-token' && phoneticsData._perTokenResults) {
    // Per-token mode: map directly from perTokenResults
    console.log('[Thai Pipeline] Parsing phonemes from PER-TOKEN MODE results');
    phoneticsData._perTokenResults.forEach((result, idx) => {
      if (idx < lexicalTokens.length) {
        const token = lexicalTokens[idx];
        // Extract phoneme from result (may contain multiple syllables separated by |)
        const phoneme = result.phoneme ? result.phoneme.split('|').filter(p => p && p.trim() && p !== '*').join('|') : '';
        lexicalPhonemeMap.set(token, phoneme);
      }
    });
  } else if (phonemeStr && phonemeStr.trim()) {
    // Batch mode: split by pipe separator, filter out empty and asterisk
    const phonemeParts = phonemeStr.split('|').filter(p => p && p.trim() && p !== '*');
    
    // G2P input was lexicalTokens.join('|'), so phonemes should align 1:1
    // Each phoneme part corresponds to one lexical token
    console.log('[Thai Pipeline] Parsing phonemes from BATCH MODE results');
    for (let i = 0; i < lexicalTokens.length && i < phonemeParts.length; i++) {
      lexicalPhonemeMap.set(lexicalTokens[i], phonemeParts[i].trim());
    }
    
    if (phonemeParts.length !== lexicalTokens.length) {
      console.log(`[Thai Pipeline] ⚠️ Phoneme count mismatch: ${phonemeParts.length} phonemes vs ${lexicalTokens.length} lexical tokens`);
      console.log(`[Thai Pipeline] Phonemes:`, phonemeParts);
      console.log(`[Thai Pipeline] Lexical tokens:`, lexicalTokens);
    }
  }
  
  // Map back to all tokens (including punctuation)
  return allTokens.map(token => {
    const isLexical = lexicalPhonemeMap.has(token);
    return {
      token,
      phoneme: isLexical ? lexicalPhonemeMap.get(token) : '',
      romanization: romanizeThai(token)
    };
  });
}

/**
 * Run the complete pipeline on a Thai sentence
 * Steps: 1) Tokenize, 2) POS tag, 3) Get phonetics (G2P), 4) Dictionary lookup
 * 
 * INTEGRATION POINT: Call this function after getting raw Thai text
 * Example: runThaiPipeline(subtitle.thai) after saveStage1 or when editing
 * 
 * @param {string} thaiSentence - Raw Thai sentence
 * @returns {Promise<Object>} Pipeline results with all steps
 */
export async function runThaiPipeline(thaiSentence) {
  if (!thaiSentence || !thaiSentence.trim()) {
    return null;
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔤 THAI PIPELINE - Current Subtitle');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Original:', thaiSentence);

  try {
    // Step 1: Tokenize
    const tokens = await tokenizeThaiSentence(thaiSentence);
    if (tokens.length === 0) {
      console.log('\n📝 Tokenized (thaiSplit): [] (empty - check API response format)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return { original: thaiSentence, tokens: [], taggedTokens: [], phonetics: null, tokenPhonetics: [], dictionaryResults: [] };
    } else {
      console.log('\n📝 Tokenized (thaiSplit):', tokens);
    }

    // Step 2: POS tag
    const taggedTokens = await tagTokensWithPOS(tokens);
    console.log('\n🏷️  POS Tagged:');
    taggedTokens.forEach(({ token, pos }) => {
      console.log(`   ${token} → ${pos}`);
    });

    // Step 3: Get phonetics (G2P)
    // Filter to lexical tokens only for G2P input to ensure alignment
    const lexicalTokens = filterLexicalTokens(tokens);
    console.log('\n📝 Lexical tokens (for G2P):', lexicalTokens);
    
    let phoneticsData = null;
    let tokenPhonetics = [];
    try {
      // Pass lexical tokens to G2P so input matches tokenization
      phoneticsData = await getPhonetics(thaiSentence, lexicalTokens);
      console.log('\n🔊 Phonetics (G2P):');
      console.log(`   src_text: ${phoneticsData.src_text || 'N/A'}`);
      console.log(`   nor_text: ${phoneticsData.nor_text || 'N/A'}`);
      console.log(`   phoneme: ${phoneticsData.phoneme || 'N/A'}`);
      
      // Parse phonemes to match tokens
      // G2P uses batch mode (lexicalTokens.join('|')) or per-token mode for perfect alignment
      if (phoneticsData.phoneme) {
        tokenPhonetics = parsePhonemesToTokens(phoneticsData.phoneme, lexicalTokens, tokens, phoneticsData);
        const modeDisplay = phoneticsData._mode === 'per-token' ? ' (PER-TOKEN MODE)' : ' (BATCH MODE)';
        console.log(`\n   Token Phonetics & Romanization${modeDisplay}:`);
        tokenPhonetics.forEach(({ token, phoneme, romanization }) => {
          const phonemeDisplay = phoneme ? ` [${phoneme}]` : '';
          const romanDisplay = romanization ? ` → ${romanization}` : '';
          console.log(`      ${token}${phonemeDisplay}${romanDisplay}`);
        });
      }
    } catch (g2pError) {
      console.log('\n🔊 Phonetics (G2P): Error -', g2pError.message);
      tokenPhonetics = tokens.map(token => ({ 
        token, 
        phoneme: '',
        romanization: romanizeThai(token)
      }));
    }

    // Step 4: Dictionary lookup for each token
    // IMPORTANT: Dictionary lookups use the Thai token, NOT phonemes
    console.log('\n📚 Dictionary Lookups:');
    const dictionaryPromises = taggedTokens.map(({ token, pos }, idx) => {
      const phonetics = tokenPhonetics[idx] || { token, phoneme: '', romanization: '' };
      // Dictionary lookup uses the Thai token, not phonemes
      return getDictionaryCandidates(token, pos).then(candidates => ({
        token,
        pos,
        phoneme: phonetics.phoneme,
        romanization: phonetics.romanization,
        candidates
      }));
    });
    const dictionaryResults = await Promise.all(dictionaryPromises);
    
    dictionaryResults.forEach(({ token, pos, phoneme, romanization, candidates }) => {
      const posDisplay = pos !== 'UNKNOWN' ? ` [${pos}]` : '';
      const romanDisplay = romanization ? ` → ${romanization}` : '';
      console.log(`\n   ${token}${posDisplay}${romanDisplay}:`);
      if (candidates.length === 0) {
        console.log('      (no dictionary entries found)');
      } else {
        candidates.forEach((cand, idx) => {
          console.log(`      ${idx + 1}. ${cand.definition || cand.word || cand.meaning || '[no definition]'}`);
        });
      }
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return {
      original: thaiSentence,
      tokens,
      taggedTokens,
      phonetics: phoneticsData,
      tokenPhonetics,
      dictionaryResults
    };
  } catch (error) {
    console.error('[Thai Pipeline] Pipeline error:', error);
    throw error;
  }
}


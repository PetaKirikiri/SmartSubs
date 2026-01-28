/**
 * GPT Tokenization - Thai Word Tokenization using GPT
 * Fallback A: GPT_TOKENIZE_ONLY
 * Splits compound Thai words into dictionary-level sub-words
 */

import { getOpenAIApiKey } from '../../utils/gpt-config.js';

/**
 * Tokenize a Thai word into sub-words using GPT (Fallback A: GPT_TOKENIZE_ONLY)
 * @param {string} thaiWord - Thai word to tokenize
 * @param {object} context - Context object with showName, episode, season, subtitleNumber, fullThaiText, allTokens, wordPosition
 * @returns {Promise<{subWords: string[], shouldScrapeSubwords: boolean}>} Object with sub-words array and flag indicating if subword scraping would be beneficial
 */
export async function tokenizeThaiWordWithGPT(thaiWord, context) {
  if (!thaiWord || !thaiWord.trim()) {
    return { subWords: [], shouldScrapeSubwords: false };
  }
  
  const apiKey = getOpenAIApiKey();
  
  if (!apiKey) {
    return { subWords: [], shouldScrapeSubwords: false };
  }
  
  const systemPrompt = 'You are a Thai language expert specializing in word tokenization. Your task is to analyze a Thai word that was not found in standard dictionaries and determine if it can be split into smaller dictionary-level sub-words.\n\nThe word might be:\n- A compound word (e.g., "รถไฟ" = "รถ" + "ไฟ")\n- A word with prefixes/suffixes\n- A proper noun that can be decomposed\n- A slang term made of multiple words\n\nReturn a JSON object with:\n- "subWords": An array of sub-words if the word CAN be split meaningfully, or an empty array if it cannot\n- "shouldScrapeSubwords": true if scraping ORST for these sub-words would likely improve the UI/meaning, false if the word is better left as-is or subword scraping would not help\n\nIMPORTANT:\n- Return ONLY valid JSON matching the exact structure: {"subWords": [...], "shouldScrapeSubwords": boolean}\n- Do NOT include definitions, translations, or explanations\n- Do NOT include the original word in the subWords array\n- Each sub-word should be a valid dictionary lookup candidate\n- Preserve the order of sub-words as they appear in the original word\n- Set shouldScrapeSubwords to false if the word is atomic, proper noun, or splitting would not improve understanding';
  
  const userPrompt = JSON.stringify({
    thaiWord: thaiWord.trim(),
    context: {
      showName: context.showName || '',
      episode: context.episode || null,
      season: context.season || null,
      subtitleNumber: context.subtitleNumber || null,
      fullThaiText: context.fullThaiText || '',
      allTokens: context.allTokens || [],
      wordPosition: context.wordPosition || null
    }
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
        temperature: 0,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return [];
    }
    
    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content?.trim() || '';
    
    if (!resultText) {
      return [];
    }
    
    // Parse JSON response
    let tokenizeData;
    try {
      tokenizeData = JSON.parse(resultText);
    } catch (parseError) {
      return { subWords: [], shouldScrapeSubwords: false };
    }
    
    // Extract subWords array and shouldScrapeSubwords flag
    const subWords = tokenizeData.subWords || [];
    const shouldScrapeSubwords = tokenizeData.shouldScrapeSubwords === true;
    
    if (!Array.isArray(subWords)) {
      return { subWords: [], shouldScrapeSubwords: false };
    }
    
    // Filter and clean sub-words
    const cleanedSubWords = subWords
      .filter(w => w && typeof w === 'string' && w.trim().length > 0)
      .map(w => w.trim());
    
    return { subWords: cleanedSubWords, shouldScrapeSubwords: shouldScrapeSubwords && cleanedSubWords.length > 0 };
  } catch (error) {
    return { subWords: [], shouldScrapeSubwords: false };
  }
}

/**
 * Split a Thai word into smaller dictionary-level tokens using GPT
 * @deprecated Use tokenizeThaiWordWithGPT instead
 * @param {string} thaiWord - Thai word to split
 * @returns {Promise<string>} Space-separated list of smaller tokens, or empty string if cannot be split
 */
export async function splitThaiWordWithGPT(thaiWord) {
  if (!thaiWord || !thaiWord.trim()) {
    return '';
  }
  
  const apiKey = getOpenAIApiKey();
  
  if (!apiKey) {
    throw new Error('OpenAI API key not found. Set VITE_OPENAI_API_KEY in .env or localStorage.smartSubs_openaiApiKey');
  }
  
  const systemPrompt = 'You are a Thai language expert. Check if this Thai word can be split into smaller dictionary-level tokens. If it can be split, return ONLY a space-separated list of the smaller tokens. If it cannot be split or is already a single token, return an empty string. Do NOT translate. Do NOT add explanations.';
  const userPrompt = thaiWord.trim();
  
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
        temperature: 0,
        max_tokens: 100
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GPT API error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim() || '';
    
    const cleaned = result.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    return cleaned;
  } catch (error) {
    throw new Error(`GPT API error: ${error.message}`);
  }
}





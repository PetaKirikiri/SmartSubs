/**
 * GPT Meaning - Thai Word Sense Creation using GPT
 * Fallback B: GPT_DEFINE_ONLY
 * Generates dictionary sense definitions for words that cannot be found in dictionaries
 */

import { getOpenAIApiKey } from '../../../../utils/gpt-config.js';

/**
 * Create sense object(s) for a Thai word using GPT from subtitle (subtitle-in pattern)
 * @param {object} subtitle - Fat subtitle
 * @param {number} selectedWordIndex - Index of selected word
 * @param {object} [context] - Additional context
 * @param {string} [context.showName] - Show name
 * @param {number} [context.episode] - Episode number
 * @param {number} [context.season] - Season number
 * @param {string} [context.subId] - Subtitle ID
 * @returns {Promise<Array>} Array of sense objects matching ORST structure, or empty array on error
 */
export async function createSenseWithGPTFromSubtitle(subtitle, selectedWordIndex, context = {}) {
  if (!subtitle || !subtitle.tokens || selectedWordIndex === null || selectedWordIndex === undefined) {
    return [];
  }
  
  const displayToken = subtitle.tokens.display?.[selectedWordIndex];
  const senseToken = subtitle.tokens.senses?.[selectedWordIndex];
  const thaiWord = displayToken?.thaiScript || '';
  
  if (!thaiWord) {
    return [];
  }
  
  // Extract all tokens from subtitle
  const allTokens = subtitle.tokens.display?.map(t => t.thaiScript || '').filter(t => t) || [];
  const fullThaiText = subtitle.subtitle?.thai || '';
  const subId = subtitle.subtitle?.id || context.subId || null;
  
  // Detect if failed word: no senses or word has no meanings
  const isFailedWord = !senseToken?.senses || senseToken.senses.length === 0;
  
  const gptContext = {
    showName: context.showName || '',
    episode: context.episode || null,
    season: context.season || null,
    subtitleNumber: subId ? parseInt(subId.split('-').pop(), 10) : null,
    fullThaiText: fullThaiText,
    allTokens: allTokens,
    wordPosition: selectedWordIndex,
    isFailedWord: isFailedWord,
    wordData: senseToken || null,
    existingSenses: senseToken?.senses || []
  };
  
  return createSenseWithGPT(thaiWord, gptContext);
}

/**
 * Create sense object(s) for a Thai word using GPT with context
 * @param {string} thaiWord - Thai word to create sense for
 * @param {object} context - Context object with showName, episode, season, subtitleNumber, fullThaiText, allTokens, wordPosition
 * @returns {Promise<Array>} Array of sense objects matching ORST structure, or empty array on error
 */
export async function createSenseWithGPT(thaiWord, context) {
  if (!thaiWord || !thaiWord.trim()) {
    return [];
  }
  
  const apiKey = getOpenAIApiKey();
  
  if (!apiKey) {
    return [];
  }
  
  // Extract failed word data from context
  const isFailedWord = context.isFailedWord || false;
  const wordData = context.wordData || null;
  const existingSenses = context.existingSenses || wordData?.senses || [];
  const existingG2P = wordData?.g2p || null;
  const existingPhonetic = wordData?.englishPhonetic || null;
  const lastEpisode = context.lastEpisode || wordData?.lastEpisode || null;
  const smartSubsRefs = context.smartSubsRefs || wordData?.smartSubsRefs || [];
  const hasPreviousSenses = existingSenses && Array.isArray(existingSenses) && existingSenses.length > 0;
  
  // Build system prompt with failed word awareness
  let systemPrompt = 'You are a Thai language expert helping to create dictionary sense entries for words that cannot be found in standard dictionaries and cannot be decomposed into dictionary sub-words.\n\nThe word might be:\n- A proper noun (person name, place name, brand name)\n- A compound word not decomposable into dictionary parts\n- A slang or colloquial term\n- A technical term\n- A word from a specific dialect\n- A newly coined word\n\nUse the provided context (show name, episode, season, subtitle text, surrounding words) to infer the most likely meaning(s).';
  
  if (isFailedWord) {
    systemPrompt += '\n\nIMPORTANT: This word was previously not found in standard dictionaries (ORST scraping failed).';
  }
  
  if (hasPreviousSenses) {
    systemPrompt += '\n\nThis word already has GPT-generated senses. You may improve them, expand them, or replace them based on the new context provided.';
  }
  
  if (existingG2P || existingPhonetic) {
    systemPrompt += '\n\nUse the provided phonetic data (G2P and/or English phonetic) to inform your understanding of pronunciation.';
  }
  
  systemPrompt += '\n\nReturn ONLY valid JSON matching the exact structure provided. Do not include explanations or markdown formatting.';
  
  const userPrompt = JSON.stringify({
    word: thaiWord.trim(),
    context: {
      showName: context.showName || '',
      episode: context.episode || null,
      season: context.season || null,
      subtitleNumber: context.subtitleNumber || null,
      fullThaiText: context.fullThaiText || '',
      allTokens: context.allTokens || [],
      wordPosition: context.wordPosition || null
    },
    requiredStructure: {
      thaiWord: 'string',
      pos: 'string',
      definition: 'string',
      english: 'string',
      example: 'string',
      source: 'GPT',
      index: 0,
      senseNumber: '1'
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
        model: 'gpt-5.2',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_completion_tokens: 500,
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
    let senseData;
    try {
      senseData = JSON.parse(resultText);
    } catch (parseError) {
      return [];
    }
    
    // Extract senses array (support both single sense object and senses array)
    let sensesArray = [];
    if (senseData.senses && Array.isArray(senseData.senses)) {
      sensesArray = senseData.senses;
    } else if (senseData.thaiWord || senseData.definition || senseData.english) {
      // Single sense object (backward compatibility)
      sensesArray = [senseData];
    }
    
    // If no valid senses found, return GPT_FAILED sense
    if (sensesArray.length === 0) {
      const sense = {
        thaiWord: thaiWord.trim(),
        pos: '',
        definition: 'GPT attempted but returned no useful data',
        english: '',
        example: '',
        source: 'GPT_FAILED',
        index: 0,
        senseNumber: '1'
      };
      return [sense];
    }
    
    // Normalize each sense object
    const normalizedSenses = sensesArray.map((senseItem, index) => {
      // Validate sense object
      if (!senseItem.thaiWord && !senseItem.definition && !senseItem.english) {
        return {
          thaiWord: thaiWord.trim(),
          pos: '',
          definition: 'GPT attempted but returned no useful data',
          english: '',
          example: '',
          source: 'GPT_FAILED',
          index: index,
          senseNumber: String(index + 1)
        };
      }
      
      // Normal GPT sense with useful data
      return {
        thaiWord: senseItem.thaiWord || thaiWord.trim(),
        pos: senseItem.pos || '',
        definition: senseItem.definition || '',
        source: 'GPT',
        index: index,
        senseNumber: senseItem.senseNumber || String(index + 1)
      };
    });
    
    return normalizedSenses;
  } catch (error) {
    return [];
  }
}



/**
 * GPT Sense Selection - Context-aware sense recommendation
 * Analyzes subtitle context to recommend the most appropriate sense
 */

import { getOpenAIApiKey } from '../../utils/gpt-config.js';
import { saveGPTSenseAssessmentSave } from './save-gpt-assessment.js';
import { parseWordReference } from '../../03_process/helpers/02_tokenization/word-reference-utils.js';

/**
 * Prepare context object for GPT sense analysis from subtitle
 * @param {object} subtitle - Fat subtitle
 * @param {number} selectedWordIndex - Index of selected word
 * @param {object} [context] - Additional context
 * @param {string} [context.showName] - Show name
 * @param {number} [context.episode] - Episode number
 * @param {number} [context.season] - Season number
 * @param {string} [context.mediaId] - Media ID
 * @param {string} [context.subId] - Subtitle ID
 * @returns {object|null} Context object for analyzeSenseSelection, or null if invalid
 */
export function prepareSenseAnalysisContextFromSubtitle(subtitle, selectedWordIndex, context = {}) {
  if (!subtitle || !subtitle.tokens || selectedWordIndex === null || selectedWordIndex === undefined) {
    return null;
  }
  
  const senseToken = subtitle.tokens.sensesThai?.[selectedWordIndex];
  const wordReferenceIdsThai = subtitle.subtitle?.wordReferenceIdsThai || [];
  const fullThaiText = subtitle.subtitle?.thai || '';
  
  return prepareSenseAnalysisContext(
    wordReferenceIdsThai,
    selectedWordIndex,
    senseToken,
    context.showName,
    context.episode,
    context.season,
    context.mediaId,
    context.subId,
    fullThaiText
  );
}

/**
 * Prepare context object for GPT sense analysis
 * Extracts currentToken from wordReferenceIdsThai and builds context object
 * @param {Array<string>} wordReferenceIdsThai - Array of word references (tokens)
 * @param {number} selectedWordIndex - Index of selected word
 * @param {object} senseToken - Sense token object with senses array
 * @param {string} [showName] - Show name
 * @param {number} [episode] - Episode number
 * @param {number} [season] - Season number
 * @param {string} [mediaId] - Media ID (episode ID)
 * @param {string} [subId] - Subtitle ID (format: mediaId-index)
 * @param {string} [fullThaiText] - Complete Thai subtitle sentence
 * @returns {object|null} Context object for analyzeSenseSelection, or null if invalid
 */
export function prepareSenseAnalysisContext(wordReferenceIdsThai, selectedWordIndex, senseToken, showName, episode, season, mediaId, subId, fullThaiText) {
  if (!senseToken?.senses || senseToken.senses.length === 0) return null;
  if (selectedWordIndex === null) return null;
  
  // Extract currentToken from wordReferenceIdsThai
  const wordRef = wordReferenceIdsThai?.[selectedWordIndex];
  const parsedRef = wordRef ? parseWordReference(wordRef) : null;
  const currentToken = parsedRef?.thaiScript || '';
  
  if (!currentToken) {
    return null;
  }
  
  const context = {
    showName: showName || null,
    mediaId: mediaId || null,
    subId: subId || null,
    tokenIndex: selectedWordIndex,
    episode: episode || null,
    season: season || null,
    fullThaiText: fullThaiText || '',
    wordReferenceIdsThai: wordReferenceIdsThai || [],
    currentToken: currentToken,
    senses: senseToken.senses
  };
  
  return context;
}

/**
 * Analyze sense selection from subtitle (subtitle-in pattern)
 * @param {object} subtitle - Fat subtitle
 * @param {number} selectedWordIndex - Index of selected word
 * @param {object} [options] - Options object
 * @param {boolean} [options.checkCache=true] - Whether to check cache before calling GPT API
 * @param {boolean} [options.forceRefresh=false] - Whether to force refresh (skip cache)
 * @param {object} [context] - Additional context
 * @param {string} [context.showName] - Show name
 * @param {number} [context.episode] - Episode number
 * @param {number} [context.season] - Season number
 * @param {string} [context.mediaId] - Media ID
 * @param {string} [context.subId] - Subtitle ID
 * @returns {Promise<object>} Analysis result with recommended sense index and confidence scores
 */
export async function analyzeSenseSelectionFromSubtitle(subtitle, selectedWordIndex, options = {}, context = {}) {
  const analysisContext = prepareSenseAnalysisContextFromSubtitle(subtitle, selectedWordIndex, context);
  if (!analysisContext) {
    return {
      recommendedSenseIndex: null,
      senseScores: [],
      overallReasoning: 'Failed to prepare context from subtitle'
    };
  }
  return analyzeSenseSelection(analysisContext, options);
}

/**
 * Analyze subtitle context and recommend which sense to select
 * @param {object} context - Context object with show metadata, subtitle text, tokens, and senses
 * @param {string} [context.showName] - Show name (helps GPT understand context)
 * @param {string} [context.mediaId] - Media ID (episode ID) - required for caching
 * @param {string} [context.subId] - Subtitle ID (format: mediaId-index) - required for caching
 * @param {number} [context.tokenIndex] - Token index within subtitle - required for caching
 * @param {number} [context.episode] - Episode number
 * @param {number} [context.season] - Season number
 * @param {string} context.fullThaiText - Complete Thai subtitle sentence
 * @param {Array<string>} context.wordReferenceIdsThai - Array of word references (tokens) from subtitle.subtitle.wordReferenceIdsThai
 * @param {string} context.currentToken - The selected Thai word
 * @param {Array} context.senses - Available sense objects for the current token
 * @param {object} [options] - Options object
 * @param {boolean} [options.checkCache=true] - Whether to check cache before calling GPT API
 * @param {boolean} [options.forceRefresh=false] - Whether to force refresh (skip cache)
 * @returns {Promise<object>} Analysis result with recommended sense index and confidence scores
 */
export async function analyzeSenseSelection(context, options = {}) {
  if (!context || !context.currentToken || !context.senses || !Array.isArray(context.senses) || context.senses.length === 0) {
    return {
      recommendedSenseIndex: null,
      senseScores: [],
      overallReasoning: 'Invalid context: missing currentToken or senses'
    };
  }
  
  const { checkCache = true, forceRefresh = false } = options;
  const { showName, mediaId, subId, tokenIndex } = context;
  
  // Check cache first if enabled and not forcing refresh
  if (checkCache && !forceRefresh && showName && mediaId && subId && tokenIndex !== null && tokenIndex !== undefined) {
    try {
      // TODO: loadGPTSenseAssessment function needs to be implemented
      const cachedAssessment = null;
      if (cachedAssessment) {
        return {
          recommendedSenseIndex: cachedAssessment.recommendedSenseIndex,
          senseScores: cachedAssessment.senseScores,
          overallReasoning: cachedAssessment.overallReasoning
        };
      }
    } catch (cacheError) {
      // Fall through to API call
    }
  }
  
  const apiKey = getOpenAIApiKey();
  
  if (!apiKey) {
    return {
      recommendedSenseIndex: null,
      senseScores: [],
      overallReasoning: 'API key not found'
    };
  }
  
  const systemPrompt = 'You are a Thai language expert helping to select the most appropriate sense (meaning) for a word in a subtitle context.\n\nYour task:\n1. Analyze the full subtitle sentence and surrounding context\n2. Consider the show/episode/season metadata if provided\n3. Review all available senses (meanings) for the selected word\n4. Determine which sense best fits the context\n5. Provide confidence scores (0-100) for each sense option\n6. Explain your reasoning\n\nReturn ONLY valid JSON matching the exact structure provided. Do not include explanations or markdown formatting outside the JSON.';
  
  // Build context description
  const contextInfo = {
    showName: context.showName || null,
    episode: context.episode || null,
    season: context.season || null,
    fullThaiText: context.fullThaiText || '',
    allTokens: context.wordReferenceIdsThai || [],
    currentToken: context.currentToken,
    availableSenses: context.senses.map((sense, index) => ({
      index: index,
      thaiWord: sense.thaiWord || '',
      pos: sense.pos || '',
      definition: sense.definition || '',
      source: sense.source || ''
    }))
  };
  
  const userPrompt = JSON.stringify({
    task: 'Select the most appropriate sense for the word in this subtitle context',
    context: contextInfo,
    requiredResponseStructure: {
      recommendedSenseIndex: 'number (0-based index of best sense, or null if uncertain)',
      senseScores: 'array of { index: number, confidence: number (0-100), reasoning: string }',
      overallReasoning: 'string (brief explanation of analysis)'
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
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        recommendedSenseIndex: null,
        senseScores: [],
        overallReasoning: `API error: ${response.status}`
      };
    }
    
    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content?.trim() || '';
    
    if (!resultText) {
      return {
        recommendedSenseIndex: null,
        senseScores: [],
        overallReasoning: 'Empty response from GPT'
      };
    }
    
    // Parse JSON response
    let analysisData;
    try {
      analysisData = JSON.parse(resultText);
    } catch (parseError) {
      return {
        recommendedSenseIndex: null,
        senseScores: [],
        overallReasoning: 'Failed to parse GPT response'
      };
    }
    
    // Validate and normalize response structure
    const recommendedSenseIndex = (analysisData.recommendedSenseIndex !== null && analysisData.recommendedSenseIndex !== undefined)
      ? parseInt(analysisData.recommendedSenseIndex, 10)
      : null;
    
    // Validate recommendedSenseIndex is within bounds
    const validRecommendedIndex = (recommendedSenseIndex !== null && 
                                    recommendedSenseIndex >= 0 && 
                                    recommendedSenseIndex < context.senses.length)
      ? recommendedSenseIndex
      : null;
    
    // Normalize senseScores array
    let senseScores = [];
    if (Array.isArray(analysisData.senseScores)) {
      senseScores = analysisData.senseScores
        .filter(score => {
          const index = parseInt(score.index, 10);
          return !isNaN(index) && index >= 0 && index < context.senses.length;
        })
        .map(score => ({
          index: parseInt(score.index, 10),
          confidence: Math.max(0, Math.min(100, parseInt(score.confidence, 10) || 0)),
          reasoning: String(score.reasoning || '').trim()
        }));
    }
    
    // If no scores provided but we have a recommended index, create default scores
    if (senseScores.length === 0 && validRecommendedIndex !== null) {
      senseScores = context.senses.map((sense, index) => ({
        index: index,
        confidence: index === validRecommendedIndex ? 80 : 20,
        reasoning: index === validRecommendedIndex ? 'Recommended by GPT' : 'Not recommended'
      }));
    }
    
    // Ensure all senses have scores
    const existingIndices = new Set(senseScores.map(s => s.index));
    for (let i = 0; i < context.senses.length; i++) {
      if (!existingIndices.has(i)) {
        senseScores.push({
          index: i,
          confidence: 0,
          reasoning: 'No analysis provided'
        });
      }
    }
    
    // Sort by index
    senseScores.sort((a, b) => a.index - b.index);
    
    const result = {
      recommendedSenseIndex: validRecommendedIndex,
      senseScores: senseScores,
      overallReasoning: String(analysisData.overallReasoning || 'Analysis complete').trim()
    };
    
    // Save to cache if we have the required identifiers
    if (showName && mediaId && subId && tokenIndex !== null && tokenIndex !== undefined) {
      try {
        await saveGPTSenseAssessmentSave(showName, mediaId, subId, tokenIndex, result);
      } catch (saveError) {
        // Don't fail the request if cache save fails
      }
    }
    
    return result;
  } catch (error) {
    return {
      recommendedSenseIndex: null,
      senseScores: [],
      overallReasoning: `Error: ${error.message}`
    };
  }
}


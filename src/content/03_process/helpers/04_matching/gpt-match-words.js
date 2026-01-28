/**
 * GPT Word Matching - Match Thai and English words from subtitles
 * Uses GPT to identify word correspondences between Thai and English translations
 */

import { getOpenAIApiKey } from '../../../utils/gpt-config.js';
import { parseWordReference } from '../02_tokenization/word-reference-utils.js';

/**
 * Match words between Thai and English subtitles using GPT
 * @param {object} subtitleMetadata - Subtitle metadata with thai, english, wordReferenceIdsThai, wordReferenceIdsEng
 * @param {object} options - Options with showName, episodeTitle, episode, season, mediaId
 * @returns {Promise<Array>} Array of match objects: [{thaiWord: string, englishWord: string, confidence: number}]
 */
export async function matchWordsBetweenLanguages(subtitleMetadata, options = {}) {
  const { thai, english, wordReferenceIdsThai, wordReferenceIdsEng } = subtitleMetadata;
  const { showName, episodeTitle, episode, season, mediaId } = options;
  
  // Validate inputs
  if (!thai || !english || !wordReferenceIdsThai || !wordReferenceIdsEng) {
    return [];
  }
  
  if (wordReferenceIdsThai.length === 0 || wordReferenceIdsEng.length === 0) {
    return [];
  }
  
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    return [];
  }
  
  // Extract actual words from references
  const thaiWords = wordReferenceIdsThai.map(ref => {
    const { thaiScript } = parseWordReference(String(ref).trim());
    return thaiScript?.split(',')[0]?.trim() || thaiScript || '';
  }).filter(w => w);
  
  const englishWords = wordReferenceIdsEng.map(ref => {
    const { thaiScript: rawWord } = parseWordReference(String(ref).trim());
    return rawWord?.split(',')[0]?.trim()?.toLowerCase() || rawWord?.toLowerCase() || '';
  }).filter(w => w);
  
  if (thaiWords.length === 0 || englishWords.length === 0) {
    return [];
  }
  
  // Build GPT prompt
  const systemPrompt = 'You are a bilingual Thai-English language expert specializing in identifying word correspondences between parallel translations.\n\nYour task is to analyze Thai and English subtitle texts and identify which words correspond to each other. Not all words will have direct matches (proper nouns, untranslatable concepts, etc.).\n\nReturn ONLY valid JSON matching the exact structure provided. Do not include explanations or markdown formatting.';
  
  const userPrompt = JSON.stringify({
    task: 'Match words between Thai and English subtitles',
    context: {
      showName: showName || '',
      episodeTitle: episodeTitle || '',
      episode: episode || null,
      season: season || null,
      thaiText: thai,
      englishText: english,
      thaiWords: thaiWords,
      englishWords: englishWords
    },
    instructions: [
      'Analyze the Thai and English texts to identify word correspondences',
      'Match words based on meaning, not just literal translation',
      'Consider context from the full subtitle sentence',
      'Skip proper nouns, names, and untranslatable concepts (mark with low confidence)',
      'Provide confidence scores (0-100) for each match',
      'Return matches in order corresponding to Thai word order',
      'If a Thai word has no match, omit it from results',
      'If multiple English words match one Thai word, return the best match'
    ],
    requiredStructure: {
      matches: [
        {
          thaiWord: 'string (Thai word from thaiWords array)',
          englishWord: 'string (English word from englishWords array)',
          confidence: 'number (0-100, confidence in match)'
        }
      ]
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
        max_completion_tokens: 2000,
        response_format: { type: 'json_object' }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return [];
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return [];
    }
    
    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      return [];
    }
    
    const matches = parsed.matches || [];
    
    // Validate and filter matches
    const validMatches = matches.filter(match => {
      return match &&
        typeof match.thaiWord === 'string' &&
        typeof match.englishWord === 'string' &&
        thaiWords.includes(match.thaiWord) &&
        englishWords.includes(match.englishWord.toLowerCase()) &&
        (match.confidence === undefined || (typeof match.confidence === 'number' && match.confidence >= 0 && match.confidence <= 100));
    });
    
    // Ensure matches are in Thai word order
    const orderedMatches = [];
    for (const thaiWord of thaiWords) {
      const match = validMatches.find(m => m.thaiWord === thaiWord);
      if (match) {
        orderedMatches.push({
          thaiWord: match.thaiWord,
          englishWord: match.englishWord.toLowerCase(),
          confidence: match.confidence || 50
        });
      }
    }
    
    return orderedMatches;
  } catch (error) {
    return [];
  }
}

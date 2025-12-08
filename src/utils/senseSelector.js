/**
 * Sense Selector - The ONLY place GPT is used
 * GPT's job: Select which dictionary entry (sense) to use for a word in context
 * GPT does NOT generate POS, English meanings, or phonetics - those come from the dictionary
 */

import OpenAI from 'openai';

// OpenAI configuration
const OPENAI_CONFIG = {
  apiKey: typeof window !== 'undefined' && window.SMARTSUBS_GPT_KEY 
    ? window.SMARTSUBS_GPT_KEY 
    : 'IINQXbcVTYWY119Fdn7xhpWLvOqx947F',
  model: 'gpt-4o-mini'
};

let openaiClient = null;

function getOpenAIClient() {
  if (!openaiClient) {
    const apiKey = (typeof window !== 'undefined' && window.SMARTSUBS_GPT_KEY) || OPENAI_CONFIG.apiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Set window.SMARTSUBS_GPT_KEY or configure OPENAI_CONFIG.apiKey.');
    }
    openaiClient = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });
  }
  return openaiClient;
}

/**
 * System prompt for sense selection
 * GPT's ONLY job: pick the right dictionary entry ID from the options
 */
const SENSE_SELECTION_SYSTEM_PROMPT = `You are a Thai language expert helping to disambiguate word senses. 
Given a Thai sentence, a target word, and a list of dictionary entries (each with id, thai, english, pos), 
your job is to select the ONE dictionary entry that best matches how the word is used in this sentence.

You MUST return ONLY the entry ID (as a string or number) that matches the word's usage in context.
Do NOT invent POS tags, English meanings, or phonetics - those are already in the dictionary entries.
Do NOT return anything else - just the ID.

If none of the options fit, return null.`;

/**
 * Choose which dictionary entry (sense) to use for a word in context
 * @param params - Parameters for sense selection
 * @param params.sentenceTh - Thai sentence
 * @param params.sentenceEn - Optional English translation
 * @param params.targetWord - Target word to disambiguate
 * @param params.options - Array of dictionary entries to choose from
 * @returns The ID of the chosen dictionary entry, or null if none match
 */
export async function chooseSense(params) {
  const { sentenceTh, sentenceEn, targetWord, options } = params;

  if (!targetWord || !targetWord.trim()) {
    return null;
  }

  if (!options || options.length === 0) {
    return null;
  }

  // If only one option, use it directly (no GPT needed)
  if (options.length === 1) {
    return options[0].id;
  }

  try {
    const client = getOpenAIClient();

    // Format options for GPT
    const optionsText = options.map((opt, idx) => {
      return `Option ${idx + 1}:
  ID: ${opt.id}
  Thai: ${opt['t-entry'] || opt['t-search']}
  English: ${opt['e-entry']}
  POS: ${opt['t-cat']}
  Definition: ${opt['t-def'] || '(no definition)'}`;
    }).join('\n\n');

    const userPrompt = `Thai sentence: ${sentenceTh}
${sentenceEn ? `English translation: ${sentenceEn}\n` : ''}
Target word: ${targetWord.trim()}

Dictionary entries for "${targetWord.trim()}":
${optionsText}

Which entry ID best matches how "${targetWord.trim()}" is used in this sentence?
Return ONLY the ID (as a string or number), or "null" if none match.`;

    const response = await client.chat.completions.create({
      model: OPENAI_CONFIG.model,
      messages: [
        {
          role: 'system',
          content: SENSE_SELECTION_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0, // Low temperature for consistent selection
      max_completion_tokens: 50 // Just need an ID
    });

    const rawResponse = response.choices?.[0]?.message?.content?.trim() || '';
    
    // Try to parse as ID
    if (rawResponse.toLowerCase() === 'null' || rawResponse === '') {
      return null;
    }

    // Try to find matching ID in options
    const matchingOption = options.find(opt => 
      String(opt.id) === rawResponse || 
      String(opt.id) === rawResponse.trim()
    );

    if (matchingOption) {
      return matchingOption.id;
    }

    // Try parsing as number
    const numId = Number(rawResponse);
    if (!isNaN(numId)) {
      const matchingNumOption = options.find(opt => Number(opt.id) === numId);
      if (matchingNumOption) {
        return matchingNumOption.id;
      }
    }

    // If we can't match, return null
    return null;
  } catch (error) {
    return null;
  }
}

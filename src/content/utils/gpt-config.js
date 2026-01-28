/**
 * GPT Configuration and Utilities
 * Shared utilities for all GPT API calls
 */

/**
 * Get OpenAI API key from various sources
 * @returns {string} API key or empty string if not found
 */
export function getOpenAIApiKey() {
  const localStorageKey = localStorage.getItem('smartSubs_openaiApiKey');
  if (localStorageKey && localStorageKey.trim()) {
    return localStorageKey.trim();
  }
  
  if (typeof window !== 'undefined' && window.__OPENAI_API_KEY__) {
    const windowKey = window.__OPENAI_API_KEY__;
    if (windowKey && typeof windowKey === 'string' && windowKey.trim()) {
      return windowKey.trim();
    }
  }
  
  if (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }
  
  if (typeof process !== 'undefined' && process.env?.VITE_OPENAI_API_KEY) {
    return process.env.VITE_OPENAI_API_KEY;
  }
  
  return '';
}

/**
 * Test GPT API connection
 * @returns {Promise<string>} Random inspiring quote from GPT
 */
export async function testGPTConnection() {
  const apiKey = getOpenAIApiKey();
  
  if (!apiKey) {
    throw new Error('OpenAI API key not found. Set VITE_OPENAI_API_KEY in .env or localStorage.smartSubs_openaiApiKey');
  }
  
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
          { role: 'user', content: 'Give me a random inspiring quote.' }
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GPT API error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const quote = data.choices?.[0]?.message?.content?.trim() || '';
    
    return quote;
  } catch (error) {
    throw new Error(`GPT API error: ${error.message}`);
  }
}

/**
 * Generic GPT API call utility (optional, for future use)
 * @param {object} options - API call options
 * @param {string} options.model - Model name (e.g., 'gpt-4o', 'gpt-5.2')
 * @param {Array} options.messages - Array of message objects
 * @param {number} [options.temperature] - Temperature setting
 * @param {number} [options.maxTokens] - Maximum tokens (deprecated, use maxCompletionTokens)
 * @param {number} [options.maxCompletionTokens] - Maximum completion tokens
 * @param {object} [options.responseFormat] - Response format (e.g., { type: 'json_object' })
 * @returns {Promise<object>} API response object
 */
export async function callGPTAPI(options) {
  const apiKey = getOpenAIApiKey();
  
  if (!apiKey) {
    throw new Error('OpenAI API key not found. Set VITE_OPENAI_API_KEY in .env or localStorage.smartSubs_openaiApiKey');
  }
  
  const {
    model,
    messages,
    temperature = 0.7,
    maxTokens,
    maxCompletionTokens,
    responseFormat
  } = options;
  
  if (!model || !messages) {
    throw new Error('Model and messages are required');
  }
  
  try {
    const body = {
      model,
      messages,
      temperature
    };
    
    // Use maxCompletionTokens if provided, otherwise fall back to maxTokens
    if (maxCompletionTokens !== undefined) {
      body.max_completion_tokens = maxCompletionTokens;
    } else if (maxTokens !== undefined) {
      body.max_tokens = maxTokens;
    }
    
    if (responseFormat) {
      body.response_format = responseFormat;
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GPT API error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    throw error;
  }
}




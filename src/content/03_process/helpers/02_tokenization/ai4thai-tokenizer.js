import { 
  getAI4ThaiApiKey, 
  setAI4ThaiApiKey
} from '../../../utils/ai4thai-config.js';

async function callThaiApiViaBackground(endpoint, method, headers, body) {
  return new Promise(async (resolve, reject) => {
    // Check if Chrome extension APIs are available
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      reject(new Error('Chrome extension runtime is not available. Make sure the extension is loaded and background script is running.'));
      return;
    }
    
    const messageId = Date.now();
    let resolved = false;
    
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        const error = new Error(`Request timeout after 60 seconds`);
        reject(error);
      }
    }, 60000);
    
    chrome.runtime.sendMessage({
      type: 'THAI_API_CALL',
      endpoint,
      method,
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body)
    }, async (response) => {
      if (resolved) {
        return;
      }
      
      clearTimeout(timeoutId);
      resolved = true;
      
      if (chrome.runtime.lastError) {
        const error = new Error(chrome.runtime.lastError.message);
        reject(error);
      } else if (response && response.success) {
        resolve(response.data);
      } else {
        const error = new Error(response?.error || 'Unknown error');
        reject(error);
      }
    });
  });
}

export async function tokenizeThaiSentence(thaiSentence) {
  try {
    const apiKey = getAI4ThaiApiKey();
    if (!apiKey || !apiKey.trim()) {
      throw new Error('[Thai Pipeline] ❌ API key is missing. Set it using: setAI4ThaiApiKey("your-key-here")');
    }
    
    const headers = {
      'Apikey': apiKey.trim(),
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    
    const cleanText = thaiSentence.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    const formData = new URLSearchParams();
    formData.append('text', cleanText);
    formData.append('sep', '|');
    formData.append('wordseg', 'true');
    formData.append('sentseg', 'false');
    
    const data = await callThaiApiViaBackground(
      'https://api.aiforthai.in.th/longan/tokenize',
      'POST',
      headers,
      formData.toString()
    );
    
    let tokens = [];
    
    if (data.result && Array.isArray(data.result)) {
      data.result.forEach(sentenceTokens => {
        if (typeof sentenceTokens === 'string') {
          const sentenceTokenArray = sentenceTokens.split('|').filter(t => t && t.trim());
          tokens.push(...sentenceTokenArray);
        }
      });
    } else if (data.result && typeof data.result === 'string') {
      tokens = data.result.split('|').filter(t => t && t.trim());
    }
    
    return tokens.filter(t => t && t.trim());
  } catch (error) {
    throw error;
  }
}

export { setAI4ThaiApiKey };


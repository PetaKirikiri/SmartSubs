import { 
  getAI4ThaiApiKey, 
  setAI4ThaiApiKey, 
  AI4THAI_G2P_ENDPOINT
} from '../../../utils/ai4thai-config.js';

async function callThaiApiViaBackground(endpoint, method, headers, body, token = null) {
  return new Promise(async (resolve, reject) => {
    // Check if Chrome extension APIs are available
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      reject(new Error('Chrome extension runtime is not available. Make sure the extension is loaded and background script is running.'));
      return;
    }
    
    const messageId = Date.now();
    let resolved = false;
    const startTime = Date.now();
    let warningInterval = null;
    
    // Set up periodic warnings every 10 seconds
    if (token) {
      warningInterval = setInterval(() => {
        if (!resolved) {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
        }
      }, 10000);
    }
    
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (warningInterval) clearInterval(warningInterval);
        const duration = Date.now() - startTime;
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
      if (warningInterval) clearInterval(warningInterval);
      resolved = true;
      const duration = Date.now() - startTime;
      
      if (chrome.runtime.lastError) {
        const error = new Error(chrome.runtime.lastError.message);
        if (token) {
        }
        reject(error);
      } else if (response && response.success) {
        if (token) {
        }
        resolve(response.data);
      } else {
        const error = new Error(response?.error || 'Unknown error');
        if (token) {
        }
        reject(error);
      }
    });
  });
}

export async function getPhonetics(token) {
  const startTime = Date.now();
  try {
    if (!token || !token.trim()) {
      return '';
    }
    
    const cleanToken = token.trim();
    
    const apiKey = getAI4ThaiApiKey();
    if (!apiKey || !apiKey.trim()) {
      throw new Error('[Thai Pipeline] ❌ API key is missing. Set it using: setAI4ThaiApiKey("your-key-here")');
    }
    
    const headers = {
      'Apikey': apiKey.trim(),
      'Content-Type': 'application/json'
    };
    
    const requestBody = JSON.stringify({
      text: cleanToken,
      output_type: 'phoneme'
    });
    
    const data = await callThaiApiViaBackground(
      AI4THAI_G2P_ENDPOINT,
      'POST',
      headers,
      requestBody,
      cleanToken
    );
    
    let phoneme = '';
    
    if (data.phoneme && typeof data.phoneme === 'string') {
      phoneme = data.phoneme;
    } else if (data.result && typeof data.result === 'string') {
      phoneme = data.result;
    } else if (data.result && Array.isArray(data.result)) {
      phoneme = data.result.join('|');
    }
    
    const duration = Date.now() - startTime;
    const result = phoneme.trim();
    return result;
  } catch (error) {
    throw error;
  }
}

export async function handleThaiApiCall(request) {
  const { endpoint, method, headers, body } = request;
  
  try {
    const requestOptions = {
      method,
      headers: { ...headers }
    };
    
    if (body) {
      if (headers['Content-Type'] === 'application/x-www-form-urlencoded') {
        requestOptions.body = body;
      } else {
        requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }
    }
    
    const response = await fetch(endpoint, requestOptions);

    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Could not read error response body';
      }
      throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
    }

    const jsonData = await response.json();
    return jsonData;
  } catch (error) {
    throw error;
  }
}

export { setAI4ThaiApiKey };


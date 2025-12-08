// Background service worker for Smart Subs extension
// Handles API calls that require bypassing CORS restrictions

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'THAI_API_CALL') {
    handleThaiApiCall(request)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicates we will send a response asynchronously
  }
});

async function handleThaiApiCall(request) {
  const { endpoint, method, headers, body } = request;
  
  try {
    // Handle form-urlencoded vs JSON body
    const requestOptions = {
      method,
      headers
    };
    
    if (body) {
      // If Content-Type is form-urlencoded, send as string
      // Otherwise, parse as JSON and stringify
      if (headers['Content-Type'] === 'application/x-www-form-urlencoded') {
        requestOptions.body = body;
      } else {
        requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }
    }
    
    const response = await fetch(endpoint, requestOptions);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Background] API call error:', error);
    throw error;
  }
}

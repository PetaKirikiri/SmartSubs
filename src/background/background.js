/**
 * Background Service Worker Entry Point
 * Handles messages from content scripts for API calls (CORS bypass)
 */

import { handleThaiApiCall } from '../content/03_process/helpers/03_phonetics/ai4thai-g2p.js';
import { handleOrstScrape } from '../content/03_process/helpers/06_dictionary/06a_orst/orst.js';

// Diagnostic: Get ORST diagnostic reports
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_ORST_DIAGNOSTICS') {
    chrome.storage.local.get(['smartSubs_orst_diagnostics'], (result) => {
      sendResponse({ success: true, data: result.smartSubs_orst_diagnostics || [] });
    });
    return true;
  }
  
  if (request.type === 'THAI_API_CALL') {
    // Store sendResponse to ensure it's called
    let responseSent = false;
    const safeSendResponse = (response) => {
      if (!responseSent) {
        responseSent = true;
        try {
          sendResponse(response);
        } catch (e) {
          // Response already sent
        }
      }
    };
    
    handleThaiApiCall(request)
      .then(result => {
        safeSendResponse({ success: true, data: result });
      })
      .catch(error => {
        safeSendResponse({ success: false, error: error.message });
      });
    
    // Set a timeout to ensure response is sent even if promise hangs
    setTimeout(() => {
      if (!responseSent) {
        safeSendResponse({ success: false, error: 'Request timeout in background script' });
      }
    }, 65000); // Slightly longer than fetch timeout
    
    return true; // Indicates we will send a response asynchronously
  }
  
  if (request.type === 'ORST_SCRAPE') {
    handleOrstScrape(request)
      .then(result => {
        if (result === '' || result.length === 0) {
          sendResponse({ success: false, error: 'Empty HTML response from ORST' });
        } else {
          sendResponse({ success: true, data: result });
        }
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicates we will send a response asynchronously
  }
  
  if (request.type === 'INJECT_NETFLIX_SEEK_SCRIPT') {
    // Background script has access to chrome.tabs API
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0 || !tabs[0].id) {
        sendResponse({ success: false, error: 'Could not get current tab ID' });
        return;
      }
      
      const tabId = tabs[0].id;
      
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        world: 'MAIN',
        func: (codeString) => {
          // Use Function constructor instead of eval to avoid bundler warnings
          const func = new Function(codeString);
          func();
        },
        args: [request.code]
      })
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    });
    
    return true; // Indicates we will send a response asynchronously
  }
  
  if (request.type === 'INJECT_NETFLIX_SUBTITLE_SCRIPT') {
    // Background script has access to chrome.tabs API
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0 || !tabs[0].id) {
        sendResponse({ success: false, error: 'Could not get current tab ID' });
        return;
      }
      
      const tabId = tabs[0].id;
      
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        world: 'MAIN',
        func: (codeString) => {
          // Use Function constructor instead of eval to avoid bundler warnings
          const func = new Function(codeString);
          func();
        },
        args: [request.code]
      })
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    });
    
    return true; // Indicates we will send a response asynchronously
  }
  
  return false; // Not handled
});

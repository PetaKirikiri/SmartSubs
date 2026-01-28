/**
 * ORST Dictionary Utilities
 * Fetches and parses dictionary entries from https://dictionary.orst.go.th/
 */


/**
 * Analyze ORST page structure when you're already on the ORST website
 * Run this in the console when you're on dictionary.orst.go.th with search results
 */
export function analyzeOrstPage() {
  const html = document.documentElement.outerHTML;
  const body = document.body;
  
  if (!body) {
    return null;
  }
  
  const containerSelectors = [
    { name: '.entry', selector: '.entry' },
    { name: '.word-entry', selector: '.word-entry' },
    { name: '.dict-entry', selector: '.dict-entry' },
    { name: 'table', selector: 'table' },
    { name: 'table tr', selector: 'table tr' },
    { name: 'ul li', selector: 'ul li' },
    { name: 'dl', selector: 'dl' },
    { name: 'dl dt', selector: 'dl dt' },
    { name: 'dl dd', selector: 'dl dd' },
    { name: 'div[class*="result"]', selector: 'div[class*="result"]' },
    { name: 'div[class*="entry"]', selector: 'div[class*="entry"]' },
    { name: 'div[class*="word"]', selector: 'div[class*="word"]' },
    { name: 'div[class*="meaning"]', selector: 'div[class*="meaning"]' },
    { name: 'div[class*="dict"]', selector: 'div[class*="dict"]' },
    { name: '[id*="entry"]', selector: '[id*="entry"]' },
    { name: '[id*="word"]', selector: '[id*="word"]' },
    { name: '[id*="result"]', selector: '[id*="result"]' },
    { name: 'div', selector: 'div' },
    { name: 'p', selector: 'p' },
    { name: 'span', selector: 'span' }
  ];
  
  const selectorResults = {};
  for (const { name, selector } of containerSelectors) {
    try {
      const elements = body.querySelectorAll(selector);
      const count = elements.length;
      selectorResults[name] = {
        count,
        selector,
        sample: count > 0 ? {
          tagName: elements[0].tagName,
          className: elements[0].className || '',
          id: elements[0].id || '',
          textPreview: elements[0].textContent?.substring(0, 100) || '',
          innerHTMLPreview: elements[0].innerHTML?.substring(0, 200) || ''
        } : null
      };
    } catch (err) {
      selectorResults[name] = { count: 0, error: err.message };
    }
  }
  
  const allElements = body.querySelectorAll('*');
  const classes = new Set();
  const ids = new Set();
  const tags = new Map();
  
  allElements.forEach(el => {
    if (el.className && typeof el.className === 'string') {
      el.className.split(' ').forEach(cls => {
        if (cls.trim()) classes.add(cls.trim());
      });
    }
    if (el.id) ids.add(el.id);
    const tag = el.tagName.toLowerCase();
    tags.set(tag, (tags.get(tag) || 0) + 1);
  });
  
  const analysis = {
    url: window.location.href,
    htmlLength: html.length,
    structure: {
      classes: Array.from(classes),
      ids: Array.from(ids),
      tagDistribution: Object.fromEntries(tags)
    },
    selectors: selectorResults
  };
  
  window.lastOrstPageAnalysis = analysis;
  return analysis;
}

/**
 * Comprehensive diagnostic function to analyze ORST page structure
 */
export async function diagnoseOrstStructure(word) {
  if (!word || !word.trim()) {
    return null;
  }

  try {
    // Check if Chrome extension APIs are available
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      return { error: 'Chrome extension runtime is not available. Make sure the extension is loaded and background script is running.', word: word.trim() };
    }
    
    const html = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('ORST diagnostic timeout after 30 seconds'));
      }, 30000);

      chrome.runtime.sendMessage(
        {
          type: 'ORST_SCRAPE',
          word: word.trim()
        },
        (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            resolve(response.data || '');
          } else {
            const errorMsg = response?.error || 'Unknown error';
            reject(new Error(errorMsg));
          }
        }
      );
    });

    if (!html || html.length === 0) {
      return { error: 'No HTML received', word: word.trim() };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const analysis = {
      word: word.trim(),
      htmlLength: html.length,
      wordFound: html.includes(word.trim()),
      structure: {},
      selectors: {},
      suggestions: []
    };

    try {
      const parsedEntries = parseOrstHtml(html, word.trim());
      analysis.parsedEntries = parsedEntries;
      analysis.parserTest = {
        success: true,
        entryCount: parsedEntries.length
      };
    } catch (parseError) {
      analysis.parserTest = {
        success: false,
        error: parseError.message
      };
    }

    const body = doc.body;
    if (!body) {
      return analysis;
    }

    const containerSelectors = [
      { name: '.entry', selector: '.entry' },
      { name: '.word-entry', selector: '.word-entry' },
      { name: '.dict-entry', selector: '.dict-entry' },
      { name: 'table', selector: 'table' },
      { name: 'table tr', selector: 'table tr' },
      { name: 'ul li', selector: 'ul li' },
      { name: 'dl', selector: 'dl' },
      { name: 'dl dt', selector: 'dl dt' },
      { name: 'dl dd', selector: 'dl dd' },
      { name: 'div[class*="result"]', selector: 'div[class*="result"]' },
      { name: 'div[class*="entry"]', selector: 'div[class*="entry"]' },
      { name: 'div[class*="word"]', selector: 'div[class*="word"]' },
      { name: 'div[class*="meaning"]', selector: 'div[class*="meaning"]' },
      { name: 'div[class*="dict"]', selector: 'div[class*="dict"]' },
      { name: '[id*="entry"]', selector: '[id*="entry"]' },
      { name: '[id*="word"]', selector: '[id*="word"]' },
      { name: '[id*="result"]', selector: '[id*="result"]' },
      { name: 'div', selector: 'div' },
      { name: 'p', selector: 'p' },
      { name: 'span', selector: 'span' }
    ];

    const selectorResults = {};
    for (const { name, selector } of containerSelectors) {
      try {
        const elements = body.querySelectorAll(selector);
        const count = elements.length;
        selectorResults[name] = {
          count,
          selector,
          sample: count > 0 ? {
            tagName: elements[0].tagName,
            className: elements[0].className || '',
            id: elements[0].id || '',
            textPreview: elements[0].textContent?.substring(0, 100) || '',
            innerHTMLPreview: elements[0].innerHTML?.substring(0, 200) || ''
          } : null
        };
      } catch (err) {
        selectorResults[name] = { count: 0, error: err.message };
      }
    }

    analysis.selectors = selectorResults;

    const allElements = body.querySelectorAll('*');
    const classes = new Set();
    const ids = new Set();
    const tags = new Map();

    allElements.forEach(el => {
      if (el.className && typeof el.className === 'string') {
        el.className.split(' ').forEach(cls => {
          if (cls.trim()) classes.add(cls.trim());
        });
      }
      if (el.id) ids.add(el.id);
      const tag = el.tagName.toLowerCase();
      tags.set(tag, (tags.get(tag) || 0) + 1);
    });

    analysis.structure = {
      classes: Array.from(classes),
      ids: Array.from(ids),
      tagDistribution: Object.fromEntries(tags)
    };

    const suggestions = [];
    
    const workingSelectors = Object.entries(selectorResults)
      .filter(([name, result]) => result.count > 0)
      .map(([name, result]) => ({ name, ...result }));

    if (workingSelectors.length > 0) {
      workingSelectors.forEach(({ name, count }) => {
        suggestions.push(`Try using selector: "${name}" - found ${count} elements`);
      });
    } else {
      suggestions.push('No standard selectors matched. Inspect the HTML preview above to identify the actual structure.');
    }

    if (html.includes('<table')) {
      suggestions.push('Page contains tables - consider parsing table rows/cells');
    }
    if (html.includes('<div')) {
      suggestions.push('Page contains divs - check class names in the classes list above');
    }
    if (html.includes(word.trim()) && body.textContent?.includes(word.trim())) {
      suggestions.push(`Word "${word.trim()}" found in page - structure exists but may need different selectors`);
    } else if (!html.includes(word.trim())) {
      suggestions.push(`Word "${word.trim()}" NOT found in HTML - may indicate no results or different word format`);
    }

    analysis.suggestions = suggestions;

    window.lastOrstDiagnostic = analysis;

    return analysis;
  } catch (error) {
    return { error: error.message, word: word.trim() };
  }
}

/**
 * Test function to scrape and display definitions for a word
 */
export async function testOrstScrape(word) {
  try {
    const entries = await scrapeOrstDictionary(word);
    return entries;
  } catch (error) {
    return [];
  }
}

/**
 * Scrape ORST dictionary for a Thai word via background script
 */
export async function scrapeOrstDictionary(word) {
  if (!word || !word.trim()) {
    return [];
  }

  const trimmedWord = word.trim();

  try {
    // Check if Chrome extension APIs are available
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      return [];
    }
    
    const html = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('ORST scrape timeout after 30 seconds'));
      }, 30000);

      chrome.runtime.sendMessage(
        {
          type: 'ORST_SCRAPE',
          word: trimmedWord
        },
        (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            resolve(response.data || '');
          } else {
            reject(new Error(response?.error || 'Unknown error'));
          }
        }
      );
    });

    if (!html || html.length === 0) {
      return [];
    }

    const results = parseOrstHtml(html, trimmedWord);
    return results;
  } catch (error) {
    return [];
  }
}

/**
 * Deduplicate and normalize meanings array
 */
export function normalizeMeanings(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return entries;
  }
  
  const seen = new Set();
  const deduped = [];
  
  const thaiDigitToNumber = (d) => {
    const map = {
      "๐": 0, "๑": 1, "๒": 2, "๓": 3, "๔": 4,
      "๕": 5, "๖": 6, "๗": 7, "๘": 8, "๙": 9
    };
    return map[d] ?? 0;
  };

  const thaiNumStringToInt = (s) => {
    if (!s || typeof s !== 'string') {
      return 0;
    }
    return [...s].reduce((acc, ch) => acc * 10 + thaiDigitToNumber(ch), 0);
  };

  for (const entry of entries) {
    const key = [
      entry.thaiWord || '',
      entry.pos || '',
      entry.definition || '',
      entry.senseNumber || ''
    ].join('|');
    
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push({
        ...entry,
        index: deduped.length
      });
    }
  }
  
  deduped.sort((a, b) => {
    const aNum = a.senseNumber ? thaiNumStringToInt(a.senseNumber) : 999;
    const bNum = b.senseNumber ? thaiNumStringToInt(b.senseNumber) : 999;
    return aNum - bNum;
  });
  
  return deduped;
}

/**
 * Parse ORST HTML results
 */
export function parseOrstHtml(html, word) {
  const entries = [];
  
  if (!html || !word) {
    return entries;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const bodyText = doc.body?.textContent || '';
    const notFoundIndicators = ['ไม่พบคำ', 'ไม่พบ', 'suggest', 'แนะนำ', 'word not found', 'no results'];
    const hasNotFoundIndicator = notFoundIndicators.some(indicator => 
      bodyText.includes(indicator)
    );
    
    if (hasNotFoundIndicator) {
      return [];
    }
    
    const panels = doc.querySelectorAll('.panel.panel-info');
    
    panels.forEach((panel, panelIndex) => {
      try {
        const titleElement = panel.querySelector('.panel-heading .panel-title b');
        // Use the actual word we searched for, not the title element (which may contain comma-separated alternatives)
        const thaiWord = word;
        
        let panelSenseNumber = null;
        const headingText = titleElement?.textContent?.trim() || '';
        const headingSenseMatch = headingText.match(/([๑๒๓๔๕๖๗๘๙\d]+)$/);
        if (headingSenseMatch) {
          panelSenseNumber = headingSenseMatch[1];
        }
        
        const bodyElement = panel.querySelector('.panel-body');
        if (!bodyElement) {
          return;
        }
        
        let bodyHtml = bodyElement.innerHTML;
        const lukKhamIndex = bodyHtml.indexOf('ลูกคำของ');
        if (lukKhamIndex !== -1) {
          bodyHtml = bodyHtml.substring(0, lukKhamIndex);
        }
        
        const tempDiv = doc.createElement('div');
        tempDiv.innerHTML = bodyHtml;
        const bodyText = tempDiv.textContent?.trim() || '';
        
        if (!bodyText || bodyText.length < 5) {
          return;
        }
        
        const numberedSensePattern = /\(([๑๒๓๔๕๖๗๘๙\d]+)\)/g;
        const numberedMatches = Array.from(bodyText.matchAll(numberedSensePattern));
        
        if (numberedMatches.length > 0) {
          const senseParts = [];
          let lastIndex = 0;
          
          numberedMatches.forEach((match, idx) => {
            const senseStart = match.index;
            const senseEnd = idx < numberedMatches.length - 1 
              ? numberedMatches[idx + 1].index 
              : bodyText.length;
            
            const senseText = bodyText.substring(senseStart, senseEnd).trim();
            if (senseText) {
              senseParts.push({
                text: senseText,
                senseNumber: match[1]
              });
            }
            lastIndex = senseEnd;
          });
          
          senseParts.forEach(({ text, senseNumber }, senseIdx) => {
            const textWithoutNumber = text.replace(/^\([๑๒๓๔๕๖๗๘๙\d]+\)\s*/, '').trim();
            
            const posMatch = textWithoutNumber.match(/^([^\s]+)\s+(.+)$/);
            let pos = '';
            let definition = textWithoutNumber;
            
            if (posMatch) {
              const potentialPos = posMatch[1];
              if (potentialPos.length <= 3 && /^[กนวผ].*$/.test(potentialPos)) {
                pos = potentialPos;
                definition = posMatch[2].trim();
              }
            }
            
            const entry = {
              thaiWord: thaiWord,
              pos: pos,
              definition: definition.trim(),
              source: 'ORST',
              index: entries.length,
              senseNumber: senseNumber
            };
            entries.push(entry);
          });
        } else {
          let normalizedBody = bodyText.trim();
          
          if (normalizedBody.startsWith(thaiWord + ' ')) {
            normalizedBody = normalizedBody.substring(thaiWord.length).trim();
          }
          
          const lines = normalizedBody.split('\n').map(l => l.trim()).filter(l => l);
          if (lines.length > 0) {
            const lastLine = lines[lines.length - 1];
            if (/^[กนวผ][\.]?$/.test(lastLine) && lastLine.length <= 3) {
              lines.pop();
              normalizedBody = lines.join(' ').trim();
            } else {
              normalizedBody = lines.join(' ').trim();
            }
          }
          
          let pos = '';
          let definition = normalizedBody;
          
          const posMatch = normalizedBody.match(/^([^\s]+)\s+(.+)$/);
          if (posMatch) {
            const potentialPos = posMatch[1];
            if (potentialPos.length <= 3 && /^[กนวผ].*$/.test(potentialPos)) {
              pos = potentialPos.replace(/\.$/, '');
              definition = posMatch[2].trim();
            }
          }
          
          const entry = {
            thaiWord: thaiWord,
            pos: pos,
            definition: definition.trim(),
            source: 'ORST',
            index: entries.length,
            senseNumber: panelSenseNumber || ''
          };
          entries.push(entry);
        }
      } catch (err) {
      }
    });
    
    const deduped = normalizeMeanings(entries);
    
    return deduped;
  } catch (error) {
    return [];
  }
}

/**
 * Handle ORST scrape in background script
 */
export async function handleOrstScrape(request) {
  const { word } = request;
  
  if (!word || !word.trim()) {
    return '';
  }

  const trimmedWord = word.trim();

  try {
    
    const searchUrl = 'https://dictionary.orst.go.th/func_lookup.php';
    const formData = new URLSearchParams();
    formData.append('word', trimmedWord);
    formData.append('funcName', 'lookupWord');
    formData.append('status', 'lookup');
    
    const bodyString = formData.toString();
    
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: bodyString
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ORST scrape failed: ${response.status} ${response.statusText} - ${errorText.substring(0, 100)}`);
    }

    const html = await response.text();
    if (html.length === 0) {
      throw new Error(`ORST returned empty HTML response (status: ${response.status})`);
    }
    return html;
  } catch (error) {
    throw error;
  }
}

/**
 * Reprocess ORST scrape for a single token
 */
export async function reprocessTokenOrst(thaiWordsRecordId, thaiScript, subtitleRecordId) {
  if (!thaiWordsRecordId || !thaiScript || !subtitleRecordId) {
    throw new Error('Missing required parameters');
  }

  try {
    const orstEntries = await scrapeOrstDictionary(thaiScript.trim());
    
    if (!orstEntries || !Array.isArray(orstEntries)) {
      throw new Error('Invalid ORST scrape results');
    }

    const { getCachedSubtitle, updateThaiWordsRecord } = await import('../../05_cache/cache-subtitles.js');
    const subtitle = getCachedSubtitle(subtitleRecordId);
    if (subtitle && subtitle.thaiWordsRecords) {
      const thaiWordsRecord = subtitle.thaiWordsRecords[thaiWordsRecordId];
      if (thaiWordsRecord) {
        const updatedThaiWordsRecord = { ...thaiWordsRecord, meanings: orstEntries };
        await updateThaiWordsRecord(subtitleRecordId, thaiWordsRecordId, updatedThaiWordsRecord);
      }
    }

    // patchWordRecordSave removed - word saving happens via schemaWorkMap in orchestrator
    // Meanings are included in senses data, so no separate save needed here

    return orstEntries;
  } catch (error) {
    throw error;
  }
}


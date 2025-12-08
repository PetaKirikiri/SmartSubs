/**
 * Word Edit Modal
 * Shows word metadata and allows editing phonetic and other fields
 */

// CACHE-FIRST: No direct Airtable imports - UI only updates cache

/**
 * Populate POS dropdown with hardcoded common values and unique values from ThaiWords
 * @param {HTMLSelectElement} selectElement - Select element to populate
 * @param {string} currentValue - Current POS value to select
 */
function populatePOSDropdown(selectElement, currentValue = '', subtitleCache = []) {
  // Hardcoded common POS values
  const commonPOS = ['verb', 'adjective', 'noun', 'classifier', 'pronoun'];
  
  // Clear existing options
  selectElement.innerHTML = '';
  
  // Add empty option
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = '-- Select POS --';
  selectElement.appendChild(emptyOption);
  
  // CACHE-FIRST: Extract unique POS values from bundle (phoneticWordMap)
  const uniquePOSFromCache = new Set();
  subtitleCache.forEach(subtitle => {
    if (subtitle.phoneticWordMap) {
      subtitle.phoneticWordMap.forEach(wordData => {
        const pos = wordData?.pos || wordData?.POS || '';
        if (pos && pos.trim() !== '') {
          uniquePOSFromCache.add(pos.trim());
        }
      });
    }
  });
  
  // Combine common POS with cached POS values
  const allPOS = new Set([...commonPOS, ...Array.from(uniquePOSFromCache).map(p => p.toLowerCase())]);
  
  // Add all POS values (common first, then cached)
  commonPOS.forEach(pos => {
    const option = document.createElement('option');
    option.value = pos;
    option.textContent = pos;
    if (pos === currentValue.toLowerCase()) {
      option.selected = true;
    }
    selectElement.appendChild(option);
  });
  
  // Add cached POS values (excluding common ones)
  Array.from(uniquePOSFromCache)
    .filter(pos => !commonPOS.includes(pos.toLowerCase()))
    .sort()
    .forEach(pos => {
      const option = document.createElement('option');
      option.value = pos; // Keep original case from cache
      option.textContent = pos;
      if (pos.toLowerCase() === currentValue.toLowerCase()) {
        option.selected = true;
      }
      selectElement.appendChild(option);
    });
  
  // If current value doesn't match any option, select empty option (don't add custom)
  // Only show POS values that exist in the color table or cache
  if (currentValue && currentValue.trim() !== '') {
    const normalizedCurrent = currentValue.toLowerCase();
    const hasMatch = Array.from(selectElement.options).some(opt => 
      opt.value.toLowerCase() === normalizedCurrent
    );
    
    if (!hasMatch) {
      // Current value not in dropdown - select empty option instead of adding custom
      const emptyOption = selectElement.querySelector('option[value=""]');
      if (emptyOption) {
        emptyOption.selected = true;
      }
    }
  }
}

// REMOVED: fetchUniquePOSFromThaiWords - no DB fetches outside initial load
// POS values are extracted from cache (subtitle bundle) in populatePOSDropdown

/**
 * Show word edit modal
 * @param {string} wordId - Word record ID
 * @param {Object} wordData - Current word data (thaiScript, english, pos, englishPhonetic)
 * @param {Function} onUpdateWord - Callback when word is updated (for cache refresh)
 */
export function showWordModal(wordId, wordData, onUpdateWord = null, subtitleCache = null) {
  // Check if modal already exists
  let modal = document.getElementById('smart-subs-word-modal');
  
  if (!modal) {
    // Create modal
    modal = document.createElement('div');
    modal.id = 'smart-subs-word-modal';
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
    modal.style.border = '2px solid rgba(255, 215, 0, 0.5)';
    modal.style.borderRadius = '8px';
    modal.style.padding = '20px';
    modal.style.zIndex = '2147483647';
    modal.style.minWidth = '400px';
    modal.style.maxWidth = '600px';
    modal.style.color = '#FFD700';
    modal.style.fontFamily = 'Arial, sans-serif';
    modal.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.8)';
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '8px';
    closeBtn.style.right = '8px';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#FFD700';
    closeBtn.style.fontSize = '24px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '0';
    closeBtn.style.width = '32px';
    closeBtn.style.height = '32px';
    closeBtn.style.lineHeight = '32px';
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    modal.appendChild(closeBtn);
    
    // Title
    const title = document.createElement('div');
    title.textContent = 'Edit Word';
    title.style.fontSize = '18px';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '16px';
    modal.appendChild(title);
    
    // Thai Script (read-only display)
    const thaiScriptLabel = document.createElement('div');
    thaiScriptLabel.textContent = 'Thai Script:';
    thaiScriptLabel.style.fontSize = '12px';
    thaiScriptLabel.style.marginBottom = '4px';
    thaiScriptLabel.style.opacity = '0.8';
    modal.appendChild(thaiScriptLabel);
    
    const thaiScriptDisplay = document.createElement('div');
    thaiScriptDisplay.id = 'word-modal-thaiScript';
    thaiScriptDisplay.style.fontSize = '20px';
    thaiScriptDisplay.style.marginBottom = '16px';
    thaiScriptDisplay.style.padding = '8px';
    thaiScriptDisplay.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
    thaiScriptDisplay.style.borderRadius = '4px';
    modal.appendChild(thaiScriptDisplay);
    
    // English (read-only display)
    const englishLabel = document.createElement('div');
    englishLabel.textContent = 'English:';
    englishLabel.style.fontSize = '12px';
    englishLabel.style.marginBottom = '4px';
    englishLabel.style.opacity = '0.8';
    modal.appendChild(englishLabel);
    
    const englishDisplay = document.createElement('div');
    englishDisplay.id = 'word-modal-english';
    englishDisplay.style.fontSize = '14px';
    englishDisplay.style.marginBottom = '16px';
    englishDisplay.style.padding = '8px';
    englishDisplay.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
    englishDisplay.style.borderRadius = '4px';
    modal.appendChild(englishDisplay);
    
    // POS (editable dropdown)
    const posLabel = document.createElement('div');
    posLabel.textContent = 'Part of Speech:';
    posLabel.style.fontSize = '12px';
    posLabel.style.marginBottom = '4px';
    posLabel.style.opacity = '0.8';
    modal.appendChild(posLabel);
    
    const posInput = document.createElement('select');
    posInput.id = 'word-modal-pos';
    posInput.style.width = '100%';
    posInput.style.padding = '8px';
    posInput.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    posInput.style.border = '1px solid rgba(255, 215, 0, 0.5)';
    posInput.style.borderRadius = '4px';
    posInput.style.color = '#FFD700';
    posInput.style.fontSize = '14px';
    posInput.style.fontFamily = 'Arial, sans-serif';
    posInput.style.outline = 'none';
    posInput.style.marginBottom = '16px';
    posInput.style.cursor = 'pointer';
    modal.appendChild(posInput);
    
    // Phonetic (editable)
    const phoneticLabel = document.createElement('div');
    phoneticLabel.textContent = 'Phonetic:';
    phoneticLabel.style.fontSize = '12px';
    phoneticLabel.style.marginBottom = '4px';
    phoneticLabel.style.opacity = '0.8';
    modal.appendChild(phoneticLabel);
    
    const phoneticInput = document.createElement('textarea');
    phoneticInput.id = 'word-modal-phonetic';
    phoneticInput.style.width = '100%';
    phoneticInput.style.minHeight = '60px';
    phoneticInput.style.padding = '8px';
    phoneticInput.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    phoneticInput.style.border = '1px solid rgba(255, 215, 0, 0.5)';
    phoneticInput.style.borderRadius = '4px';
    phoneticInput.style.color = '#FFD700';
    phoneticInput.style.fontSize = '14px';
    phoneticInput.style.fontFamily = 'Arial, sans-serif';
    phoneticInput.style.outline = 'none';
    phoneticInput.style.resize = 'vertical';
    modal.appendChild(phoneticInput);
    
    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '8px';
    buttonContainer.style.marginTop = '16px';
    buttonContainer.style.justifyContent = 'flex-end';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.padding = '8px 16px';
    cancelBtn.style.backgroundColor = 'transparent';
    cancelBtn.style.border = '1px solid rgba(255, 215, 0, 0.5)';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.color = '#FFD700';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.fontSize = '14px';
    cancelBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    buttonContainer.appendChild(cancelBtn);
    
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.padding = '8px 16px';
    saveBtn.style.backgroundColor = 'rgba(74, 222, 128, 0.2)';
    saveBtn.style.border = '1px solid rgba(74, 222, 128, 0.5)';
    saveBtn.style.borderRadius = '4px';
    saveBtn.style.color = 'rgba(74, 222, 128, 1)';
    saveBtn.style.cursor = 'pointer';
    saveBtn.style.fontSize = '14px';
    saveBtn.style.fontWeight = 'bold';
    buttonContainer.appendChild(saveBtn);
    
    modal.appendChild(buttonContainer);
    document.body.appendChild(modal);
  }
  
  // CACHE-FIRST: Update modal content with word data from bundle (instant, no DB fetch)
  // wordData comes from bundle (phoneticWordMap) - already loaded, no need to fetch
  const thaiScriptDisplay = modal.querySelector('#word-modal-thaiScript');
  const englishDisplay = modal.querySelector('#word-modal-english');
  const posInput = modal.querySelector('#word-modal-pos');
  const phoneticInput = modal.querySelector('#word-modal-phonetic');
  
  // Use wordData from bundle (passed as parameter - no DB fetch)
  if (thaiScriptDisplay) thaiScriptDisplay.textContent = wordData?.thaiScript || '';
  if (englishDisplay) englishDisplay.textContent = wordData?.english || '';
  if (phoneticInput) phoneticInput.value = wordData?.englishPhonetic || '';
  
  // CACHE-FIRST: Populate POS dropdown from cache (instant, no DB fetch)
  if (posInput) {
    // Get subtitle cache for POS values (try parameter first, then window, then empty array)
    let cache = subtitleCache;
    if (!cache) {
      // Try to get from window dependencies
      const deps = window.smartSubsDependencies || {};
      cache = deps.onGetSubtitleCache ? deps.onGetSubtitleCache() : [];
    }
    // Populate dropdown instantly from cache (synchronous, no async operations)
    populatePOSDropdown(posInput, wordData?.pos || '', cache || []);
  }
  
  // Store wordId for save handler
  modal._wordId = wordId;
  modal._originalPhonetic = wordData?.englishPhonetic || '';
  modal._originalPos = wordData?.pos || '';
  modal._onUpdateWord = onUpdateWord;
  
  // Update save button handler
  const saveBtn = modal.querySelector('button:last-child');
  if (saveBtn) {
    // Remove old listeners
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    
    newSaveBtn.addEventListener('click', async () => {
      const newPhonetic = phoneticInput.value.trim();
      const newPos = posInput.value.trim();
      
      if (!newPhonetic) {
        alert('Phonetic cannot be empty');
        return;
      }
      
      // Check if anything changed
      const phoneticChanged = newPhonetic !== modal._originalPhonetic;
      const posChanged = newPos !== modal._originalPos;
      
      if (!phoneticChanged && !posChanged) {
        modal.style.display = 'none';
        return;
      }
      
      // LOCAL-FIRST: Update cache immediately (cache is source of truth)
      if (modal._onUpdateWord) {
        const updateData = {};
        if (phoneticChanged) updateData.englishPhonetic = newPhonetic;
        if (posChanged) updateData.pos = newPos;
        modal._onUpdateWord(modal._wordId, updateData);
      }
      
      // Update UI immediately
      newSaveBtn.disabled = true;
      newSaveBtn.textContent = 'Saving...';
      
      // CACHE-FIRST: Cache already updated via onUpdateWord callback above
      // Universal save trigger will watch cache changes and save to Airtable
      // No direct Airtable calls from UI - all saves go through universal trigger
      newSaveBtn.textContent = 'Saved to cache!';
      newSaveBtn.style.color = 'rgba(74, 222, 128, 1)';
      setTimeout(() => {
        modal.style.display = 'none';
      }, 500);
    });
  }
  
  // Show modal
  modal.style.display = 'block';
  phoneticInput.focus();
  phoneticInput.select();
}


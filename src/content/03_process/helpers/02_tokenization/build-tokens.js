/**
 * Build token structures from word references and word data maps
 * Extracted from process-subtitle-orchestrator.js for separation of concerns
 */

import { parseWordReference } from './word-reference-utils.js';
import { validateTokenAgainstSchema, validateFatSubtitle } from '../workmap/schema-work-map-builder.js';

/**
 * Build token structures from word references and word data
 * @param {Array<string>} wordReferenceIdsThai - Thai word reference IDs
 * @param {Array<string>} wordReferenceIdsEng - English word reference IDs
 * @param {Map<string, object>} thaiWordsMap - Map of Thai word data (thaiScript -> wordData)
 * @param {Map<string, object>} englishWordsMap - Map of English word data (englishWord -> wordData)
 * @returns {Promise<object>} { display, senses, displayEng, sensesEng }
 */
export async function buildTokensFromWordReferences(
  wordReferenceIdsThai,
  wordReferenceIdsEng,
  thaiWordsMap,
  englishWordsMap
) {
  // Build Thai display tokens and sense tokens
  const displayTokens = [];
  const senseTokens = [];

  for (let i = 0; i < wordReferenceIdsThai.length; i++) {
    const wordRef = wordReferenceIdsThai[i];
    let thaiScript = null;
    let thaiWordsRecord = null;
    let text = null;
    let englishPhonetic = null;
    let selectedSenseIndex = null;

    if (wordRef && wordRef !== null && wordRef !== undefined && String(wordRef).trim() !== '') {
      const parsed = parseWordReference(String(wordRef).trim());
      const rawThaiScript = parsed.thaiScript;
      thaiScript = rawThaiScript?.split(',')[0]?.trim() || rawThaiScript || null;
      selectedSenseIndex = parsed.senseIndex;

      if (thaiScript) {
        text = thaiScript;
        thaiWordsRecord = thaiWordsMap.get(thaiScript);
        if (thaiWordsRecord) {
          englishPhonetic = thaiWordsRecord.englishPhonetic || null;
        }
      } else {
        text = `[missing:${i}]`;
      }
    } else {
      text = `[empty:${i}]`;
    }

    const g2p = thaiWordsRecord?.g2p || null;

    const displayToken = {
      index: i,
      thaiScript: text,
      englishPhonetic: englishPhonetic,
      g2p: g2p
    };

    await validateTokenAgainstSchema(displayToken, 'display-token', i);
    displayTokens.push(displayToken);

    const senses = thaiWordsRecord?.senses || [];
    const sensesWithSelection = senses.map((sense, idx) => {
      let senseDocIndex = null;
      if (sense.senseId) {
        const senseIdParts = sense.senseId.split('-');
        if (senseIdParts.length >= 3 && senseIdParts[0] === 'sense') {
          senseDocIndex = parseInt(senseIdParts[senseIdParts.length - 1], 10);
          if (isNaN(senseDocIndex)) {
            senseDocIndex = null;
          }
        }
      }
      const senseIndex = senseDocIndex !== null ? senseDocIndex : (sense.index !== undefined ? sense.index : idx);
      const isSelected = selectedSenseIndex !== null && senseIndex === selectedSenseIndex;

      return {
        ...sense,
        id: senseIndex,
        index: senseIndex,
        selected: isSelected
      };
    });

    const senseToken = {
      index: i,
      senses: sensesWithSelection
    };

    await validateTokenAgainstSchema(senseToken, 'sense-token', i);
    senseTokens.push(senseToken);
  }

  // Build English display tokens and sense tokens
  const englishDisplayTokens = [];
  const englishSenseTokens = [];

  for (let i = 0; i < wordReferenceIdsEng.length; i++) {
    const wordRef = wordReferenceIdsEng[i];
    let englishWord = null;
    let englishWordsRecord = null;
    let text = null;
    let selectedSenseIndex = null;

    if (wordRef && wordRef !== null && wordRef !== undefined && String(wordRef).trim() !== '') {
      const parsed = parseWordReference(String(wordRef).trim());
      const rawEnglishWord = parsed.thaiScript;
      const rawWord = rawEnglishWord?.split(',')[0]?.trim() || rawEnglishWord || null;
      const normalizedEnglishWord = rawWord ? rawWord.toLowerCase() : null;
      englishWord = normalizedEnglishWord;
      selectedSenseIndex = parsed.senseIndex;

      if (englishWord) {
        text = rawWord || englishWord;
        englishWordsRecord = englishWordsMap.get(englishWord);
      } else {
        text = `[missing:${i}]`;
      }
    } else {
      text = `[empty:${i}]`;
    }

    const englishDisplayToken = {
      index: i,
      englishWord: text
    };

    englishDisplayTokens.push(englishDisplayToken);

    const senses = englishWordsRecord?.senses || [];
    const sensesWithSelection = senses.map((sense, idx) => {
      let senseDocIndex = null;
      if (sense.senseId) {
        const senseIdParts = sense.senseId.split('-');
        if (senseIdParts.length >= 3 && senseIdParts[0] === 'sense') {
          senseDocIndex = parseInt(senseIdParts[senseIdParts.length - 1], 10);
          if (isNaN(senseDocIndex)) {
            senseDocIndex = null;
          }
        }
      }
      const senseIndex = senseDocIndex !== null ? senseDocIndex : (sense.index !== undefined ? sense.index : idx);
      const isSelected = selectedSenseIndex !== null && senseIndex === selectedSenseIndex;

      return {
        ...sense,
        id: senseIndex,
        index: senseIndex,
        selected: isSelected
      };
    });

    const englishSenseToken = {
      index: i,
      senses: sensesWithSelection
    };

    await validateTokenAgainstSchema(englishSenseToken, 'sense-token', i);
    englishSenseTokens.push(englishSenseToken);
  }

  return {
    display: displayTokens,
    senses: senseTokens,
    displayEng: englishDisplayTokens,
    sensesEng: englishSenseTokens
  };
}

/**
 * Load word data maps from word references
 * @param {Array<string>} wordReferenceIdsThai - Thai word reference IDs
 * @param {Array<string>} wordReferenceIdsEng - English word reference IDs
 * @returns {Promise<object>} { thaiWordsMap, englishWordsMap }
 */
export async function loadWordDataMaps(wordReferenceIdsThai, wordReferenceIdsEng) {
  // Load Thai words
  const thaiWordsMap = new Map();
  for (const wordRef of wordReferenceIdsThai) {
    try {
      const { thaiScript } = parseWordReference(String(wordRef).trim());
      if (thaiScript) {
        const script = thaiScript.split(',')[0].trim();
        // TODO: loadWord function needs to be implemented
        // const wordData = await loadWord(script, 'wordsThai');
        // if (wordData) {
        //   thaiWordsMap.set(script, wordData);
        // }
      }
    } catch (error) {
      // Skip invalid word references
    }
  }

  // Load English words
  const englishWordsMap = new Map();
  for (const wordRef of wordReferenceIdsEng) {
    try {
      const word = String(wordRef).split(':')[0].trim().toLowerCase();
      if (word) {
        // TODO: loadWord function needs to be implemented
        // const wordData = await loadWord(word, 'wordsEng');
        // if (wordData) {
        //   englishWordsMap.set(word, wordData);
        // }
      }
    } catch (error) {
      // Skip invalid word references
    }
  }

  return { thaiWordsMap, englishWordsMap };
}

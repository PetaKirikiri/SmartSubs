// Three-stage workflow:
// Stage 1: Thai Script Clean-Check - user edits raw Thai text, presses Esc to accept
// Stage 2: Tokenization Check - system auto-tokenizes, user reviews/edits tokens, presses Esc to accept
// Stage 3: Word-by-Word Sense Selection - highlight one token, show candidates, user presses number to confirm
export const SUBTITLE_STAGE = {
  RAW_IMPORTED: 1,        // Stage 1: Thai Script Clean-Check
  SCRIPT_CONFIRMED: 2,    // Stage 2: Tokenization Check
  SPLIT_CONFIRMED: 3      // Stage 3: Word-by-Word Sense Selection (final stage)
};

export const SUBTITLE_DATA_STRUCTURE = {
  recordId: '',
  processingStage: SUBTITLE_STAGE.RAW_IMPORTED,
  thai: '',
  startSec: '',
  endSec: '',
  subIndex: '',
  mediaId: '',
  thaiScriptReview: false,
  thaiSplit: null,
  thaiSplitIds: null,
  startTime: null,
  endTime: null,
  range: '',
  reviewed: false,
  phoneticWordIds: null,
  phoneticWordMap: null
};

export function createSubtitleData(params = {}) {
  return {
    ...SUBTITLE_DATA_STRUCTURE,
    ...params,
    processingStage: params.processingStage != null 
      ? (params.processingStage === 0 ? SUBTITLE_STAGE.RAW_IMPORTED : params.processingStage)
      : SUBTITLE_STAGE.RAW_IMPORTED
  };
}


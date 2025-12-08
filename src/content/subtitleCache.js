let allSubtitlesArray = [];
let loadingProgress = {
  editModeReady: false,
  userModeLoading: false,
  phoneticWordsTotal: 0,
  phoneticWordsLoaded: 0
};

export function getSubtitleCache() {
  return allSubtitlesArray;
}

export function setSubtitleCache(subtitles) {
  allSubtitlesArray = subtitles;
}

export function getLoadingProgress() {
  const userModePercent = loadingProgress.userModeLoading && loadingProgress.phoneticWordsTotal > 0
    ? Math.min(100, Math.round((loadingProgress.phoneticWordsLoaded / loadingProgress.phoneticWordsTotal) * 100))
    : (loadingProgress.userModeLoading ? 0 : 100);
  
  return {
    editModeReady: loadingProgress.editModeReady,
    userModeLoading: loadingProgress.userModeLoading,
    userModePercent
  };
}

export function updateLoadingProgress(updates) {
  loadingProgress = { ...loadingProgress, ...updates };
}

export function findSubtitleByRecordId(recordId) {
  return allSubtitlesArray.find(s => s.recordId === recordId) || null;
}

export function findSubtitleIndexByRecordId(recordId) {
  return allSubtitlesArray.findIndex(s => s.recordId === recordId);
}

export function updateCacheSubtitle(recordId, updater) {
  const index = allSubtitlesArray.findIndex(s => s.recordId === recordId);
  if (index === -1) return false;
  updater(allSubtitlesArray[index]);
  return true;
}

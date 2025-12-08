# Refactoring Status

## Completed Modules ✅

1. **netflixMetadata.js** - Netflix metadata extraction (~200 lines)
2. **videoPlayer.js** - Video player integration (~100 lines)
3. **subtitleCache.js** - Subtitle data management (~300 lines)
4. **state.js** - Shared state management (~50 lines)
5. **utils.js** - Utility functions (~20 lines)
6. **overlayBuilder.js** - UI/DOM overlay creation (~700 lines)
7. **keyboardShortcuts.js** - Keyboard handlers (~150 lines)

## Remaining Modules to Create

1. **subtitleDisplay.js** (~600 lines) - Display logic & rendering
   - `startSubtitlePolling()` - Sets up polling/intervals
   - `updateSubtitleFromTimestamp()` - Main display logic
   - `transitionToNewSubtitle()` - Handles transitions
   - `updateSubtitlePreviews()` - Updates prev/next displays
   - `showLoadingState()` / `hideLoadingState()` - Loading states

2. **editMode.js** (~400 lines) - Edit mode management
   - `startEditMode()` - Enters edit mode
   - `cancelEditMode()` - Cancels editing
   - `saveSubtitle()` / `saveToCacheOnly()` - Save logic
   - `handleEscapeKey()` - Escape key handler
   - `updateDisplayFromCache()` - Updates UI from cache
   - `resumeTimeBasedUpdates()` - Resumes polling

3. **timestampAdjuster.js** (~200 lines) - Timestamp adjustment
   - `startTimestampAdjustMode()` - Creates adjustment UI
   - Timestamp adjustment handlers

4. **srtUpload.js** (~500 lines) - SRT upload functionality
   - `showSRTUploadModal()` - Creates upload modal
   - `handleSRTUpload()` - Legacy upload handler

## Next Steps

1. Create remaining module files with extracted code
2. Update `content.js` to import and orchestrate all modules
3. Test and verify functionality

## Module Dependencies

```
content.js (orchestrator)
├── netflixMetadata.js
├── videoPlayer.js
├── subtitleCache.js
│   └── netflixMetadata.js
├── overlayBuilder.js
│   ├── videoPlayer.js
│   ├── utils.js
│   └── (callbacks to other modules)
├── subtitleDisplay.js
│   ├── subtitleCache.js
│   ├── utils.js
│   └── (callbacks)
├── editMode.js
│   ├── subtitleCache.js
│   └── (callbacks)
├── timestampAdjuster.js
│   ├── subtitleCache.js
│   └── (callbacks)
├── keyboardShortcuts.js
│   └── (callbacks)
├── srtUpload.js
│   ├── subtitleCache.js
│   └── (callbacks)
├── state.js (shared state)
└── utils.js
```






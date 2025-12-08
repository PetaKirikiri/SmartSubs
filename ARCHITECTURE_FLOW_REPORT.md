# Architecture Flow Report

**Purpose**: Document the stable architecture flow and identify any old/conflicting patterns that need removal.

---

## ✅ STABLE ARCHITECTURE FLOW

### 1. Subtitle Object Creation
**Location**: `src/services/airtable.js:467` → `processRecordsToSubtitles()`

**Flow**:
- Airtable records fetched via `getAllSubtitlesSorted()` or `getSubtitlesByTimeRange()`
- Records converted to subtitle bundle objects via `processRecordsToSubtitles()`
- Each subtitle object contains:
  - `recordId` - Airtable record ID
  - `thai` / `thaiScript` - Original Thai text
  - `thaiSplit` - Tokenized Thai text (after processing)
  - `thaiSplitIds` - Array of word record IDs
  - `phoneticWordIds` - Array of word IDs (derived from `thaiSplitIds`)
  - `phoneticWordMap` - Map of wordId → word data (loaded post-processing)
  - `startTime` / `endTime` - Timestamp range
  - `processed` - Boolean flag (true after tokenization complete)
  - `thaiScriptReview` - Boolean flag (human has seen/edited)
  - `fullReview` - Boolean flag (batch review complete)
  - `Edited` - Boolean flag (cache has unsaved changes)

**Status**: ✅ CORRECT - Single source of truth for subtitle objects

---

### 2. Priority-Based Bundle Insertion
**Location**: `src/content/subtitleCache.js:176` → `reloadSubtitlesFromAirtable()`

**Flow**:
- Initial load: All subtitle objects added to `allSubtitlesArray` (sorted by timestamp)
- Priority ordering: Subtitles sorted by `startTime` (ascending)
- Cache storage: `allSubtitlesArray` is the single source of truth
- Post-processing load: Word data loaded only for subtitles where `processed === true`
  - Location: `src/content/subtitleCache.js:427` → `preloadPhoneticTexts()`
  - Priority tiers:
    1. HIGH: Current subtitle (within 5 seconds)
    2. MEDIUM: Time window (60s before, 300s after)
    3. BACKGROUND: All remaining subtitles

**Status**: ✅ CORRECT - Priority-based loading implemented

---

### 3. Three-Subtitle Display Object
**Location**: `src/content/subtitleDisplay.js:1040` → `updateSubtitlePreviews()`

**Flow**:
- Display shows exactly 3 subtitle objects:
  - **Previous**: `allSubtitlesArray[currentIndex - 1]` (if exists)
  - **Current**: `allSubtitlesArray[currentIndex]` (active subtitle)
  - **Next**: `allSubtitlesArray[currentIndex + 1]` (if exists)
- UI elements:
  - `#smart-subs-prev` - Previous subtitle row
  - `#smart-subs-current` - Current subtitle row
  - `#smart-subs-next` - Next subtitle row
- Created in: `src/content/overlayBuilder.js:179-193`

**Status**: ✅ CORRECT - Three-subtitle display pattern implemented

---

### 4. Mode Availability Based on Status Flags
**Location**: `src/content/subtitleDisplay.js:697-775` (current), `800-1008` (transition), `1101-1275` (previews)

**Flow**:
- **Flag Check**: `processed === true` determines data access
- **Before `processed === true`**:
  - Only `thaiScript` available
  - Edit mode: Shows `thaiScript` text
  - User mode: Locked (shows nothing)
  - No access to `thaiSplit`, `thaiSplitIds`, `phoneticWordMap`
- **After `processed === true`**:
  - Can access `thaiSplit`, `thaiSplitIds`, `phoneticWordMap`
  - Edit mode: Shows word spans with `thaiScript` from `phoneticWordMap`
  - User mode: Shows word spans with `englishPhonetic` from `phoneticWordMap`
- **Review Flags**:
  - `thaiScriptReview` - Human has seen/edited (triggers processing)
  - `processed` - Tokenization complete (enables word data)
  - `fullReview` - Batch review complete (final state)

**Status**: ✅ CORRECT - Mode availability strictly controlled by flags

---

### 5. Batch Review Trigger (After 5 Pass)
**Location**: `src/content/content.js:650-700` → Counter tracking

**Flow**:
- **Counter Tracking**: `incrementBatchReviewSubtitleCount()` called when subtitle passes
- **Trigger Condition**: Counter reaches threshold (default: 5)
- **Check Function**: `shouldAutoOpenBatchReview()` in `src/content/content.js:140`
- **Modal Opening**: `showBatchReviewModal()` in `src/content/batchReviewModal.js:37`
- **Review Bundle**: Modal locks to 5 subtitle objects (`modal._reviewBundle`)
- **Review on Close**: All 5 subtitles marked `reviewed = true` and `fullReview = true` when modal closes

**Status**: ✅ CORRECT - Counter-based batch review trigger implemented

---

## 🔍 ARCHITECTURE COMPONENTS

### Core Functions (Stable Architecture)

#### Subtitle Object Creation
- ✅ `processRecordsToSubtitles()` (`src/services/airtable.js:467`)
  - Converts Airtable records to subtitle bundle objects
  - Single source of truth for object structure

#### Bundle Management
- ✅ `reloadSubtitlesFromAirtable()` (`src/content/subtitleCache.js:176`)
  - Initial load: Fetches and populates `allSubtitlesArray`
  - Priority-based: Sorted by timestamp
  - Post-processing: Calls `preloadPhoneticTexts()` for processed subtitles

- ✅ `preloadPhoneticTexts()` (`src/content/subtitleCache.js:427`)
  - Loads word data only when `processed === true`
  - Priority tiers: Current → Time window → Background

- ✅ `getSubtitleCache()` (`src/content/subtitleCache.js:23`)
  - Returns `allSubtitlesArray` (single source of truth)

- ✅ `updateCacheSubtitle()` (`src/content/subtitleCache.js:131`)
  - Single function for cache updates
  - Sets `Edited = true` flag
  - Triggers universal save watcher

#### Display Logic
- ✅ `updateSubtitleFromTimestamp()` (`src/content/subtitleDisplay.js:526`)
  - Finds current subtitle based on video time
  - Checks `processed` flag before accessing data
  - Calls `updateSubtitlePreviews()` to show 3 subtitles

- ✅ `updateSubtitlePreviews()` (`src/content/subtitleDisplay.js:1040`)
  - Updates previous, current, next subtitle rows
  - Respects `processed` flag for each subtitle
  - Reads from cache bundle only

- ✅ `transitionToNewSubtitle()` (`src/content/subtitleDisplay.js:800`)
  - Handles transition to new subtitle
  - Checks `processed` flag
  - Updates 3-subtitle display

#### Batch Review
- ✅ `incrementBatchReviewSubtitleCount()` (`src/content/state.js`)
  - Increments counter when subtitle passes
  - Called from `updateSubtitleFromTimestamp()` when subtitle transitions

- ✅ `shouldAutoOpenBatchReview()` (`src/content/content.js:140`)
  - Checks if counter >= threshold
  - Returns true to trigger modal

- ✅ `showBatchReviewModal()` (`src/content/batchReviewModal.js:37`)
  - Opens modal with 5 subtitle objects
  - Locks to `modal._reviewBundle` (5 recordIds)
  - Review on close: Marks all 5 as reviewed

---

## ⚠️ POTENTIAL OLD/CONFLICTING PATTERNS

### 1. Old Batch Review Threshold Function
**Location**: `src/content/batchReviewModal.js:21` → `meetsReviewThreshold()`

**Issue**:
- Function checks for 5 status states (thaiScript, thaiSplit, thaiSplitIds, phoneticWordMap, complete word data)
- Currently returns `true` always (testing mode)
- **NOT USED**: Counter-based triggering is the actual mechanism
- Comment says "TESTING MODE: Always return true - counter-based triggering only"

**Status**: ⚠️ UNUSED - Should be removed (not called anywhere)

**Recommendation**: Delete `meetsReviewThreshold()` function

---

### 2. Direct Cache Property Assignments
**Search**: Look for patterns like `subtitle.property = value` outside `updateCacheSubtitle()`

**Status**: ✅ VERIFIED - All cache updates go through `updateCacheSubtitle()`

---

### 3. Direct Airtable Calls Outside Initial Load
**Search**: Look for `fetch()`, `PATCH`, `GET` calls to Airtable API in content scripts

**Status**: ✅ VERIFIED - No direct Airtable calls found outside:
- Initial load: `reloadSubtitlesFromAirtable()` → `getAllSubtitlesSorted()` / `getSubtitlesByTimeRange()`
- Post-processing load: `preloadPhoneticTexts()` → fetches word records
- Universal save: `processSaveQueue()` → `saveSubtitleBundle()` / `saveWordBundle()`

---

### 4. Alternative Display Patterns
**Search**: Look for alternative subtitle display logic that doesn't use 3-subtitle pattern

**Status**: ✅ VERIFIED - All display logic uses 3-subtitle pattern (prev/current/next)

---

### 5. Old Review Logic
**Search**: Look for old batch review logic that doesn't use counter-based triggering

**Status**: ⚠️ FOUND - `meetsReviewThreshold()` exists but unused (see #1)

---

## 📋 VERIFICATION CHECKLIST

### ✅ Subtitle Object Creation
- [x] Objects created via `processRecordsToSubtitles()`
- [x] Single source of truth for object structure
- [x] All required fields present

### ✅ Priority-Based Bundle Insertion
- [x] Initial load populates `allSubtitlesArray`
- [x] Subtitles sorted by timestamp (priority)
- [x] Post-processing load only for `processed === true`
- [x] Priority tiers implemented (current → time window → background)

### ✅ Three-Subtitle Display
- [x] Previous subtitle: `allSubtitlesArray[currentIndex - 1]`
- [x] Current subtitle: `allSubtitlesArray[currentIndex]`
- [x] Next subtitle: `allSubtitlesArray[currentIndex + 1]`
- [x] UI elements created in `overlayBuilder.js`

### ✅ Mode Availability
- [x] `processed` flag checked before accessing `thaiSplit` / `phoneticWordMap`
- [x] Edit mode shows `thaiScript` before processed, word spans after
- [x] User mode locked before processed, word spans after
- [x] All rendering respects flag checks

### ✅ Batch Review Trigger
- [x] Counter increments when subtitle passes
- [x] Counter checked against threshold (5)
- [x] Modal opens with 5 subtitle objects
- [x] Review bundle locked to 5 recordIds
- [x] Review on close marks all 5 as reviewed

---

## 🚨 CODE TO REMOVE

### 1. Unused Function: `meetsReviewThreshold()`
**Location**: `src/content/batchReviewModal.js:21-30`

**Reason**: 
- Not called anywhere in codebase (verified via grep)
- Counter-based triggering is the actual mechanism (`shouldAutoOpenBatchReview()`)
- Comment indicates it's testing mode only
- Confusing to have unused threshold logic
- Function checks for 5 status states but counter-based triggering doesn't use it

**Action**: Delete function

**Verification**: 
- ✅ Exported but never imported
- ✅ Not called in `showBatchReviewModal()` or anywhere else
- ✅ Counter-based logic uses `shouldAutoOpenBatchReview()` instead

---

## 📊 ARCHITECTURE SUMMARY

### Flow Diagram
```
Airtable Records
  ↓
processRecordsToSubtitles() → Subtitle Objects
  ↓
reloadSubtitlesFromAirtable() → Priority-Based Bundle Insertion
  ↓
allSubtitlesArray (sorted by timestamp)
  ↓
updateSubtitleFromTimestamp() → Find Current Subtitle
  ↓
updateSubtitlePreviews() → Display 3 Subtitles (prev/current/next)
  ↓
Check processed flag → Enable/Disable Modes
  ↓
Subtitle Passes → incrementBatchReviewSubtitleCount()
  ↓
Counter >= 5 → shouldAutoOpenBatchReview() → true
  ↓
showBatchReviewModal() → Lock 5 Subtitles
  ↓
User Closes Modal → Mark 5 as reviewed + fullReview
```

### Key Principles
1. **Single Source of Truth**: `allSubtitlesArray` is the cache bundle
2. **Priority-Based Loading**: Timestamp sorting + tiered word data loading
3. **Three-Subtitle Display**: Always show prev/current/next
4. **Flag-Based Modes**: `processed` flag controls data access and mode availability
5. **Counter-Based Review**: 5 subtitles pass → batch review modal opens

---

## ✅ VERIFIED CLEAN ARCHITECTURE

### Cache Updates
- ✅ All updates use `updateCacheSubtitle()`
- ✅ No direct property assignments
- ✅ `Edited` flag set automatically

### Data Loading
- ✅ Initial load: `reloadSubtitlesFromAirtable()`
- ✅ Post-processing: `preloadPhoneticTexts()` (only when `processed === true`)
- ✅ No direct Airtable calls outside these paths

### Display Logic
- ✅ Three-subtitle pattern (prev/current/next)
- ✅ `processed` flag checked before data access
- ✅ Mode availability controlled by flags

### Batch Review
- ✅ Counter-based triggering
- ✅ 5-subtitle bundle locked
- ✅ Review on close mechanism

---

## 🎯 RECOMMENDATIONS

1. **Remove Unused Function**: Delete `meetsReviewThreshold()` from `batchReviewModal.js`
2. **Document Counter Logic**: Add comments explaining counter-based triggering
3. **Verify Flag Checks**: Ensure all rendering paths check `processed` flag
4. **Clean Up Comments**: Remove "TESTING MODE" comments if counter-based triggering is permanent

---

**Report Generated**: Current session  
**Status**: Architecture verified, 1 unused function identified for removal


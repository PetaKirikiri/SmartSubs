# Word Data Bundle Architecture Report

**Purpose**: Document the unified word data bundle structure and verify all access goes through the bundle.

---

## ✅ UNIFIED WORD DATA BUNDLE STRUCTURE

### ThaiWords Table Fields
- `wordId` - Word record ID (Airtable record ID)
- `thaiScript` - Thai script text
- `englishPhonetic` - English phonetic transcription
- `english` - English translation
- `pos` - Part of speech
- `status` - Status field

### Word Data Bundle Object
**Location**: `src/content/subtitleCache.js:638-643`

```javascript
const wordData = {
  wordId: record.id || '',                    // ThaiWords field: wordId
  thaiScript: record.fields?.thaiScript || '', // ThaiWords field: thaiScript
  englishPhonetic: record.fields?.englishPhonetic || '', // ThaiWords field: englishPhonetic
  english: record.fields?.english || '',      // ThaiWords field: english
  pos: record.fields?.pos || '',              // ThaiWords field: pos
  status: record.fields?.status || ''         // ThaiWords field: status
};
```

**Status**: ✅ CORRECT - All ThaiWords table fields included in bundle

---

## ✅ BUNDLE STORAGE

### Storage Location
- **Subtitle Bundle**: `subtitle.phoneticWordMap` (Map of wordId → wordData)
- **Type**: `Map<string, Object>` where Object is the wordData bundle
- **Access**: `subtitle.phoneticWordMap.get(wordId)` returns wordData bundle

**Status**: ✅ CORRECT - Single storage location in subtitle bundle

---

## ✅ UNIFIED SAVE FUNCTION

### saveWordBundle()
**Location**: `src/services/airtable.js:716`

**Editable Fields** (can be updated):
- `englishPhonetic` - Updated via word modal
- `pos` - Updated via word modal
- `status` - Can be updated (if needed)

**Read-Only Fields** (set during word creation):
- `wordId` - Set by Airtable (record ID)
- `thaiScript` - Set during word creation
- `english` - Set during word creation

**Status**: ✅ CORRECT - Only editable fields are saved

---

## ✅ VERIFIED BUNDLE ACCESS PATHS

### 1. Display Rendering
**Location**: `src/content/subtitleDisplay.js:198`
- ✅ `wordData = wordMap.get(wordId)` - Gets bundle from phoneticWordMap
- ✅ `wordData.thaiScript` - Accesses bundle property
- ✅ `wordData.englishPhonetic` - Accesses bundle property
- ✅ `wordData.pos` - Accesses bundle property
- ✅ `wordData.english` - Accesses bundle property

### 2. Word Modal
**Location**: `src/content/wordModal.js:269-271`
- ✅ `wordData.thaiScript` - Reads from bundle
- ✅ `wordData.english` - Reads from bundle
- ✅ `wordData.englishPhonetic` - Reads from bundle
- ✅ `wordData.pos` - Reads from bundle

### 3. Batch Review Modal
**Location**: `src/content/batchReviewModal.js:370`
- ✅ `wordData = wordMap.get(wordId)` - Gets bundle from phoneticWordMap
- ✅ `wordData.thaiScript` - Accesses bundle property
- ✅ `wordData.pos` - Accesses bundle property

### 4. Edit Mode
**Location**: `src/content/editMode.js:102`
- ✅ `wordData = wordMap.get(id)` - Gets bundle from phoneticWordMap

**Status**: ✅ VERIFIED - All UI access goes through bundle

---

## ✅ VERIFIED NO DIRECT FIELD ACCESS

### Processing Pipeline (OK - Creates New Records)
**Location**: `src/content/content.js:1815-1896`
- ⚠️ Direct field access: `r.fields.thaiScript`, `result.fields.englishPhonetic`
- **Status**: ✅ OK - This is word creation pipeline, not UI access
- **Note**: New word records are created here, then loaded into bundle

### Initial Load (OK - Populates Bundle)
**Location**: `src/content/subtitleCache.js:638-643`
- ✅ Reads from Airtable to populate bundle
- ✅ Bundle structure matches ThaiWords table fields
- **Status**: ✅ OK - This is initial load, populates bundle

**Status**: ✅ VERIFIED - No direct field access outside bundle for UI

---

## ✅ BUNDLE UPDATE PATHS

### 1. Word Modal Save
**Location**: `src/content/wordModal.js:318-322`
- ✅ Updates bundle: `wordData.englishPhonetic = newPhonetic`
- ✅ Updates bundle: `wordData.pos = newPos`
- ✅ Triggers universal save: `onUpdateWord()` → `saveWordBundle()`

### 2. Batch Review Modal
**Location**: `src/content/batchReviewModal.js:417-419`
- ✅ Updates bundle: `Object.assign(wordData, updatedData)`
- ✅ Updates bundle: `phoneticWordMap.set(updatedWordId, wordData)`

**Status**: ✅ VERIFIED - All updates go through bundle

---

## 📋 ARCHITECTURE SUMMARY

### Word Data Flow
```
Airtable ThaiWords Table
  ↓
preloadPhoneticTexts() → Reads records
  ↓
wordData bundle created (all 6 fields)
  ↓
phoneticWordMap.set(wordId, wordData)
  ↓
subtitle.phoneticWordMap (Map of wordId → wordData)
  ↓
UI Access: phoneticWordMap.get(wordId) → wordData bundle
  ↓
Display: wordData.thaiScript, wordData.englishPhonetic, etc.
  ↓
Update: wordData.property = value → bundle updated
  ↓
saveWordBundle() → Saves editable fields to Airtable
```

### Key Principles
1. **Single Source of Truth**: `phoneticWordMap` is the bundle
2. **Unified Structure**: All 6 ThaiWords fields in bundle
3. **Bundle-First Access**: All UI reads from bundle
4. **Unified Save**: `saveWordBundle()` handles all saves

---

## ✅ VERIFIED CLEAN ARCHITECTURE

### Bundle Structure
- ✅ All 6 ThaiWords fields included: wordId, thaiScript, englishPhonetic, english, pos, status
- ✅ Single storage location: `subtitle.phoneticWordMap`
- ✅ Consistent structure across all subtitles

### Access Patterns
- ✅ All UI access: `phoneticWordMap.get(wordId)` → bundle
- ✅ All updates: Modify bundle → trigger save
- ✅ No direct field access outside bundle

### Save Function
- ✅ Unified save: `saveWordBundle()` handles all saves
- ✅ Only editable fields saved: englishPhonetic, pos, status
- ✅ Read-only fields preserved: wordId, thaiScript, english

---

## 🎯 SUMMARY

**Word Data Bundle**: ✅ Complete
- All 6 ThaiWords table fields included
- Single storage location (`phoneticWordMap`)
- All UI access goes through bundle
- Unified save function handles all updates

**No External Variables**: ✅ Verified
- No word data stored outside bundle
- No direct field access for UI
- All access patterns verified

**Status**: Architecture is clean and unified - all word data flows through the bundle.

---

**Report Generated**: Current session  
**Status**: Word data bundle verified - all fields included, all access through bundle


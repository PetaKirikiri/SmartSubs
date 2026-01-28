# SchemaWorkMap Truth-Table Test Findings

## Purpose

This document captures findings from the self-auditing coverage guard tests about actual system behavior. These findings should be applied to the codebase to remove unused code paths and simplify the system.

## Test Framework

The test framework mirrors `content.js` orchestration:
- Entry point: `processSingleSubtitle` (called by `content.js.orchestrateSubtitleProcessing`)
- Always works with fat bundles (never transforms shapes)
- Each helper fills its section of the fat bundle

## Boolean Evaluation Logic (3-State Process)

Each boolean in `schemaWorkMap` is evaluated through 3 states: **MISSING**, **DIRTY**, and **CLEAN**. The evaluation logic determines which state applies and whether work is needed (`true`) or not (`false`).

### Top-Level Fields

#### `id`
- **Evaluation**: `!fatBundle.id || String(fatBundle.id).trim() === ''`
- **MISSING**: `undefined`, `null`, or empty string after trim → `true` (needs work)
- **DIRTY**: Empty string `''` → `true` (same as missing)
- **CLEAN**: Non-empty string → `false` (no work needed)
- **Inspection Level**: Presence + content (trim check)
- **Code Location**: `schema-work-map-builder.js:665`

#### `startSecThai`, `endSecThai`, `startSecEng`, `endSecEng`
- **Evaluation**: `fatBundle.startSecThai === undefined || fatBundle.startSecThai === null`
- **MISSING**: `undefined` or `null` → `true` (needs work)
- **DIRTY**: `null` → `true` (same as missing)
- **CLEAN**: Number (including `0`) → `false` (no work needed)
- **Inspection Level**: Presence only (no type/range validation)
- **Code Location**: `schema-work-map-builder.js:666-669`
- **Note**: Does NOT validate that value is a valid number or within range

#### `thai`, `english`
- **Evaluation**: `!fatBundle.thai || String(fatBundle.thai).trim() === ''`
- **MISSING**: `undefined`, `null`, or empty string after trim → `true` (needs work)
- **DIRTY**: Empty string `''` → `true` (same as missing)
- **CLEAN**: Non-empty string → `false` (no work needed)
- **Inspection Level**: Presence + content (trim check)
- **Code Location**: `schema-work-map-builder.js:670-671`

#### `wordReferenceIdsThai`, `wordReferenceIdsEng`
- **Evaluation**: `!fatBundle.wordReferenceIdsThai || !Array.isArray(fatBundle.wordReferenceIdsThai) || fatBundle.wordReferenceIdsThai.length === 0`
- **MISSING**: `undefined`, `null`, or not an array → `true` (needs work)
- **DIRTY**: Empty array `[]` or not an array → `true` (needs work)
- **CLEAN**: Non-empty array → `false` (no work needed)
- **Inspection Level**: Presence + type + length (no content validation)
- **Code Location**: `schema-work-map-builder.js:672-673`
- **Note**: Does NOT validate array item types or content

### Token-Level Fields

#### `tokens.display[i].index`
- **Evaluation**: `!token || token.index === undefined || token.index === null`
- **MISSING**: Token missing OR `index` undefined/null → `true` (needs work)
- **DIRTY**: `null` → `true` (same as missing)
- **CLEAN**: Number → `false` (no work needed)
- **Inspection Level**: Presence only
- **Code Location**: `schema-work-map-builder.js:701`

#### `tokens.display[i].thaiScript`
- **Evaluation**: `!token || !token.thaiScript || String(token.thaiScript).trim() === ''`
- **MISSING**: Token missing OR `thaiScript` missing OR empty after trim → `true` (needs work)
- **DIRTY**: Empty string `''` → `true` (same as missing)
- **CLEAN**: Non-empty string → `false` (no work needed)
- **Inspection Level**: Presence + content (trim check)
- **Code Location**: `schema-work-map-builder.js:702`

#### `tokens.display[i].g2p`
- **Evaluation**: `!token || token.g2p === undefined || token.g2p === null`
- **MISSING**: Token missing OR `g2p` undefined/null → `true` (needs work)
- **DIRTY**: `null` → `true` (same as missing)
- **CLEAN**: String (even empty string `''` is valid) → `false` (no work needed)
- **Inspection Level**: Presence only (no content validation)
- **Code Location**: `schema-work-map-builder.js:703`
- **Note**: Empty string `''` is considered CLEAN (not validated for correctness)

#### `tokens.display[i].englishPhonetic`
- **Evaluation**: `!token || token.englishPhonetic === undefined || token.englishPhonetic === null`
- **MISSING**: Token missing OR `englishPhonetic` undefined/null → `true` (needs work)
- **DIRTY**: `null` → `true` (same as missing)
- **CLEAN**: String (even empty string `''` is valid) → `false` (no work needed)
- **Inspection Level**: Presence only (no content validation)
- **Code Location**: `schema-work-map-builder.js:704`
- **Note**: Empty string `''` is considered CLEAN (not validated for correctness)

#### `tokens.displayEng[i].index`
- **Evaluation**: `!token || token.index === undefined || token.index === null`
- **MISSING**: Token missing OR `index` undefined/null → `true` (needs work)
- **DIRTY**: `null` → `true` (same as missing)
- **CLEAN**: Number → `false` (no work needed)
- **Inspection Level**: Presence only
- **Code Location**: `schema-work-map-builder.js:760`

#### `tokens.displayEng[i].englishWord`
- **Evaluation**: `!token || !token.englishWord || String(token.englishWord).trim() === ''`
- **MISSING**: Token missing OR `englishWord` missing OR empty after trim → `true` (needs work)
- **DIRTY**: Empty string `''` → `true` (same as missing)
- **CLEAN**: Non-empty string → `false` (no work needed)
- **Inspection Level**: Presence + content (trim check)
- **Code Location**: `schema-work-map-builder.js:761`

#### `tokens.senses[i].index`
- **Evaluation**: `!token || token.index === undefined || token.index === null`
- **MISSING**: Token missing OR `index` undefined/null → `true` (needs work)
- **DIRTY**: `null` → `true` (same as missing)
- **CLEAN**: Number → `false` (no work needed)
- **Inspection Level**: Presence only
- **Code Location**: `schema-work-map-builder.js:729, 781`

#### `tokens.senses[i].senses` (Array Gate)
- **Evaluation**: Complex - uses `sensesNeedsWork()` function
  - Empty array `[]` → `true` (needs work - triggers ORST scraping)
  - Array with normalizedSense objects → checks each sense field via `createNormalizedSenseWorkMap()`
- **MISSING**: Empty array `[]` → `true` (needs work)
- **DIRTY**: Array exists but contains incomplete senses (any field missing) → `true` (needs work)
- **CLEAN**: Array with complete normalized senses → `false` (no work needed)
- **Inspection Level**: Presence + structure + content (deep inspection)
- **Code Location**: `schema-work-map-builder.js:734-740, 1133-1147`
- **Gate Logic**:
  - **Gate 1** (Empty senses): `scrapeOrstDictionary()` called
  - **Gate 2** (Senses exist but not normalized): `normalizeSensesWithGPT()` called
  - **Gate 3** (Senses normalized): No helper called

### Sense-Level Fields (within `tokens.senses[i].senses[i]`)

All sense-level fields use `createNormalizedSenseWorkMap()` which creates a workmap for each sense object:

#### `tokens.senses[i].senses[i].id`
- **Evaluation**: `!sense || sense.id === undefined || sense.id === null`
- **MISSING**: Sense missing OR `id` undefined/null → `true` (needs work)
- **DIRTY**: `null` → `true` (same as missing)
- **CLEAN**: Number or string → `false` (no work needed)
- **Inspection Level**: Presence only
- **Code Location**: `schema-work-map-builder.js:611`

#### `tokens.senses[i].senses[i].normalized`
- **Evaluation**: `!sense || sense.normalized === undefined || sense.normalized === null || sense.normalized !== true`
- **MISSING**: Sense missing OR `normalized` undefined/null → `true` (needs work)
- **DIRTY**: `false` or `null` → `true` (needs work)
- **CLEAN**: `true` → `false` (no work needed)
- **Inspection Level**: Presence + value (must be exactly `true`)
- **Code Location**: `schema-work-map-builder.js:625`
- **Note**: Only `true` is considered CLEAN; `false` is DIRTY

#### `tokens.senses[i].senses[i].thaiWord`, `meaningThai`, `meaningEnglish`, etc.
- **Evaluation**: `!sense || !sense.thaiWord || String(sense.thaiWord).trim() === ''`
- **MISSING**: Sense missing OR field missing OR empty after trim → `true` (needs work)
- **DIRTY**: Empty string `''` → `true` (same as missing)
- **CLEAN**: Non-empty string → `false` (no work needed)
- **Inspection Level**: Presence + content (trim check)
- **Code Location**: `schema-work-map-builder.js:614-624`

#### `tokens.senses[i].senses[i].confidence`
- **Evaluation**: `!sense || sense.confidence === undefined || sense.confidence === null`
- **MISSING**: Sense missing OR `confidence` undefined/null → `true` (needs work)
- **DIRTY**: `null` → `true` (same as missing)
- **CLEAN**: Number (including `0`) → `false` (no work needed)
- **Inspection Level**: Presence only (no range validation)
- **Code Location**: `schema-work-map-builder.js:628`

#### `tokens.senses[i].senses[i].originalData`
- **Evaluation**: `!sense || !sense.originalData || typeof sense.originalData !== 'object'`
- **MISSING**: Sense missing OR `originalData` missing OR not an object → `true` (needs work)
- **DIRTY**: Not an object → `true` (needs work)
- **CLEAN**: Object → `false` (no work needed)
- **Inspection Level**: Presence + type (no content validation)
- **Code Location**: `schema-work-map-builder.js:629`

## Inspection Level Summary

### Presence-Only Checks
- `startSecThai`, `endSecThai`, `startSecEng`, `endSecEng`
- `tokens.display[i].index`, `tokens.displayEng[i].index`, `tokens.senses[i].index`
- `tokens.display[i].g2p`, `tokens.display[i].englishPhonetic`
- `tokens.senses[i].senses[i].id`, `tokens.senses[i].senses[i].confidence`

### Presence + Content Checks (Trim)
- `id`, `thai`, `english`
- `tokens.display[i].thaiScript`, `tokens.displayEng[i].englishWord`
- `tokens.senses[i].senses[i].thaiWord`, `meaningThai`, `meaningEnglish`, etc.

### Presence + Type Checks
- `wordReferenceIdsThai`, `wordReferenceIdsEng` (must be array, non-empty)
- `tokens.senses[i].senses[i].originalData` (must be object)

### Presence + Value Checks (Exact Match)
- `tokens.senses[i].senses[i].normalized` (must be exactly `true`)

### Deep Inspection (Structure + Content)
- `tokens.senses[i].senses` (array gate with nested field checks)

## Findings

### Functions Actually Called by content.js

1. **`processSingleSubtitle`** (from `load-subtitles-orchestrator.js`)
   - Called by: `content.js.orchestrateSubtitleProcessing`
   - Always builds fat bundle from template
   - Generates schemaWorkMap internally
   - Calls `processSubtitleToFat` internally

2. **`processSubtitleToFat`** (from `process-subtitle-orchestrator.js`)
   - Called by: `processSingleSubtitle`
   - Handles all processing (LOAD + PROCESS unified)
   - May call `processSubtitleToSkinny` internally if tokens don't exist

### Functions NOT Called by content.js (Internal Only)

1. **`processSubtitleToSkinny`** (from `process-subtitle-orchestrator.js`)
   - Status: Only called internally by `processSubtitleToFat` if tokens don't exist
   - Finding: Not a public API - internal implementation detail
   - Recommendation: Consider removing as public export, make internal only

2. **`processSubtitleToMinimal`** (from `process-subtitle-orchestrator.js`)
   - Status: Only called internally by `processSubtitleToSkinny`
   - Finding: Not a public API - internal implementation detail
   - Recommendation: Consider removing as public export, make internal only

### Helper Call Patterns Discovered

**LOAD helpers** (fetch/parse VTT):
- Called during: `loadFromParsedSubtitles` (import flow)
- NOT called by: `processSingleSubtitle` or `processSubtitleToFat`
- Finding: LOAD helpers are called BEFORE fat bundle creation
- Test impact: LOAD helper tests may need separate setup or be marked as "pre-bundle" phase
- **Test Result**: Tests for LOAD helpers (fetchThaiVTTContent, fetchEnglishVTTContent) fail when called via `processSingleSubtitle` because these helpers are not invoked by that orchestrator. This is expected behavior - LOAD happens earlier in the pipeline.

**PROCESS helpers** (G2P, phonetics, senses, normalization):
- Called by: `processSubtitleToFat` → `processTokens`
- Test impact: Can be tested via `processSingleSubtitle`

**STRUCTURAL helpers** (tokenization):
- Called by: `processSubtitleToFat` → `processSubtitleToSkinny` → `tokenizeSubtitle`
- Test impact: Can be tested via `processSingleSubtitle`

## Test Results Analysis

### Comprehensive Coverage Achieved
- **Total booleans extracted**: 36 (up from 9)
- **Top-level booleans**: 9 (id, thai, english, startSecThai, endSecThai, startSecEng, endSecEng, wordReferenceIdsThai, wordReferenceIdsEng)
- **Token-level booleans**: 7 (tokens.display[i].g2p, tokens.display[i].englishPhonetic, tokens.display[i].index, tokens.display[i].thaiScript, tokens.displayEng[i].englishWord, tokens.displayEng[i].index, tokens.senses[i].index, tokens.sensesEng[i].index)
- **Sense-level booleans**: 20 (all fields within tokens.senses[i].senses[i] - normalized, meaningThai, meaningEnglish, etc.)

### Missing Fields from Fat Bundle Schema
The test identifies fields that are checked in the codebase but missing from `fat-subtitle-schema.json`:
- **`smartSubsRefs`**: Checked in `checkFieldPresenceAndValue` and `inspectSubtitleChecklist` (skinny stage), but NOT in schema
  - Helper: `rebuildSmartSubsRefsForSubtitleSave` (cache-subtitles.js)
  - Gating: Not gated by workmap, built during save operation
  - Storage: Stored on word documents, not subtitle bundles
  
- **`matchedWords`**: Checked in `checkFieldPresenceAndValue` and `inspectSubtitleChecklist` (skinny stage), but NOT in schema
  - Helper: `matchWordsBetweenLanguages` (gpt-match-words.js)
  - Gating: Gated by checklist (`inspectSubtitleChecklist`), not workmap
  - Storage: Stored on word documents, not subtitle bundles

**Impact**: These fields won't appear in `schemaWorkMap` booleans because `generateSchemaWorkMap` mirrors the schema. They are tracked separately via checklist, not workmap.

See `fat-bundle-schema-gaps.md` for detailed analysis.

### Known Test Failures (Expected Behavior)
When tests reveal that a helper is NOT called for a MISSING state:
- **LOAD helpers** (fetchThaiVTTContent, fetchEnglishVTTContent): These are called earlier in the pipeline (`loadFromParsedSubtitles`), not by `processSingleSubtitle`. This is expected and documented.
- Other failures indicate the helper might not be gated by that boolean path OR the test setup doesn't match real-world conditions
- Document these findings for codebase review

## Recommendations

1. **Remove unused public exports**: If `processSubtitleToSkinny` and `processSubtitleToMinimal` are only used internally, make them internal functions (remove from exports)

2. **Document actual flow**: Update documentation to reflect that the system always works with fat bundles, and helpers fill missing sections

3. **Simplify test framework**: Tests should use `processSingleSubtitle` as entry point (mirrors content.js), not lower-level functions

4. **Apply findings to codebase**: Use these findings to remove dead code paths and simplify the system

5. **Investigate helper call failures**: When a helper isn't called in tests, investigate:
   - Is the helper actually gated by that boolean path?
   - Does the test setup match real-world conditions?
   - Should the helper be called but isn't (bug)?

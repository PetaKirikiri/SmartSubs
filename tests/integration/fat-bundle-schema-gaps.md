# Fat Bundle Schema Gap Analysis

## Purpose

This document lists all fields that are used in the codebase but missing from `fat-subtitle-schema.json`.
Since `generateSchemaWorkMap` mirrors the schema, missing fields won't appear in workmap booleans.

## Missing Fields

### Top-Level Fields

#### smartSubsRefs
- **Type**: `array<string>`
- **Used in**: 
  - `checkFieldPresenceAndValue` (schema-work-map-builder.js:381-384)
  - `inspectSubtitleChecklist` (skinny stage)
  - `save-subtitles.js` (builds and saves smartSubsRefs)
  - `cache-subtitles.js` (rebuildSmartSubsRefsForSubtitleSave)
- **Helper**: `rebuildSmartSubsRefsForSubtitleSave` (cache-subtitles.js:564)
- **Workmap Impact**: NOT in workmap (missing from schema)
- **Gating**: Not gated by workmap, built during save operation

#### matchedWords
- **Type**: `array<object>` (objects with `thaiWord`, `englishWord`, `confidence`, `key`)
- **Used in**:
  - `checkFieldPresenceAndValue` (schema-work-map-builder.js:386-389)
  - `inspectSubtitleChecklist` (skinny stage)
  - `gpt-match-words.js` (matchWordsBetweenLanguages)
  - `word-save-helpers.js` (saves matchedWords to word documents)
- **Helper**: `matchWordsBetweenLanguages` (gpt-match-words.js:15)
- **Workmap Impact**: NOT in workmap (missing from schema)
- **Gating**: Gated by checklist (`inspectSubtitleChecklist`), not workmap

#### wordReferenceIdsEng sense indices
- **Type**: `array<string>` (derived from `wordReferenceIdsEng` - filters refs containing `:`)
- **Used in**:
  - `checkFieldPresenceAndValue` (schema-work-map-builder.js:375-379)
  - `inspectSubtitleChecklist` (skinny stage)
- **Helper**: None (derived field, extracted during processing)
- **Workmap Impact**: NOT in workmap (derived field, not stored on bundle)
- **Gating**: Not gated, derived from `wordReferenceIdsEng`

### Token-Level Fields

All token-level fields are present in the schema:
- `tokens.display[i].g2p` ✓
- `tokens.display[i].englishPhonetic` ✓
- `tokens.senses[i].senses` ✓
- `tokens.displayEng[i].englishWord` ✓
- `tokens.sensesEng[i].senses` ✓

## Fields Checked But Not in Schema

### From checkFieldPresenceAndValue:
- `smartSubsRefs` - array check
- `matchedWords` - array check
- `wordReferenceIdsEng sense indices` - derived field (not stored)

### From inspectSubtitleChecklist:
- **Minimal stage**: All fields are in schema ✓
- **Skinny stage**: 
  - `smartSubsRefs` ✗ (missing from schema)
  - `matchedWords` ✗ (missing from schema)
  - `wordReferenceIdsEng sense indices` ✗ (derived field, not stored)
- **Fat stage**: All fields are in schema ✓

## Fields Written But Not in Schema

### From processSubtitleToFat:
All fields written to `result.subtitle` are present in schema:
- `id` ✓
- `startSecThai` ✓
- `endSecThai` ✓
- `startSecEng` ✓
- `endSecEng` ✓
- `thai` ✓
- `english` ✓
- `wordReferenceIdsThai` ✓
- `wordReferenceIdsEng` ✓

Note: `smartSubsRefs` and `matchedWords` are NOT written to bundles by `processSubtitleToFat`. They are:
- Built during save operations (`save-subtitles.js`)
- Stored on word documents, not subtitle bundles
- Checked via `inspectSubtitleChecklist` but not part of bundle structure

## Integrity Flags: NOT Bundle Fields

**CRITICAL CONSTRAINT**: Integrity flags (like `g2pComplete`, `sensesComplete`, `smartSubsRefsComplete`, etc.) must NEVER be stored on the fat bundle.

- Integrity flags belong ONLY in `schemaWorkMap` (separate object returned alongside bundle)
- Fat bundle contains ONLY data fields (thai, english, tokens, wordReferenceIds, etc.)
- `schemaWorkMap` is returned separately, never merged into bundle
- Any code that writes integrity flags to bundle must be removed/fixed

### Integrity Flag Names (for reference, NOT bundle fields):
- `g2pComplete` → tracked in `schemaWorkMap.tokens.display[i].g2p` (boolean)
- `phoneticsComplete` → tracked in `schemaWorkMap.tokens.display[i].englishPhonetic` (boolean)
- `sensesComplete` → tracked in `schemaWorkMap.tokens.senses[i].senses` (boolean or array)
- `sensesNormalizedComplete` → tracked in `schemaWorkMap.tokens.senses[i].senses` (nested booleans)
- `smartSubsRefsComplete` → NOT tracked in workmap (missing from schema, field not on bundle)
- `matchedWordsComplete` → NOT tracked in workmap (missing from schema, field not on bundle)
- `tokenized` → tracked in `schemaWorkMap.wordReferenceIdsThai` (boolean)
- `tokenProcessingComplete` → aggregate of token-level flags

## Impact on Coverage Guard Test

Since these fields are NOT in the schema:
- They won't appear in `generateSchemaWorkMap` output
- They won't be extracted by `extractAllBooleanPaths`
- Coverage guard test will NOT catch missing helpers for these fields
- Tests must explicitly account for these gaps

**Exception**: Integrity flags are NOT bundle fields, so they should NOT appear in workmap extraction. They are metadata tracked separately.

**Known Gaps** (fields checked but not in schema):
1. `smartSubsRefs` - Helper: `rebuildSmartSubsRefsForSubtitleSave`, gated by save operation
2. `matchedWords` - Helper: `matchWordsBetweenLanguages`, gated by checklist
3. `wordReferenceIdsEng sense indices` - Derived field, no helper needed

## Recommendations

### Option A: Add missing fields to `fat-subtitle-schema.json`
**Pros**: Complete schema coverage, fields appear in workmap
**Cons**: These fields are not actually stored on bundles (smartSubsRefs/matchedWords are on word docs)

**If chosen**:
- Add `smartSubsRefs: { type: "array", items: { type: "string" } }` to schema
- Add `matchedWords: { type: "array", items: { type: "object" } }` to schema
- Update `generateSchemaWorkMap` to include these fields
- **BUT**: These fields are not written to bundles, so this may be misleading

### Option B: Document as "out-of-schema" fields (RECOMMENDED)
**Pros**: Accurate representation (fields not on bundles), clear separation
**Cons**: Coverage guard won't catch them automatically

**If chosen**:
- Keep them separate from schema
- Add explicit tests for these fields outside coverage guard
- Document that they're tracked differently (via checklist, not workmap)
- Add to "known gaps" list in coverage guard test

### Option C: Move to separate schema
**Pros**: Clear separation of concerns
**Cons**: More complexity, requires new schema file

**If chosen**:
- Create `subtitle-metadata-schema.json` for fields like smartSubsRefs, matchedWords
- Keep fat-subtitle-schema.json focused on core structure
- Update `inspectSubtitleChecklist` to use metadata schema

## Current Status

**Recommended Approach**: Option B (Document as out-of-schema fields)

**Rationale**:
- `smartSubsRefs` and `matchedWords` are NOT stored on subtitle bundles
- They are stored on word documents and checked via checklist
- Adding them to fat-subtitle-schema.json would be misleading
- Coverage guard test should explicitly list these as "known gaps" with separate tests

## Validation Required

1. **Audit all bundle writes**
   - ✅ `processSubtitleToFat` - verified: no integrity flags written to `result.subtitle`
   - ✅ `saveFatSubtitle` - verified: smartSubsRefs/matchedWords written to word docs, not bundles
   - ✅ `cacheFatSubtitleSilent` - needs verification
   - ✅ `generateSchemaWorkMap` - verified: returns workmap separately, not merged into bundle

2. **Add validation tests**
   - Test that `processSubtitleToFat` never writes integrity flags to bundle
   - Test that `generateSchemaWorkMap` never includes integrity flags in bundle structure
   - Test that saved bundles never contain integrity flags
   - Test that `smartSubsRefs` and `matchedWords` are not on bundles

3. **Document in coverage guard test**
   - Explicitly list "known gaps" (smartSubsRefs, matchedWords)
   - Add separate tests for out-of-schema fields
   - Document that these fields are tracked via checklist, not workmap

---
name: ""
overview: ""
todos: []
isProject: false
---

# Plan: Modify loadFromDB to Load All Subtitles with VTT Fallback

## Location
**File**: `src/content/01_load-subtitles/load-subtitles-orchestrator.js`

## Changes Required

### Create `getEpisodeMetadataFromMediaId` helper function
- Query `episodeLookup/{mediaId}` document
- Return `{ showName, mediaId, season, episode, episodeTitle }` or null
- Used internally by `loadFromDB` to get all episode metadata from `mediaId`

### Modify `loadFromDB` function signature
Change from:
```javascript
export async function loadFromDB(showName, mediaId, subtitleId)
```

To:
```javascript
export async function loadFromDB(mediaId, subtitleId = null)
```

### Update `loadFromDB` implementation structure
1. **Query lookup table first**: `getEpisodeMetadataFromMediaId(mediaId)` to get `{ showName, mediaId, season, episode, episodeTitle }`
2. **If lookup table has entry**:
   - Extract `showName` from lookup metadata
   - If `subtitleId` is null/undefined:
     - Query `shows/{showName}/episodes/{mediaId}/subs` collection
     - Load all subtitle documents
     - For each subtitle, load words and senses (same as current logic)
     - If result is empty array, continue to fallback (step 3)
     - If result has subtitles, return array of all subtitles
   - If `subtitleId` is provided:
     - Load single subtitle: `shows/{showName}/episodes/{mediaId}/subs/{subtitleId}`
     - Load words and senses (same as current logic)
     - If result is null, continue to fallback (step 3)
     - If result exists, return single subtitle object
3. **VTT Fallback (at the END of `loadFromDB`)**:
   - This block executes if:
     - Lookup table doesn't have entry, OR
     - DB query returned null/empty (for single subtitle), OR
     - DB query returned empty array (for all subtitles)
   - Extract metadata using `extractMediaMetadata(videoElement, mediaId)` from `./helpers/extract-metadata.js`
     - Get `videoElement` from DOM: `document.querySelector('video')`
   - Ensure lookup table entry exists:
     - If metadata has `showName`, call `ensureEpisodeLookupSave(showName, mediaId)` from `../05_save/save-subtitles.js`
     - Also update lookup table with episode metadata: `updateEpisodeLookupMetadata(showName, mediaId, { season: null, episode: metadata.episodeNumber, episodeTitle: metadata.episodeTitle })`
   - If loading single subtitle (`subtitleId` provided):
     - Extract `subtitleIndex` from `subtitleId` format (`mediaId-index`)
     - Call `loadFromVTT(mediaId, subtitleIndex)`
     - Return single subtitle object
   - If loading all subtitles (`subtitleId` is null):
     - Call `loadAllFromVTT(mediaId)` (new helper function - see below)
     - Return array of all parsed subtitles

### Update `loadFromVTT` function
- Add logic to ensure lookup table entry exists:
  - Get `videoElement` from DOM: `document.querySelector('video')`
  - Extract metadata using `extractMediaMetadata(videoElement, mediaId)` from `./helpers/extract-metadata.js`
  - If metadata has `showName`:
    - Call `ensureEpisodeLookupSave(showName, mediaId)` from `../05_save/save-subtitles.js`
    - Also update lookup table with episode metadata if available:
      - Call `updateEpisodeLookupMetadata(showName, mediaId, { season: null, episode: metadata.episodeNumber, episodeTitle: metadata.episodeTitle })` if those fields are present in metadata
- Continue with existing VTT fetch/parse logic
- Return VTT data as before

### Create `loadAllFromVTT` helper function
- Extract metadata and ensure lookup table entry (same logic as `loadFromVTT`):
  - Get `videoElement` from DOM: `document.querySelector('video')`
  - Extract metadata using `extractMediaMetadata(videoElement, mediaId)` from `./helpers/extract-metadata.js`
  - If metadata has `showName`:
    - Call `ensureEpisodeLookupSave(showName, mediaId)` from `../05_save/save-subtitles.js`
    - Call `updateEpisodeLookupMetadata(showName, mediaId, { season: null, episode: metadata.episodeNumber, episodeTitle: metadata.episodeTitle })`
- Fetch all VTT content:
  - Use `fetchThaiVTTContent(mediaId)` and `fetchEnglishVTTContent(mediaId)` from `../03_process/helpers/01_vtt/vtt.js`
  - Parse both: `parseThaiVTTContent(thaiVTT.content)` and `parseEnglishVTTContent(englishVTT.content)`
  - Merge parsed Thai and English arrays (by index) into combined subtitle objects
- Return array of all parsed subtitles

### Update button call in `smartsubs-parent.jsx`
- Change `handleFetchFromNetflix` to:
  - Get `mediaId` from URL using `getMediaIdFromUrl()` from `./01_load-subtitles/helpers/extract-metadata.js`
  - Get `videoElement` from DOM
  - Extract metadata using `extractMediaMetadata(videoElement, mediaId)` 
  - Ensure lookup table is populated:
    - If metadata has `showName`, call `ensureEpisodeLookupSave(showName, mediaId)` from `../05_save/save-subtitles.js`
  - Call `loadFromDB(mediaId)` (no subtitleId = load all)
  - Format result for upload form: `{ mediaMeta, parsedSubtitles, fileName }`
  - Set `uploadFormData` and show upload form

## Return Format Changes
- When `subtitleId` provided: Returns single subtitle object (current behavior)
- When `subtitleId` null: Returns array of all subtitles
- VTT fallback returns same format (single or array)

## Dependencies
- Create `getEpisodeMetadataFromMediaId(mediaId)` function
- Create `loadAllFromVTT(mediaId)` helper function
- Import `ensureEpisodeLookupSave` and `updateEpisodeLookupMetadata` from `../05_save/save-subtitles.js`
- Import `extractMediaMetadata` from `./helpers/extract-metadata.js` (does most of the metadata extraction work)
- Import VTT functions: `fetchThaiVTTContent`, `fetchEnglishVTTContent`, `parseThaiVTTContent`, `parseEnglishVTTContent` from `../03_process/helpers/01_vtt/vtt.js`
- Import `getMediaIdFromUrl` from `./helpers/extract-metadata.js` (for button handler)

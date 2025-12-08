# Smart Subs Chrome Extension

A Chrome Extension (Manifest V3) for editing and enhancing Netflix subtitles for language learning.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the extension:
```bash
npm run build
```

3. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder from this project

## Development

Run the build in watch mode for development:
```bash
npm run dev
```

After making changes, rebuild and reload the extension in Chrome.

## Project Structure

- `manifest.json` - Chrome extension manifest (Manifest V3)
- `popup.html` - Extension popup page entry point
- `src/popup/` - React components for the popup UI
- `src/content/` - Content script that injects subtitle overlay on Netflix
- `src/content/content.js` - Main content script logic
- `src/content/content.css` - Styles for the subtitle overlay
- `dist/` - Built extension files (created after `npm run build`)

## Features

- **Subtitle Overlay**: Injects a non-intrusive subtitle overlay on Netflix watch pages
- **Edit Functionality**: Click the edit icon to modify subtitle text inline
- **Future Airtable Integration**: Comments in code indicate where Airtable calls will be added for persistence

## Future Enhancements

- Connect to Airtable to store corrected subtitle lines with timestamps
- Display tokenized, clickable words with grammar and vocabulary information
- Load/save subtitle corrections based on video timestamps


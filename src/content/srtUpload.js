import { parseSubtitlesFromText } from '../utils/srtParser.js';

/**
 * Read file as text and parse subtitles (handles both SRT and Netflix WebVTT formats)
 * @param {File} file - Selected file (can be .srt or Netflix download file with no extension)
 * @returns {Promise<Array>} - Parsed subtitle array with startSec, endSec, text, etc.
 */
export async function readAndParseSubtitleFile(file) {
  if (!file) {
    throw new Error('No file selected');
  }

  const text = await file.text();
  const parsedSubtitles = parseSubtitlesFromText(text);

  if (!parsedSubtitles || parsedSubtitles.length === 0) {
    throw new Error('No valid subtitles found in file');
  }

  return parsedSubtitles;
}

/**
 * Build upload payload from parsed subtitles and options
 * @param {Array} parsedSubtitles - Array of parsed subtitle objects
 * @param {Object} options - Upload options
 * @param {string} options.tableName - Required: Airtable table name
 * @param {string} options.mediaId - Required: Media ID
 * @param {number} options.duration - Required: Episode duration in seconds
 * @param {number|null} options.season - Optional: Season number
 * @param {number|null} options.episode - Optional: Episode number
 * @param {number|null} options.recordLimit - Optional: Limit number of subtitles to process
 * @returns {Object} - Payload object with subtitles and options
 */
export function buildSubtitleUploadPayload(parsedSubtitles, options) {
  const { tableName, mediaId, duration, season, episode, recordLimit } = options;

  if (!tableName || typeof tableName !== 'string' || !tableName.trim()) {
    throw new Error('tableName is required and must be a non-empty string');
  }

  if (!mediaId || typeof mediaId !== 'string' || !mediaId.trim()) {
    throw new Error('mediaId is required and must be a non-empty string');
  }

  if (!duration || typeof duration !== 'number' || isNaN(duration) || duration <= 0) {
    throw new Error('duration is required and must be a positive number');
  }

  if (!Array.isArray(parsedSubtitles) || parsedSubtitles.length === 0) {
    throw new Error('parsedSubtitles must be a non-empty array');
  }

  let subtitles = parsedSubtitles;
  if (recordLimit && typeof recordLimit === 'number' && recordLimit > 0) {
    subtitles = parsedSubtitles.slice(0, recordLimit);
  }

  return {
    subtitles,
    options: {
      tableName: tableName.trim(),
      mediaId: mediaId.trim(),
      duration,
      season: season ?? null,
      episode: episode ?? null
    }
  };
}

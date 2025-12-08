/**
 * Utility Functions Module
 * Shared utility functions for subtitle formatting and display
 */

/**
 * Format timestamp range from Airtable format to display format
 * @param {string} timestampRange - Timestamp range from Airtable: "00:02:08,500 --> 00:02:10,041"
 * @returns {Object} Object with start and end timestamps for display
 */
export function formatTimestampRange(timestampRange) {
  // Parse timestamp range from Airtable: "00:02:08,500 --> 00:02:10,041"
  // Return object with start and end for display (number above and number below)
  if (!timestampRange || !timestampRange.includes('-->')) {
    return { start: '--:--:--', end: '--:--:--' };
  }
  const parts = timestampRange.split('-->');
  const start = parts[0]?.trim().replace(',', '.') || '--:--:--';
  const end = parts[1]?.trim().replace(',', '.') || '--:--:--';
  return { start: start, end: end };
}







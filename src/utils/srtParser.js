/**
 * Parse SRT subtitle file format
 * SRT format:
 * 1
 * 00:00:01,000 --> 00:00:03,500
 * Subtitle text here
 * 
 * 2
 * 00:00:04,000 --> 00:00:06,500
 * More subtitle text
 */

/**
 * Convert SRT timestamp "HH:MM:SS,mmm" to seconds (number)
 * @param {string} timestamp - Format: "00:00:01,000"
 * @returns {number} - Seconds as number
 */
function parseSRTTimestamp(timestamp) {
  const parts = timestamp.trim().split(':')
  if (parts.length !== 3) return null
  
  const hours = parseInt(parts[0]) || 0
  const minutes = parseInt(parts[1]) || 0
  const secondsParts = parts[2].split(',')
  const seconds = parseInt(secondsParts[0]) || 0
  const milliseconds = parseInt(secondsParts[1]) || 0
  
  return hours * 3600 + minutes * 60 + seconds + (milliseconds / 1000)
}

/**
 * Convert WebVTT timestamp "HH:MM:SS.mmm" to seconds (number)
 * @param {string} timestamp - Format: "00:23:42.958"
 * @returns {number} - Seconds as number
 */
function parseWebVTTTimestamp(timestamp) {
  const parts = timestamp.trim().split(':')
  if (parts.length !== 3) return null
  
  const hours = parseInt(parts[0]) || 0
  const minutes = parseInt(parts[1]) || 0
  const secondsParts = parts[2].split('.')
  const seconds = parseInt(secondsParts[0]) || 0
  const milliseconds = parseInt(secondsParts[1]) || 0
  
  return hours * 3600 + minutes * 60 + seconds + (milliseconds / 1000)
}

/**
 * Strip HTML-like tags and entities from text
 * Removes <...> tags and HTML entities like &lrm;
 * @param {string} text - Text with HTML tags
 * @returns {string} - Cleaned text
 */
function stripHTMLTags(text) {
  if (!text) return ''
  // Remove HTML-like tags: <...>
  let cleaned = text.replace(/<[^>]+>/g, '')
  // Remove HTML entities like &lrm; &nbsp; etc.
  cleaned = cleaned.replace(/&[a-z]+;/gi, '')
  // Trim whitespace
  return cleaned.trim()
}

/**
 * Parse Netflix WebVTT-style subtitle file format
 * Netflix format:
 * 239
 * 00:23:42.958 --> 00:23:44.541 position:50.00%,middle align:middle size:80.00% line:84.67% 
 * <c.thai><c.bg_transparent>&lrm;มันชักไปกันใหญ่แล้ว</c.bg_transparent></c.thai>
 * 
 * @param {string} content - Raw Netflix WebVTT file content
 * @returns {Array<{index: number, text: string, startSec: string, endSec: string, startTime: number, endTime: number}>} - Parsed subtitles
 */
export function parseNetflixVTTLike(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('Invalid Netflix WebVTT content')
  }

  const subtitles = []
  // Split by blank lines (double newlines)
  const blocks = content.trim().split(/\n\s*\n/)
  
  for (const block of blocks) {
    const lines = block.trim().split('\n').filter(line => line.trim())
    if (lines.length < 2) continue
    
    // First line is the index number
    const index = parseInt(lines[0].trim())
    if (isNaN(index)) continue
    
    // Second line contains timing: "HH:MM:SS.mmm --> HH:MM:SS.mmm position:..."
    const timeLine = lines[1].trim()
    if (!timeLine.includes('-->')) continue
    
    // Extract timestamps - stop at the second timestamp, ignore everything after
    const arrowIndex = timeLine.indexOf('-->')
    if (arrowIndex === -1) continue
    
    const startTimestamp = timeLine.substring(0, arrowIndex).trim()
    const afterArrow = timeLine.substring(arrowIndex + 3).trim()
    // Extract end timestamp - take everything up to the first space or end of string
    const endTimestampMatch = afterArrow.match(/^(\d{2}:\d{2}:\d{2}\.\d{3})/)
    if (!endTimestampMatch) continue
    
    const endTimestamp = endTimestampMatch[1]
    
    // Parse timestamps to numbers
    const startTime = parseWebVTTTimestamp(startTimestamp)
    const endTime = parseWebVTTTimestamp(endTimestamp)
    
    if (startTime === null || endTime === null) continue
    
    // Convert to string format (seconds only, no milliseconds for startSec/endSec)
    const startSec = String(Math.floor(startTime))
    const endSec = String(Math.floor(endTime))
    
    // Remaining lines are text with HTML tags
    const textLines = lines.slice(2)
    const cleanedTextLines = textLines.map(line => stripHTMLTags(line)).filter(line => line.trim())
    
    if (cleanedTextLines.length === 0) continue
    
    // Join multiple <c.thai> lines with \n (newline) between lines
    const text = cleanedTextLines.join('\n').trim()
    
    if (text && startTime !== null && endTime !== null) {
      // Only include fields that exist in the database schema
      // Database fields: thai, startSec, endSec, subIndex, mediaId (set during upload)
      // Ignore WebVTT formatting attributes (position, align, size, line) - not in schema
      subtitles.push({
        index, // Used for subIndex during upload
        text, // Raw text for reference
        thai: text, // Required: Thai text field
        startSec, // Required: Start time in seconds (string)
        endSec, // Required: End time in seconds (string)
        startTime, // Computed: Start time as number (for internal use)
        endTime // Computed: End time as number (for internal use)
        // Note: WebVTT formatting attributes (position, align, size, line) are intentionally excluded
        // as they are not part of the Airtable schema
      })
    }
  }
  
  return subtitles
}

/**
 * Parse SRT file content into array of subtitle objects
 * @param {string} srtContent - Raw SRT file content
 * @returns {Array<{index: number, timestampRange: string, text: string, startSec: string, endSec: string, startTime: number, endTime: number}>} - Parsed subtitles
 */
export function parseSRT(srtContent) {
  if (!srtContent || typeof srtContent !== 'string') {
    throw new Error('Invalid SRT content')
  }

  const subtitles = []
  // Split by double newlines (subtitle blocks)
  const blocks = srtContent.trim().split(/\n\s*\n/)
  
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 2) continue
    
    // First line is the index number
    const index = parseInt(lines[0].trim())
    if (isNaN(index)) continue
    
    // Second line is the timestamp range
    const timestampRange = lines[1].trim()
    if (!timestampRange.includes('-->')) continue
    
    // Parse start and end timestamps
    const [startTimestamp, endTimestamp] = timestampRange.split('-->').map(s => s.trim())
    const startTime = parseSRTTimestamp(startTimestamp)
    const endTime = parseSRTTimestamp(endTimestamp)
    
    if (startTime === null || endTime === null) continue
    
    // Convert to string format (seconds only, no milliseconds for startSec/endSec)
    const startSec = String(Math.floor(startTime))
    const endSec = String(Math.floor(endTime))
    
    // Remaining lines are the subtitle text (may be multi-line)
    const text = lines.slice(2).join('\n').trim()
    
    if (timestampRange && text && startTime !== null && endTime !== null) {
      // Only include fields that exist in the database schema
      // Database fields: thai, startSec, endSec, subIndex, mediaId (set during upload)
      subtitles.push({
        index, // Used for subIndex during upload
        timestampRange, // Original timestamp string for reference
        text, // Raw text for reference
        thai: text, // Required: Thai text field
        startSec, // Required: Start time in seconds (string)
        endSec, // Required: End time in seconds (string)
        startTime, // Computed: Start time as number (for internal use)
        endTime // Computed: End time as number (for internal use)
      })
    }
  }
  
  return subtitles
}

/**
 * Unified parser that detects format and parses accordingly
 * Detects Netflix WebVTT format by looking for "WEBVTT" header, "<c.thai>" tags, or "position:" in time line
 * Otherwise falls back to classic SRT format
 * @param {string} text - Raw subtitle file content
 * @returns {Array<{index: number, text: string, startSec: string, endSec: string, startTime: number, endTime: number, ...}>} - Parsed subtitles
 */
export function parseSubtitlesFromText(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid subtitle content')
  }
  
  // Check for WebVTT format indicators
  const hasWebVTTHeader = text.trim().startsWith('WEBVTT')
  const hasNetflixTags = text.includes('<c.thai>')
  const hasPositionStyle = /^\d+\s*\n\s*\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\s+position:/.test(text)
  
  if (hasWebVTTHeader || hasNetflixTags || hasPositionStyle) {
    return parseNetflixVTTLike(text)
  } else {
    return parseSRT(text)
  }
}

/**
 * Validate SRT timestamp range format
 * @param {string} timestampRange - Format: "00:00:01,000 --> 00:00:03,500"
 * @returns {boolean}
 */
export function validateTimestampRange(timestampRange) {
  const pattern = /^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}$/
  return pattern.test(timestampRange.trim())
}


/**
 * UI Utilities - Helper functions for subtitle display components
 */

/**
 * Match token text to recordId by comparing with thaiScript
 * Utility function for UI components
 * @param {object} fatSubtitle - Fat subtitle with tokens
 * @param {number} tokenIndex - Token index
 * @returns {string|null} - thaiScript or null if not found
 */
export function matchTokenToRecordId(fatSubtitle, tokenIndex) {
  if (!fatSubtitle || !fatSubtitle.tokens || !fatSubtitle.tokens.displayThai) {
    return null;
  }
  
  const displayToken = fatSubtitle.tokens.display[tokenIndex];
  if (!displayToken || !displayToken.thaiScript) {
    return null;
  }
  
  const tokenText = displayToken.thaiScript.trim();
  if (!tokenText || tokenText.startsWith('[missing:') || tokenText.startsWith('[empty:')) {
    return null;
  }
  
  return tokenText;
}

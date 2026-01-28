/**
 * Batch Reporting Runner
 * Processes a single subtitle from gap report item
 * Executes operations and generates integrity report
 */

import { saveFatSubtitle } from '../../../05_save/save-subtitles.js';
import { inspectSubtitleChecklist } from '../workmap/schema-work-map-builder.js';
import { addressNeedsWork } from '../../process-subtitle-orchestrator.js';

/**
 * Process a single subtitle from gap report item
 * Executes operations and generates integrity report
 * @param {object} gapReportItem - Item containing subtitle and subtitleId
 * @param {number} index - Subtitle index (0-based)
 * @param {number} total - Total number of subtitles
 * @param {string} showName - Show name
 * @param {string} mediaId - Media ID
 * @param {object} episodeData - Episode data { season, episode, episodeTitle }
 * @param {Function} progressCallback - Progress callback
 * @param {object} problemCounters - Problem counters object
 * @returns {Promise<object>} { report: integrityReport, subtitleId }
 */
export async function processSingleSubtitleFromGapReport(gapReportItem, index, total, showName, mediaId, episodeData, progressCallback, problemCounters = null) {
  const subtitle = gapReportItem.subtitle; // Already flat format
  const subtitleId = gapReportItem.subtitleId;
  
  // Ensure fat bundle structure exists (guaranteed by load phase)
  // Use getEmptyFatBundleTemplate to ensure structure + merge with subtitle data
  const { generateSchemaWorkMap, getEmptyFatBundleTemplate } = await import('../workmap/schema-work-map-builder.js');
  const template = getEmptyFatBundleTemplate(subtitleId);
  
  // Build fat bundle: merge template with subtitle to ensure ALL schema fields exist
  // CRITICAL: tokens is always an object (never null) - rule enforced everywhere
  const fatBundle = { 
    ...template,  // Start with template (ensures all schema fields exist)
    ...subtitle,  // Override with actual data
    tokens: subtitle.tokens || template.tokens  // Ensure tokens structure exists
  };
  
  // Generate schemaWorkMap from fat bundle
  const schemaWorkMap = await generateSchemaWorkMap(fatBundle, subtitleId, { showName, mediaId });
  
  // Convert flat fatBundle to package format: { subtitle: {...}, tokens: {...} }
  const packageFatBundle = {
    subtitle: fatBundle,
    tokens: fatBundle.tokens || { displayThai: [], sensesThai: [], displayEnglish: [], sensesEnglish: [] }
  };
  
  // Address needs/work in fat bundle
  const processResult = await addressNeedsWork(
    packageFatBundle,
    schemaWorkMap,
    {
      mediaId,
      showName,
      episode: episodeData.episode || null,
      season: episodeData.season || null,
      problemCounters
    },
    progressCallback
  );
  const result = processResult.fat;
  
  // Extract schemaWorkMap from result
  const finalSchemaWorkMap = result.schemaWorkMap;
  const fatSubtitle = {
    subtitle: result.subtitle,
    tokens: result.tokens,
    schemaWorkMap: finalSchemaWorkMap
  };
  
  // Generate integrity report
  const integrityReport = await inspectSubtitleChecklist(result.subtitle, subtitleId, 'fat');
  
  // Save using schemaWorkMap signals
  if (result.tokens && result.tokens.displayThai && finalSchemaWorkMap) {
    await saveFatSubtitle(fatSubtitle, finalSchemaWorkMap, { showName, mediaId });
  } else {
    // Missing schemaWorkMap - skipping save
  }
  
  return { report: integrityReport, subtitleId };
}

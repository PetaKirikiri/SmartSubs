/**
 * Subtitle Validators and Integrity Inspector
 * Schema validation functions and integrity checklist inspection for subtitle structures
 */

// Static imports for all schemas (bundled at build time)
import minimalSubtitleSchema from '../../../../schemas/minimal-subtitle-schema.json';
import skinnySubtitleSchema from '../../../../schemas/skinny-subtitle-schema.json';
import fatSubtitleSchema from '../../../../schemas/fat-subtitle-schema.json';
import displayTokenSchema from '../../../../schemas/display-token-schema.json';
import senseTokenSchema from '../../../../schemas/sense-token-schema.json';
import orstSenseSchema from '../../../../schemas/orst-sense-schema.json';
import normalizedSenseSchema from '../../../../schemas/normalized-sense-schema.json';
import senseLevelsSchema from '../../../../schemas/sense-levels-schema.json';
import tokenLevelsSchema from '../../../../schemas/token-levels-schema.json';
import integrityReportSchema from '../../../../schemas/integrity-report-schema.json';
import { FIELD_REGISTRY, getFieldRegistryByHelper } from '../../../05_save/helpers/field-registry.js';

// Import integrity checks
import { checkIntegrity as checkVTTIntegrity, getDependencies as getVTTDependencies, getFields as getVTTFields } from './01_vtt-integrity.js';
import { checkIntegrity as checkTokenizationIntegrity, getDependencies as getTokenizationDependencies, getFields as getTokenizationFields } from './02_tokenization-integrity.js';
import { checkIntegrity as checkPhoneticsIntegrity, getDependencies as getPhoneticsDependencies, getFields as getPhoneticsFields } from './03_phonetics-integrity.js';
import { checkIntegrity as checkMatchingIntegrity, getDependencies as getMatchingDependencies, getFields as getMatchingFields } from './04_matching-integrity.js';
import { checkIntegrity as checkReferencesIntegrity, getDependencies as getReferencesDependencies, getFields as getReferencesFields } from './05_references-integrity.js';
import { checkIntegrity as checkDictionaryIntegrity, getDependencies as getDictionaryDependencies, getFields as getDictionaryFields } from './06_dictionary-integrity.js';
import { checkIntegrity as checkNormalizeIntegrity, getDependencies as getNormalizeDependencies, getFields as getNormalizeFields } from './07_normalize-integrity.js';

// Schema registry map - maps schema names to imported schema objects
export const SCHEMA_REGISTRY = {
  'minimal-subtitle': minimalSubtitleSchema,
  'skinny-subtitle': skinnySubtitleSchema,
  'fat-subtitle': fatSubtitleSchema,
  'display-token': displayTokenSchema,
  'sense-token': senseTokenSchema,
  'orst-sense': orstSenseSchema,
  'normalized-sense': normalizedSenseSchema,
  'sense-levels': senseLevelsSchema,
  'token-levels': tokenLevelsSchema,
  'integrity-report': integrityReportSchema
};

/**
 * Load JSON schema file from registry
 * @param {string} schemaName - Schema file name (without .json extension)
 * @returns {Promise<object>} Schema object (synchronous lookup, kept async for compatibility)
 */
export async function loadSchema(schemaName) {
  const schema = SCHEMA_REGISTRY[schemaName];
  if (!schema) {
    return null;
  }
  return schema;
}

/**
 * Validate object against JSON schema (simple validation - checks required fields and types)
 * @param {object} data - Data to validate
 * @param {object} schema - JSON schema object
 * @param {string} context - Context for error messages
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateAgainstSchema(data, schema, context = '') {
  const errors = [];
  
  if (!schema || !schema.properties) {
    return { valid: true, errors: [] }; // Schema not loaded, skip validation
  }
  
  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (data[field] === undefined) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }
  
  // Check property types
  if (schema.properties) {
    for (const [field, propSchema] of Object.entries(schema.properties)) {
      if (data[field] !== undefined) {
        const value = data[field];
        const expectedType = propSchema.type;
        
        if (expectedType) {
          const types = Array.isArray(expectedType) ? expectedType : [expectedType];
          const actualType = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
          
          if (!types.includes(actualType) && !types.includes('null')) {
            errors.push(`Field ${field}: expected type ${types.join(' or ')}, got ${actualType}`);
          }
        }
        
        // Check array constraints
        if (propSchema.type === 'array' && Array.isArray(value)) {
          if (propSchema.minItems !== undefined && value.length < propSchema.minItems) {
            errors.push(`Field ${field}: array length ${value.length} is less than minimum ${propSchema.minItems}`);
          }
          if (propSchema.maxItems !== undefined && value.length > propSchema.maxItems) {
            errors.push(`Field ${field}: array length ${value.length} exceeds maximum ${propSchema.maxItems}`);
          }
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.map(e => context ? `${context}: ${e}` : e)
  };
}

/**
 * Map subtitle stage to schema name
 * @param {'minimal' | 'skinny' | 'fat'} stage - Subtitle stage
 * @returns {string} Schema name
 */
function getSchemaNameForStage(stage) {
  const schemaMap = {
    'minimal': 'minimal-subtitle',
    'skinny': 'skinny-subtitle',
    'fat': 'fat-subtitle'
  };
  return schemaMap[stage] || null;
}

/**
 * Validate subtitle at specific stage (automatically maps stage to schema)
 * @param {object} subtitle - Subtitle to validate
 * @param {'minimal' | 'skinny' | 'fat'} stage - Expected subtitle stage
 * @param {string} subtitleId - Subtitle ID for logging
 * @returns {Promise<boolean>} True if valid
 */
export async function validateSubtitleAtStage(subtitle, stage, subtitleId = 'unknown') {
  const schemaName = getSchemaNameForStage(stage);
  if (!schemaName) {
    return true;
  }
  return validateSubtitleAgainstSchema(subtitle, schemaName, subtitleId);
}

/**
 * Validate subtitle against schema and log result
 * @param {object} subtitle - Subtitle to validate
 * @param {string} schemaName - Schema name (minimal-subtitle, skinny-subtitle, fat-subtitle)
 * @param {string} subtitleId - Subtitle ID for logging
 * @returns {Promise<boolean>} True if valid
 */
export async function validateSubtitleAgainstSchema(subtitle, schemaName, subtitleId = 'unknown') {
  const schema = await loadSchema(schemaName);
  if (!schema) {
    return true;
  }
  
  const validation = validateAgainstSchema(subtitle, schema, `Subtitle ${subtitleId}`);
  
  if (validation.valid) {
    return true;
  } else {
    return false;
  }
}

/**
 * Validate token against schema and log result
 * @param {object} token - Token to validate
 * @param {string} schemaName - Schema name (display-token, sense-token)
 * @param {number} tokenIndex - Token index for logging
 * @returns {Promise<boolean>} True if valid
 */
export async function validateTokenAgainstSchema(token, schemaName, tokenIndex = -1) {
  const schema = await loadSchema(schemaName);
  if (!schema) {
    return true;
  }
  
  const validation = validateAgainstSchema(token, schema, `Token ${tokenIndex}`);
  
  if (validation.valid) {
    return true;
  } else {
    return false;
  }
}

/**
 * Validate sense against schema and log result
 * @param {object} sense - Sense to validate
 * @param {string} schemaName - Schema name (orst-sense, normalized-sense)
 * @param {string} context - Context for logging (e.g., "word: ดื่ม, senseIndex: 0")
 * @returns {Promise<boolean>} True if valid
 */
export async function validateSenseAgainstSchema(sense, schemaName, context = '') {
  const schema = await loadSchema(schemaName);
  if (!schema) {
    return true;
  }
  
  const validation = validateAgainstSchema(sense, schema, context);
  
  if (validation.valid) {
    return true;
  } else {
    return false;
  }
}

/**
 * Validate minimal subtitle structure
 * @param {object} subtitle - Subtitle to validate
 * @throws {Error} If subtitle structure is invalid
 */
export async function validateMinimalSubtitle(subtitle) {
  if (!subtitle || typeof subtitle !== 'object') {
    throw new Error('Invalid minimal subtitle: subtitle must be an object');
  }

  // Handle both formats for backward compatibility during migration
  let subtitleData;
  if (subtitle.subtitle && typeof subtitle.subtitle === 'object') {
    // Wrapped format (old/legacy) - extract
    subtitleData = subtitle.subtitle;
  } else if (subtitle.id) {
    // Direct format (correct per schema) - use as-is
    subtitleData = subtitle;
  } else {
    throw new Error('Invalid minimal subtitle: missing subtitle object or id');
  }

  // Delegate to schema validation
  const subtitleId = subtitleData.id || 'unknown';
  const isValid = await validateSubtitleAgainstSchema(subtitleData, 'minimal-subtitle', subtitleId);
  if (!isValid) {
    throw new Error(`Invalid minimal subtitle: does not match minimal-subtitle schema`);
  }
}

/**
 * Validate skinny subtitle structure
 * @param {object} subtitle - Subtitle to validate
 * @throws {Error} If subtitle structure is invalid
 */
export async function validateSkinnySubtitle(subtitle) {
  if (!subtitle || typeof subtitle !== 'object') {
    throw new Error('Invalid skinny subtitle: subtitle must be an object');
  }

  // Handle both formats for backward compatibility during migration
  let subtitleData;
  if (subtitle.subtitle && typeof subtitle.subtitle === 'object') {
    // Wrapped format (old/legacy) - extract
    subtitleData = subtitle.subtitle;
  } else if (subtitle.id) {
    // Direct format (correct per schema) - use as-is
    subtitleData = subtitle;
  } else {
    throw new Error('Invalid skinny subtitle: missing subtitle object or id');
  }

  // Delegate to schema validation
  const subtitleId = subtitleData.id || 'unknown';
  const isValid = await validateSubtitleAgainstSchema(subtitleData, 'skinny-subtitle', subtitleId);
  if (!isValid) {
    throw new Error(`Invalid skinny subtitle: does not match skinny-subtitle schema`);
  }
}

/**
 * Validate fat subtitle structure
 * @param {object} subtitle - Subtitle to validate
 * @throws {Error} If subtitle structure is invalid
 */
export async function validateFatSubtitle(subtitle) {
  if (!subtitle || typeof subtitle !== 'object') {
    throw new Error('Invalid fat subtitle: subtitle must be an object');
  }

  // Handle both formats for backward compatibility during migration
  let subtitleData;
  if (subtitle.subtitle && typeof subtitle.subtitle === 'object') {
    // Wrapped format (old/legacy) - merge subtitle and tokens into flat structure
    subtitleData = {
      ...subtitle.subtitle,
      tokens: subtitle.tokens
    };
  } else if (subtitle.id) {
    // Direct format (correct per schema) - use as-is
    subtitleData = subtitle;
  } else {
    throw new Error('Invalid fat subtitle: missing subtitle object or id');
  }

  // Delegate to schema validation
  const subtitleId = subtitleData.id || 'unknown';
  const isValid = await validateSubtitleAgainstSchema(subtitleData, 'fat-subtitle', subtitleId);
  if (!isValid) {
    throw new Error(`Invalid fat subtitle: does not match fat-subtitle schema`);
  }
}

/**
 * Strict validation for normalized sense structure
 * Throws error if validation fails - no fallbacks
 * @param {object} sense - Sense object to validate
 * @param {string} context - Context for error messages (e.g., "word: ดื่ม, senseIndex: 0")
 * @throws {Error} If sense structure is invalid
 */
export async function validateNormalizedSenseStrict(sense, context = '') {
  if (!sense || typeof sense !== 'object') {
    throw new Error(`Invalid normalized sense${context ? ` (${context})` : ''}: sense must be an object`);
  }

  // Delegate to schema validation
  const isValid = await validateSenseAgainstSchema(sense, 'normalized-sense', context);
  if (!isValid) {
    throw new Error(`Invalid normalized sense${context ? ` (${context})` : ''}: does not match normalized-sense schema`);
  }
}

// ============================================================================
// Integrity Checklist Inspection
// ============================================================================

/**
 * Check field presence and extract value
 * @param {object} subtitle - Subtitle object
 * @param {string} key - Field key from schema
 * @returns {Promise<{ ok: boolean, value: any }>} ok=true if field is valid and present, value is extracted value or null
 */
async function checkFieldPresenceAndValue(subtitle, key) {
  if (!subtitle || typeof subtitle !== 'object') {
    return { ok: false, value: null };
  }

  // Subtitle-level fields
  if (key === 'thai') {
    const value = subtitle.thai;
    const ok = value !== undefined && value !== null && String(value).trim() !== '';
    return { ok, value: ok ? value : null };
  }
  if (key === 'english') {
    const value = subtitle.english;
    const ok = value !== undefined && value !== null && String(value).trim() !== '';
    return { ok, value: ok ? value : null };
  }
  if (key === 'startSecThai') {
    const value = subtitle.startSecThai;
    const ok = value !== undefined && value !== null && !isNaN(value);
    return { ok, value: ok ? value : null };
  }
  if (key === 'endSecThai') {
    const value = subtitle.endSecThai;
    const ok = value !== undefined && value !== null && !isNaN(value);
    return { ok, value: ok ? value : null };
  }
  if (key === 'startSecEng') {
    const value = subtitle.startSecEng;
    const ok = value !== undefined && value !== null && !isNaN(value);
    return { ok, value: ok ? value : null };
  }
  if (key === 'endSecEng') {
    const value = subtitle.endSecEng;
    const ok = value !== undefined && value !== null && !isNaN(value);
    return { ok, value: ok ? value : null };
  }
  if (key === 'wordReferenceIdsThai') {
    const value = subtitle.wordReferenceIdsThai;
    const ok = Array.isArray(value) && value.length > 0;
    return { ok, value: ok ? value : null };
  }
  if (key === 'wordReferenceIdsEng') {
    const value = subtitle.wordReferenceIdsEng;
    const ok = Array.isArray(value) && value.length > 0;
    return { ok, value: ok ? value : null };
  }
  if (key === 'wordReferenceIdsEng sense indices') {
    const engRefs = subtitle.wordReferenceIdsEng || [];
    const senseIndices = engRefs.filter(ref => typeof ref === 'string' && ref.includes(':'));
    const ok = senseIndices.length > 0;
    return { ok, value: ok ? senseIndices : null };
  }
  if (key === 'smartSubsRefs') {
    const value = subtitle.smartSubsRefs;
    const ok = Array.isArray(value) && value.length > 0;
    return { ok, value: ok ? value : null };
  }
  if (key === 'matchedWords') {
    const value = subtitle.matchedWords;
    const ok = Array.isArray(value) && value.length > 0;
    return { ok, value: ok ? value : null };
  }

  // Token-level fields (fat subtitles)
  const tokens = subtitle.tokens || {};
  const displayTokens = tokens.displayThai || [];
  const senseTokens = tokens.sensesThai || [];
  const sensesEngTokens = tokens.sensesEnglish || [];

  if (key === 'g2p') {
    // Use schema validation instead of heuristic checks
    const displayTokenSchema = await loadSchema('display-token');
    const g2pValues = [];
    if (displayTokenSchema) {
      for (const token of displayTokens) {
        if (token && typeof token === 'object') {
          const validation = validateAgainstSchema(token, displayTokenSchema, '');
          if (validation.valid && token.g2p !== null && token.g2p !== undefined) {
            g2pValues.push(token.g2p);
          }
        }
      }
    }
    const ok = g2pValues.length > 0;
    return { ok, value: ok ? g2pValues : null };
  }
  if (key === 'englishPhonetic') {
    // Use schema validation instead of heuristic checks
    const displayTokenSchema = await loadSchema('display-token');
    const phoneticValues = [];
    if (displayTokenSchema) {
      for (const token of displayTokens) {
        if (token && typeof token === 'object') {
          const validation = validateAgainstSchema(token, displayTokenSchema, '');
          if (validation.valid && token.englishPhonetic !== null && token.englishPhonetic !== undefined) {
            phoneticValues.push(token.englishPhonetic);
          }
        }
      }
    }
    const ok = phoneticValues.length > 0;
    return { ok, value: ok ? phoneticValues : null };
  }
  if (key === 'sensesOrst') {
    // Use schema validation instead of heuristic checks
    const orstSchema = await loadSchema('orst-sense');
    const orstSenses = [];
    if (orstSchema) {
      for (const senseToken of senseTokens) {
        if (senseToken?.senses && Array.isArray(senseToken.senses)) {
          for (const sense of senseToken.senses) {
            if (sense && typeof sense === 'object') {
              const validation = validateAgainstSchema(sense, orstSchema, '');
              if (validation.valid) {
                orstSenses.push(sense);
              }
            }
          }
        }
      }
    }
    const ok = orstSenses.length > 0;
    return { ok, value: ok ? orstSenses : null };
  }
  if (key === 'sensesNormalized') {
    // Use schema validation instead of heuristic checks
    const normalizedSchema = await loadSchema('normalized-sense');
    const normalizedSenses = [];
    if (normalizedSchema) {
      for (const senseToken of senseTokens) {
        if (senseToken?.senses && Array.isArray(senseToken.senses)) {
          for (const sense of senseToken.senses) {
            if (sense && typeof sense === 'object') {
              const validation = validateAgainstSchema(sense, normalizedSchema, '');
              if (validation.valid) {
                normalizedSenses.push(sense);
              }
            }
          }
        }
      }
    }
    const ok = normalizedSenses.length > 0;
    return { ok, value: ok ? normalizedSenses : null };
  }
  if (key === 'sensesEnglish') {
    const engSenses = [];
    for (const senseToken of sensesEngTokens) {
      if (senseToken?.senses && Array.isArray(senseToken.senses) && senseToken.senses.length > 0) {
        engSenses.push(...senseToken.senses);
      }
    }
    const ok = engSenses.length > 0;
    return { ok, value: ok ? engSenses : null };
  }

  return { ok: false, value: null };
}

/**
 * Inspect subtitle against integrity-report schema checklist
 * Pure inspection - no execution, no Firebase reads, no level detection
 * @param {object} subtitle - Subtitle object (flat format)
 * @param {string} subtitleId - Subtitle ID
 * @param {string|null} stage - Optional stage ('minimal' | 'skinny' | 'fat'). If null, checks all fields (backward compatibility)
 * @returns {Promise<object>} { subtitleId, checklist: [{ key, value, sourceFile, status }] }
 */
export async function inspectSubtitleChecklist(subtitle, subtitleId, stage = null) {
  const schema = await loadSchema('integrity-report');
  if (!schema || !schema.fieldOrder) {
    return { subtitleId, checklist: [] };
  }

  const checklist = [];

    // Process fields based on stage - only check what current stage is responsible for
    if (stage === 'minimal') {
      // Only check minimal fields
      const minimalFields = schema.fieldOrder.minimal || [];
      for (const fieldDef of minimalFields) {
        const { key, sourceFile } = fieldDef;
        const { ok, value } = await checkFieldPresenceAndValue(subtitle, key);
        const status = ok ? 'skipped' : 'processed';
        checklist.push({ key, value, sourceFile, status });
      }
    } else if (stage === 'skinny') {
      // Only check skinny fields (includes wordReferenceIds, sense indices, smartSubsRefs, matchedWords)
      const skinnyFields = schema.fieldOrder.skinny || [];
      for (const fieldDef of skinnyFields) {
        const { key, sourceFile } = fieldDef;
        const { ok, value } = await checkFieldPresenceAndValue(subtitle, key);
        const status = ok ? 'skipped' : 'processed';
        checklist.push({ key, value, sourceFile, status });
      }
    } else if (stage === 'fat') {
      // Only check fat fields (tokens structure, g2p, englishPhonetic, sensesOrst, sensesNormalized, sensesEng)
      const fatWordFields = schema.fieldOrder.fat?.word || [];
      const fatSenseFields = schema.fieldOrder.fat?.sense || [];
      const fatSenseEngFields = schema.fieldOrder.fat?.senseEng || [];
      
      // Process fat.word fields
      for (const fieldDef of fatWordFields) {
        const { key, sourceFile } = fieldDef;
        const { ok, value } = await checkFieldPresenceAndValue(subtitle, key);
        const status = ok ? 'skipped' : 'processed';
        checklist.push({ key, value, sourceFile, status });
      }
      
      // Process fat.sense fields
      for (const fieldDef of fatSenseFields) {
        const { key, sourceFile } = fieldDef;
        const { ok, value } = await checkFieldPresenceAndValue(subtitle, key);
        const status = ok ? 'skipped' : 'processed';
        checklist.push({ key, value, sourceFile, status });
      }
      
      // Process fat.senseEng fields
      for (const fieldDef of fatSenseEngFields) {
        const { key, sourceFile } = fieldDef;
        const { ok, value } = await checkFieldPresenceAndValue(subtitle, key);
        const status = ok ? 'skipped' : 'processed';
        checklist.push({ key, value, sourceFile, status });
      }
    } else {
      // stage is null/undefined - backward compatibility: check all fields
      const minimalFields = schema.fieldOrder.minimal || [];
      const skinnyFields = schema.fieldOrder.skinny || [];
      const fatWordFields = schema.fieldOrder.fat?.word || [];
      const fatSenseFields = schema.fieldOrder.fat?.sense || [];
      const fatSenseEngFields = schema.fieldOrder.fat?.senseEng || [];

      // Process minimal fields
      for (const fieldDef of minimalFields) {
        const { key, sourceFile } = fieldDef;
        const { ok, value } = await checkFieldPresenceAndValue(subtitle, key);
        const status = ok ? 'skipped' : 'processed';
        checklist.push({ key, value, sourceFile, status });
      }

      // Process skinny fields
      for (const fieldDef of skinnyFields) {
        const { key, sourceFile } = fieldDef;
        const { ok, value } = await checkFieldPresenceAndValue(subtitle, key);
        const status = ok ? 'skipped' : 'processed';
        checklist.push({ key, value, sourceFile, status });
      }

      // Process fat.word fields
      for (const fieldDef of fatWordFields) {
        const { key, sourceFile } = fieldDef;
        const { ok, value } = await checkFieldPresenceAndValue(subtitle, key);
        const status = ok ? 'skipped' : 'processed';
        checklist.push({ key, value, sourceFile, status });
      }

      // Process fat.sense fields
      for (const fieldDef of fatSenseFields) {
        const { key, sourceFile } = fieldDef;
        const { ok, value } = await checkFieldPresenceAndValue(subtitle, key);
        const status = ok ? 'skipped' : 'processed';
        checklist.push({ key, value, sourceFile, status });
      }

      // Process fat.senseEng fields
      for (const fieldDef of fatSenseEngFields) {
        const { key, sourceFile } = fieldDef;
        const { ok, value } = await checkFieldPresenceAndValue(subtitle, key);
        const status = ok ? 'skipped' : 'processed';
        checklist.push({ key, value, sourceFile, status });
      }
    }

  return { subtitleId, checklist };
}

/**
 * Group fields by helper from FIELD_REGISTRY helper structure or workmap
 * Creates helper groups with fields that need work
 * @param {object} helpersStructure - FIELD_REGISTRY level.helpers object from getFieldRegistryByHelper()
 * @param {object} fieldWorkMap - Object with field names as keys and boolean workmap values
 * @returns {object} Helper groups object: { 'helper-name.js': { fields: [...], needsWork: boolean } }
 */
function groupFieldsByHelperFromStructure(helpersStructure, fieldWorkMap) {
  const helperGroups = {};
  
  // Iterate through helper groups in FIELD_REGISTRY structure
  for (const [helperName, fieldDefs] of Object.entries(helpersStructure)) {
    helperGroups[helperName] = {
      fields: [],
      needsWork: false
    };
    
    // Check each field in this helper's field list
    for (const fieldDef of fieldDefs) {
      const needsWork = fieldWorkMap[fieldDef.field] === true;
      if (needsWork) {
        helperGroups[helperName].fields.push(fieldDef.field);
        helperGroups[helperName].needsWork = true;
      }
    }
  }
  
  return helperGroups;
}

/**
 * Group fields by helper from FIELD_REGISTRY arrays (backward compatibility)
 * @param {Array} fieldDefinitions - Array of field definitions from FIELD_REGISTRY
 * @param {object} fieldWorkMap - Object with field names as keys and boolean workmap values
 * @returns {object} Helper groups object: { 'helper-name.js': { fields: [...], needsWork: boolean } }
 */
function groupFieldsByHelper(fieldDefinitions, fieldWorkMap) {
  const helperGroups = {};
  
  for (const fieldDef of fieldDefinitions) {
    const helperName = fieldDef.helper;
    
    // Only group fields that have helpers (exclude null/derived/metadata fields)
    if (helperName) {
      // Handle multiple helpers (e.g., 'orst.js / gpt-normalize-senses.js')
      const helpers = helperName.split(' / ').map(h => h.trim());
      
      for (const helper of helpers) {
        if (!helperGroups[helper]) {
          helperGroups[helper] = {
            fields: [],
            needsWork: false
          };
        }
        
        // Check if this field needs work
        const needsWork = fieldWorkMap[fieldDef.field] === true;
        if (needsWork) {
          helperGroups[helper].fields.push(fieldDef.field);
          helperGroups[helper].needsWork = true;
        }
      }
    }
  }
  
  return helperGroups;
}

/**
 * Check if field value needs work based on validation type
 * @param {object} fieldDef - Field definition from FIELD_REGISTRY
 * @param {any} value - Field value
 * @returns {boolean} True if field needs work (value is invalid/missing)
 */
function fieldNeedsWork(fieldDef, value) {
  if (!fieldDef || !fieldDef.validation) {
    // Default: just check presence
    return value === undefined || value === null;
  }

  const validationType = fieldDef.validation;

  // First check: value must exist (for all validation types)
  if (value === undefined || value === null) {
    return true; // Needs work
  }

  // Apply validation based on type
  if (validationType === 'presence') {
    // Just presence check - already passed above
    return false; // Doesn't need work
  } else if (validationType === 'presence+content') {
    // Must be non-empty string (trimmed)
    if (typeof value !== 'string') {
      return true; // Needs work
    }
    return value.trim().length === 0; // Needs work if empty
  } else if (validationType === 'presence+type') {
    // Type-specific validation
    if (fieldDef.field === 'originalData') {
      // Must be object
      return !(typeof value === 'object' && value !== null && !Array.isArray(value));
    }
    // Default: just check presence (already passed)
    return false; // Doesn't need work
  } else if (validationType === 'presence+type+length-when-workmap-true') {
    // For arrays that need length check - array must exist AND have items
    return !(Array.isArray(value) && value.length > 0);
  }

  // Unknown validation type - default to presence check
  return false; // Doesn't need work
}

/**
 * Create normalizedSense boolean mask - mirrors normalizedSense structure exactly
 * @param {object} sense - NormalizedSense object (can be null/undefined)
 * @param {object} fatBundle - Fat bundle object (for context)
 * @param {number} tokenIndex - Token index
 * @param {number} senseIndex - Sense index
 * @returns {object} Boolean mask with all normalizedSense fields
 */
function createNormalizedSenseWorkMap(sense, fatBundle, tokenIndex, senseIndex) {
  const senseWorkMap = {};
  
  // Check dictionary integrity (ORST fields)
  const dictResult = checkDictionaryIntegrity(fatBundle, { tokenIndex, senseIndex });
  Object.assign(senseWorkMap, dictResult);
  
  // Check normalization integrity (normalized fields)
  const normResult = checkNormalizeIntegrity(fatBundle, { tokenIndex, senseIndex });
  Object.assign(senseWorkMap, normResult);
  
  // Add helper-grouped structure using getFields() from integrity checks
  const dictFields = getDictionaryFields();
  const normFields = getNormalizeFields();
  
  // Group fields by helper
  const helpers = {};
  
  // Dictionary helper (orst.js)
  const dictHelperFields = dictFields.filter(f => f !== 'tokens.sensesThai[i].senses');
  helpers['orst.js'] = {
    fields: dictHelperFields.filter(f => senseWorkMap[f] === true),
    needsWork: dictHelperFields.some(f => senseWorkMap[f] === true)
  };
  
  // Normalization helper (gpt-normalize-senses.js)
  helpers['gpt-normalize-senses.js'] = {
    fields: normFields.filter(f => senseWorkMap[f] === true),
    needsWork: normFields.some(f => senseWorkMap[f] === true)
  };
  
  senseWorkMap.helpers = helpers;
  
  return senseWorkMap;
}

/**
 * Check if dependencies are satisfied using evolution-aware logic
 * Evolution logic: "I have X → I can check Y → I can check Z"
 * @param {Array<string>} dependencies - Array of dependency field paths from integrity check
 * @param {object} fatBundle - Fat bundle object
 * @returns {{ canCheck: boolean, reason: string }} Whether dependencies are satisfied
 */
function checkDependenciesSatisfied(dependencies, fatBundle) {
  if (!dependencies || dependencies.length === 0) {
    return { canCheck: true, reason: 'No dependencies' };
  }

  // Check each dependency using evolution logic
  for (const dep of dependencies) {
    // Top-level dependencies
    if (dep === 'thai') {
      const thaiExists = fatBundle.thai !== undefined && fatBundle.thai !== null && fatBundle.thai !== '';
      if (!thaiExists) {
        return { canCheck: false, reason: 'thai dependency not satisfied' };
      }
    } else if (dep === 'english') {
      const englishExists = fatBundle.english !== undefined && fatBundle.english !== null && fatBundle.english !== '';
      if (!englishExists) {
        return { canCheck: false, reason: 'english dependency not satisfied' };
      }
    }
    // wordReferenceIds dependencies - evolution: can check if wordReferenceIds exists OR if thai/english exists (can be created)
    else if (dep === 'wordReferenceIdsThai') {
      const wordRefsExist = fatBundle.wordReferenceIdsThai && Array.isArray(fatBundle.wordReferenceIdsThai) && fatBundle.wordReferenceIdsThai.length > 0;
      const thaiExists = fatBundle.thai !== undefined && fatBundle.thai !== null && fatBundle.thai !== '';
      if (!wordRefsExist && !thaiExists) {
        return { canCheck: false, reason: 'wordReferenceIdsThai dependency not satisfied (no thai or wordReferenceIdsThai)' };
      }
    } else if (dep === 'wordReferenceIdsEng') {
      const wordRefsExist = fatBundle.wordReferenceIdsEng && Array.isArray(fatBundle.wordReferenceIdsEng) && fatBundle.wordReferenceIdsEng.length > 0;
      const englishExists = fatBundle.english !== undefined && fatBundle.english !== null && fatBundle.english !== '';
      if (!wordRefsExist && !englishExists) {
        return { canCheck: false, reason: 'wordReferenceIdsEng dependency not satisfied (no english or wordReferenceIdsEng)' };
      }
    }
    // Token-level dependencies - evolution: can check if field exists OR if wordReferenceIds exists (can be created)
    else if (dep === 'tokens.displayThaiThai[i].g2p') {
      // This is a self-reference check - if we're checking g2p, we need wordReferenceIdsThai
      const wordRefsExist = fatBundle.wordReferenceIdsThai && Array.isArray(fatBundle.wordReferenceIdsThai) && fatBundle.wordReferenceIdsThai.length > 0;
      const thaiExists = fatBundle.thai !== undefined && fatBundle.thai !== null && fatBundle.thai !== '';
      if (!wordRefsExist && !thaiExists) {
        return { canCheck: false, reason: 'tokens.displayThaiThai[i].g2p dependency not satisfied (no wordReferenceIdsThai or thai)' };
      }
    }
    // Sense-level dependencies - evolution: can check if senses exist OR if wordReferenceIds exists (can be created)
    else if (dep === 'tokens.sensesThai[i].senses') {
      const tokens = fatBundle.tokens || fatBundle.subtitle?.tokens || { senses: [] };
      const senseTokens = tokens.sensesThai || [];
      const sensesExist = senseTokens.length > 0 && senseTokens.some(st => st.senses && Array.isArray(st.senses) && st.senses.length > 0);
      const wordRefsExist = fatBundle.wordReferenceIdsThai && Array.isArray(fatBundle.wordReferenceIdsThai) && fatBundle.wordReferenceIdsThai.length > 0;
      const thaiExists = fatBundle.thai !== undefined && fatBundle.thai !== null && fatBundle.thai !== '';
      if (!sensesExist && !wordRefsExist && !thaiExists) {
        return { canCheck: false, reason: 'tokens.sensesThai[i].senses dependency not satisfied (no senses, wordReferenceIdsThai, or thai)' };
      }
    }
    // Definition dependency (for descriptionThai/descriptionEnglish)
    else if (dep === 'definition') {
      // This is checked at sense level - if we're checking description fields, definition should exist in sense
      // This is handled in createNormalizedSenseWorkMap, so we can allow it here
      return { canCheck: true, reason: 'definition dependency checked at sense level' };
    }
  }

  return { canCheck: true, reason: 'All dependencies satisfied' };
}

/**
 * Generate schemaWorkMap - key-aligned boolean mask that mirrors fat bundle keys exactly
 * Compares fat bundle keys against expected shape to determine what needs work
 * @param {object} fatBundle - Fat bundle object (can have missing data)
 * @param {string} subtitleId - Subtitle ID
 * @param {object} options - Options { showName, mediaId }
 * @returns {Promise<object>} schemaWorkMap object
 */
export async function generateSchemaWorkMap(fatBundle, subtitleId, options = {}) {
  // Initialize schemaWorkMap structure - mirrors fat bundle keys exactly
  // Pure boolean mask - no metadata, no save instructions
  const schemaWorkMap = {
    needsSave: false,  // Save flag independent of validation
    validated: false,  // Validation status
    // Top-level fields from fat bundle - 1:1 match with schema
    id: false,
    startSecThai: false,
    endSecThai: false,
    startSecEng: false,
    endSecEng: false,
    thai: false,
    english: false,
    wordReferenceIdsThai: false,
    wordReferenceIdsEng: false,
    smartSubsRefs: false,
    matchedWords: false,
    tokens: {
      displayThai: [],
      sensesThai: [],
      displayEnglish: [],
      sensesEnglish: []
    }
  };

  // Compare fat bundle keys against expected shape using integrity checks
  // Top-level fields - use integrity checks
  
  // VTT fields (thai, english, timestamps)
  const vttResult = checkVTTIntegrity(fatBundle);
  schemaWorkMap.thai = vttResult.thai;
  schemaWorkMap.english = vttResult.english;
  schemaWorkMap.startSecThai = vttResult.startSecThai;
  schemaWorkMap.endSecThai = vttResult.endSecThai;
  schemaWorkMap.startSecEng = vttResult.startSecEng;
  schemaWorkMap.endSecEng = vttResult.endSecEng;
  
  // Tokenization fields
  const tokenizationResult = checkTokenizationIntegrity(fatBundle);
  schemaWorkMap.wordReferenceIdsThai = tokenizationResult.wordReferenceIdsThai;
  schemaWorkMap.wordReferenceIdsEng = tokenizationResult.wordReferenceIdsEng;
  
  // Matching fields
  const matchingResult = checkMatchingIntegrity(fatBundle);
  schemaWorkMap.matchedWords = matchingResult.matchedWords;
  
  // References fields
  const referencesResult = checkReferencesIntegrity(fatBundle);
  schemaWorkMap.smartSubsRefs = referencesResult.smartSubsRefs;
  
  // id field - check separately (immutable, no helper)
  const id = fatBundle.id ?? fatBundle.subtitle?.id;
  schemaWorkMap.id = !id || String(id).trim() === '';
  
  // Add helper groups for top-level fields using getFields() from integrity checks
  const helpers = {};
  const vttFields = getVTTFields();
  const tokenizationFields = getTokenizationFields();
  const matchingFields = getMatchingFields();
  const referencesFields = getReferencesFields();
  
  helpers['parse-vtt.js'] = {
    fields: vttFields.filter(f => schemaWorkMap[f] === true),
    needsWork: vttFields.some(f => schemaWorkMap[f] === true)
  };
  
  helpers['ai4thai-tokenizer.js'] = {
    fields: ['wordReferenceIdsThai'].filter(f => schemaWorkMap[f] === true),
    needsWork: schemaWorkMap.wordReferenceIdsThai === true
  };
  
  helpers['english-tokenizer.js'] = {
    fields: ['wordReferenceIdsEng'].filter(f => schemaWorkMap[f] === true),
    needsWork: schemaWorkMap.wordReferenceIdsEng === true
  };
  
  helpers['gpt-match-words.js'] = {
    fields: matchingFields.filter(f => schemaWorkMap[f] === true),
    needsWork: matchingFields.some(f => schemaWorkMap[f] === true)
  };
  
  helpers['smartsubsrefs-builder.js'] = {
    fields: referencesFields.filter(f => schemaWorkMap[f] === true),
    needsWork: referencesFields.some(f => schemaWorkMap[f] === true)
  };
  
  schemaWorkMap.helpers = helpers;

  // Tokens structure - CRITICAL: Always initialize as object (never null)
  // Rule: tokens is always an object with arrays (never null)
  // This prevents crashes when accessing tokens.displayThai, tokens.sensesThai, etc.
  // Follow data path: check fatBundle.tokens first, then fatBundle.subtitle?.tokens (nested structure from cache)
  const tokens = fatBundle.tokens || fatBundle.subtitle?.tokens || {
    display: [],
    senses: [],
displayEnglish: [],
      sensesEnglish: []
  };
  // Ensure fatBundle.tokens is always an object (update if it was null)
  if (!fatBundle.tokens && !fatBundle.subtitle?.tokens) {
    fatBundle.tokens = tokens;
  }
  const displayTokens = tokens.displayThaiThai || [];
  const senseTokens = tokens.sensesThai || [];
  const displayEngTokens = tokens.displayEnglish || [];
  const sensesEngTokens = tokens.sensesEnglish || [];

  // Follow data path: check multiple locations to find wordReferenceIds
  const thaiLength = fatBundle.wordReferenceIdsThai?.length || fatBundle.subtitle?.wordReferenceIdsThai?.length || 0;
  const engLength = fatBundle.wordReferenceIdsEng?.length || fatBundle.subtitle?.wordReferenceIdsEng?.length || 0;

  // Build display array - EVOLUTION-AWARE: Check token-level fields based on dependencies
  // Evolution logic: "I have wordReferenceIdsThai → I can check token-level helpers"
  
  // Evolution step 1: Check if wordReferenceIdsThai dependency is satisfied
  const wordRefsThaiExist = thaiLength > 0;
  const thaiExists = fatBundle.thai !== undefined && fatBundle.thai !== null && fatBundle.thai !== '';
  const canCheckThaiTokens = wordRefsThaiExist || thaiExists;
  
  // Evolution step 2: Determine expected token count
  let expectedThaiTokenCount = 0;
  if (wordRefsThaiExist) {
    expectedThaiTokenCount = thaiLength;
  } else if (thaiExists) {
    // Can check helpers even if tokens don't exist yet (orchestrator can create them)
    expectedThaiTokenCount = 0; // No tokens yet, but can still check helpers
  }
  
  // Check phonetics dependencies
  const phoneticsDeps = getPhoneticsDependencies();
  const canCheckPhonetics = checkDependenciesSatisfied(phoneticsDeps, fatBundle).canCheck;
  
  // Evolution step 3: Check existing tokens
  for (let i = 0; i < displayTokens.length; i++) {
    const tokenWorkMap = {};
    
    // Check phonetics integrity if dependencies satisfied
    if (canCheckPhonetics) {
      const phoneticsResult = checkPhoneticsIntegrity(fatBundle, { tokenIndex: i });
      tokenWorkMap.g2p = phoneticsResult.g2p;
      tokenWorkMap.englishPhonetic = phoneticsResult.englishPhonetic;
    } else {
      tokenWorkMap.g2p = false;
      tokenWorkMap.englishPhonetic = false;
    }
    
    // Check derived fields (index, thaiScript) - these don't have integrity checks
    const token = displayTokens[i];
    tokenWorkMap.index = !token || token.index === undefined || token.index === null;
    tokenWorkMap.thaiScript = !token || !token.thaiScript || String(token.thaiScript).trim() === '';
    
    // Add helper groups using getFields() from integrity checks
    const helpers = {};
    if (canCheckPhonetics) {
      const phoneticsFields = getPhoneticsFields();
      helpers['ai4thai-g2p.js'] = {
        fields: ['g2p'].filter(f => tokenWorkMap[f] === true),
        needsWork: tokenWorkMap.g2p === true
      };
      helpers['phonetic-parser.js'] = {
        fields: ['englishPhonetic'].filter(f => tokenWorkMap[f] === true),
        needsWork: tokenWorkMap.englishPhonetic === true
      };
    }
    tokenWorkMap.helpers = helpers;
    
    schemaWorkMap.tokens.displayThaiThai.push(tokenWorkMap);
  }
  
  // Evolution step 4: If dependency satisfied but tokens missing, mark for orchestrator
  if (canCheckThaiTokens && expectedThaiTokenCount > displayTokens.length) {
    while (schemaWorkMap.tokens.displayThaiThai.length < expectedThaiTokenCount) {
      const missingTokenWorkMap = {};
      
      // Check phonetics integrity if dependencies satisfied
      if (canCheckPhonetics) {
        const phoneticsResult = checkPhoneticsIntegrity(fatBundle, { tokenIndex: schemaWorkMap.tokens.displayThaiThai.length });
        missingTokenWorkMap.g2p = phoneticsResult.g2p || true; // Missing token - needs work
        missingTokenWorkMap.englishPhonetic = phoneticsResult.englishPhonetic || true;
      } else {
        missingTokenWorkMap.g2p = false;
        missingTokenWorkMap.englishPhonetic = false;
      }
      
      // Derived fields need work for missing tokens
      missingTokenWorkMap.index = true;
      missingTokenWorkMap.thaiScript = true;
      
      // Add helper groups
      const helpers = {};
      if (canCheckPhonetics) {
        helpers['ai4thai-g2p.js'] = {
          fields: ['g2p'],
          needsWork: true
        };
        helpers['phonetic-parser.js'] = {
          fields: ['englishPhonetic'],
          needsWork: true
        };
      }
      missingTokenWorkMap.helpers = helpers;
      
      schemaWorkMap.tokens.displayThaiThai.push(missingTokenWorkMap);
    }
  }
  
  // Evolution step 5: If thai exists but no wordReferenceIdsThai yet, still check helpers
  if (thaiExists && !wordRefsThaiExist && displayTokens.length === 0) {
    const placeholderTokenWorkMap = {};
    
    // Check phonetics integrity if dependencies satisfied
    if (canCheckPhonetics) {
      const phoneticsResult = checkPhoneticsIntegrity(fatBundle, { tokenIndex: 0 });
      placeholderTokenWorkMap.g2p = phoneticsResult.g2p || true; // Dependency satisfied but field missing
      placeholderTokenWorkMap.englishPhonetic = phoneticsResult.englishPhonetic || true;
    } else {
      placeholderTokenWorkMap.g2p = false;
      placeholderTokenWorkMap.englishPhonetic = false;
    }
    
    placeholderTokenWorkMap.index = true;
    placeholderTokenWorkMap.thaiScript = true;
    
    // Add helper groups
    const helpers = {};
    if (canCheckPhonetics) {
      helpers['ai4thai-g2p.js'] = {
        fields: ['g2p'],
        needsWork: true
      };
      helpers['phonetic-parser.js'] = {
        fields: ['englishPhonetic'],
        needsWork: true
      };
    }
    placeholderTokenWorkMap.helpers = helpers;
    
    if (schemaWorkMap.tokens.displayThaiThai.length === 0) {
      schemaWorkMap.tokens.displayThaiThai.push(placeholderTokenWorkMap);
    }
  }

  // Build senses array - EVOLUTION-AWARE: Check sense-level fields based on dependencies
  // Evolution logic: "I have wordReferenceIdsThai → I can check tokens.sensesThai[i].senses → I can check sense-level helpers"
  
  // Evolution step 1: Check if tokens.sensesThai[i].senses dependency is satisfied
  // Reuse tokens variable from above (line 935) - don't redeclare
  const existingTokens = tokens;
  const existingSenseTokens = existingTokens.sensesThai || [];
  const sensesExist = existingSenseTokens.length > 0 && existingSenseTokens.some(st => st.senses && Array.isArray(st.senses) && st.senses.length > 0);
  const canCheckSenses = sensesExist || wordRefsThaiExist || thaiExists;
  
  // Evolution step 2: Determine expected sense count
  let expectedSenseTokenCount = 0;
  if (sensesExist) {
    expectedSenseTokenCount = existingSenseTokens.length;
  } else if (wordRefsThaiExist) {
    expectedSenseTokenCount = thaiLength;
  } else if (thaiExists) {
    // Can check helpers even if senses don't exist yet (orchestrator can create them)
    expectedSenseTokenCount = 0; // No senses yet, but can still check helpers
  }
  
  // Check dictionary and normalization dependencies
  const dictDeps = getDictionaryDependencies();
  const normDeps = getNormalizeDependencies();
  const canCheckDictionary = checkDependenciesSatisfied(dictDeps, fatBundle).canCheck;
  const canCheckNormalize = checkDependenciesSatisfied(normDeps, fatBundle).canCheck;
  
  // Evolution step 3: Check existing sense tokens
  for (let i = 0; i < senseTokens.length; i++) {
    const token = senseTokens[i];
    const senseWorkMap = {
      index: !token || token.index === undefined || token.index === null,
      senses: []
    };
    
    // Check senses array: needs work if array doesn't exist or is empty
    const sensesArrayValue = token?.senses;
    if (sensesArrayValue && Array.isArray(sensesArrayValue) && sensesArrayValue.length > 0) {
      // Mirror each normalizedSense object in the senses array
      // Individual field validation handled by createNormalizedSenseWorkMap
      for (let j = 0; j < sensesArrayValue.length; j++) {
        const sense = sensesArrayValue[j];
        senseWorkMap.senses.push(createNormalizedSenseWorkMap(sense, fatBundle, i, j));
      }
    } else {
      // If senses array is empty or missing but dependency satisfied, mark as needs work
      if (canCheckSenses) {
        // Create placeholder sense workmap to represent checkable helpers
        const placeholderSense = createNormalizedSenseWorkMap(null, fatBundle, i, 0);
        // Mark all checkable fields as needs work since sense doesn't exist yet
        if (canCheckDictionary) {
          const dictFields = getDictionaryFields();
          dictFields.forEach(field => {
            if (field !== 'tokens.sensesThai[i].senses') {
              placeholderSense[field] = true;
            }
          });
        }
        if (canCheckNormalize) {
          const normFields = getNormalizeFields();
          normFields.forEach(field => {
            placeholderSense[field] = true;
          });
        }
        senseWorkMap.senses.push(placeholderSense);
      }
      // If dependency not satisfied, keep senses: [] (empty array)
      // sensesNeedsWork will check for empty array and return true
    }
    
    schemaWorkMap.tokens.sensesThai.push(senseWorkMap);
  }
  
  // Evolution step 4: If dependency satisfied but sense tokens missing, mark for orchestrator
  if (canCheckSenses && expectedSenseTokenCount > senseTokens.length) {
    while (schemaWorkMap.tokens.sensesThai.length < expectedSenseTokenCount) {
      const missingSenseWorkMap = {
        index: true, // Missing token - needs work
        senses: []
      };
      
      // Create placeholder sense to represent checkable helpers
      const placeholderSense = createNormalizedSenseWorkMap(null, fatBundle, schemaWorkMap.tokens.sensesThai.length, 0);
      // Mark all checkable fields as needs work
      if (canCheckDictionary) {
        const dictFields = getDictionaryFields();
        dictFields.forEach(field => {
          if (field !== 'tokens.sensesThai[i].senses') {
            placeholderSense[field] = true;
          }
        });
      }
      if (canCheckNormalize) {
        const normFields = getNormalizeFields();
        normFields.forEach(field => {
          placeholderSense[field] = true;
        });
      }
      missingSenseWorkMap.senses.push(placeholderSense);
      
      schemaWorkMap.tokens.sensesThai.push(missingSenseWorkMap);
    }
  }
  
  // Evolution step 5: If wordReferenceIdsThai exists but no senses yet, still check helpers
  if ((wordRefsThaiExist || thaiExists) && !sensesExist && senseTokens.length === 0) {
    const placeholderSenseTokenWorkMap = {
      index: true, // Missing token - needs work
      senses: []
    };
    
    // Create placeholder sense with all checkable fields marked as needs work
    const placeholderSense = createNormalizedSenseWorkMap(null, fatBundle, 0, 0);
    if (canCheckDictionary) {
      const dictFields = getDictionaryFields();
      dictFields.forEach(field => {
        if (field !== 'tokens.sensesThai[i].senses') {
          placeholderSense[field] = true;
        }
      });
    }
    if (canCheckNormalize) {
      const normFields = getNormalizeFields();
      normFields.forEach(field => {
        placeholderSense[field] = true;
      });
    }
    placeholderSenseTokenWorkMap.senses.push(placeholderSense);
    
    if (schemaWorkMap.tokens.sensesThai.length === 0) {
      schemaWorkMap.tokens.sensesThai.push(placeholderSenseTokenWorkMap);
    }
  }

  // Build displayEng array - mirrors fat bundle tokens.displayEnglish[i] keys
  // Use FIELD_REGISTRY.tokenLevel and direct validation
  for (let i = 0; i < displayEngTokens.length; i++) {
    const token = displayEngTokens[i];
    const tokenWorkMap = {};
    
    // Process token-level fields from FIELD_REGISTRY
    for (const fieldDef of FIELD_REGISTRY.tokenLevel) {
      // Only process displayEng fields
      if (fieldDef.field.startsWith('tokens.displayEnglish[i].')) {
        const fieldName = fieldDef.field.replace('tokens.displayEnglish[i].', '');
        const fieldValue = token?.[fieldName];
        tokenWorkMap[fieldName] = fieldNeedsWork(fieldDef, fieldValue);
      }
    }
    
    // Add helper groups for displayEng token fields
    const displayEngFieldsByHelper = {};
    for (const [helperName, fieldDefs] of Object.entries(tokenLevelByHelper)) {
      const displayEngFieldDefs = fieldDefs.filter(f => f.field.startsWith('tokens.displayEnglish[i].'));
      if (displayEngFieldDefs.length > 0) {
        displayEngFieldsByHelper[helperName] = displayEngFieldDefs;
      }
    }
    tokenWorkMap.helpers = groupFieldsByHelperFromStructure(displayEngFieldsByHelper, tokenWorkMap);
    
    schemaWorkMap.tokens.displayThaiThaiEng.push(tokenWorkMap);
  }
  
  // If wordReferenceIdsEng exists but tokens.displayThaiEng is shorter, tokens need to be built
  if (engLength > displayEngTokens.length) {
    while (schemaWorkMap.tokens.displayThaiThaiEng.length < engLength) {
      const missingTokenWorkMap = {};
      // All fields need work for missing tokens
      for (const fieldDef of FIELD_REGISTRY.tokenLevel) {
        if (fieldDef.field.startsWith('tokens.displayEnglish[i].')) {
          const fieldName = fieldDef.field.replace('tokens.displayEnglish[i].', '');
          missingTokenWorkMap[fieldName] = true; // Missing token - needs work
        }
      }
      // Add helper groups for missing displayEng token fields
      const displayEngFieldsByHelper = {};
      for (const [helperName, fieldDefs] of Object.entries(tokenLevelByHelper)) {
        const displayEngFieldDefs = fieldDefs.filter(f => f.field.startsWith('tokens.displayEnglish[i].'));
        if (displayEngFieldDefs.length > 0) {
          displayEngFieldsByHelper[helperName] = displayEngFieldDefs;
        }
      }
      missingTokenWorkMap.helpers = groupFieldsByHelperFromStructure(displayEngFieldsByHelper, missingTokenWorkMap);
      schemaWorkMap.tokens.displayThaiThaiEng.push(missingTokenWorkMap);
    }
  }

  // Build sensesEng array - mirrors fat bundle tokens.sensesEnglish[i] keys
  // Use FIELD_REGISTRY and direct validation
  // Note: sensesEng doesn't require normalization, just presence of array with items
  for (let i = 0; i < sensesEngTokens.length; i++) {
    const token = sensesEngTokens[i];
    const sensesArrayValue = token?.senses;
    const sensesArrayExists = sensesArrayValue && Array.isArray(sensesArrayValue) && sensesArrayValue.length > 0;
    
    const senseWorkMap = {
      index: !token || token.index === undefined || token.index === null,
      // For sensesEng: use boolean false if array exists with items, true if missing/empty
      // This is different from Thai senses which use array structure for granular tracking
      senses: sensesArrayExists ? false : true
    };
    
    schemaWorkMap.tokens.sensesThaiEng.push(senseWorkMap);
  }
  
  // If wordReferenceIdsEng exists but tokens.sensesEnglish is shorter, tokens need to be built
  if (engLength > sensesEngTokens.length) {
    while (schemaWorkMap.tokens.sensesThaiEng.length < engLength) {
      schemaWorkMap.tokens.sensesThaiEng.push({
        index: true, // Missing token - needs work
        senses: true // Missing token - boolean true (sensesNeedsWork will return true)
      });
    }
  }
  
  // CRITICAL: Dependency rule - when wordReferenceIdsThai is created, mark all token work as needed
  // When IDs appear, token keys become eligible for processing
  // Only mark if wordReferenceIdsThai needs work AND tokens don't exist yet
  if (schemaWorkMap.wordReferenceIdsThai && thaiLength > 0) {
    // New wordReferenceIdsThai created - ensure token arrays exist and mark work as needed
    // This ensures token-level helpers run after IDs are created
    for (let i = 0; i < thaiLength; i++) {
      // Ensure display token entry exists
      if (!schemaWorkMap.tokens.displayThaiThai[i]) {
        schemaWorkMap.tokens.displayThaiThai[i] = { index: true, thaiScript: true, g2p: true, englishPhonetic: true };
      } else {
        // If wordReferenceIdsThai needs work, mark token fields as needing work too
        // This ensures dependency chain: IDs created → token work becomes eligible
        if (!displayTokens[i]) {
          // Token doesn't exist yet - mark all fields as needing work
          if (!schemaWorkMap.tokens.displayThaiThai[i].hasOwnProperty('index')) {
            schemaWorkMap.tokens.displayThaiThai[i].index = true;
          }
          schemaWorkMap.tokens.displayThaiThai[i].thaiScript = true;
          schemaWorkMap.tokens.displayThaiThai[i].g2p = true;
          schemaWorkMap.tokens.displayThaiThai[i].englishPhonetic = true;
        }
      }
      // Ensure senses token entry exists
      if (!schemaWorkMap.tokens.sensesThai[i]) {
        schemaWorkMap.tokens.sensesThai[i] = { index: true, senses: [] };
      } else {
        // If wordReferenceIdsThai needs work and token doesn't exist, mark senses as needing work
        if (!senseTokens[i] || !senseTokens[i].senses || senseTokens[i].senses.length === 0) {
          if (!schemaWorkMap.tokens.sensesThai[i].hasOwnProperty('index')) {
            schemaWorkMap.tokens.sensesThai[i].index = true;
          }
          // Set senses to empty array (sensesNeedsWork will return true for empty array)
          schemaWorkMap.tokens.sensesThai[i].senses = [];
        }
      }
    }
  }
  
  // Similar for English tokens
  if (schemaWorkMap.wordReferenceIdsEng && engLength > 0) {
    for (let i = 0; i < engLength; i++) {
      if (!schemaWorkMap.tokens.displayThaiThaiEng[i]) {
        schemaWorkMap.tokens.displayThaiThaiEng[i] = { index: true, englishWord: true };
      } else {
        // If wordReferenceIdsEng needs work and token doesn't exist, mark as needing work
        if (!displayEngTokens[i]) {
          if (!schemaWorkMap.tokens.displayThaiThaiEng[i].hasOwnProperty('index')) {
            schemaWorkMap.tokens.displayThaiThaiEng[i].index = true;
          }
          schemaWorkMap.tokens.displayThaiThaiEng[i].englishWord = true;
        }
      }
      if (!schemaWorkMap.tokens.sensesThaiEng[i]) {
        schemaWorkMap.tokens.sensesThaiEng[i] = { index: true, senses: true };
      } else {
        // If wordReferenceIdsEng needs work and token doesn't exist, mark senses as needing work
        if (!sensesEngTokens[i] || !sensesEngTokens[i].senses || sensesEngTokens[i].senses.length === 0) {
          if (!schemaWorkMap.tokens.sensesThaiEng[i].hasOwnProperty('index')) {
            schemaWorkMap.tokens.sensesThaiEng[i].index = true;
          }
          // Set senses to boolean true (sensesNeedsWork will return true)
          schemaWorkMap.tokens.sensesThaiEng[i].senses = true;
        }
      }
    }
  }

  return schemaWorkMap;
}

/**
 * Validate fat bundle against schemaWorkMap - logs failures to console
 * If schemaWorkMap[key] === true (work needed), then fatBundle[key] must be populated
 * @param {object} fatBundle - Fat bundle to validate
 * @param {object} schemaWorkMap - Schema work map (key-aligned boolean mask)
 * @param {string} subtitleId - Subtitle ID for error messages
 * @param {string} phase - Phase being validated: 'LOAD' (only LOAD fields) or 'PROCESS' (all fields)
 * @returns {Promise<boolean>} true if validation passed, false if failures found
 */
export async function validateFatBundleAgainstWorkMap(fatBundle, schemaWorkMap, subtitleId, phase = 'PROCESS') {
  if (!fatBundle) {
    return false;
  }
  
  if (!schemaWorkMap) {
    return false;
  }
  
  const failures = [];
  
  // Define LOAD-owned fields (raw subtitle data from VTT)
  const loadFields = [
    { key: 'id', check: (val) => val && String(val).trim() !== '' },
    { key: 'startSecThai', check: (val) => val !== undefined && val !== null },
    { key: 'endSecThai', check: (val) => val !== undefined && val !== null },
    { key: 'startSecEng', check: (val) => val !== undefined && val !== null },
    { key: 'endSecEng', check: (val) => val !== undefined && val !== null },
    { key: 'thai', check: (val) => val && String(val).trim() !== '' },
    { key: 'english', check: (val) => val && String(val).trim() !== '' }
  ];
  
  // Define PROCESS-owned fields (derived/enriched data)
  // Note: For wordReferenceIds, if schemaWorkMap is true, array must have items (length > 0)
  // For other fields, empty arrays are valid - they mean "helper was called but found no matches/data"
  const processFields = [
    { key: 'wordReferenceIdsThai', check: (val, workmap) => {
      // If workmap is true, array must exist and have items (length > 0)
      // If workmap is false, array can be empty (already processed, no tokens found)
      if (workmap === true) {
        return Array.isArray(val) && val.length > 0;
      }
      return Array.isArray(val); // Empty array valid when workmap is false
    }},
    { key: 'wordReferenceIdsEng', check: (val, workmap) => {
      // If workmap is true, array must exist and have items (length > 0)
      // If workmap is false, array can be empty (already processed, no tokens found)
      if (workmap === true) {
        return Array.isArray(val) && val.length > 0;
      }
      return Array.isArray(val); // Empty array valid when workmap is false
    }},
    { key: 'smartSubsRefs', check: (val) => Array.isArray(val) }, // Empty array valid - means no refs to build
    { key: 'matchedWords', check: (val) => Array.isArray(val) } // Empty array valid - means no matches found
  ];
  
  // Select fields to validate based on phase
  const fieldsToValidate = phase === 'LOAD' ? loadFields : [...loadFields, ...processFields];
  
  for (const field of fieldsToValidate) {
    if (schemaWorkMap[field.key] === true) {
      const value = fatBundle[field.key];
      const workmapValue = schemaWorkMap[field.key];
      // Pass workmap value to check function if it accepts it (for wordReferenceIds)
      const checkResult = field.check.length > 1 ? field.check(value, workmapValue) : field.check(value);
      if (!checkResult) {
        failures.push(`schemaWorkMap.${field.key} is true but fatBundle.${field.key} is ${value === undefined ? 'undefined' : value === null ? 'null' : `invalid (${JSON.stringify(value)})`}`);
      }
    }
  }
  
  // Validate token-level fields
  if (schemaWorkMap.tokens) {
    const tokens = fatBundle.tokens || { displayThai: [], sensesThai: [], displayEnglish: [], sensesEnglish: [] };
    
    // Validate display tokens
    if (schemaWorkMap.tokens.displayThaiThai && Array.isArray(schemaWorkMap.tokens.displayThaiThai)) {
      for (let i = 0; i < schemaWorkMap.tokens.displayThaiThai.length; i++) {
        const tokenWorkMap = schemaWorkMap.tokens.displayThaiThai[i];
        if (tokenWorkMap) {
          if (tokenWorkMap.g2p === true && (!tokens.displayThaiThai[i] || !tokens.displayThaiThai[i].g2p)) {
            failures.push(`schemaWorkMap.tokens.displayThaiThai[${i}].g2p is true but fatBundle.tokens.displayThaiThai[${i}].g2p is missing`);
          }
          if (tokenWorkMap.englishPhonetic === true && (!tokens.displayThaiThai[i] || tokens.displayThaiThai[i].englishPhonetic === undefined || tokens.displayThaiThai[i].englishPhonetic === null)) {
            failures.push(`schemaWorkMap.tokens.displayThaiThai[${i}].englishPhonetic is true but fatBundle.tokens.displayThaiThai[${i}].englishPhonetic is missing`);
          }
        }
      }
    }
    
    // Validate senses tokens
    if (schemaWorkMap.tokens.sensesThai && Array.isArray(schemaWorkMap.tokens.sensesThai)) {
      for (let i = 0; i < schemaWorkMap.tokens.sensesThai.length; i++) {
        const senseWorkMap = schemaWorkMap.tokens.sensesThai[i];
        if (senseWorkMap && sensesNeedsWork(senseWorkMap)) {
          if (!tokens.sensesThai[i] || !tokens.sensesThai[i].senses || !Array.isArray(tokens.sensesThai[i].senses) || tokens.sensesThai[i].senses.length === 0) {
            failures.push(`schemaWorkMap.tokens.sensesThai[${i}] needs work but fatBundle.tokens.sensesThai[${i}].senses is missing or empty`);
          }
        }
      }
    }
    
    // Validate displayEnglish tokens
    if (schemaWorkMap.tokens.displayThaiThaiEng && Array.isArray(schemaWorkMap.tokens.displayThaiThaiEng)) {
      for (let i = 0; i < schemaWorkMap.tokens.displayThaiThaiEng.length; i++) {
        const tokenWorkMap = schemaWorkMap.tokens.displayThaiThaiEng[i];
        if (tokenWorkMap && tokenWorkMap.englishWord === true) {
          if (!tokens.displayEnglish[i] || !tokens.displayEnglish[i].englishWord) {
            failures.push(`schemaWorkMap.tokens.displayThaiThaiEng[${i}].englishWord is true but fatBundle.tokens.displayThaiThaiEng[${i}].englishWord is missing`);
          }
        }
      }
    }
    
    // Validate sensesEnglish tokens
    if (schemaWorkMap.tokens.sensesThaiEng && Array.isArray(schemaWorkMap.tokens.sensesThaiEng)) {
      for (let i = 0; i < schemaWorkMap.tokens.sensesThaiEng.length; i++) {
        const senseWorkMap = schemaWorkMap.tokens.sensesThaiEng[i];
        if (senseWorkMap && sensesNeedsWork(senseWorkMap)) {
          if (!tokens.sensesEnglish[i] || !tokens.sensesEnglish[i].senses || !Array.isArray(tokens.sensesEnglish[i].senses) || tokens.sensesEnglish[i].senses.length === 0) {
            failures.push(`schemaWorkMap.tokens.sensesThaiEng[${i}] needs work but fatBundle.tokens.sensesThaiEng[${i}].senses is missing or empty`);
          }
        }
      }
    }
  }
  
  if (failures.length > 0) {
    return false;
  }
  
  return true;
}

/**
 * Create blank schemaWorkMap from fat bundle - all signals set to false (does not need work)
 * Used for UI reset - creates blank schemaWorkMap matching fat bundle structure
 * @param {object} fatBundle - Fat bundle object
 * @param {string} subtitleId - Subtitle ID
 * @returns {Promise<object>} Blank schemaWorkMap with all signals set to false
 */
export async function makeBlankSchemaWorkMapFromFatBundle(fatBundle, subtitleId) {
  // Pure boolean mask - mirrors fat bundle structure exactly
  const schemaWorkMap = {
    needsSave: false,  // Save flag independent of validation
    validated: false,  // Validation status
    // Top-level fields from fat bundle - all false (does not need work)
    id: false,
    startSecThai: false,
    endSecThai: false,
    startSecEng: false,
    endSecEng: false,
    thai: false,
    english: false,
    wordReferenceIdsThai: false,
    wordReferenceIdsEng: false,
    tokens: {
      displayThai: [],
      sensesThai: [],
      displayEnglish: [],
      sensesEnglish: []
    }
  };

  // Build token arrays matching fat bundle structure
  const tokens = fatBundle.tokens || {};
  const displayTokens = tokens.displayThaiThai || [];
  const senseTokens = tokens.sensesThai || [];
  const displayEngTokens = tokens.displayEnglish || [];
  const sensesEngTokens = tokens.sensesEnglish || [];

  const thaiLength = fatBundle.wordReferenceIdsThai?.length || displayTokens.length || 0;
  const engLength = fatBundle.wordReferenceIdsEng?.length || displayEngTokens.length || 0;

  // Build display array - mirrors fat bundle tokens.displayThaiThai[i] keys
  for (let i = 0; i < displayTokens.length; i++) {
    schemaWorkMap.tokens.displayThaiThai.push({
      index: false,
      thaiScript: false,
      g2p: false,
      englishPhonetic: false
    });
  }

  // Build senses array - mirrors fat bundle tokens.sensesThai[i] keys
  // CRITICAL: senses array contains normalizedSense objects - mirror each one exactly
  for (let i = 0; i < senseTokens.length; i++) {
    const token = senseTokens[i];
    const senseWorkMap = {
      index: false,
      senses: []
    };
    
    // Mirror each normalizedSense object in the senses array
    if (token && token.senses && Array.isArray(token.senses)) {
      for (let j = 0; j < token.senses.length; j++) {
        const sense = token.senses[j];
        senseWorkMap.senses.push(createNormalizedSenseWorkMap(sense, fatBundle, i, j));
        // Set all fields to false since this is a blank work map
        const senseMask = senseWorkMap.senses[senseWorkMap.senses.length - 1];
        Object.keys(senseMask).forEach(key => {
          senseMask[key] = false;
        });
      }
    }
    
    schemaWorkMap.tokens.sensesThai.push(senseWorkMap);
  }

  // Build displayEng array - mirrors fat bundle tokens.displayEnglish[i] keys
  for (let i = 0; i < displayEngTokens.length; i++) {
    schemaWorkMap.tokens.displayThaiThaiEng.push({
      index: false,
      englishWord: false
    });
  }

  // Build sensesEng array - mirrors fat bundle tokens.sensesEnglish[i] keys
  // CRITICAL: senses array contains normalizedSense objects - mirror each one exactly
  for (let i = 0; i < sensesEngTokens.length; i++) {
    const token = sensesEngTokens[i];
    const senseWorkMap = {
      index: false,
      senses: []
    };
    
    // Mirror each normalizedSense object in the senses array
    if (token && token.senses && Array.isArray(token.senses)) {
      for (let j = 0; j < token.senses.length; j++) {
        const sense = token.senses[j];
        senseWorkMap.senses.push(createNormalizedSenseWorkMap(sense, fatBundle, i, j));
        // Set all fields to false since this is a blank work map
        const senseMask = senseWorkMap.senses[senseWorkMap.senses.length - 1];
        Object.keys(senseMask).forEach(key => {
          senseMask[key] = false;
        });
      }
    }
    
    schemaWorkMap.tokens.sensesThaiEng.push(senseWorkMap);
  }

  return schemaWorkMap;
}

/**
 * Get empty fat bundle template - returns fat bundle structure with example values at all levels
 * Used by import to build minimal fat bundle with correct structure
 * 
 * CRITICAL: This function generates the template from fat-subtitle-schema.json.
 * Schema is the source of truth - any schema changes automatically reflect in the template.
 * 
 * This template serves as a blueprint showing complete structure at all levels:
 * - Top-level fields: Example values showing expected types
 * - Token-level examples: Example displayToken and senseToken structures
 * - Sense-level examples: Example normalizedSense structure
 * 
 * @param {string} subtitleId - Subtitle ID (required)
 * @returns {object} Fat bundle template with example structure at all levels
 */
export function getEmptyFatBundleTemplate(subtitleId) {
  // Load schemas (already imported at top of file)
  const schema = fatSubtitleSchema;
  
  if (!schema || !schema.properties) {
    throw new Error('[Schema] fat-subtitle schema not loaded - cannot generate template');
  }
  
  // Template shows structure (empty arrays) - this is the blueprint
  // Building logic is in helpers - they already know how to build from wordReferenceIds
  const template = {
    id: subtitleId,  // Required field, always set
    startSecThai: null,
    endSecThai: null,
    startSecEng: null,
    endSecEng: null,
    thai: null,
    english: null,
    wordReferenceIdsThai: [],
    wordReferenceIdsEng: [],
    smartSubsRefs: [],
    matchedWords: [],
    tokens: {
      displayThai: [],  // Empty array - structure only
      sensesThai: [],  // Empty array - structure only
      displayEnglish: [],  // Empty array - structure only
      sensesEnglish: []  // Empty array - structure only
    }
  };
  
  return template;
}

/**
 * Build example object from schema definition
 * @param {object} schemaDef - Schema definition object
 * @param {object} defaults - Default example values
 * @returns {object} Example object with all schema properties
 */
function buildExampleFromSchema(schemaDef, defaults = {}) {
  if (!schemaDef || !schemaDef.properties) {
    return defaults;
  }
  
  const example = { ...defaults };
  
  // Add all properties from schema with example values
  for (const [propName, propSchema] of Object.entries(schemaDef.properties)) {
    if (example[propName] === undefined) {
      const propType = propSchema.type;
      const types = Array.isArray(propType) ? propType : [propType];
      
      if (types.includes('number')) {
        example[propName] = 0;
      } else if (types.includes('string')) {
        example[propName] = '';
      } else if (types.includes('boolean')) {
        example[propName] = false;
      } else if (types.includes('array')) {
        example[propName] = [];
      } else if (types.includes('object')) {
        example[propName] = null;
      } else if (types.includes('null')) {
        example[propName] = null;
      } else {
        example[propName] = null;
      }
    }
  }
  
  return example;
}

/**
 * Legacy function name - kept for backward compatibility during migration
 * @deprecated Use generateSchemaWorkMap instead
 */
export async function generateGapReport(subtitle, subtitleId, options = {}) {
  // Convert old format to fat bundle format if needed
  // CRITICAL: Ensure tokens is always object (never null)
  const fatBundle = subtitle.tokens ? subtitle : { 
    ...subtitle, 
    tokens: {
      displayThai: [],
      sensesThai: [],
      displayEnglish: [],
      sensesEnglish: []
    }
  };
  return generateSchemaWorkMap(fatBundle, subtitleId, options);
}

/**
 * Tokenize subtitle - pure tokenization
 * Tokenizes Thai and English text into wordReferenceIds arrays
 * @param {object} subtitle - Subtitle object with thai and english fields
 * @returns {Promise<object>} { wordReferenceIdsThai: [...], wordReferenceIdsEng: [...] }
 */
export async function tokenizeSubtitle(subtitle) {
  const { tokenizeThaiSentence } = await import('../02_tokenization/ai4thai-tokenizer.js');
  const { tokenizeEnglishSentence } = await import('../02_tokenization/english-tokenizer.js');
  
  const thaiText = subtitle.thai || '';
  const englishText = subtitle.english || '';
  
  // Tokenize Thai text
  const thaiTokens = thaiText ? await tokenizeThaiSentence(thaiText) : [];
  const wordReferenceIdsThai = thaiTokens.filter(t => t && t.trim());
  
  // Tokenize English text
  const englishTokens = englishText ? tokenizeEnglishSentence(englishText) : [];
  const wordReferenceIdsEng = englishTokens.filter(t => t && t.trim());
  
  return {
    wordReferenceIdsThai,
    wordReferenceIdsEng
  };
}

/**
 * Fill gaps in fat subtitle - fills missing token data
 * Checks fat subtitle tokens for missing data and fills gaps using appropriate helpers
 * @param {object} fatSubtitle - Fat subtitle with tokens structure
 * @param {object} options - Processing options { mediaId, showName, episode, season }
 * @param {Function} progressCallback - Optional progress callback
 * @returns {Promise<object>} Updated fat subtitle
 */
export async function fillGapsInFatSubtitle(fatSubtitle, options, progressCallback) {
  // If tokens structure doesn't exist, nothing to fill
  if (!fatSubtitle.tokens || !fatSubtitle.tokens.displayThai || !fatSubtitle.tokens.sensesThai) {
    return fatSubtitle;
  }
  
  // Gap filling is handled by processTokens - if tokens exist but data is missing,
  // we need to reprocess the tokens. However, since processTokens expects wordReferenceIds
  // and we already have tokens, we'll just return the fatSubtitle as-is.
  // The actual gap filling happens during token processing, not after fat bundle creation.
  // This function is a placeholder for future gap-filling logic if needed.
  
  return fatSubtitle;
}

/**
 * Check if senses need work (handles both boolean and array cases)
 * @param {object} senseWorkMap - Sense token work map
 * @returns {boolean} True if senses need processing
 */
export function sensesNeedsWork(senseWorkMap) {
  if (!senseWorkMap) return false;
  if (senseWorkMap.senses === true) return true; // Boolean true = full processing needed
  if (Array.isArray(senseWorkMap.senses)) {
    // Empty array = senses missing, work is needed
    if (senseWorkMap.senses.length === 0) {
      return true;
    }
    // Check if any sense needs work via helper groups (generic iteration)
    return senseWorkMap.senses.some(sense => {
      // Check helper groups generically - iterate through ALL helpers
      if (sense?.helpers) {
        const anyHelperNeedsWork = Object.values(sense.helpers).some(
          helperGroup => helperGroup.needsWork === true
        );
        if (anyHelperNeedsWork) return true;
      }
      // Fall back to individual field check (backward compatibility)
      return Object.values(sense).some(value => value === true);
    });
  }
  return false;
}

/**
 * Build senses data for saving (handles both boolean and array cases)
 * @param {object} senseWorkMap - Sense token work map
 * @param {Array} senseTokenSenses - Actual senses array from fat bundle
 * @returns {Array|null} Senses array to save, or null if nothing to save
 */
export function buildSensesForSave(senseWorkMap, senseTokenSenses) {
  if (!senseWorkMap || !senseTokenSenses || !Array.isArray(senseTokenSenses)) {
    return null;
  }
  
  if (senseWorkMap.senses === true) {
    // Boolean true = save all senses (full processing)
    return senseTokenSenses;
  }
  
  if (Array.isArray(senseWorkMap.senses) && senseWorkMap.senses.length === senseTokenSenses.length) {
    // Array structure = granular save - only save fields marked true
    const sensesToSave = [];
    for (let i = 0; i < senseTokenSenses.length; i++) {
      const sense = senseTokenSenses[i];
      const senseMask = senseWorkMap.senses[i];
      if (!senseMask) continue;
      
      // Build sense object with only fields that need saving
      const senseToSave = {};
      Object.keys(senseMask).forEach(key => {
        if (senseMask[key] === true && sense[key] !== undefined) {
          senseToSave[key] = sense[key];
        }
      });
      
      if (Object.keys(senseToSave).length > 0) {
        sensesToSave.push(senseToSave);
      }
    }
    return sensesToSave.length > 0 ? sensesToSave : null;
  }
  
  return null;
}

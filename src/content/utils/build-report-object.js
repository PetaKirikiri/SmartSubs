/**
 * Build Report Object from workmap, tracking, and fatBundle
 * This function reads data and builds the report object structure
 * No logic - just reads and combines data
 */

import { FIELD_REGISTRY, getFieldRegistryByHelper, getFieldsForHelper } from '../05_save/helpers/field-registry.js';
import { REPORT_OBJECT_SCHEMA } from './report-object.js';

/**
 * Format value for display
 */
function formatValue(value, maxLength = 50) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > maxLength) {
      return `"${trimmed.substring(0, maxLength - 3)}..."`;
    }
    return `"${trimmed}"`;
  }
  
  if (Array.isArray(value)) {
    // Show actual array contents, not just length
    const arrayStr = JSON.stringify(value);
    if (arrayStr.length > maxLength) {
      return arrayStr.substring(0, maxLength - 3) + '...';
    }
    return arrayStr;
  }
  
  if (typeof value === 'number') {
    return String(value);
  }
  
  if (typeof value === 'object') {
    return '{type: object}';
  }
  
  return String(value);
}

/**
 * Get field value from fatBundle
 */
function getFieldValue(fatBundle, fieldPath, tokenIndex = null, senseIndex = null) {
  if (!fatBundle || !fieldPath) return null;
  
  // Always expect package format: { subtitle: {...}, tokens: {...} }
  // Handle top-level fields (check in subtitle object)
  if (!fieldPath.includes('.')) {
    return fatBundle.subtitle?.[fieldPath] ?? null;
  }
  
  // Handle nested paths
  const parts = fieldPath.split('.');
  let current = fatBundle.subtitle;
  
  if (!current) {
    return null;
  }
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (part.includes('[')) {
      const [arrayName, indexPart] = part.split('[');
      if (current[arrayName] && Array.isArray(current[arrayName])) {
        if (indexPart === 'i]') {
          // Use provided index or check first item
          const idx = tokenIndex !== null ? tokenIndex : (senseIndex !== null ? senseIndex : 0);
          current = current[arrayName][idx] || null;
        } else {
          const idx = parseInt(indexPart.replace(']', ''), 10);
          current = current[arrayName] && current[arrayName][idx] ? current[arrayName][idx] : null;
        }
      } else {
        return null;
      }
    } else {
      current = current && current[part] !== undefined ? current[part] : null;
    }
    
    if (current === null || current === undefined) {
      return null;
    }
  }
  
  return current;
}

/**
 * Get concrete field path (replace [i] with actual index)
 */
function getConcreteFieldPath(templatePath, tokenIndex, senseIndex) {
  let path = templatePath;
  if (tokenIndex !== null) {
    path = path.replace(/\[i\]/g, `[${tokenIndex}]`);
  }
  if (senseIndex !== null) {
    path = path.replace(/\[i\]/g, `[${senseIndex}]`);
  }
  return path;
}

/**
 * Check if any field from a helper is saved
 * If ANY field from a helper is saved, ALL fields for that helper are considered saved
 * Note: Cache status is handled separately - if bundle is cached, all fields are cached
 */
function getHelperLevelSaveStatus(tracking, helperName) {
  if (!helperName || helperName === 'none') return false;
  if (!tracking || !tracking.fields) return false;
  
  let registryByHelper;
  try {
    registryByHelper = getFieldRegistryByHelper();
  } catch (error) {
    return false;
  }
  
  const helperFieldDefs = [];
  
  // Collect all fieldDefs for this helper
  try {
    Object.values(registryByHelper).forEach(helperGroups => {
      const fields = helperGroups?.helpers?.[helperName] || [];
      helperFieldDefs.push(...fields);
    });
  } catch (error) {
    return false;
  }
  
  // Check each fieldDef.field - use it directly to check tracking
  for (const fieldDef of helperFieldDefs) {
    const field = fieldDef?.field;
    if (!field || typeof field !== 'string') continue;
    
    // If field already contains template path structure, check it directly
    if (field.includes('tokens.')) {
      const fieldTracking = tracking.fields[field] || {};
      if (fieldTracking.wasSaved) return true;
    } else {
      // Field name only - check all possible paths where it might exist
      const possiblePaths = [
        field, // Top-level path
        `tokens.sensesThai[i].senses[i].${field}`, // Thai senses path
        `tokens.sensesEnglish[i].senses[i].${field}` // English senses path
      ];
      
      for (const path of possiblePaths) {
        const fieldTracking = tracking.fields[path] || {};
        if (fieldTracking.wasSaved) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Check if parent array field is cached/saved
 * If parent array (e.g., tokens.sensesThai[i].senses) is cached/saved, 
 * all child fields are implicitly cached/saved too
 */
function getParentArrayStatus(tracking, templatePath) {
  // For sense-level fields like tokens.sensesThai[i].senses[i].id
  // Check if parent array tokens.sensesThai[i].senses is cached/saved
  if (templatePath.startsWith('tokens.sensesThai[i].senses[i].')) {
    const parentPath = 'tokens.sensesThai[i].senses';
    const parentTracking = tracking.fields[parentPath] || {};
    return {
      wasCached: parentTracking.wasCached || false,
      wasSaved: parentTracking.wasSaved || false
    };
  }
  // For English senses: tokens.sensesEnglish[i].senses[i].id
  if (templatePath.startsWith('tokens.sensesEnglish[i].senses[i].')) {
    const parentPath = 'tokens.sensesEnglish[i].senses';
    const parentTracking = tracking.fields[parentPath] || {};
    return {
      wasCached: parentTracking.wasCached || false,
      wasSaved: parentTracking.wasSaved || false
    };
  }
  return { wasCached: false, wasSaved: false };
}

/**
 * Build report object from workmap, tracking, and fatBundle
 */
export function buildReportObject(subtitleId, schemaWorkMap, fatBundle, tracking, wasLoadedFromFirebase = false, helpersCalled = {}) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/321fb967-e310-42c8-9fbb-98d62112cb97',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'build-report-object.js:190',message:'buildReportObject entry',data:{subtitleId,hasFatBundle:!!fatBundle,hasTokens:!!fatBundle?.tokens,hasSubtitleTokens:!!fatBundle?.subtitle?.tokens,tokensKeys:fatBundle?.tokens?Object.keys(fatBundle.tokens):[],hasSenses:!!fatBundle?.tokens?.sensesThai,sensesLength:fatBundle?.tokens?.sensesThai?.length||0,firstSenseKeys:fatBundle?.tokens?.sensesThai?.[0]?.senses?.[0]?Object.keys(fatBundle.tokens.sensesThai[0].senses[0]):[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  // Check if any save should happen
  const needsSave = schemaWorkMap?.needsSave === true;
  let hasWorkToSave = false;
  if (schemaWorkMap) {
    // Check if workmap has any true values (excluding status flags)
    const workmap = schemaWorkMap;
    if (workmap && typeof workmap === 'object') {
      for (const [key, value] of Object.entries(workmap)) {
        if (key === 'validated' || key === 'needsSave' || key === 'tokens') continue;
        if (value === true) {
          hasWorkToSave = true;
          break;
        }
      }
      if (!hasWorkToSave && workmap.tokens) {
        // Check token-level fields
          for (const tokenWorkMap of workmap.tokens.displayThai || []) {
          if (tokenWorkMap && Object.values(tokenWorkMap).some(v => v === true)) {
            hasWorkToSave = true;
            break;
          }
        }
        if (!hasWorkToSave) {
          for (const senseWorkMap of workmap.tokens.sensesThai || []) {
            if (senseWorkMap && Object.values(senseWorkMap).some(v => v === true)) {
              hasWorkToSave = true;
              break;
            }
          }
        }
        if (!hasWorkToSave) {
          for (const tokenWorkMap of workmap.tokens.displayEnglish || []) {
            if (tokenWorkMap && Object.values(tokenWorkMap).some(v => v === true)) {
              hasWorkToSave = true;
              break;
            }
          }
        }
        if (!hasWorkToSave) {
          for (const senseWorkMap of workmap.tokens.sensesEnglish || []) {
            if (senseWorkMap && Object.values(senseWorkMap).some(v => v === true)) {
              hasWorkToSave = true;
              break;
            }
          }
        }
      }
    }
  }
  const shouldSave = needsSave || hasWorkToSave;
  
  const report = {
    reportVersion: '2.0',
    subtitleId,
    needsSave: needsSave,
    helpers: {}
  };
  
  if (!schemaWorkMap || !fatBundle || !tracking) {
    return report;
  }
  
  // Get FIELD_REGISTRY grouped by helper
  const registryByHelper = getFieldRegistryByHelper();
  
  // Process top-level fields
  for (const fieldDef of FIELD_REGISTRY.topLevel) {
    const fieldPath = fieldDef.field;
    const workmap = schemaWorkMap[fieldPath] === true;
    const fieldTracking = tracking.fields[fieldPath] || {};
    const value = getFieldValue(fatBundle, fieldPath);
    
    // Fix helperCalled logic: Check helpersCalled tracking object first, then fallback to tracking or workmap inference
    let helperName = null;
    if (helpersCalled && helpersCalled[fieldPath]) {
      helperName = helpersCalled[fieldPath];
    } else if (fieldTracking.helperCalled) {
      helperName = fieldTracking.helperCalled;
    } else if (workmap && fieldDef.helper) {
      // Fallback: infer from workmap if tracking not available (backward compatibility)
      helperName = fieldDef.helper;
      if (fieldDef.derivedFrom) {
        helperName = `derived from ${fieldDef.derivedFrom}`;
      }
    }
    
        // Cache: If bundle is cached (subtitle-level), all fields are cached
        const wasCached = tracking.subtitle?.wasCached || fieldTracking.wasCached || false;
        
        // Save: Check field-level first, then helper-level, then parent array
        // BUT: If needsSave is false and workmap is false, no save should happen, so don't show saved: true
        let wasSaved = false;
        if (shouldSave) {
          // Only check tracking if a save should actually happen
          wasSaved = fieldTracking.wasSaved || false;
          
          // If field-level save is false, check helper-level status
          if (!wasSaved && fieldDef.helper) {
            // Handle multiple helpers - check each one
            const helpers = fieldDef.helper.split(' / ').map(h => h.trim());
            for (const helper of helpers) {
              if (getHelperLevelSaveStatus(tracking, helper)) {
                wasSaved = true;
                break;
              }
            }
          }
        }
        
        const fieldMetadata = {
          field: fieldDef.field,
          fieldPath: fieldDef.field,
          workmap,
          validated: schemaWorkMap?.validated || false,
          helperCalled: helperName,
          cached: wasCached,
          saved: wasSaved,
          displayed: fieldTracking.isDisplayed || false,
          present: (wasLoadedFromFirebase || wasCached || wasSaved) || false,
          dataLoaded: wasLoadedFromFirebase || false,
          dataStatus: fieldTracking.dataStatus || 'clean',
          validation: fieldTracking.validation === 'passed' || false,
          value: formatValue(value),
          error: fieldTracking.error || null
        };
    
    if (fieldDef.helper) {
      const helpers = fieldDef.helper.split(' / ').map(h => h.trim());
      for (const helperName of helpers) {
        if (!report.helpers[helperName]) {
          report.helpers[helperName] = {
            helper: helperName,
            needsWork: false,
            needsSave: needsSave,
            fields: []
          };
        }
        report.helpers[helperName].fields.push(fieldMetadata);
        if (workmap) {
          report.helpers[helperName].needsWork = true;
        }
      }
    }
  }
  
  // Process token-level fields
  const tokens = fatBundle.tokens || fatBundle.subtitle?.tokens || { displayThai: [], sensesThai: [], displayEnglish: [], sensesEnglish: [] };
  const displayTokens = tokens.displayThai || [];
  const senseTokens = tokens.sensesThai || [];
  const displayEngTokens = tokens.displayEnglish || [];
  const sensesEngTokens = tokens.sensesEnglish || [];
  
  // #region agent log
  if (senseTokens.length > 0 && senseTokens[0]?.senses?.[0]) {
    fetch('http://127.0.0.1:7242/ingest/321fb967-e310-42c8-9fbb-98d62112cb97',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'build-report-object.js:344',message:'Fat bundle tokens structure',data:{senseTokensLength:senseTokens.length,firstSenseTokenSensesLength:senseTokens[0]?.senses?.length||0,firstSenseKeys:senseTokens[0]?.senses?.[0]?Object.keys(senseTokens[0].senses[0]):[],hasDefinition:senseTokens[0]?.senses?.[0]?.definition!==undefined,hasEnglish:senseTokens[0]?.senses?.[0]?.english!==undefined,hasExample:senseTokens[0]?.senses?.[0]?.example!==undefined,definitionValue:senseTokens[0]?.senses?.[0]?.definition,englishValue:senseTokens[0]?.senses?.[0]?.english,exampleValue:senseTokens[0]?.senses?.[0]?.example},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  }
  // #endregion
  
  // Process display tokens
  for (let i = 0; i < displayTokens.length; i++) {
    const tokenWorkMap = schemaWorkMap.tokens?.displayThai?.[i] || {};
    
    for (const fieldDef of FIELD_REGISTRY.tokenLevel) {
      if (fieldDef.field.startsWith('tokens.displayThai[i].')) {
        const fieldName = fieldDef.field.replace('tokens.displayThai[i].', '');
        const workmap = tokenWorkMap[fieldName] === true;
        const templatePath = fieldDef.field;
        const concretePath = getConcreteFieldPath(templatePath, i, null);
        const fieldTracking = tracking.fields[templatePath] || {};
        const value = getFieldValue(fatBundle, concretePath, i, null);
        
        // Fix helperCalled logic: Check helpersCalled tracking object first
        let helperName = null;
        if (helpersCalled && helpersCalled[concretePath]) {
          helperName = helpersCalled[concretePath];
        } else if (helpersCalled && helpersCalled[templatePath]) {
          helperName = helpersCalled[templatePath];
        } else if (fieldTracking.helperCalled) {
          helperName = fieldTracking.helperCalled;
        } else if (workmap && fieldDef.helper) {
          // Fallback: infer from workmap if tracking not available (backward compatibility)
          helperName = fieldDef.helper;
        }
        
        // Cache: If bundle is cached (subtitle-level), all fields are cached
        const wasCached = tracking.subtitle?.wasCached || fieldTracking.wasCached || false;
        
        // Save: Check field-level first, then helper-level
        // BUT: If needsSave is false and workmap is false, no save should happen, so don't show saved: true
        let wasSaved = false;
        if (shouldSave) {
          wasSaved = fieldTracking.wasSaved || false;
          
          // If field-level save is false, check helper-level status
          if (!wasSaved && fieldDef.helper) {
            const helpers = fieldDef.helper.split(' / ').map(h => h.trim());
            for (const helper of helpers) {
              if (getHelperLevelSaveStatus(tracking, helper)) {
                wasSaved = true;
                break;
              }
            }
          }
        }
        
        const fieldMetadata = {
          field: fieldName,
          fieldPath: concretePath,
          workmap,
          validated: schemaWorkMap?.validated || false,
          helperCalled: helperName,
          cached: wasCached,
          saved: wasSaved,
          displayed: fieldTracking.isDisplayed || false,
          present: (wasLoadedFromFirebase || wasCached || wasSaved) || false,
          dataLoaded: wasLoadedFromFirebase || false,
          dataStatus: fieldTracking.dataStatus || 'clean',
          validation: fieldTracking.validation === 'passed' || false,
          value: formatValue(value),
          error: fieldTracking.error || null
        };
        
        if (fieldDef.helper) {
          const helpers = fieldDef.helper.split(' / ').map(h => h.trim());
          for (const helperName of helpers) {
            if (!report.helpers[helperName]) {
              report.helpers[helperName] = {
                helper: helperName,
                needsWork: false,
                needsSave: needsSave,
                fields: []
              };
            }
            report.helpers[helperName].fields.push(fieldMetadata);
            if (workmap) {
              report.helpers[helperName].needsWork = true;
            }
          }
        }
      }
    }
  }
  
  // Process senses array fields
  for (let i = 0; i < senseTokens.length; i++) {
    const senseTokenWorkMap = schemaWorkMap.tokens?.sensesThai?.[i];
    const senseToken = senseTokens[i];
    const senses = senseToken?.senses || [];
    
    // Handle senses array field itself
    for (const fieldDef of FIELD_REGISTRY.tokenLevel) {
      if (fieldDef.field === 'tokens.sensesThai[i].senses') {
        const templatePath = fieldDef.field;
        const concretePath = getConcreteFieldPath(templatePath, i, null);
        const fieldTracking = tracking.fields[templatePath] || {};
        const value = senses;
        
        // Read workmap for senses array
        const sensesWorkmap = senseTokenWorkMap?.senses;
        let workmap = false;
        if (sensesWorkmap === true) {
          workmap = true;
        } else if (Array.isArray(sensesWorkmap) && sensesWorkmap.length === 0) {
          workmap = true;
        }
        
        // Fix helperCalled logic: Check helpersCalled tracking object first
        let helperName = null;
        if (helpersCalled && helpersCalled[concretePath]) {
          helperName = helpersCalled[concretePath];
        } else if (helpersCalled && helpersCalled[templatePath]) {
          helperName = helpersCalled[templatePath];
        } else if (fieldTracking.helperCalled) {
          helperName = fieldTracking.helperCalled;
        } else if (workmap && fieldDef.helper) {
          // Fallback: infer from workmap if tracking not available (backward compatibility)
          const helpers = fieldDef.helper.split(' / ').map(h => h.trim());
          helperName = helpers[0] || null;
        }
        
        // Cache: If bundle is cached (subtitle-level), all fields are cached
        const wasCached = tracking.subtitle?.wasCached || fieldTracking.wasCached || false;
        
        // Save: Check field-level first, then helper-level
        // BUT: If needsSave is false and workmap is false, no save should happen, so don't show saved: true
        let wasSaved = false;
        if (shouldSave) {
          wasSaved = fieldTracking.wasSaved || false;
          
          // If field-level save is false, check helper-level status
          if (!wasSaved && fieldDef.helper) {
            const helpers = fieldDef.helper.split(' / ').map(h => h.trim());
            for (const helper of helpers) {
              const helperSaved = getHelperLevelSaveStatus(tracking, helper);
              if (helperSaved) {
                wasSaved = true;
                break;
              }
            }
          }
        }
        
        const fieldMetadata = {
          field: 'senses',
          fieldPath: concretePath,
          workmap,
          validated: schemaWorkMap?.validated || false,
          helperCalled: helperName,
          cached: wasCached,
          saved: wasSaved,
          displayed: fieldTracking.isDisplayed || false,
          present: (wasLoadedFromFirebase || wasCached || wasSaved) || false,
          dataLoaded: wasLoadedFromFirebase || false,
          dataStatus: fieldTracking.dataStatus || 'clean',
          validation: fieldTracking.validation === 'passed' || false,
          value: formatValue(value),
          error: fieldTracking.error || null
        };
        
        if (fieldDef.helper) {
          const helpers = fieldDef.helper.split(' / ').map(h => h.trim());
          for (const helperName of helpers) {
            if (!report.helpers[helperName]) {
              report.helpers[helperName] = {
                helper: helperName,
                needsWork: false,
                needsSave: needsSave,
                fields: []
              };
            }
            report.helpers[helperName].fields.push(fieldMetadata);
            if (workmap) {
              report.helpers[helperName].needsWork = true;
            }
          }
        }
      }
    }
    
    // Process sense-level fields
    for (let j = 0; j < senses.length; j++) {
      const sense = senses[j];
      const senseWorkMap = senseTokenWorkMap?.senses?.[j] || {};
      
      // #region agent log
      if (j === 0) {
        fetch('http://127.0.0.1:7242/ingest/321fb967-e310-42c8-9fbb-98d62112cb97',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'build-report-object.js:529',message:'Processing Thai sense object',data:{tokenIndex:i,senseIndex:j,senseKeys:sense?Object.keys(sense):[],hasDefinition:sense?.definition!==undefined,definitionValue:sense?.definition},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      }
      // #endregion
      
      for (const fieldDef of FIELD_REGISTRY.senseLevel) {
        const templatePath = `tokens.sensesThai[i].senses[i].${fieldDef.field}`;
        const concretePath = getConcreteFieldPath(templatePath, i, j);
        const fieldTracking = tracking.fields[templatePath] || {};
        
        // Handle ORST-only fields that may be in originalData after normalization
        let value;
        if (fieldDef.field === 'definition') {
          if (sense?.originalData && typeof sense?.originalData === 'object') {
            value = sense?.originalData?.definition || '';
          } else {
            value = sense?.definition || '';
          }
        } else {
          value = sense?.[fieldDef.field];
        }
        
        // #region agent log
        if ((fieldDef.field === 'definition' || fieldDef.field === 'originalData') && j === 0) {
          fetch('http://127.0.0.1:7242/ingest/321fb967-e310-42c8-9fbb-98d62112cb97',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'build-report-object.js:536',message:'Extracting sense field value',data:{field:fieldDef.field,tokenIndex:i,senseIndex:j,hasSense:!!sense,senseKeys:sense?Object.keys(sense):[],hasOriginalData:!!sense?.originalData,originalDataKeys:sense?.originalData?Object.keys(sense.originalData):[],value:value,valueType:typeof value,concretePath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        }
        // #endregion
        
        const workmap = senseWorkMap[fieldDef.field] === true;
        
        // Fix helperCalled logic: Check helpersCalled tracking object first
        let helperName = null;
        if (helpersCalled && helpersCalled[concretePath]) {
          helperName = helpersCalled[concretePath];
        } else if (helpersCalled && helpersCalled[templatePath]) {
          helperName = helpersCalled[templatePath];
        } else if (fieldTracking.helperCalled) {
          helperName = fieldTracking.helperCalled;
        } else if (workmap && fieldDef.helper) {
          // Fallback: infer from workmap if tracking not available (backward compatibility)
          helperName = fieldDef.helper;
          if (fieldDef.derivedFrom) {
            helperName = `derived from ${fieldDef.derivedFrom}`;
          }
        }
        
        // Cache: If bundle is cached (subtitle-level), all fields are cached
        const wasCached = tracking.subtitle?.wasCached || fieldTracking.wasCached || false;
        
        // Save: Check field-level first, then helper-level
        // BUT: If needsSave is false and workmap is false, no save should happen, so don't show saved: true
        let wasSaved = false;
        if (shouldSave) {
          wasSaved = fieldTracking.wasSaved || false;
          
          // If field-level save is false, check helper-level status
          if (!wasSaved && fieldDef.helper) {
            const helpers = fieldDef.helper.split(' / ').map(h => h.trim());
            for (const helper of helpers) {
              const helperSaved = getHelperLevelSaveStatus(tracking, helper);
              if (helperSaved) {
                wasSaved = true;
                break;
              }
            }
          }
        }
        
        const fieldMetadata = {
          field: fieldDef.field,
          fieldPath: concretePath,
          workmap,
          validated: schemaWorkMap?.validated || false,
          helperCalled: helperName,
          cached: wasCached,
          saved: wasSaved,
          displayed: fieldTracking.isDisplayed || false,
          present: (wasLoadedFromFirebase || wasCached || wasSaved) || false,
          dataLoaded: wasLoadedFromFirebase || false,
          dataStatus: fieldTracking.dataStatus || 'clean',
          validation: fieldTracking.validation === 'passed' || false,
          value: formatValue(value),
          error: fieldTracking.error || null
        };
        
        if (fieldDef.helper) {
          const helpers = fieldDef.helper.split(' / ').map(h => h.trim());
          for (const helperName of helpers) {
            if (!report.helpers[helperName]) {
              report.helpers[helperName] = {
                helper: helperName,
                needsWork: false,
                needsSave: needsSave,
                fields: []
              };
            }
            report.helpers[helperName].fields.push(fieldMetadata);
            if (workmap) {
              report.helpers[helperName].needsWork = true;
            }
          }
        }
      }
    }
  }
  
  // Process displayEnglish tokens
  for (let i = 0; i < displayEngTokens.length; i++) {
    const tokenWorkMap = schemaWorkMap.tokens?.displayEnglish?.[i] || {};
    
    for (const fieldDef of FIELD_REGISTRY.tokenLevel) {
      if (fieldDef.field.startsWith('tokens.displayEnglish[i].')) {
        const fieldName = fieldDef.field.replace('tokens.displayEnglish[i].', '');
        const workmap = tokenWorkMap[fieldName] === true;
        const templatePath = fieldDef.field;
        const concretePath = getConcreteFieldPath(templatePath, i, null);
        const fieldTracking = tracking.fields[templatePath] || {};
        const value = getFieldValue(fatBundle, concretePath, i, null);
        
        // Fix helperCalled logic: Check helpersCalled tracking object first
        let helperName = null;
        if (helpersCalled && helpersCalled[concretePath]) {
          helperName = helpersCalled[concretePath];
        } else if (helpersCalled && helpersCalled[templatePath]) {
          helperName = helpersCalled[templatePath];
        } else if (fieldTracking.helperCalled) {
          helperName = fieldTracking.helperCalled;
        } else if (workmap && fieldDef.helper) {
          // Fallback: infer from workmap if tracking not available (backward compatibility)
          helperName = fieldDef.helper;
          if (fieldDef.derivedFrom) {
            helperName = `derived from ${fieldDef.derivedFrom}`;
          }
        }
        
        // Cache: If bundle is cached (subtitle-level), all fields are cached
        const wasCached = tracking.subtitle?.wasCached || fieldTracking.wasCached || false;
        
        // Save: Check field-level first, then helper-level
        // BUT: If needsSave is false and workmap is false, no save should happen, so don't show saved: true
        let wasSaved = false;
        if (shouldSave) {
          wasSaved = fieldTracking.wasSaved || false;
          
          // If field-level save is false, check helper-level status
          if (!wasSaved && fieldDef.helper) {
            const helpers = fieldDef.helper.split(' / ').map(h => h.trim());
            for (const helper of helpers) {
              if (getHelperLevelSaveStatus(tracking, helper)) {
                wasSaved = true;
                break;
              }
            }
          }
        }
        
        const fieldMetadata = {
          field: fieldName,
          fieldPath: concretePath,
          workmap,
          validated: schemaWorkMap?.validated || false,
          helperCalled: helperName,
          cached: wasCached,
          saved: wasSaved,
          displayed: fieldTracking.isDisplayed || false,
          present: (wasLoadedFromFirebase || wasCached || wasSaved) || false,
          dataLoaded: wasLoadedFromFirebase || false,
          dataStatus: fieldTracking.dataStatus || 'clean',
          validation: fieldTracking.validation === 'passed' || false,
          value: formatValue(value),
          error: fieldTracking.error || null
        };
        
        if (fieldDef.helper) {
          const helpers = fieldDef.helper.split(' / ').map(h => h.trim());
          for (const helperName of helpers) {
            if (!report.helpers[helperName]) {
              report.helpers[helperName] = {
                helper: helperName,
                needsWork: false,
                needsSave: needsSave,
                fields: []
              };
            }
            report.helpers[helperName].fields.push(fieldMetadata);
            if (workmap) {
              report.helpers[helperName].needsWork = true;
            }
          }
        }
      }
    }
  }
  
  // Process sensesEng array fields
  for (let i = 0; i < sensesEngTokens.length; i++) {
    const senseTokenWorkMap = schemaWorkMap.tokens?.sensesEnglish?.[i];
    const senseToken = sensesEngTokens[i];
    const senses = senseToken?.senses || [];
    
    // Handle sensesEnglish array field itself
    for (const fieldDef of FIELD_REGISTRY.tokenLevel) {
      if (fieldDef.field === 'tokens.sensesEnglish[i].senses') {
        const templatePath = fieldDef.field;
        const concretePath = getConcreteFieldPath(templatePath, i, null);
        const fieldTracking = tracking.fields[templatePath] || {};
        const value = senses;
        
        // Read workmap for sensesEng array
        const sensesWorkmap = senseTokenWorkMap?.senses;
        let workmap = false;
        if (sensesWorkmap === true) {
          workmap = true;
        } else if (Array.isArray(sensesWorkmap) && sensesWorkmap.length === 0) {
          workmap = true;
        }
        
        // Fix helperCalled logic: Check helpersCalled tracking object first
        let helperName = null;
        if (helpersCalled && helpersCalled[concretePath]) {
          helperName = helpersCalled[concretePath];
        } else if (helpersCalled && helpersCalled[templatePath]) {
          helperName = helpersCalled[templatePath];
        } else if (fieldTracking.helperCalled) {
          helperName = fieldTracking.helperCalled;
        } else if (workmap && fieldDef.helper) {
          // Fallback: infer from workmap if tracking not available (backward compatibility)
          helperName = fieldDef.helper;
          if (fieldDef.derivedFrom) {
            helperName = `derived from ${fieldDef.derivedFrom}`;
          }
        }
        
        // Cache: If bundle is cached (subtitle-level), all fields are cached
        const wasCached = tracking.subtitle?.wasCached || fieldTracking.wasCached || false;
        
        // Save: Check field-level first, then helper-level
        // BUT: If needsSave is false and workmap is false, no save should happen, so don't show saved: true
        let wasSaved = false;
        if (shouldSave) {
          wasSaved = fieldTracking.wasSaved || false;
          
          // If field-level save is false, check helper-level status
          if (!wasSaved && fieldDef.helper) {
            const helpers = fieldDef.helper.split(' / ').map(h => h.trim());
            for (const helper of helpers) {
              if (getHelperLevelSaveStatus(tracking, helper)) {
                wasSaved = true;
                break;
              }
            }
          }
        }
        
        const fieldMetadata = {
          field: 'senses',
          fieldPath: concretePath,
          workmap,
          validated: schemaWorkMap?.validated || false,
          helperCalled: helperName,
          cached: wasCached,
          saved: wasSaved,
          displayed: fieldTracking.isDisplayed || false,
          present: (wasLoadedFromFirebase || wasCached || wasSaved) || false,
          dataLoaded: wasLoadedFromFirebase || false,
          dataStatus: fieldTracking.dataStatus || 'clean',
          validation: fieldTracking.validation === 'passed' || false,
          value: formatValue(value),
          error: fieldTracking.error || null
        };
        
        if (fieldDef.helper) {
          const helpers = fieldDef.helper.split(' / ').map(h => h.trim());
          for (const helperName of helpers) {
            if (!report.helpers[helperName]) {
              report.helpers[helperName] = {
                helper: helperName,
                needsWork: false,
                needsSave: needsSave,
                fields: []
              };
            }
            report.helpers[helperName].fields.push(fieldMetadata);
            if (workmap) {
              report.helpers[helperName].needsWork = true;
            }
          }
        }
      }
    }
    
    // Process sense-level fields for sensesEng
    // CRITICAL: English senses (sensesEng) only use ORST, NOT normalization
    // Filter out normalized fields (gpt-normalize-senses.js) - they don't apply to English senses
    const normalizedFieldNames = ['posEnglish', 'meaningThai', 'meaningEnglish', 'descriptionThai', 'descriptionEnglish', 'confidence'];
    
    for (let j = 0; j < senses.length; j++) {
      const sense = senses[j];
      const senseWorkMap = senseTokenWorkMap?.senses?.[j] || {};
      
      // #region agent log
      if (j === 0) {
        fetch('http://127.0.0.1:7242/ingest/321fb967-e310-42c8-9fbb-98d62112cb97',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'build-report-object.js:803',message:'Processing English sense object',data:{tokenIndex:i,senseIndex:j,senseKeys:sense?Object.keys(sense):[],hasDefinition:sense?.definition!==undefined,definitionValue:sense?.definition},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      }
      // #endregion
      
      for (const fieldDef of FIELD_REGISTRY.senseLevel) {
        // Skip normalized fields for English senses - they only use ORST
        if (normalizedFieldNames.includes(fieldDef.field)) {
          continue;
        }
        
        const templatePath = `tokens.sensesEnglish[i].senses[i].${fieldDef.field}`;
        const concretePath = getConcreteFieldPath(templatePath, i, j);
        const fieldTracking = tracking.fields[templatePath] || {};
        
        // Handle ORST-only fields that may be in originalData after normalization
        let value;
        if (fieldDef.field === 'definition') {
          if (sense?.originalData && typeof sense?.originalData === 'object') {
            value = sense?.originalData?.definition || '';
          } else {
            value = sense?.definition || '';
          }
        } else {
          value = sense?.[fieldDef.field];
        }
        
        // #region agent log
        if ((fieldDef.field === 'definition' || fieldDef.field === 'originalData') && j === 0) {
          fetch('http://127.0.0.1:7242/ingest/321fb967-e310-42c8-9fbb-98d62112cb97',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'build-report-object.js:815',message:'Extracting English sense field value',data:{field:fieldDef.field,tokenIndex:i,senseIndex:j,hasSense:!!sense,senseKeys:sense?Object.keys(sense):[],hasOriginalData:!!sense?.originalData,originalDataKeys:sense?.originalData?Object.keys(sense.originalData):[],value:value,valueType:typeof value,concretePath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        }
        // #endregion
        
        const workmap = senseWorkMap[fieldDef.field] === true;
        
        // Fix helperCalled logic: Check helpersCalled tracking object first
        let helperName = null;
        if (helpersCalled && helpersCalled[concretePath]) {
          helperName = helpersCalled[concretePath];
        } else if (helpersCalled && helpersCalled[templatePath]) {
          helperName = helpersCalled[templatePath];
        } else if (fieldTracking.helperCalled) {
          helperName = fieldTracking.helperCalled;
        } else if (workmap && fieldDef.helper) {
          // Fallback: infer from workmap if tracking not available (backward compatibility)
          helperName = fieldDef.helper;
          if (fieldDef.derivedFrom) {
            helperName = `derived from ${fieldDef.derivedFrom}`;
          }
        }
        
        // Cache: If bundle is cached (subtitle-level), all fields are cached
        let wasCached = tracking.subtitle?.wasCached || fieldTracking.wasCached || false;
        
        // Save: Check field-level first, then helper-level, then parent array
        // BUT: If needsSave is false and workmap is false, no save should happen, so don't show saved: true
        let wasSaved = false;
        if (shouldSave) {
          wasSaved = fieldTracking.wasSaved || false;
          
          // If field-level save is false, check helper-level status
          if (!wasSaved && fieldDef.helper) {
            const helpers = fieldDef.helper.split(' / ').map(h => h.trim());
            for (const helper of helpers) {
              if (getHelperLevelSaveStatus(tracking, helper)) {
                wasSaved = true;
                break;
              }
            }
          }
          
          // Also check parent array status (for sense-level fields)
          const parentStatus = getParentArrayStatus(tracking, templatePath);
          wasSaved = wasSaved || parentStatus.wasSaved;
        }
        
        // Also check parent array cached status (always check this)
        const parentStatus = getParentArrayStatus(tracking, templatePath);
        wasCached = wasCached || parentStatus.wasCached;
        
        const fieldMetadata = {
          field: fieldDef.field,
          fieldPath: concretePath,
          workmap,
          validated: schemaWorkMap?.validated || false,
          helperCalled: helperName,
          cached: wasCached,
          saved: wasSaved,
          displayed: fieldTracking.isDisplayed || false,
          present: (wasLoadedFromFirebase || wasCached || wasSaved) || false,
          dataLoaded: wasLoadedFromFirebase || false,
          dataStatus: fieldTracking.dataStatus || 'clean',
          validation: fieldTracking.validation === 'passed' || false,
          value: formatValue(value),
          error: fieldTracking.error || null
        };
        
        if (fieldDef.helper) {
          const helpers = fieldDef.helper.split(' / ').map(h => h.trim());
          for (const helperName of helpers) {
            if (!report.helpers[helperName]) {
              report.helpers[helperName] = {
                helper: helperName,
                needsWork: false,
                needsSave: needsSave,
                fields: []
              };
            }
            report.helpers[helperName].fields.push(fieldMetadata);
            if (workmap) {
              report.helpers[helperName].needsWork = true;
            }
          }
        }
      }
    }
  }
  
  return report;
}

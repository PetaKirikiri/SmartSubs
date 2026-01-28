/**
 * SchemaWorkMap Truth-Table Coverage Verification Script
 * 
 * Verifies that every boolean flag in schemaWorkMap that gates a helper
 * has been tested with all three states (MISSING, DIRTY, CLEAN).
 * 
 * Run: node tests/integration/verify-schemaworkmap-coverage.js
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// All boolean flags that gate helpers (from code analysis)
const HELPER_GATING_FLAGS = {
  // Top-level flags
  'id': { helper: 'Immutable validation', category: 'IMMUTABLE' },
  'thai': { helper: 'fetchThaiVTTContent + parseThaiVTTContent', category: 'LOAD' },
  'english': { helper: 'fetchEnglishVTTContent + parseEnglishVTTContent', category: 'LOAD' },
  'startSecThai': { helper: 'fetchThaiVTTContent + parseThaiVTTContent', category: 'LOAD' },
  'endSecThai': { helper: 'fetchThaiVTTContent + parseThaiVTTContent', category: 'LOAD' },
  'startSecEng': { helper: 'fetchEnglishVTTContent + parseEnglishVTTContent', category: 'LOAD' },
  'endSecEng': { helper: 'fetchEnglishVTTContent + parseEnglishVTTContent', category: 'LOAD' },
  'wordReferenceIdsThai': { helper: 'tokenizeThaiSentence', category: 'STRUCTURAL' },
  'wordReferenceIdsEng': { helper: 'tokenizeEnglishSentence', category: 'STRUCTURAL' },
  
  // Token-level flags
  'tokens.display[i].g2p': { helper: 'getPhonetics', category: 'PROCESS' },
  'tokens.display[i].englishPhonetic': { helper: 'parsePhoneticToEnglish', category: 'PROCESS' },
  'tokens.senses[i].senses (ORST)': { helper: 'scrapeOrstDictionary', category: 'PROCESS' },
  'tokens.senses[i].senses (normalization)': { helper: 'normalizeSensesWithGPT', category: 'PROCESS' },
};

// Read test file
const testFilePath = join(projectRoot, 'tests/integration/schemaworkmap-truth-table.test.js');
const testFileContent = readFileSync(testFilePath, 'utf-8');

// Extract test names from test file
const testNames = [];
const testRegex = /it\(['"]([^'"]+)['"]/g;
let match;
while ((match = testRegex.exec(testFileContent)) !== null) {
  testNames.push(match[1]);
}

// Verify coverage for each flag
const coverage = {};
let totalTests = 0;
let missingTests = [];

for (const [flag, info] of Object.entries(HELPER_GATING_FLAGS)) {
  const flagTests = {
    MISSING: false,
    DIRTY: false,
    CLEAN: false
  };
  
  // Check for MISSING state test
  const missingPattern = new RegExp(flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\[i\]/g, '\\[i\\]') + '.*MISSING|MISSING.*' + flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\[i\]/g, '\\[i\\]'), 'i');
  flagTests.MISSING = testNames.some(name => missingPattern.test(name) || name.toLowerCase().includes('missing'));
  
  // Check for DIRTY state test
  const dirtyPattern = new RegExp(flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\[i\]/g, '\\[i\\]') + '.*DIRTY|DIRTY.*' + flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\[i\]/g, '\\[i\\]'), 'i');
  flagTests.DIRTY = testNames.some(name => dirtyPattern.test(name) || name.toLowerCase().includes('dirty'));
  
  // Check for CLEAN state test
  const cleanPattern = new RegExp(flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\[i\]/g, '\\[i\\]') + '.*CLEAN|CLEAN.*' + flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\[i\]/g, '\\[i\\]'), 'i');
  flagTests.CLEAN = testNames.some(name => cleanPattern.test(name) || name.toLowerCase().includes('clean') || name.toLowerCase().includes('is not called'));
  
  coverage[flag] = {
    ...info,
    tests: flagTests,
    complete: flagTests.MISSING && flagTests.DIRTY && flagTests.CLEAN
  };
  
  if (flagTests.MISSING) totalTests++;
  if (flagTests.DIRTY) totalTests++;
  if (flagTests.CLEAN) totalTests++;
  
  if (!coverage[flag].complete) {
    missingTests.push({
      flag,
      missing: Object.entries(flagTests).filter(([_, exists]) => !exists).map(([state]) => state)
    });
  }
}

// Print coverage report
console.log('='.repeat(80));
console.log('SchemaWorkMap Truth-Table Coverage Verification');
console.log('='.repeat(80));
console.log();

console.log(`Total flags with helpers: ${Object.keys(HELPER_GATING_FLAGS).length}`);
console.log(`Expected tests: ${Object.keys(HELPER_GATING_FLAGS).length * 3} (${Object.keys(HELPER_GATING_FLAGS).length} flags × 3 states)`);
console.log(`Found tests: ${totalTests}`);
console.log();

// Group by category
const byCategory = {};
for (const [flag, info] of Object.entries(coverage)) {
  if (!byCategory[info.category]) {
    byCategory[info.category] = [];
  }
  byCategory[info.category].push({ flag, ...info });
}

// Print by category
for (const [category, flags] of Object.entries(byCategory)) {
  console.log(`${category} Fields (${flags.length} flags):`);
  console.log('-'.repeat(80));
  
  for (const { flag, helper, tests, complete } of flags) {
    const status = complete ? '✅' : '❌';
    console.log(`  ${status} ${flag}`);
    console.log(`     Helper: ${helper}`);
    console.log(`     Tests: MISSING=${tests.MISSING ? '✅' : '❌'} DIRTY=${tests.DIRTY ? '✅' : '❌'} CLEAN=${tests.CLEAN ? '✅' : '❌'}`);
    console.log();
  }
}

// Summary
console.log('='.repeat(80));
console.log('Coverage Summary');
console.log('='.repeat(80));

const completeFlags = Object.values(coverage).filter(c => c.complete).length;
const totalFlags = Object.keys(coverage).length;
const coveragePercent = Math.round((completeFlags / totalFlags) * 100);

console.log(`Complete: ${completeFlags}/${totalFlags} flags (${coveragePercent}%)`);
console.log();

if (missingTests.length > 0) {
  console.log('⚠️  Missing Tests:');
  for (const { flag, missing } of missingTests) {
    console.log(`  - ${flag}: Missing ${missing.join(', ')} state test(s)`);
  }
  console.log();
} else {
  console.log('✅ All flags have complete test coverage!');
  console.log();
}

// Verify test count
const expectedTestCount = Object.keys(HELPER_GATING_FLAGS).length * 3;
if (totalTests === expectedTestCount) {
  console.log(`✅ Test count matches expected: ${totalTests} tests`);
} else {
  console.log(`⚠️  Test count mismatch: Expected ${expectedTestCount}, found ${totalTests}`);
}

console.log();
console.log('='.repeat(80));

// Exit with error code if coverage incomplete
if (missingTests.length > 0 || totalTests !== expectedTestCount) {
  process.exit(1);
}

#!/usr/bin/env node
/**
 * Arcane Auto-Split Script
 * Automatically splits Thai sentences in the Arcane table using GPT-5.1
 */

import OpenAI from 'openai';

// Airtable configuration (from src/services/airtable.js)
const AIRTABLE_CONFIG = {
  apiToken: process.env.AIRTABLE_API_TOKEN || process.env.VITE_AIRTABLE_API_TOKEN || '',
  baseId: process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID || ''
};

// OpenAI configuration
const OPENAI_CONFIG = {
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '',
  model: 'gpt-5.1'
};

const TABLE_NAME = 'Arcane';
const THROTTLE_MS = 250; // 200-300ms throttle between API calls

// Initialize OpenAI client
const openaiClient = new OpenAI({
  apiKey: OPENAI_CONFIG.apiKey
});

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch all records from Arcane table where thai exists but thaiSplit is empty
 */
async function fetchRecordsNeedingSplit() {
  const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(TABLE_NAME)}`;
  const params = new URLSearchParams();
  
  // Filter: thai exists AND (thaiSplit is empty OR missing)
  const filterFormula = `AND({thai} != "", OR({thaiSplit} = "", {thaiSplit} = BLANK()))`;
  params.append('filterByFormula', filterFormula);
  params.append('fields[]', 'thai');
  params.append('fields[]', 'thaiSplit');
  params.append('maxRecords', '1000'); // Adjust if needed
  
  const records = [];
  let offset = null;
  
  do {
    if (offset) {
      params.set('offset', offset);
    }
    
    const response = await fetch(`${url}?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_CONFIG.apiToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable API error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    records.push(...data.records);
    offset = data.offset || null;
  } while (offset);
  
  return records;
}

/**
 * Call GPT-5.1 to split Thai sentence
 */
async function splitThaiWithGPT(thaiSentence) {
  const systemPrompt = 'Split this Thai sentence into dictionary-level tokens that maximize semantic clarity. Output only a space-separated list. Do NOT translate.';
  const userPrompt = thaiSentence;
  
  try {
    const response = await openaiClient.chat.completions.create({
      model: OPENAI_CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0,
      max_tokens: 500
    });
    
    const result = response.choices?.[0]?.message?.content?.trim() || '';
    
    // Clean up: remove line breaks, extra spaces
    const cleaned = result.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    return cleaned;
  } catch (error) {
    throw new Error(`GPT API error: ${error.message}`);
  }
}

/**
 * Update record's thaiSplit field in Airtable
 */
async function updateThaiSplit(recordId, thaiSplit) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(TABLE_NAME)}/${recordId}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_CONFIG.apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: {
        thaiSplit: thaiSplit
      }
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable update error ${response.status}: ${errorText}`);
  }
  
  return await response.json();
}

/**
 * Main processing function
 */
async function main() {
  console.log('Arcane Auto-Split Script');
  console.log('='.repeat(50));
  
  try {
    // Fetch records needing split
    console.log('\nFetching records from Arcane table...');
    const records = await fetchRecordsNeedingSplit();
    console.log(`Found ${records.length} records needing split\n`);
    
    if (records.length === 0) {
      console.log('No records to process.');
      console.log('\nArcane auto-split complete.');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    // Process each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const recordId = record.id;
      const thai = record.fields?.thai || '';
      
      console.log(`[${i + 1}/${records.length}] Processing record: ${recordId}`);
      console.log(`  Original Thai: ${thai}`);
      
      try {
        // Call GPT to split
        const thaiSplit = await splitThaiWithGPT(thai);
        
        // Validate output
        if (!thaiSplit || thaiSplit.length === 0) {
          console.log(`  ⚠️  Warning: GPT returned empty output, skipping record`);
          skippedCount++;
          continue;
        }
        
        console.log(`  Generated thaiSplit: ${thaiSplit}`);
        
        // Update Airtable
        await updateThaiSplit(recordId, thaiSplit);
        console.log(`  ✅ Success`);
        successCount++;
        
        // Throttle between API calls
        if (i < records.length - 1) {
          await sleep(THROTTLE_MS);
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        errorCount++;
        // Continue processing other records
      }
      
      console.log(''); // Blank line between records
    }
    
    // Summary
    console.log('='.repeat(50));
    console.log('Summary:');
    console.log(`  Total records: ${records.length}`);
    console.log(`  Successful: ${successCount}`);
    console.log(`  Errors: ${errorCount}`);
    console.log(`  Skipped: ${skippedCount}`);
    console.log('\nArcane auto-split complete.');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();


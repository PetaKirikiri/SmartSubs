#!/usr/bin/env node
/**
 * Parse Thai Wiktionary XML export to JSON
 * Uses streaming parser to handle large file (>200MB, 2.2M+ pages)
 */

import fs from 'fs';
import { createReadStream } from 'fs';
import { createWriteStream } from 'fs';
import sax from 'sax';

const INPUT_FILE = './public/thaiWiktionary.xml';
const OUTPUT_FILE = './public/thaiWiktionary.json';

// Statistics
let pageCount = 0;
let entryCount = 0;
let skippedCount = 0;

// Current parsing state
let currentPage = null;
let currentElement = null;
let currentText = '';
let inTextElement = false;
let inRevision = false;

// Output stream (using newline-delimited JSON for large datasets)
const outputStream = createWriteStream(OUTPUT_FILE, { encoding: 'utf8' });
outputStream.write('[\n'); // Start JSON array

let isFirstEntry = true;

// Create streaming XML parser
const parser = sax.createStream(true, {
  trim: false,
  normalize: false,
  lowercase: false,
  xmlns: false,
  position: false
});

// Handle opening tags
parser.onopentag = (node) => {
  if (node.name === 'page') {
    currentPage = {
      title: null,
      namespace: null,
      id: null,
      text: null,
      timestamp: null,
      contributor: null
    };
    inRevision = false;
  } else if (node.name === 'revision') {
    inRevision = true;
  } else if (node.name === 'text') {
    inTextElement = true;
    currentText = '';
  } else if (node.name === 'contributor') {
    currentPage.contributor = {};
  }
  
  currentElement = node.name;
};

// Handle text content
parser.ontext = (text) => {
  if (inTextElement && currentElement === 'text') {
    currentText += text;
  } else if (currentPage && !inTextElement) {
    switch (currentElement) {
      case 'title':
        currentPage.title = (currentPage.title || '') + text;
        break;
      case 'ns':
        const nsText = (currentPage.namespace || '') + text;
        currentPage.namespace = parseInt(nsText.trim()) || 0;
        break;
      case 'id':
        if (!inRevision) {
          const idText = (currentPage.id || '') + text;
          currentPage.id = parseInt(idText.trim()) || null;
        }
        break;
      case 'timestamp':
        if (inRevision) {
          currentPage.timestamp = (currentPage.timestamp || '') + text;
        }
        break;
      case 'username':
        if (currentPage.contributor) {
          currentPage.contributor.username = (currentPage.contributor.username || '') + text;
        }
        break;
    }
  }
};

// Handle closing tags
parser.onclosetag = (tagName) => {
  if (tagName === 'text' && inTextElement) {
    if (currentPage && inRevision) {
      currentPage.text = currentText;
    }
    inTextElement = false;
    currentText = '';
    currentElement = null;
  } else if (tagName === 'revision') {
    inRevision = false;
  } else if (tagName === 'title' && currentPage) {
    currentPage.title = (currentPage.title || '').trim();
  } else if (tagName === 'ns' && currentPage) {
    currentPage.namespace = parseInt((currentPage.namespace || '').toString().trim()) || 0;
  } else if (tagName === 'id' && currentPage && !inRevision) {
    currentPage.id = parseInt((currentPage.id || '').toString().trim()) || null;
  } else if (tagName === 'timestamp' && currentPage && inRevision) {
    currentPage.timestamp = (currentPage.timestamp || '').trim();
  } else if (tagName === 'username' && currentPage && currentPage.contributor) {
    currentPage.contributor.username = (currentPage.contributor.username || '').trim();
  } else if (tagName === 'page' && currentPage) {
    pageCount++;
    
    // Only process main namespace entries (ns === 0) - actual dictionary entries
    // Skip meta pages, categories, templates, etc.
    if (currentPage.namespace === 0 && currentPage.text && currentPage.text.trim()) {
      entryCount++;
      
      // Write entry as JSON (newline-delimited format for large files)
      if (!isFirstEntry) {
        outputStream.write(',\n');
      }
      isFirstEntry = false;
      
      const entry = {
        title: currentPage.title,
        id: currentPage.id,
        text: currentPage.text,
        timestamp: currentPage.timestamp || null,
        contributor: currentPage.contributor || null
      };
      
      outputStream.write(JSON.stringify(entry, null, 2));
      
      // Progress indicator every 10000 entries
      if (entryCount % 10000 === 0) {
        console.log(`Processed ${entryCount} entries (${pageCount} total pages)...`);
      }
    } else {
      skippedCount++;
    }
    
    currentPage = null;
  }
  
  currentElement = null;
};

// Handle errors
parser.onerror = (err) => {
  console.error('Parser error:', err);
  process.exit(1);
};

// Handle end of stream
parser.onend = () => {
  outputStream.write('\n]'); // Close JSON array
  outputStream.end();
  
  console.log('\n=== Parsing Complete ===');
  console.log(`Total pages processed: ${pageCount}`);
  console.log(`Dictionary entries extracted: ${entryCount}`);
  console.log(`Skipped (non-main namespace): ${skippedCount}`);
  console.log(`Output file: ${OUTPUT_FILE}`);
};

// Start parsing
console.log(`Parsing ${INPUT_FILE}...`);
console.log('This may take a while for large files...\n');

const inputStream = createReadStream(INPUT_FILE, { encoding: 'utf8' });
inputStream.pipe(parser);

inputStream.on('error', (err) => {
  console.error('File read error:', err);
  process.exit(1);
});

outputStream.on('error', (err) => {
  console.error('File write error:', err);
  process.exit(1);
});


#!/usr/bin/env node
// scripts/show_snippet.js
// Usage: node scripts/show_snippet.js /path/to/acos_page.html
// If no path is provided, reads from stdin.

'use strict';

const fs = require('fs');

function readInput(file) {
  if (!file || file === '-') return fs.readFileSync(0, 'utf8');
  return fs.readFileSync(file, 'utf8');
}

function extractExerciseJson(html) {
  // Match: window.JSTRACING_EXERCISE = {...};
  const re = /window\.JSTRACING_EXERCISE\s*=\s*(\{[\s\S]*?\})\s*;/m;
  const m = html.match(re);
  if (!m) return null;
  return m[1];
}

function tryParse(jsonStr) {
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

function main() {
  const file = process.argv[2];
  const html = readInput(file);
  const exerStr = extractExerciseJson(html);
  if (!exerStr) {
    console.error('No window.JSTRACING_EXERCISE found in input');
    process.exit(1);
  }

  const obj = tryParse(exerStr);
  if (!obj) {
    console.error('Failed to parse exercise JSON. Raw output:');
    console.log(exerStr);
    process.exit(2);
  }

  if (obj.code) {
    console.log(obj.code);
  } else {
    console.log(JSON.stringify(obj, null, 2));
  }
}

if (require.main === module) main();

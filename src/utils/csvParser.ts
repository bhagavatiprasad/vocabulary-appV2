/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VocabularyWord } from '../types';

export function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let currentToken = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      // Handle escaped quote inside quotes: ""
      if (inQuotes && text[i + 1] === '"') {
        currentToken += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(currentToken.trim());
      currentToken = "";
    } else {
      currentToken += char;
    }
  }
  result.push(currentToken.trim());
  return result;
}

export function parseVocabularyCSV(csvText: string): VocabularyWord[] {
  const lines = csvText.split(/\r?\n/);
  const words: VocabularyWord[] = [];

  let currentLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' = 'A1';
  let currentLevelName = 'Elementary';

  let idCounter = 1;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Check for CEFR header starts
    if (trimmedLine.toLowerCase().includes("words a1 (elementary)")) {
      currentLevel = 'A1';
      currentLevelName = 'Elementary';
      continue;
    } else if (trimmedLine.toLowerCase().includes("words a2 (pre-intermediate)")) {
      currentLevel = 'A2';
      currentLevelName = 'Pre-Intermediate';
      continue;
    } else if (trimmedLine.toLowerCase().includes("words b1 (intermediate)")) {
      currentLevel = 'B1';
      currentLevelName = 'Intermediate';
      continue;
    } else if (trimmedLine.toLowerCase().includes("words b2 (upper intermediate)")) {
      currentLevel = 'B2';
      currentLevelName = 'Upper Intermediate';
      continue;
    } else if (trimmedLine.toLowerCase().includes("words c1 (advanced)")) {
      currentLevel = 'C1';
      currentLevelName = 'Advanced';
      continue;
    } else if (trimmedLine.toLowerCase().includes("words c2 (proficiency)")) {
      currentLevel = 'C2';
      currentLevelName = 'Proficiency';
      continue;
    }

    // Skip column header lines like "ability,noun,basic meaning,..."
    if (
      trimmedLine.toLowerCase().startsWith("word,") ||
      trimmedLine.toLowerCase().includes("part of speech,basic meaning")
    ) {
      continue;
    }

    const columns = parseCSVLine(trimmedLine);
    if (columns.length < 3 || !columns[0]) continue;

    const wordVal = columns[0];
    const posVal = columns[1] || 'noun';
    const meaningVal = columns[2] || '';
    
    // Status mapping
    let statusVal: 'Learning' | 'Familiar' | 'Mastered' = 'Learning';
    const rawStatus = (columns[3] || '').trim().toLowerCase();
    if (rawStatus === 'mastered') {
      statusVal = 'Mastered';
    } else if (rawStatus === 'familiar') {
      statusVal = 'Familiar';
    }

    // Generate unique ID based on word and level
    const parsedWordClean = wordVal.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
    const id = `${currentLevel.toLowerCase()}_${parsedWordClean}_${idCounter++}`;

    words.push({
      id,
      word: wordVal,
      pos: posVal,
      meaning: meaningVal,
      status: statusVal,
      level: currentLevel,
      levelName: currentLevelName,
    });
  }

  return words;
}

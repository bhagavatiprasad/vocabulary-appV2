/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VocabularyWord } from '../types';
import { defaultVocabulary } from '../data/defaultVocabulary';

// Utility to create a local backup map of meanings
export const createMeaningBackupMap = (words: VocabularyWord[]): Map<string, string> => {
  const map = new Map<string, string>();
  words.forEach(w => {
    if (w.meaning) {
      const key = `${w.word.toLowerCase()}_${w.level.toLowerCase()}`;
      map.set(key, w.meaning);
    }
  });
  return map;
};

// Reconstruct standard Vocab word item from Supabase format
export const reconstructFromSupabaseRow = (
  row: any,
  meaningBackup: Map<string, string>
): VocabularyWord => {
  const wordSpelling = row.word || '';
  const level = (row.classification || 'A1') as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  const pos = row.type || 'noun';
  const status = (row.status || 'Learning') as 'Learning' | 'Familiar' | 'Mastered';
  const uuid = row.id;

  const key = `${wordSpelling.toLowerCase()}_${level.toLowerCase()}`;
  let meaning = meaningBackup.get(key);

  // Fallback to default vocabulary
  if (!meaning) {
    const matchedDefault = defaultVocabulary.find(
      w => w.word.toLowerCase() === wordSpelling.toLowerCase() && w.level === level
    );
    if (matchedDefault) {
      meaning = matchedDefault.meaning;
    }
  }

  // Final fallback
  if (!meaning) {
    meaning = "Definition imported from cloud database.";
  }

  const levelNameMap: Record<string, string> = {
    A1: 'Elementary',
    A2: 'Pre-Intermediate',
    B1: 'Intermediate',
    B2: 'Upper Intermediate',
    C1: 'Advanced',
    C2: 'Proficiency'
  };

  return {
    id: uuid || `${level.toLowerCase()}_${wordSpelling.toLowerCase()}_${Date.now()}`,
    word: wordSpelling,
    pos: pos,
    meaning,
    status,
    level,
    levelName: levelNameMap[level] || 'Elementary'
  };
};

/**
 * Fetch all words for the authenticated user from Supabase.
 */
export const fetchSupabaseWords = async (supabaseClient: any, userId: string): Promise<any[]> => {
  const { data, error } = await supabaseClient
    .from('vocab_words')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return data || [];
};

/**
 * Erases existing user rows on Supabase and saves local words there.
 */
export const pushLocalToSupabase = async (
  supabaseClient: any,
  userId: string,
  localWords: VocabularyWord[]
): Promise<{ success: boolean; count: number }> => {
  // 1. Delete all existing records for the current user
  const { error: deleteError } = await supabaseClient
    .from('vocab_words')
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    throw new Error(`Deletion Error: ${deleteError.message}`);
  }

  if (localWords.length === 0) {
    return { success: true, count: 0 };
  }

  // 2. Prepare database rows according to the table schema specified:
  // user_id, word, classification, type, status
  const rowsToInsert = localWords.map(w => ({
    user_id: userId,
    word: w.word,
    classification: w.level,
    type: w.pos,
    status: w.status,
  }));

  // Note: Supabase can batch insert up to thousands of rows perfectly
  const { error: insertError } = await supabaseClient
    .from('vocab_words')
    .insert(rowsToInsert);

  if (insertError) {
    throw new Error(`Insert Error: ${insertError.message}`);
  }

  return { success: true, count: localWords.length };
};

/**
 * Pulls from Supabase, completely overriding local items.
 */
export const pullFromSupabase = async (
  supabaseClient: any,
  userId: string,
  currentLocalWords: VocabularyWord[]
): Promise<VocabularyWord[]> => {
  const remoteRows = await fetchSupabaseWords(supabaseClient, userId);
  const backupMap = createMeaningBackupMap(currentLocalWords);

  return remoteRows.map(row => reconstructFromSupabaseRow(row, backupMap));
};

/**
 * Merges both local and remote sets.
 * Priority given to local mutations if a conflict arises during direct match.
 */
export const mergeSyncWithSupabase = async (
  supabaseClient: any,
  userId: string,
  localWords: VocabularyWord[]
): Promise<VocabularyWord[]> => {
  // 1. Fetch remote rows
  const remoteRows = await fetchSupabaseWords(supabaseClient, userId);
  const backupMap = createMeaningBackupMap(localWords);

  // Reconstruct remote items to match standard local vocabulary types
  const remoteWords = remoteRows.map(row => reconstructFromSupabaseRow(row, backupMap));

  // 2. Create index sets based on literal signature (word + '_' + level)
  const mergedMap = new Map<string, VocabularyWord>();

  // Add remote values first
  remoteWords.forEach(w => {
    const key = `${w.word.toLowerCase()}_${w.level.toLowerCase()}`;
    mergedMap.set(key, w);
  });

  // Keep local values, which take priority for updates/status edits
  localWords.forEach(w => {
    const key = `${w.word.toLowerCase()}_${w.level.toLowerCase()}`;
    mergedMap.set(key, w);
  });

  const mergedList = Array.from(mergedMap.values());

  // 3. Update Supabase with the fully merged clean index
  await pushLocalToSupabase(supabaseClient, userId, mergedList);

  return mergedList;
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VocabularyWord } from '../types';
import { defaultVocabulary } from '../data/defaultVocabulary';

// Helper to filter words that have been modified compared to defaultVocabulary
export const getModifiedWords = (localWords: VocabularyWord[]): VocabularyWord[] => {
  const defaultMap = new Map<string, any>();
  defaultVocabulary.forEach(w => {
    const key = `${w.word.toLowerCase()}_${w.level.toLowerCase()}`;
    defaultMap.set(key, w);
  });

  return localWords.filter(word => {
    const key = `${word.word.toLowerCase()}_${word.level.toLowerCase()}`;
    const def = defaultMap.get(key);
    if (!def) {
      // Custom added word
      return true;
    }
    // Check if status, pos, or meaning differs
    return (
      word.status !== def.status ||
      word.pos !== def.pos ||
      word.meaning !== def.meaning
    );
  });
};

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
 * Fetch all words for the authenticated user from Supabase using pagination.
 */
export const fetchSupabaseWords = async (supabaseClient: any, userId: string): Promise<any[]> => {
  let allData: any[] = [];
  let from = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const to = from + limit - 1;
    const { data, error } = await supabaseClient
      .from('vocab_words')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    if (data && data.length > 0) {
      allData = allData.concat(data);
      if (data.length < limit) {
        hasMore = false;
      } else {
        from += limit;
      }
    } else {
      hasMore = false;
    }
  }

  return allData.reverse();
};

/**
 * Syncs a single word's active status or entire row to Supabase in real-time.
 */
export const syncSingleWordToCloud = async (
  supabaseClient: any,
  userId: string,
  word: VocabularyWord
) => {
  try {
    // 1. Check if record already exists for this word and CEFR classification level
    const { data, error: selectError } = await supabaseClient
      .from('vocab_words')
      .select('id')
      .eq('user_id', userId)
      .eq('word', word.word)
      .eq('classification', word.level)
      .limit(1);

    if (selectError) throw selectError;

    if (data && data.length > 0) {
      // Update status and type of the existing record
      const { error: updateError } = await supabaseClient
        .from('vocab_words')
        .update({
          type: word.pos,
          status: word.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', data[0].id);
      if (updateError) throw updateError;
    } else {
      // Insert new record
      const { error: insertError } = await supabaseClient
        .from('vocab_words')
        .insert({
          user_id: userId,
          word: word.word,
          classification: word.level,
          type: word.pos,
          status: word.status,
        });
      if (insertError) throw insertError;
    }
  } catch (err) {
    console.warn("Failed to sync word to cloud database real-time:", err);
  }
};

/**
 * Deletes a single word from cloud storage.
 */
export const deleteSingleWordFromCloud = async (
  supabaseClient: any,
  userId: string,
  wordVal: string,
  levelVal: string
) => {
  try {
    const { error } = await supabaseClient
      .from('vocab_words')
      .delete()
      .eq('user_id', userId)
      .eq('word', wordVal)
      .eq('classification', levelVal);
    if (error) throw error;
  } catch (err) {
    console.warn("Failed to delete word from cloud workspace real-time:", err);
  }
};

/**
 * Erases existing user rows on Supabase and saves ONLY modified local words in clean batches.
 */
export const pushLocalToSupabase = async (
  supabaseClient: any,
  userId: string,
  localWords: VocabularyWord[]
): Promise<{ success: boolean; count: number }> => {
  // 1. Screen modified entries only to respect database performance limits
  const modifiedEntries = getModifiedWords(localWords);

  // 2. Wipe current remote cache completely
  const { error: deleteError } = await supabaseClient
    .from('vocab_words')
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    throw new Error(`Deletion Error: ${deleteError.message}`);
  }

  if (modifiedEntries.length === 0) {
    return { success: true, count: 0 };
  }

  const rowsToInsert = modifiedEntries.map(w => ({
    user_id: userId,
    word: w.word,
    classification: w.level,
    type: w.pos,
    status: w.status,
  }));

  const batchSize = 1000;
  for (let i = 0; i < rowsToInsert.length; i += batchSize) {
    const chunk = rowsToInsert.slice(i, i + batchSize);
    const { error: insertError } = await supabaseClient
      .from('vocab_words')
      .insert(chunk);

    if (insertError) {
      throw new Error(`Insert Error (Batch ${Math.floor(i / batchSize) + 1}): ${insertError.message}`);
    }
  }

  return { success: true, count: modifiedEntries.length };
};

/**
 * Pulls from Supabase, applying overlay customizations on top of the original defaults.
 */
export const pullFromSupabase = async (
  supabaseClient: any,
  userId: string,
  currentLocalWords: VocabularyWord[]
): Promise<VocabularyWord[]> => {
  // 1. Fetch remote user records (which only include their modified delta rows)
  const remoteRows = await fetchSupabaseWords(supabaseClient, userId);
  const backupMap = createMeaningBackupMap(currentLocalWords);

  // Reconstruct remote items
  const remoteWords = remoteRows.map(row => reconstructFromSupabaseRow(row, backupMap));

  // 2. Start with fresh default vocabulary and layer remote user records on top of it
  const reconstructedMap = new Map<string, VocabularyWord>();
  defaultVocabulary.forEach((originalWord: VocabularyWord) => {
    const key = `${originalWord.word.toLowerCase()}_${originalWord.level.toLowerCase()}`;
    reconstructedMap.set(key, { ...originalWord });
  });

  // Overlay remote custom/modified rows
  remoteWords.forEach(rw => {
    const key = `${rw.word.toLowerCase()}_${rw.level.toLowerCase()}`;
    reconstructedMap.set(key, rw);
  });

  return Array.from(reconstructedMap.values());
};

/**
 * Merges local edits with remote cloud states in a robust hybrid index.
 */
export const mergeSyncWithSupabase = async (
  supabaseClient: any,
  userId: string,
  localWords: VocabularyWord[]
): Promise<VocabularyWord[]> => {
  // 1. Pull current remote records
  const remoteRows = await fetchSupabaseWords(supabaseClient, userId);
  const backupMap = createMeaningBackupMap(localWords);

  // Convert remote entries to structured form
  const remoteWords = remoteRows.map(row => reconstructFromSupabaseRow(row, backupMap));

  // Create an overlay map starting from defaults
  const mergedMap = new Map<string, VocabularyWord>();
  defaultVocabulary.forEach((originalWord: VocabularyWord) => {
    const key = `${originalWord.word.toLowerCase()}_${originalWord.level.toLowerCase()}`;
    mergedMap.set(key, { ...originalWord });
  });

  // Layer remote changes
  remoteWords.forEach(rw => {
    const key = `${rw.word.toLowerCase()}_${rw.level.toLowerCase()}`;
    mergedMap.set(key, rw);
  });

  // Layer local changes (takes priority)
  const modifiedLocal = getModifiedWords(localWords);
  modifiedLocal.forEach(lw => {
    const key = `${lw.word.toLowerCase()}_${lw.level.toLowerCase()}`;
    mergedMap.set(key, lw);
  });

  const fullMergedList = Array.from(mergedMap.values());

  // Save the synchronized modified records back to Supabase
  await pushLocalToSupabase(supabaseClient, userId, fullMergedList);

  return fullMergedList;
};

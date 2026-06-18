/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface VocabularyWord {
  id: string;
  word: string;
  pos: string;
  meaning: string;
  status: 'Learning' | 'Familiar' | 'Mastered';
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  levelName: string;
}

export interface CEFRLevelInfo {
  code: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  name: string;
  description: string;
  color: string;
}

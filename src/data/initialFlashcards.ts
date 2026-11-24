import term3CsvRaw from './term3Exam.csv?raw';
import type { ExamScope, Flashcard } from '../types/flashcards';
import { parseFlashcardsCsv } from '../utils/flashcardParser';

export const TERM3_SCOPE_ID = 'scope-term3-exam';

export const INITIAL_EXAM_SCOPES: ExamScope[] = [
  {
    id: TERM3_SCOPE_ID,
    name: '第3回定期考査範囲',
    description:
      '歴史総合：第3章（20〜21）・第4章（22〜25）・第5章（26〜33）の全14単元・289問',
    createdAt: 1763960000000,
  },
];

export function buildInitialTerm3Flashcards(): Flashcard[] {
  const parsed = parseFlashcardsCsv(term3CsvRaw, {
    scopeId: TERM3_SCOPE_ID,
    idPrefix: 'term3',
    startNumber: 1,
    baseTimestamp: 1763960000000,
  });
  return parsed.cards;
}

export const INITIAL_FLASHCARDS: Flashcard[] = buildInitialTerm3Flashcards();

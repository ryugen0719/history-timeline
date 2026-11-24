export interface ExamScope {
  id: string;
  name: string;
  description: string;
  createdAt: number;
}

export interface Flashcard {
  id: string;
  scopeId: string;
  number: number;
  deckPath: string;
  chapter: string;
  unit: string;
  front: string;
  back: string;
  tags: string[];
  note?: string;
  starred?: boolean;
  suspended?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type SrsCardState = 'new' | 'learning' | 'review' | 'relearning';

export type SrsRating = 1 | 2 | 3 | 4;

export interface SrsProgress {
  cardId: string;
  state: SrsCardState;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  lastReviewedAt: number | null;
  dueAt: number | null;
  totalReviews: number;
  correctReviews: number;
}

export type SrsProgressMap = Record<string, SrsProgress>;

export interface DailyStudyLog {
  date: string; // YYYY-MM-DD
  reviews: number;
  correct: number;
  newStudied: number;
  againCount: number;
}

export type DailyStudyLogsMap = Record<string, DailyStudyLog>;

export type StudyMode = 'flip' | 'redsheet' | 'typing';
export type FlashcardSubView = 'hub' | 'study' | 'analytics' | 'manage';
export type StudyFilterPreset = 'due' | 'all' | 'new' | 'weak' | 'starred';
export type StudyOrderMode = 'srs' | 'unit' | 'shuffle';
export type TagMatchMode = 'and' | 'or';

export interface StudySessionConfig {
  scopeId: string; // 'all' or specific ExamScope.id
  chapter: string; // 'all' or chapter name
  unit: string; // 'all' or unit name
  selectedTags: string[];
  tagMatchMode: TagMatchMode;
  filterPreset: StudyFilterPreset;
  orderMode: StudyOrderMode;
  swapFrontBack: boolean;
  recordToSrs: boolean;
  mode: StudyMode;
  label?: string;
}

export type TagCategoryKey =
  | 'importance'
  | 'category'
  | 'region'
  | 'lesson'
  | 'custom';

export interface ParsedTagMeta {
  raw: string;
  categoryKey: TagCategoryKey;
  categoryLabel: string;
  displayLabel: string;
}

export interface FlashcardBackupPayload {
  version: 1;
  exportedAt: string;
  scopes: ExamScope[];
  cards: Flashcard[];
  srsMap?: SrsProgressMap;
  dailyLogs?: DailyStudyLogsMap;
}

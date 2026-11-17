export type DatePrecision =
  | 'year'
  | 'month'
  | 'day'
  | 'century'
  | 'period'
  | 'unknown';

export type EventCategory =
  | 'politics'
  | 'diplomacy'
  | 'economy'
  | 'military'
  | 'society'
  | 'culture'
  | 'religion'
  | 'science';

export type Certainty = 'explicit' | 'inferred';

export type ImportanceLevel = 1 | 2 | 3;

export interface HistoricalEvent {
  id: string;
  date: string;
  date_precision: DatePrecision;
  title: string;
  description: string;
  people: string[];
  places: string[];
  category: EventCategory[];
  causes: string[];
  consequences: string[];
  related_events: string[];
  importance: ImportanceLevel;
  source: string;
  certainty: Certainty;
}

export interface HistoricalDatabase {
  events: HistoricalEvent[];
}

export type ViewMode = 'timeline' | 'places' | 'people';
export type SortOrder = 'asc' | 'desc';
export type TimelineGroupMode = 'era' | 'color';

export type AssignedColorId =
  | 'vermilion'
  | 'lapis'
  | 'forest'
  | 'amber'
  | 'plum'
  | 'slate';

export type ColorId = 'none' | AssignedColorId;

export interface ColorDefinition {
  id: AssignedColorId;
  colorName: string;
  defaultLabel: string;
  swatchHex: string;
  surfaceHex: string;
  borderHex: string;
}

export const COLOR_PALETTE: ColorDefinition[] = [
  {
    id: 'vermilion',
    colorName: '赤',
    defaultLabel: '政治・制度',
    swatchHex: '#DC2626',
    surfaceHex: '#FEF2F2',
    borderHex: '#FECACA',
  },
  {
    id: 'lapis',
    colorName: '青',
    defaultLabel: '外交・国際',
    swatchHex: '#1D4ED8',
    surfaceHex: '#EFF6FF',
    borderHex: '#BFDBFE',
  },
  {
    id: 'forest',
    colorName: '緑',
    defaultLabel: '経済・社会',
    swatchHex: '#15803D',
    surfaceHex: '#F0FDF4',
    borderHex: '#BBF7D0',
  },
  {
    id: 'amber',
    colorName: '黄',
    defaultLabel: '文化・思想・科学',
    swatchHex: '#D97706',
    surfaceHex: '#FFFBEB',
    borderHex: '#FDE68A',
  },
  {
    id: 'plum',
    colorName: '紫',
    defaultLabel: '軍事・紛争',
    swatchHex: '#7E22CE',
    surfaceHex: '#FAF5FF',
    borderHex: '#E9D5FF',
  },
  {
    id: 'slate',
    colorName: '青緑',
    defaultLabel: 'その他・メモ',
    swatchHex: '#0F766E',
    surfaceHex: '#F0FDFA',
    borderHex: '#99F6E4',
  },
];

export type ColorLabelsMap = Record<AssignedColorId, string>;

export const DEFAULT_COLOR_LABELS: ColorLabelsMap = {
  vermilion: '政治・制度',
  lapis: '外交・国際',
  forest: '経済・社会',
  amber: '文化・思想・科学',
  plum: '軍事・紛争',
  slate: 'その他・メモ',
};

export const LEGACY_DEFAULT_COLOR_LABELS: ColorLabelsMap = {
  vermilion: '朱色（重要・転換点）',
  lapis: '藍色（外交・国際）',
  forest: '深緑（経済・社会）',
  amber: '琥珀（文化・思想）',
  plum: '紫檀（軍事・紛争）',
  slate: '墨色（補足・制度）',
};

export const IMPORTANCE_COLOR_LABELS: ColorLabelsMap = {
  vermilion: '最重要（転換点）',
  lapis: '要確認',
  forest: '理解済み',
  amber: '重要（基本事項）',
  plum: '苦手・要復習',
  slate: '補足・背景',
};

export const STUDY_COLOR_LABELS: ColorLabelsMap = {
  vermilion: 'テスト頻出',
  lapis: '流れが重要',
  forest: '覚えた',
  amber: '要暗記',
  plum: '苦手・要復習',
  slate: '補足メモ',
};

export interface PersonProfile {
  photoUrl: string;
  note?: string;
}

export type PersonProfilesMap = Record<string, PersonProfile>;
export type EventColorsMap = Record<string, AssignedColorId>;

export interface TimelineFilters {
  search: string;
  category: EventCategory | 'all';
  importance: ImportanceLevel | 'all';
  certainty: Certainty | 'all';
  place: string | 'all';
  color: ColorId | 'all';
  sortOrder: SortOrder;
}

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  politics: '政治',
  diplomacy: '外交',
  economy: '経済',
  military: '軍事',
  society: '社会',
  culture: '文化',
  religion: '宗教',
  science: '科学・技術',
};

export const PRECISION_LABELS: Record<DatePrecision, string> = {
  day: '年月日',
  month: '年月',
  year: '年',
  century: '世紀',
  period: '時代・年代',
  unknown: '不明',
};

export const CERTAINTY_LABELS: Record<Certainty, string> = {
  explicit: '資料明記',
  inferred: '文脈推定',
};

export const IMPORTANCE_LABELS: Record<ImportanceLevel, string> = {
  3: '最重要（時代の転換点）',
  2: '重要（主要政策・事件）',
  1: '補足（背景・関連事項）',
};

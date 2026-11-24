import type {
  ExamScope,
  Flashcard,
  FlashcardBackupPayload,
  ParsedTagMeta,
  TagCategoryKey,
} from '../types/flashcards';

export function normalizeTag(rawTag: string): string {
  return rawTag
    .trim()
    .replace(/^#+/, '')
    .trim();
}

export function parseTagsString(input: string): string[] {
  if (!input || !input.trim()) return [];
  const tokens = input
    .split(/[\s　,、]+/)
    .map(normalizeTag)
    .filter(Boolean);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of tokens) {
    if (!seen.has(t)) {
      seen.add(t);
      result.push(t);
    }
  }
  return result;
}

export function parseTagMeta(rawTag: string): ParsedTagMeta {
  const clean = normalizeTag(rawTag);

  if (clean.startsWith('重要度_')) {
    return {
      raw: clean,
      categoryKey: 'importance',
      categoryLabel: '重要度',
      displayLabel: clean.slice('重要度_'.length),
    };
  }
  if (clean.startsWith('分類_')) {
    return {
      raw: clean,
      categoryKey: 'category',
      categoryLabel: '分類・分野',
      displayLabel: clean.slice('分類_'.length),
    };
  }
  if (clean.startsWith('分野_')) {
    return {
      raw: clean,
      categoryKey: 'category',
      categoryLabel: '分類・分野',
      displayLabel: `分野: ${clean.slice('分野_'.length)}`,
    };
  }
  if (clean.startsWith('地域_')) {
    return {
      raw: clean,
      categoryKey: 'region',
      categoryLabel: '地域',
      displayLabel: clean.slice('地域_'.length),
    };
  }
  if (clean.startsWith('授業_')) {
    const rest = clean.slice('授業_'.length);
    const formatted = rest.replace(/^(\d+)_/, '$1. ');
    return {
      raw: clean,
      categoryKey: 'lesson',
      categoryLabel: '授業単元タグ',
      displayLabel: formatted,
    };
  }

  return {
    raw: clean,
    categoryKey: 'custom',
    categoryLabel: 'カスタムタグ',
    displayLabel: clean,
  };
}

export const TAG_CATEGORY_ORDER: Array<{ key: TagCategoryKey; label: string }> = [
  { key: 'importance', label: '重要度' },
  { key: 'category', label: '分類・分野' },
  { key: 'region', label: '地域' },
  { key: 'lesson', label: '授業単元タグ' },
  { key: 'custom', label: 'カスタムタグ' },
];

/**
 * RFC-4180 compliant CSV / TSV parser supporting quoted fields and commas inside quotes.
 */
export function parseDelimitedRows(rawText: string): string[][] {
  const cleaned = rawText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLine = cleaned.split('\n').find((line) => line.trim().length > 0) ?? '';

  // Auto-detect delimiter (TSV if tabs outnumber commas on header line)
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const delimiter = tabCount > commaCount ? '\t' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"' && cell.length === 0) {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(cell);
        cell = '';
      } else if (ch === '\n') {
        row.push(cell);
        if (row.some((v) => v.trim().length > 0)) {
          rows.push(row);
        }
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((v) => v.trim().length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

export interface CsvParseResult {
  ok: boolean;
  cards: Flashcard[];
  errors: string[];
  warnings: string[];
}

/**
 * Parses Anki-style or standard Q&A CSV/TSV into Flashcard objects WITHOUT dropping duplicate rows.
 * Supported headers:
 *   No., デッキ, 章, 単元, 表面, 裏面, タグ
 *   or 問題, 解答, タグ (plus optional 章, 単元, メモ)
 */
export function parseFlashcardsCsv(
  rawText: string,
  options: {
    scopeId: string;
    idPrefix?: string;
    startNumber?: number;
    baseTimestamp?: number;
  }
): CsvParseResult {
  const rows = parseDelimitedRows(rawText);
  if (rows.length === 0) {
    return {
      ok: false,
      cards: [],
      errors: ['テキストが空です。CSVまたはTSVデータを入力してください。'],
      warnings: [],
    };
  }

  const firstRow = rows[0].map((c) => c.trim());
  const lowerHeaders = firstRow.map((h) => h.toLowerCase());

  const findCol = (candidates: string[]): number =>
    lowerHeaders.findIndex((h) => candidates.some((c) => h === c.toLowerCase()));

  let colNo = findCol(['no.', 'no', '番号', 'id']);
  let colDeck = findCol(['デッキ', 'deck']);
  let colChapter = findCol(['章', 'chapter']);
  let colUnit = findCol(['単元', 'unit', 'section']);
  let colFront = findCol(['表面', '問題', '問題文', 'front', 'question', 'q']);
  let colBack = findCol(['裏面', '解答', '答え', '回答', 'back', 'answer', 'a']);
  let colTags = findCol(['タグ', 'tags', 'tag']);
  let colNote = findCol(['メモ', '解説', '補足', 'note']);

  const hasHeader = colFront !== -1 && colBack !== -1;
  let dataStartIndex = hasHeader ? 1 : 0;

  if (!hasHeader) {
    // Infer column positions when header row is omitted
    if (firstRow.length >= 7) {
      colNo = 0;
      colDeck = 1;
      colChapter = 2;
      colUnit = 3;
      colFront = 4;
      colBack = 5;
      colTags = 6;
    } else if (firstRow.length >= 2) {
      colFront = 0;
      colBack = 1;
      colTags = firstRow.length >= 3 ? 2 : -1;
      colUnit = firstRow.length >= 4 ? 3 : -1;
      colChapter = firstRow.length >= 5 ? 4 : -1;
    } else {
      return {
        ok: false,
        cards: [],
        errors: [
          '列構造を認識できませんでした。「表面,裏面」または「No.,デッキ,章,単元,表面,裏面,タグ」形式で入力してください。',
        ],
        warnings: [],
      };
    }
  }

  const cards: Flashcard[] = [];
  const warnings: string[] = [];
  const now = options.baseTimestamp ?? Date.now();
  const idPrefix = options.idPrefix ?? `card-${now}`;
  const startNum = options.startNumber ?? 1;

  for (let i = dataStartIndex; i < rows.length; i++) {
    const r = rows[i];
    const front = (r[colFront] ?? '').trim();
    const back = (r[colBack] ?? '').trim();

    if (!front && !back) continue;
    if (!front || !back) {
      warnings.push(`${i + 1}行目: 問題または解答が空のためスキップしました。`);
      continue;
    }

    const parsedNo =
      colNo !== -1 ? Number.parseInt((r[colNo] ?? '').trim(), 10) : Number.NaN;
    const number = Number.isFinite(parsedNo) ? parsedNo : startNum + cards.length;
    const deckPath = colDeck !== -1 ? (r[colDeck] ?? '').trim() : '';
    let chapter = colChapter !== -1 ? (r[colChapter] ?? '').trim() : '';
    let unit = colUnit !== -1 ? (r[colUnit] ?? '').trim() : '';

    if ((!chapter || !unit) && deckPath.includes('::')) {
      const parts = deckPath.split('::').map((p) => p.trim()).filter(Boolean);
      if (!chapter && parts.length >= 2) chapter = parts[1];
      if (!unit && parts.length >= 3) unit = parts[2];
    }

    const tagsRaw = colTags !== -1 ? (r[colTags] ?? '') : '';
    const tags = parseTagsString(tagsRaw);
    const note = colNote !== -1 ? (r[colNote] ?? '').trim() : undefined;

    const seq = String(cards.length + 1).padStart(4, '0');
    cards.push({
      id: `${idPrefix}-${seq}`,
      scopeId: options.scopeId,
      number,
      deckPath,
      chapter: chapter || '未分類の章',
      unit: unit || '未分類の単元',
      front,
      back,
      tags,
      note: note || undefined,
      starred: false,
      suspended: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (cards.length === 0) {
    return {
      ok: false,
      cards: [],
      errors: ['有効な問題行が見つかりませんでした。問題文と解答が含まれているか確認してください。'],
      warnings,
    };
  }

  return {
    ok: true,
    cards,
    errors: [],
    warnings,
  };
}

export interface JsonImportResult {
  ok: boolean;
  kind: 'backup' | 'cards';
  scopes?: ExamScope[];
  cards: Flashcard[];
  backup?: FlashcardBackupPayload;
  errors: string[];
}

export function parseFlashcardsJson(
  rawText: string,
  fallbackScopeId: string,
  startNumber: number = 1
): JsonImportResult {
  try {
    const parsed = JSON.parse(rawText) as unknown;
    const now = Date.now();

    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      'version' in parsed &&
      'cards' in parsed &&
      Array.isArray((parsed as FlashcardBackupPayload).cards)
    ) {
      const backup = parsed as FlashcardBackupPayload;
      const normalizedCards = backup.cards.map((c, idx) => ({
        ...c,
        id: c.id || `imp-${now}-${idx + 1}`,
        scopeId: c.scopeId || fallbackScopeId,
        number: Number.isFinite(c.number) ? c.number : startNumber + idx,
        chapter: c.chapter || '未分類の章',
        unit: c.unit || '未分類の単元',
        deckPath: c.deckPath || '',
        front: String(c.front ?? '').trim(),
        back: String(c.back ?? '').trim(),
        tags: Array.isArray(c.tags) ? c.tags.map(normalizeTag).filter(Boolean) : [],
        createdAt: c.createdAt || now,
        updatedAt: c.updatedAt || now,
      })).filter((c) => c.front && c.back);

      return {
        ok: true,
        kind: 'backup',
        scopes: Array.isArray(backup.scopes) ? backup.scopes : [],
        cards: normalizedCards,
        backup: { ...backup, cards: normalizedCards },
        errors: [],
      };
    }

    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && 'cards' in parsed && Array.isArray((parsed as { cards: unknown[] }).cards)
        ? (parsed as { cards: unknown[] }).cards
        : null;

    if (!list) {
      return {
        ok: false,
        kind: 'cards',
        cards: [],
        errors: ['JSONは配列、または { "cards": [...] } 形式である必要があります。'],
      };
    }

    const cards: Flashcard[] = [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i] as Record<string, unknown>;
      if (!item || typeof item !== 'object') continue;
      const front = String(item.front ?? item.question ?? item['表面'] ?? item['問題'] ?? '').trim();
      const back = String(item.back ?? item.answer ?? item['裏面'] ?? item['解答'] ?? '').trim();
      if (!front || !back) continue;

      const rawTags = item.tags ?? item['タグ'];
      const tags = Array.isArray(rawTags)
        ? rawTags.map((t) => normalizeTag(String(t))).filter(Boolean)
        : typeof rawTags === 'string'
          ? parseTagsString(rawTags)
          : [];

      cards.push({
        id: `json-${now}-${String(i + 1).padStart(4, '0')}`,
        scopeId: fallbackScopeId,
        number:
          typeof item.number === 'number'
            ? item.number
            : startNumber + cards.length,
        deckPath: String(item.deckPath ?? item['デッキ'] ?? ''),
        chapter: String(item.chapter ?? item['章'] ?? '').trim() || '未分類の章',
        unit: String(item.unit ?? item['単元'] ?? '').trim() || '未分類の単元',
        front,
        back,
        tags,
        note: typeof item.note === 'string' ? item.note : undefined,
        starred: Boolean(item.starred),
        suspended: Boolean(item.suspended),
        createdAt: now,
        updatedAt: now,
      });
    }

    if (cards.length === 0) {
      return {
        ok: false,
        kind: 'cards',
        cards: [],
        errors: ['JSON内に有効な問題データ（front/back または 表面/裏面）が見つかりませんでした。'],
      };
    }

    return {
      ok: true,
      kind: 'cards',
      cards,
      errors: [],
    };
  } catch (err) {
    return {
      ok: false,
      kind: 'cards',
      cards: [],
      errors: [`JSONの構文エラー: ${err instanceof Error ? err.message : '解析できませんでした'}`],
    };
  }
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportFlashcardsToCsv(cards: Flashcard[]): string {
  const header = ['No.', 'デッキ', '章', '単元', '表面', '裏面', 'タグ'].join(',');
  const lines = cards.map((card) =>
    [
      String(card.number),
      escapeCsvCell(card.deckPath || ''),
      escapeCsvCell(card.chapter),
      escapeCsvCell(card.unit),
      escapeCsvCell(card.front),
      escapeCsvCell(card.back),
      escapeCsvCell(card.tags.join(' ')),
    ].join(',')
  );
  return `\uFEFF${[header, ...lines].join('\n')}`;
}

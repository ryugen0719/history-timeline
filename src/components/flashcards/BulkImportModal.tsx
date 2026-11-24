import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from 'react';
import { FileSpreadsheet, Upload, X } from 'lucide-react';
import type {
  ExamScope,
  Flashcard,
  FlashcardBackupPayload,
} from '../../types/flashcards';
import {
  parseFlashcardsCsv,
  parseFlashcardsJson,
} from '../../utils/flashcardParser';

interface BulkImportModalProps {
  isOpen: boolean;
  scopes: ExamScope[];
  defaultScopeId: string;
  nextNumber: number;
  onImportCards: (payload: {
    cards: Flashcard[];
    newScope?: ExamScope;
  }) => void;
  onRestoreBackup: (backup: FlashcardBackupPayload) => void;
  onClose: () => void;
}

type ImportFormat = 'csv' | 'json';

export function BulkImportModal({
  isOpen,
  scopes,
  defaultScopeId,
  nextNumber,
  onImportCards,
  onRestoreBackup,
  onClose,
}: BulkImportModalProps) {
  const [format, setFormat] = useState<ImportFormat>('csv');
  const [targetMode, setTargetMode] = useState<'existing' | 'new'>('new');
  const [selectedScopeId, setSelectedScopeId] = useState(
    defaultScopeId !== 'all' ? defaultScopeId : scopes[0]?.id ?? ''
  );
  const [newScopeName, setNewScopeName] = useState('');
  const [newScopeDescription, setNewScopeDescription] = useState('');
  const [rawText, setRawText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedScopeId(
      defaultScopeId !== 'all' ? defaultScopeId : scopes[0]?.id ?? ''
    );
    setErrors([]);
  }, [isOpen, defaultScopeId, scopes]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const previewResult = useMemo(() => {
    if (!rawText.trim()) return null;
    const previewScopeId =
      targetMode === 'new' ? 'preview-new-scope' : selectedScopeId || 'preview';

    if (format === 'csv') {
      return {
        kind: 'csv' as const,
        parsed: parseFlashcardsCsv(rawText, {
          scopeId: previewScopeId,
          startNumber: targetMode === 'new' ? 1 : nextNumber,
        }),
      };
    }

    return {
      kind: 'json' as const,
      parsed: parseFlashcardsJson(
        rawText,
        previewScopeId,
        targetMode === 'new' ? 1 : nextNumber
      ),
    };
  }, [rawText, format, targetMode, selectedScopeId, nextNumber]);

  if (!isOpen) return null;

  const handleReadFile = async (file: File) => {
    try {
      const content = await file.text();
      setRawText(content);
      setErrors([]);
      if (/\.json$/i.test(file.name)) {
        setFormat('json');
      } else {
        setFormat('csv');
      }
      if (!newScopeName.trim()) {
        setNewScopeName(file.name.replace(/\.(csv|tsv|txt|json)$/i, ''));
      }
    } catch {
      setErrors(['ファイルの読み込みに失敗しました。']);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleReadFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleReadFile(file);
  };

  const handleConfirmImport = () => {
    if (!rawText.trim()) {
      setErrors(['取り込むデータを貼り付けるか、ファイルを選択してください。']);
      return;
    }

    const now = Date.now();
    let targetScopeId = selectedScopeId || scopes[0]?.id || `scope-${now}`;
    let newScope: ExamScope | undefined;

    if (format === 'json') {
      const jsonParsed = parseFlashcardsJson(
        rawText,
        targetScopeId,
        targetMode === 'new' ? 1 : nextNumber
      );
      if (!jsonParsed.ok) {
        setErrors(jsonParsed.errors);
        return;
      }
      if (jsonParsed.kind === 'backup' && jsonParsed.backup) {
        onRestoreBackup(jsonParsed.backup);
        setRawText('');
        setNewScopeName('');
        setNewScopeDescription('');
        onClose();
        return;
      }

      if (targetMode === 'new') {
        if (!newScopeName.trim()) {
          setErrors(['新しい考査範囲名（例：第4回定期考査範囲）を入力してください。']);
          return;
        }
        targetScopeId = `scope-${now}`;
        newScope = {
          id: targetScopeId,
          name: newScopeName.trim(),
          description:
            newScopeDescription.trim() ||
            `JSONから一括追加（${jsonParsed.cards.length}問）`,
          createdAt: now,
        };
      }

      const cardsWithScope = jsonParsed.cards.map((c) => ({
        ...c,
        scopeId: targetScopeId,
      }));
      onImportCards({ cards: cardsWithScope, newScope });
      setRawText('');
      setNewScopeName('');
      setNewScopeDescription('');
      onClose();
      return;
    }

    // CSV / TSV import (preserves all rows without deduplication)
    if (targetMode === 'new') {
      if (!newScopeName.trim()) {
        setErrors(['新しい考査範囲名（例：第4回定期考査範囲）を入力してください。']);
        return;
      }
      targetScopeId = `scope-${now}`;
    }

    const csvParsed = parseFlashcardsCsv(rawText, {
      scopeId: targetScopeId,
      idPrefix: `imp-${now}`,
      startNumber: targetMode === 'new' ? 1 : nextNumber,
      baseTimestamp: now,
    });

    if (!csvParsed.ok) {
      setErrors(csvParsed.errors);
      return;
    }

    if (targetMode === 'new') {
      newScope = {
        id: targetScopeId,
        name: newScopeName.trim(),
        description:
          newScopeDescription.trim() ||
          `CSVから一括追加（${csvParsed.cards.length}問）`,
        createdAt: now,
      };
    }

    onImportCards({ cards: csvParsed.cards, newScope });
    setRawText('');
    setNewScopeName('');
    setNewScopeDescription('');
    onClose();
  };

  const previewCards =
    previewResult?.parsed.ok ? previewResult.parsed.cards : [];
  const isBackupJson =
    previewResult?.kind === 'json' &&
    previewResult.parsed.ok &&
    previewResult.parsed.kind === 'backup';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#1C1917]/50 backdrop-blur-[2px]"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-import-title"
        className="w-full max-w-3xl max-h-[92dvh] sm:max-h-[90vh] bg-[#FBF9F5] border-t sm:border border-[#D6CEBE] rounded-t-2xl sm:rounded-lg shadow-xl flex flex-col overflow-hidden pb-safe"
      >
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-white">
          <div className="w-10 h-1 rounded-full bg-[#D6CEBE]" aria-hidden="true" />
        </div>
        {/* Header */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 bg-white border-b border-[#E6E0D6] flex items-center justify-between gap-4">
          <h2
            id="bulk-import-title"
            className="text-base sm:text-xl font-serif font-bold text-[#1C1917]"
          >
            問題セットの一括追加・インポート
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="モーダルを閉じる"
            className="min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center text-[#57534E] hover:text-[#1C1917] rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format tabs */}
        <div
          role="tablist"
          aria-label="取り込み形式"
          className="px-5 sm:px-6 pt-3 bg-white border-b border-[#E6E0D6] flex items-center gap-5 overflow-x-auto no-scrollbar"
        >
          <button
            type="button"
            role="tab"
            aria-selected={format === 'csv'}
            onClick={() => {
              setFormat('csv');
              setErrors([]);
            }}
            className={`pb-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              format === 'csv'
                ? 'border-[#9A3412] text-[#1C1917]'
                : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            CSV / TSV 一括追加
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={format === 'json'}
            onClick={() => {
              setFormat('json');
              setErrors([]);
            }}
            className={`pb-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              format === 'json'
                ? 'border-[#9A3412] text-[#1C1917]'
                : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            JSON 読込・履歴復元
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto archival-scroll space-y-5 flex-1">
          {/* File Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border border-dashed rounded-lg p-4 text-center transition-colors ${
              isDragging
                ? 'border-[#9A3412] bg-[#9A3412]/5'
                : 'border-[#D6CEBE] bg-white'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm text-[#57534E]">
              <Upload className="w-4 h-4 text-[#9A3412]" aria-hidden="true" />
              <span>
                <code className="font-mono text-xs">
                  {format === 'csv' ? '.csv / .tsv / .txt' : '.json'}
                </code>{' '}
                ファイルをドラッグ＆ドロップ、または
              </span>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded-md cursor-pointer transition-colors">
                <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
                ファイルを選択
                <input
                  type="file"
                  accept={format === 'csv' ? '.csv,.tsv,.txt,text/csv,text/plain' : '.json,application/json'}
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          {/* Target Scope selector (hidden if restoring full backup JSON) */}
          {!isBackupJson && (
            <div className="p-4 bg-white border border-[#E6E0D6] rounded-lg space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="text-xs font-medium text-[#57534E]">追加先の考査範囲:</span>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="target-scope-mode"
                    checked={targetMode === 'new'}
                    onChange={() => setTargetMode('new')}
                    className="accent-[#9A3412]"
                  />
                  <span>新しい考査範囲として作成</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="target-scope-mode"
                    checked={targetMode === 'existing'}
                    onChange={() => setTargetMode('existing')}
                    className="accent-[#9A3412]"
                  />
                  <span>既存の範囲に追記する</span>
                </label>
              </div>

              {targetMode === 'new' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="new-scope-name"
                      className="block text-xs font-medium text-[#57534E] mb-1"
                    >
                      新しい考査範囲名
                    </label>
                    <input
                      id="new-scope-name"
                      type="text"
                      value={newScopeName}
                      onChange={(e) => setNewScopeName(e.target.value)}
                      placeholder="例：第4回定期考査範囲"
                      className="w-full h-10 px-3 text-sm bg-[#FBF9F5] border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="new-scope-desc"
                      className="block text-xs font-medium text-[#57534E] mb-1"
                    >
                      範囲の説明メモ（任意）
                    </label>
                    <input
                      id="new-scope-desc"
                      type="text"
                      value={newScopeDescription}
                      onChange={(e) => setNewScopeDescription(e.target.value)}
                      placeholder="例：第6章 世界恐慌〜第二次世界大戦"
                      className="w-full h-10 px-3 text-sm bg-[#FBF9F5] border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="existing-scope-select"
                    className="block text-xs font-medium text-[#57534E] mb-1"
                  >
                    追記先の考査範囲
                  </label>
                  <select
                    id="existing-scope-select"
                    value={selectedScopeId}
                    onChange={(e) => setSelectedScopeId(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-[#FBF9F5] border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
                  >
                    {scopes.map((scope) => (
                      <option key={scope.id} value={scope.id}>
                        {scope.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Textarea */}
          <div>
            <label
              htmlFor="bulk-import-textarea"
              className="block text-xs font-medium text-[#57534E] mb-1"
            >
              {format === 'csv'
                ? 'CSV / TSVテキストを貼り付け（No.,デッキ,章,単元,表面,裏面,タグ または 問題,解答,タグ）'
                : 'JSONテキストを貼り付け（カード配列、またはバックアップJSON）'}
            </label>
            <textarea
              id="bulk-import-textarea"
              rows={8}
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                if (errors.length > 0) setErrors([]);
              }}
              placeholder={
                format === 'csv'
                  ? 'No.,デッキ,章,単元,表面,裏面,タグ\n1,*歴史総合::第6章::34. 世界恐慌,第6章,34. 世界恐慌,1929年10月にニューヨーク株式市場の暴落から始まった世界的な経済危機は何か。,世界恐慌,分類_事件 地域_アメリカ 重要度_最重要'
                  : '[\n  {\n    "chapter": "第6章",\n    "unit": "34. 世界恐慌",\n    "front": "問題文",\n    "back": "解答",\n    "tags": ["分類_事件", "重要度_最重要"]\n  }\n]'
              }
              className="w-full p-3 font-mono text-xs leading-relaxed bg-white border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
            />
          </div>

          {/* Live Preview */}
          {previewResult && previewResult.parsed.ok && (
            <div className="p-4 bg-white border border-[#E6E0D6] rounded-lg space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-[#15803D]">
                  {isBackupJson
                    ? `バックアップファイルを検出（${previewCards.length}問・学習履歴を含む完全復元）`
                    : `解析成功：全 ${previewCards.length} 問をそのまま取り込みます（重複除外なし・#タグ自動正規化）`}
                </span>
                <span className="font-mono text-[#78716C]">先頭3件プレビュー</span>
              </div>
              <div className="divide-y divide-[#E6E0D6] text-xs">
                {previewCards.slice(0, 3).map((c) => (
                  <div key={c.id} className="py-2 grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-5 text-[#1C1917] truncate">
                      <span className="font-mono text-[#78716C] mr-1.5">#{c.number}</span>
                      {c.front}
                    </div>
                    <div className="sm:col-span-4 font-medium text-[#9A3412] truncate">
                      {c.back}
                    </div>
                    <div className="sm:col-span-3 text-[#78716C] truncate">
                      {c.tags.join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {(errors.length > 0 || (previewResult && !previewResult.parsed.ok)) && (
            <div
              role="alert"
              className="p-3.5 rounded-md bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B] space-y-1"
            >
              {(errors.length > 0
                ? errors
                : previewResult && !previewResult.parsed.ok
                  ? previewResult.parsed.errors
                  : []
              ).map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 sm:flex items-center justify-end gap-2.5 pt-2 border-t border-[#E6E0D6]">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] sm:min-h-[38px] px-4 py-2 text-sm font-medium text-[#57534E] hover:text-[#1C1917] bg-[#F4F0E8] sm:bg-transparent rounded-xl sm:rounded-md"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              className="min-h-[44px] sm:min-h-[38px] px-5 py-2 text-sm font-medium text-[#FBF9F5] bg-[#1C1917] hover:bg-[#9A3412] rounded-xl sm:rounded-md transition-colors whitespace-nowrap"
            >
              {isBackupJson
                ? 'バックアップを復元'
                : previewCards.length > 0
                  ? `${previewCards.length}問を追加する`
                  : '一括追加を実行'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

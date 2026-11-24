import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { ExamScope, Flashcard } from '../../types/flashcards';
import { parseTagsString } from '../../utils/flashcardParser';

interface CardEditorModalProps {
  isOpen: boolean;
  editingCard: Flashcard | null;
  scopes: ExamScope[];
  defaultScopeId: string;
  existingChapters: string[];
  existingUnits: string[];
  suggestedTags: string[];
  nextNumber: number;
  onSave: (payload: {
    id?: string;
    scopeId: string;
    number: number;
    chapter: string;
    unit: string;
    front: string;
    back: string;
    tags: string[];
    note?: string;
  }) => void;
  onDelete?: (cardId: string) => void;
  onClose: () => void;
}

export function CardEditorModal({
  isOpen,
  editingCard,
  scopes,
  defaultScopeId,
  existingChapters,
  existingUnits,
  suggestedTags,
  nextNumber,
  onSave,
  onDelete,
  onClose,
}: CardEditorModalProps) {
  const [scopeId, setScopeId] = useState(defaultScopeId);
  const [number, setNumber] = useState(nextNumber);
  const [chapter, setChapter] = useState('');
  const [unit, setUnit] = useState('');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (editingCard) {
      setScopeId(editingCard.scopeId);
      setNumber(editingCard.number);
      setChapter(editingCard.chapter);
      setUnit(editingCard.unit);
      setFront(editingCard.front);
      setBack(editingCard.back);
      setTagsText(editingCard.tags.join(' '));
      setNote(editingCard.note ?? '');
    } else {
      setScopeId(
        defaultScopeId !== 'all'
          ? defaultScopeId
          : scopes[0]?.id ?? ''
      );
      setNumber(nextNumber);
      setChapter(existingChapters[0] ?? '');
      setUnit('');
      setFront('');
      setBack('');
      setTagsText('重要度_重要 ');
      setNote('');
    }
    setError('');
  }, [isOpen, editingCard, defaultScopeId, scopes, nextNumber, existingChapters]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAppendTag = (tag: string) => {
    const current = parseTagsString(tagsText);
    if (current.includes(tag)) return;
    setTagsText([...current, tag].join(' '));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) {
      setError('問題（表面）と解答（裏面）の両方を入力してください。');
      return;
    }
    const targetScope = scopeId || scopes[0]?.id;
    if (!targetScope) {
      setError('登録先の考査範囲を選択してください。');
      return;
    }

    onSave({
      id: editingCard?.id,
      scopeId: targetScope,
      number: Number.isFinite(number) && number > 0 ? number : nextNumber,
      chapter: chapter.trim() || '未分類の章',
      unit: unit.trim() || '未分類の単元',
      front: front.trim(),
      back: back.trim(),
      tags: parseTagsString(tagsText),
      note: note.trim() || undefined,
    });
    onClose();
  };

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
        aria-labelledby="card-editor-title"
        className="w-full max-w-2xl max-h-[92dvh] sm:max-h-[90vh] bg-[#FBF9F5] border-t sm:border border-[#D6CEBE] rounded-t-2xl sm:rounded-lg shadow-xl flex flex-col overflow-hidden pb-safe"
      >
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-white">
          <div className="w-10 h-1 rounded-full bg-[#D6CEBE]" aria-hidden="true" />
        </div>
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 bg-white border-b border-[#E6E0D6] flex items-center justify-between gap-4">
          <h2
            id="card-editor-title"
            className="text-base sm:text-lg font-serif font-bold text-[#1C1917]"
          >
            {editingCard ? `問題 No.${editingCard.number} を編集` : '新しい一問一答を追加'}
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

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto archival-scroll space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="card-scope-select"
                className="block text-xs font-medium text-[#57534E] mb-1"
              >
                考査範囲・問題セット
              </label>
              <select
                id="card-scope-select"
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
              >
                {scopes.map((scope) => (
                  <option key={scope.id} value={scope.id}>
                    {scope.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="card-number-input"
                className="block text-xs font-medium text-[#57534E] mb-1"
              >
                問題番号（No.）
              </label>
              <input
                id="card-number-input"
                type="number"
                min={1}
                value={number}
                onChange={(e) => setNumber(Number(e.target.value))}
                className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="card-chapter-input"
                className="block text-xs font-medium text-[#57534E] mb-1"
              >
                章
              </label>
              <input
                id="card-chapter-input"
                type="text"
                list="existing-chapters-datalist"
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                placeholder="例：第5章 第一次世界大戦と大衆社会"
                className="w-full h-10 px-3 text-sm bg-white border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
              />
              <datalist id="existing-chapters-datalist">
                {existingChapters.map((ch) => (
                  <option key={ch} value={ch} />
                ))}
              </datalist>
            </div>

            <div>
              <label
                htmlFor="card-unit-input"
                className="block text-xs font-medium text-[#57534E] mb-1"
              >
                単元
              </label>
              <input
                id="card-unit-input"
                type="text"
                list="existing-units-datalist"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="例：34. 世界恐慌とファシズム"
                className="w-full h-10 px-3 text-sm bg-white border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
              />
              <datalist id="existing-units-datalist">
                {existingUnits.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label
              htmlFor="card-front-input"
              className="block text-xs font-medium text-[#57534E] mb-1"
            >
              表面（問題文）
            </label>
            <textarea
              id="card-front-input"
              rows={3}
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="問題文を入力してください"
              className="w-full p-3 text-sm leading-relaxed bg-white border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
            />
          </div>

          <div>
            <label
              htmlFor="card-back-input"
              className="block text-xs font-medium text-[#57534E] mb-1"
            >
              裏面（解答）
            </label>
            <textarea
              id="card-back-input"
              rows={2}
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="解答を入力してください"
              className="w-full p-3 text-sm leading-relaxed bg-white border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
            />
          </div>

          <div>
            <label
              htmlFor="card-tags-input"
              className="block text-xs font-medium text-[#57534E] mb-1"
            >
              タグ（スペース区切り・#付きでも自動正規化されます）
            </label>
            <input
              id="card-tags-input"
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="例：分類_条約 地域_日本 重要度_最重要"
              className="w-full h-10 px-3 text-sm bg-white border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
            />
            {suggestedTags.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[#78716C] mr-1">よく使うタグを追加:</span>
                {suggestedTags.slice(0, 12).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleAppendTag(tag)}
                    className="px-2 py-1 text-[11px] text-[#57534E] bg-[#F4F0E8] hover:bg-[#E6E0D6] hover:text-[#1C1917] rounded transition-colors whitespace-nowrap"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="card-note-input"
              className="block text-xs font-medium text-[#57534E] mb-1"
            >
              補足メモ・解説（任意・解答表示時に表示）
            </label>
            <textarea
              id="card-note-input"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="語呂合わせ、年号の背景、ひっかけ注意点など"
              className="w-full p-3 text-sm leading-relaxed bg-white border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-md bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]"
            >
              {error}
            </div>
          )}

          <div className="pt-3 border-t border-[#E6E0D6] flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              {editingCard && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(editingCard.id);
                    onClose();
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] px-3 py-2 text-xs font-medium text-[#991B1B] bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] rounded-xl sm:rounded-md transition-colors whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  この問題を削除
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] sm:min-h-[38px] px-4 py-2 text-sm font-medium text-[#57534E] hover:text-[#1C1917] bg-[#F4F0E8] sm:bg-transparent rounded-xl sm:rounded-md whitespace-nowrap"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="min-h-[44px] sm:min-h-[38px] px-5 py-2 text-sm font-medium text-[#FBF9F5] bg-[#1C1917] hover:bg-[#9A3412] rounded-xl sm:rounded-md transition-colors whitespace-nowrap"
              >
                {editingCard ? '変更を保存' : '問題を追加'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

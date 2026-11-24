import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { ExamScope } from '../../types/flashcards';

interface ScopeManagerModalProps {
  isOpen: boolean;
  scopes: ExamScope[];
  cardCountsByScope: Record<string, number>;
  onCreateScope: (name: string, description: string) => void;
  onUpdateScope: (id: string, name: string, description: string) => void;
  onDeleteScope: (id: string) => void;
  onClose: () => void;
}

export function ScopeManagerModal({
  isOpen,
  scopes,
  cardCountsByScope,
  onCreateScope,
  onUpdateScope,
  onDeleteScope,
  onClose,
}: ScopeManagerModalProps) {
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreateScope(newName.trim(), newDesc.trim());
    setNewName('');
    setNewDesc('');
  };

  const handleStartEdit = (scope: ExamScope) => {
    setEditingId(scope.id);
    setEditName(scope.name);
    setEditDesc(scope.description);
  };

  const handleSaveEdit = (id: string) => {
    if (!editName.trim()) return;
    onUpdateScope(id, editName.trim(), editDesc.trim());
    setEditingId(null);
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
        aria-labelledby="scope-manager-title"
        className="w-full max-w-xl max-h-[88dvh] sm:max-h-[85vh] bg-[#FBF9F5] border-t sm:border border-[#D6CEBE] rounded-t-2xl sm:rounded-lg shadow-xl flex flex-col overflow-hidden pb-safe"
      >
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-white">
          <div className="w-10 h-1 rounded-full bg-[#D6CEBE]" aria-hidden="true" />
        </div>
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 bg-white border-b border-[#E6E0D6] flex items-center justify-between gap-4">
          <h2
            id="scope-manager-title"
            className="text-base sm:text-lg font-serif font-bold text-[#1C1917]"
          >
            考査範囲・問題セットの管理
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

        <div className="p-5 sm:p-6 overflow-y-auto archival-scroll space-y-6">
          {/* Existing scopes */}
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-[#57534E]">
              登録済みの考査範囲（{scopes.length}件）
            </h3>
            <div className="divide-y divide-[#E6E0D6] bg-white border border-[#E6E0D6] rounded-lg">
              {scopes.map((scope) => {
                const count = cardCountsByScope[scope.id] ?? 0;
                const isEditing = editingId === scope.id;
                return (
                  <div key={scope.id} className="p-4 space-y-2">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full h-9 px-3 text-sm bg-[#FBF9F5] border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
                        />
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="範囲の説明"
                          className="w-full h-9 px-3 text-xs bg-[#FBF9F5] border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 text-xs text-[#57534E] hover:text-[#1C1917]"
                          >
                            キャンセル
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(scope.id)}
                            className="px-3 py-1.5 text-xs font-medium text-[#FBF9F5] bg-[#1C1917] hover:bg-[#9A3412] rounded-md"
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-serif font-semibold text-[#1C1917]">
                              {scope.name}
                            </span>
                            <span className="text-xs font-mono tabular-nums text-[#78716C]">
                              {count}問
                            </span>
                          </div>
                          {scope.description && (
                            <p className="text-xs text-[#57534E] mt-0.5">
                              {scope.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(scope)}
                            className="px-2.5 py-1.5 text-xs text-[#57534E] hover:text-[#1C1917] bg-[#F4F0E8] rounded-md"
                          >
                            編集
                          </button>
                          {scopes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => onDeleteScope(scope.id)}
                              aria-label={`${scope.name}を削除`}
                              className="p-1.5 text-[#991B1B] hover:bg-[#FEF2F2] rounded-md"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Create new scope */}
          <form
            onSubmit={handleAdd}
            className="p-4 bg-white border border-[#E6E0D6] rounded-lg space-y-3"
          >
            <h3 className="text-xs font-medium text-[#57534E]">
              新しい考査範囲を追加
            </h3>
            <div className="space-y-2.5">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例：第4回定期考査範囲、学年末考査範囲"
                className="w-full h-10 px-3 text-sm bg-[#FBF9F5] border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
              />
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="対象章や単元のメモ（任意）"
                className="w-full h-10 px-3 text-sm bg-[#FBF9F5] border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newName.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#FBF9F5] bg-[#1C1917] hover:bg-[#9A3412] disabled:opacity-40 rounded-md transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                考査範囲を作成
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

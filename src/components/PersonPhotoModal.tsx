import { useEffect, useState, type ChangeEvent } from 'react';
import { Globe, Loader2, Trash2, Upload, X } from 'lucide-react';
import type { PersonProfile } from '../types/timeline';
import { resizeImageFileToDataUrl } from '../utils/imageResize';
import { fetchSingleWikipediaPortrait } from '../utils/wikipediaPortrait';
import { PersonAvatar } from './PersonAvatar';

interface PersonPhotoModalProps {
  personName: string | null;
  currentProfile?: PersonProfile;
  onSave: (name: string, profile: PersonProfile | null) => void;
  onClose: () => void;
}

export function PersonPhotoModal({
  personName,
  currentProfile,
  onSave,
  onClose,
}: PersonPhotoModalProps) {
  const [photoUrl, setPhotoUrl] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isFetchingWiki, setIsFetchingWiki] = useState(false);

  useEffect(() => {
    if (!personName) return;
    setPhotoUrl(currentProfile?.photoUrl ?? '');
    setNote(currentProfile?.note ?? '');
    setError('');
    setIsFetchingWiki(false);
  }, [personName, currentProfile]);

  useEffect(() => {
    if (!personName) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [personName, onClose]);

  if (!personName) return null;

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const dataUrl = await resizeImageFileToDataUrl(file, 256);
      setPhotoUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : '画像の処理に失敗しました。');
    }
  };

  const handleFetchFromWiki = async () => {
    setError('');
    setIsFetchingWiki(true);
    try {
      const result = await fetchSingleWikipediaPortrait(personName);
      if (!result) {
        setError('Wikipedia上で顔写真が見つかりませんでした。');
        return;
      }
      setPhotoUrl(result.photoUrl);
      if (!note.trim() && result.note) {
        setNote(result.note);
      }
    } catch {
      setError('Wikipediaからの取得中にエラーが発生しました。');
    } finally {
      setIsFetchingWiki(false);
    }
  };

  const handleSave = () => {
    const trimmedUrl = photoUrl.trim();
    const trimmedNote = note.trim();
    if (!trimmedUrl && !trimmedNote) {
      onSave(personName, null);
      onClose();
      return;
    }
    onSave(personName, {
      photoUrl: trimmedUrl,
      note: trimmedNote || undefined,
    });
    onClose();
  };

  const handleRemove = () => {
    onSave(personName, null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-[2px]"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-photo-modal-title"
        className="w-full max-w-md bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 bg-white border-b border-[#E6E0D6] flex items-center justify-between gap-3">
          <h2
            id="person-photo-modal-title"
            className="text-lg font-serif font-bold text-[#1C1917] truncate"
          >
            {personName} の顔写真・人物メモ
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="モーダルを閉じる"
            className="p-2 text-[#57534E] hover:text-[#1C1917] rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Preview + upload / Wikipedia fetch */}
          <div className="flex items-center gap-4 bg-white border border-[#E6E0D6] rounded-lg p-4">
            <PersonAvatar name={personName} photoUrl={photoUrl.trim()} size="lg" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="text-xs text-[#57534E]">
                画像ファイルをアップロード、Wikipediaから取得、またはURLを指定できます。
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded-md cursor-pointer transition-colors whitespace-nowrap">
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  画像を選択
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleFetchFromWiki}
                  disabled={isFetchingWiki}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:border-[#1C1917] disabled:opacity-60 rounded-md transition-colors whitespace-nowrap"
                >
                  {isFetchingWiki ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Globe className="w-3.5 h-3.5 text-[#57534E]" aria-hidden="true" />
                  )}
                  {isFetchingWiki ? '取得中...' : 'Wikipediaから取得'}
                </button>
              </div>
            </div>
          </div>

          {/* Image URL input */}
          <div>
            <label
              htmlFor="person-photo-url"
              className="block text-xs font-medium text-[#57534E] mb-1"
            >
              画像URL（またはデータURI）
            </label>
            <input
              id="person-photo-url"
              type="text"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://... または上のボタンから画像を選択"
              className="w-full h-10 px-3 text-xs font-mono bg-white border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
            />
          </div>

          {/* Optional note */}
          <div>
            <label
              htmlFor="person-note-input"
              className="block text-xs font-medium text-[#57534E] mb-1"
            >
              人物メモ（肩書き・補足など・任意）
            </label>
            <input
              id="person-note-input"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例：アメリカ東インド艦隊司令長官"
              className="w-full h-10 px-3 text-sm bg-white border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-[#991B1B]">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#E6E0D6]">
            {currentProfile ? (
              <button
                type="button"
                onClick={handleRemove}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#991B1B] hover:bg-[#FEF2F2] rounded-md transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                登録を削除
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[#57534E] hover:text-[#1C1917] rounded-md"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2 text-sm font-medium text-[#FBF9F5] bg-[#1C1917] hover:bg-[#9A3412] rounded-md transition-colors"
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

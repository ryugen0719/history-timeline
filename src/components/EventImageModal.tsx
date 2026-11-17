import { useEffect, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from 'react';
import { Globe, ImagePlus, Loader2, Trash2, Upload, X } from 'lucide-react';
import type { EventImageItem } from '../types/timeline';
import { isValidEventImageUrl } from '../utils/eventImages';
import { resizeImageFileToDataUrl } from '../utils/imageResize';
import { fetchWikipediaEventImage } from '../utils/wikipediaPortrait';

interface EventImageModalProps {
  isOpen: boolean;
  eventTitle: string;
  editingImage: EventImageItem | null;
  onSave: (payload: { url: string; caption?: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function EventImageModal({
  isOpen,
  eventTitle,
  editingImage,
  onSave,
  onDelete,
  onClose,
}: EventImageModalProps) {
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);
  const [isFetchingWiki, setIsFetchingWiki] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setImageUrl(editingImage?.url ?? '');
    setCaption(editingImage?.caption ?? '');
    setError('');
    setPreviewFailed(false);
    setIsFetchingWiki(false);
    setIsDragging(false);
  }, [isOpen, editingImage]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const processImageFile = async (file: File) => {
    setError('');
    setPreviewFailed(false);
    try {
      const dataUrl = await resizeImageFileToDataUrl(file, 960);
      setImageUrl(dataUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '画像の読み込みに失敗しました。'
      );
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImageFile(file);
    e.target.value = '';
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await processImageFile(file);
    }
  };

  const handlePaste = async (e: ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imgItem = items.find((item) => item.type.startsWith('image/'));
    if (!imgItem) return;
    const file = imgItem.getAsFile();
    if (file) {
      e.preventDefault();
      await processImageFile(file);
    }
  };

  const handleFetchFromWiki = async () => {
    setError('');
    setPreviewFailed(false);
    setIsFetchingWiki(true);
    try {
      const result = await fetchWikipediaEventImage(eventTitle);
      if (!result) {
        setError('Wikipedia上で関連画像が見つかりませんでした。');
        return;
      }
      setImageUrl(result.photoUrl);
      if (!caption.trim() && result.note) {
        setCaption(result.note);
      }
    } catch {
      setError('Wikipediaからの画像取得中にエラーが発生しました。');
    } finally {
      setIsFetchingWiki(false);
    }
  };

  const handleSubmit = () => {
    const trimmed = imageUrl.trim();
    if (!trimmed) {
      setError('画像ファイルを選択するか、画像URLを入力してください。');
      return;
    }
    if (!isValidEventImageUrl(trimmed)) {
      setError(
        '有効な画像URL（https://... または http://...）または画像データを指定してください。'
      );
      return;
    }
    onSave({
      url: trimmed,
      caption: caption.trim() || undefined,
    });
    onClose();
  };

  const validPreviewUrl = isValidEventImageUrl(imageUrl)
    ? imageUrl.trim()
    : '';

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
        aria-labelledby="event-image-modal-title"
        onPaste={handlePaste}
        className="w-full max-w-lg bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 bg-white border-b border-[#E6E0D6] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="event-image-modal-title"
              className="text-lg font-serif font-bold text-[#1C1917] truncate"
            >
              {editingImage ? '出来事の画像を編集' : '出来事に画像を追加'}
            </h2>
            <p className="text-xs text-[#78716C] truncate mt-0.5">
              {eventTitle}
            </p>
          </div>
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
          {/* Preview & Upload / Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`bg-white border rounded-lg p-3.5 space-y-3 transition-colors ${
              isDragging
                ? 'border-[#9A3412] bg-[#FAF7F2]'
                : 'border-[#E6E0D6]'
            }`}
          >
            <div className="w-full h-44 rounded-md border border-[#E6E0D6] bg-[#FBF9F5] overflow-hidden flex items-center justify-center">
              {validPreviewUrl && !previewFailed ? (
                <img
                  src={validPreviewUrl}
                  alt={caption.trim() || `${eventTitle} の資料画像`}
                  onError={() => setPreviewFailed(true)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center px-4 text-xs text-[#78716C] space-y-1.5">
                  <ImagePlus
                    className="w-7 h-7 mx-auto text-[#A8A29E]"
                    aria-hidden="true"
                  />
                  <p>
                    {previewFailed
                      ? 'プレビュー画像を読み込めませんでした'
                      : '画像をドロップ、貼り付け（Ctrl+V）、または下のボタンから選択'}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded-md cursor-pointer transition-colors whitespace-nowrap">
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                画像ファイルを選択
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
                  <Loader2
                    className="w-3.5 h-3.5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Globe className="w-3.5 h-3.5 text-[#57534E]" aria-hidden="true" />
                )}
                {isFetchingWiki ? '取得中...' : 'Wikipediaから画像を取得'}
              </button>
            </div>
          </div>

          {/* URL input */}
          <div>
            <label
              htmlFor="event-image-url-input"
              className="block text-xs font-medium text-[#57534E] mb-1"
            >
              画像URL（またはデータURI）
            </label>
            <input
              id="event-image-url-input"
              type="text"
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                setPreviewFailed(false);
                setError('');
              }}
              placeholder="https://... または上のボタンから画像を選択"
              className="w-full h-10 px-3 text-xs font-mono bg-white border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
            />
          </div>

          {/* Optional caption */}
          <div>
            <label
              htmlFor="event-image-caption-input"
              className="block text-xs font-medium text-[#57534E] mb-1"
            >
              説明・キャプション（任意）
            </label>
            <input
              id="event-image-caption-input"
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="例：浦賀沖に来航した黒船を描いた資料"
              className="w-full h-10 px-3 text-sm bg-white border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-[#991B1B]">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#E6E0D6]">
            {editingImage && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#991B1B] hover:bg-[#FEF2F2] rounded-md transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                この画像を削除
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
                onClick={handleSubmit}
                className="px-5 py-2 text-sm font-medium text-[#FBF9F5] bg-[#1C1917] hover:bg-[#9A3412] rounded-md transition-colors"
              >
                {editingImage ? '更新する' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface EventImageLightboxProps {
  image: EventImageItem | null;
  eventTitle: string;
  onClose: () => void;
}

export function EventImageLightbox({
  image,
  eventTitle,
  onClose,
}: EventImageLightboxProps) {
  useEffect(() => {
    if (!image) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [image, onClose]);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#1C1917]/80 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={`${eventTitle} の画像拡大表示`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative max-w-3xl w-full bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg shadow-2xl overflow-hidden">
        <div className="px-4 py-3 bg-white border-b border-[#E6E0D6] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-[#78716C] truncate">{eventTitle}</div>
            {image.caption && (
              <div className="text-sm font-medium text-[#1C1917] truncate">
                {image.caption}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="拡大表示を閉じる"
            className="p-1.5 text-[#57534E] hover:text-[#1C1917] rounded-md shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-3 sm:p-4 bg-[#1C1917]/5 flex items-center justify-center max-h-[78vh]">
          <img
            src={image.url}
            alt={image.caption || `${eventTitle} の資料画像`}
            className="max-w-full max-h-[72vh] object-contain rounded"
          />
        </div>
      </div>
    </div>
  );
}

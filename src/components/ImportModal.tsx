import { useEffect, useState, type ChangeEvent, type DragEvent } from 'react';
import { Check, Copy, Download, FileJson, Upload, X } from 'lucide-react';
import {
  GENERATION_PROMPT_TEMPLATE,
  SAMPLE_DATASETS,
  type SampleDatasetPreset,
} from '../data/sampleDatasets';
import type { HistoricalDatabase } from '../types/timeline';
import { parseHistoricalJson } from '../utils/timelineParser';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportJson: () => void;
  onApplyDatabase: (
    db: HistoricalDatabase,
    mode: 'replace' | 'merge',
    datasetTitle?: string
  ) => void;
}

type ModalTab = 'paste' | 'samples' | 'prompt';

export function ImportModal({
  isOpen,
  onClose,
  onExportJson,
  onApplyDatabase,
}: ImportModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>('paste');
  const [jsonText, setJsonText] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [customTitle, setCustomTitle] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFileRead = async (file: File) => {
    try {
      const content = await file.text();
      setJsonText(content);
      if (!customTitle.trim()) {
        setCustomTitle(file.name.replace(/\.json$/i, ''));
      }
      const check = parseHistoricalJson(content);
      setErrors(check.errors);
      setWarnings(check.warnings);
    } catch {
      setErrors(['ファイルの読み込みに失敗しました。']);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileRead(file);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFileRead(file);
    }
  };

  const handleSubmitJson = () => {
    const result = parseHistoricalJson(jsonText);
    setErrors(result.errors);
    setWarnings(result.warnings);
    if (!result.ok || !result.data) {
      return;
    }

    onApplyDatabase(
      result.data,
      importMode,
      customTitle.trim() || '読み込んだ歴史年表データ'
    );
    setJsonText('');
    setCustomTitle('');
    setErrors([]);
    setWarnings([]);
    onClose();
  };

  const handleSelectSample = (preset: SampleDatasetPreset) => {
    onApplyDatabase(preset.data, 'replace', preset.name);
    onClose();
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(GENERATION_PROMPT_TEMPLATE);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      setCopiedPrompt(false);
    }
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
        aria-labelledby="import-modal-title"
        className="w-full max-w-3xl max-h-[90vh] bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg shadow-xl flex flex-col overflow-hidden"
      >
        {/* Modal header */}
        <div className="px-6 py-4 bg-white border-b border-[#E6E0D6] flex items-center justify-between gap-4">
          <h2
            id="import-modal-title"
            className="text-lg sm:text-xl font-serif font-bold text-[#1C1917]"
          >
            歴史年表データの読み込み・管理
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExportJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded-md transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-[#57534E]" aria-hidden="true" />
              JSON書き出し
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="モーダルを閉じる"
              className="p-2 text-[#57534E] hover:text-[#1C1917] rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal tabs */}
        <div
          role="tablist"
          aria-label="データ読み込み方法"
          className="px-6 pt-3 bg-white border-b border-[#E6E0D6] flex items-center gap-6"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'paste'}
            onClick={() => setActiveTab('paste')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'paste'
                ? 'border-[#9A3412] text-[#1C1917]'
                : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            JSON貼り付け・ファイル読込
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'samples'}
            onClick={() => setActiveTab('samples')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'samples'
                ? 'border-[#9A3412] text-[#1C1917]'
                : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            サンプルデータ切替
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'prompt'}
            onClick={() => setActiveTab('prompt')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'prompt'
                ? 'border-[#9A3412] text-[#1C1917]'
                : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            データ生成プロンプト
          </button>
        </div>

        {/* Modal body */}
        <div className="p-6 overflow-y-auto archival-scroll flex-1">
          {activeTab === 'paste' && (
            <div className="space-y-4">
              {/* File dropzone */}
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
                    <code className="font-mono text-xs">.json</code> ファイルをドラッグ＆ドロップ、または
                  </span>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded-md cursor-pointer transition-colors">
                    <FileJson className="w-3.5 h-3.5" aria-hidden="true" />
                    ファイルを選択
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              {/* Dataset title & mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="dataset-title-input"
                    className="block text-xs font-medium text-[#57534E] mb-1"
                  >
                    年表のタイトル（任意）
                  </label>
                  <input
                    id="dataset-title-input"
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="例：世界史 第3章 ルネサンス〜宗教改革"
                    className="w-full h-10 px-3 text-sm bg-white border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
                  />
                </div>
                <div>
                  <span className="block text-xs font-medium text-[#57534E] mb-1">
                    読み込み方式
                  </span>
                  <div className="flex items-center gap-4 h-10 text-sm">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="import-mode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="accent-[#9A3412]"
                      />
                      <span>現在の年表を置き換える</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="import-mode"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                        className="accent-[#9A3412]"
                      />
                      <span>IDで統合（マージ）</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* JSON textarea */}
              <div>
                <label
                  htmlFor="json-paste-textarea"
                  className="block text-xs font-medium text-[#57534E] mb-1"
                >
                  JSONデータを貼り付け（<code className="font-mono">{`{ "events": [...] }`}</code> 形式）
                </label>
                <textarea
                  id="json-paste-textarea"
                  rows={10}
                  value={jsonText}
                  onChange={(e) => {
                    setJsonText(e.target.value);
                    if (errors.length > 0) setErrors([]);
                  }}
                  placeholder={`{\n  "events": [\n    {\n      "id": "E001",\n      "date": "1853",\n      "date_precision": "year",\n      "title": "ペリー来航",\n      ...\n    }\n  ]\n}`}
                  className="w-full p-3 font-mono text-xs leading-relaxed bg-white border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
                />
              </div>

              {/* Validation feedback */}
              {errors.length > 0 && (
                <div
                  role="alert"
                  className="p-3.5 rounded-md bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B] space-y-1"
                >
                  <div className="font-semibold">読み込みエラー</div>
                  {errors.map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              )}

              {warnings.length > 0 && errors.length === 0 && (
                <div className="p-3 rounded-md bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E] space-y-1">
                  {warnings.map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-[#57534E] hover:text-[#1C1917] rounded-md"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleSubmitJson}
                  className="px-5 py-2 text-sm font-medium text-[#FBF9F5] bg-[#1C1917] hover:bg-[#9A3412] rounded-md transition-colors"
                >
                  年表に読み込む
                </button>
              </div>
            </div>
          )}

          {activeTab === 'samples' && (
            <div className="space-y-3">
              <p className="text-sm text-[#57534E] mb-4">
                スキーマ仕様に準拠したサンプルデータセットを選択して動作を確認できます。
              </p>
              {SAMPLE_DATASETS.map((preset) => (
                <div
                  key={preset.id}
                  className="bg-white border border-[#E6E0D6] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <h3 className="text-base font-serif font-semibold text-[#1C1917]">
                      {preset.name}
                    </h3>
                    <p className="text-xs text-[#57534E] mt-0.5">
                      {preset.subtitle}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectSample(preset)}
                    className="px-4 py-2 text-xs font-medium bg-[#1C1917] text-[#FBF9F5] hover:bg-[#9A3412] rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    このデータを表示
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'prompt' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs sm:text-sm text-[#57534E]">
                  授業プリントや教科書からこのアプリ用のJSONデータを作成する際のプロンプトです。
                </p>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#D6CEBE] hover:border-[#1C1917] rounded-md text-[#1C1917] whitespace-nowrap shrink-0"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#14532D]" aria-hidden="true" />
                      コピー済み
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      プロンプトをコピー
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 bg-white border border-[#E6E0D6] rounded-md text-xs font-mono text-[#1C1917] whitespace-pre-wrap leading-relaxed">
                {GENERATION_PROMPT_TEMPLATE}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

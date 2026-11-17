import { ArrowRight, Camera, X } from 'lucide-react';
import {
  CATEGORY_LABELS,
  COLOR_PALETTE,
  type ColorId,
  type ColorLabelsMap,
  type EventColorsMap,
  type HistoricalEvent,
  type PersonProfilesMap,
} from '../types/timeline';
import { findConnectedEvents } from '../utils/timelineParser';
import { PersonAvatar } from './PersonAvatar';

interface EventDetailPanelProps {
  event: HistoricalEvent | null;
  allEvents: HistoricalEvent[];
  eventColors: EventColorsMap;
  colorLabels: ColorLabelsMap;
  personProfiles: PersonProfilesMap;
  onAssignColor: (eventId: string, colorId: ColorId) => void;
  onEditPersonPhoto: (personName: string) => void;
  onSelectEvent: (eventId: string) => void;
  onCloseMobile?: () => void;
  onClose?: () => void;
}

export function EventDetailPanel({
  event,
  allEvents,
  eventColors,
  colorLabels,
  personProfiles,
  onAssignColor,
  onEditPersonPhoto,
  onSelectEvent,
  onCloseMobile,
  onClose,
}: EventDetailPanelProps) {
  if (!event) {
    return (
      <div className="bg-white border border-[#E6E0D6] rounded-lg p-8 text-center text-[#57534E]">
        <p className="font-serif text-base text-[#1C1917] mb-1">
          出来事を選択してください
        </p>
        <p className="text-xs leading-relaxed">
          左の出来事を選ぶと、概要・原因・結果・関係人物がここに表示されます。
        </p>
      </div>
    );
  }

  const { explicitRelated, reverseRelated } = findConnectedEvents(event, allEvents);
  const allRelated = [...explicitRelated, ...reverseRelated];
  const currentColor: ColorId =
    (eventColors[event.id] as ColorId | undefined) ?? 'none';
  const activeColorDef =
    currentColor !== 'none'
      ? COLOR_PALETTE.find((c) => c.id === currentColor)
      : undefined;

  const metaParts: string[] = [event.date];
  if (event.places.length > 0) {
    metaParts.push(event.places.join('・'));
  }
  if (event.category.length > 0) {
    metaParts.push(event.category.map((c) => CATEGORY_LABELS[c]).join(' / '));
  }

  return (
    <article
      aria-label={`${event.title} の詳細`}
      className="bg-white border border-[#E6E0D6] rounded-lg overflow-hidden"
    >
      {/* Focused Reading Header (tinted gently with assigned color) */}
      <div
        className="px-5 py-4 border-b border-[#E6E0D6] bg-[#F4F0E8]/50 transition-colors"
        style={
          activeColorDef
            ? { backgroundColor: activeColorDef.surfaceHex }
            : undefined
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#57534E] mb-1.5">
              <span className="font-mono tabular-nums font-medium text-[#1C1917]">
                {metaParts[0]}
              </span>
              {metaParts.slice(1).map((part, i) => (
                <span key={i} className="inline-flex items-center gap-2">
                  <span aria-hidden="true">·</span>
                  <span>{part}</span>
                </span>
              ))}
              {event.importance === 3 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-[#9A3412]">最重要</span>
                </>
              )}
            </div>
            <h2 className="text-xl font-serif font-bold text-[#1C1917] leading-snug">
              {event.title}
            </h2>
          </div>

          {(onClose || onCloseMobile) && (
            <button
              type="button"
              onClick={onClose ?? onCloseMobile}
              aria-label="詳細パネルを閉じる"
              className={`p-2 -mr-1 -mt-1 text-[#57534E] hover:text-[#1C1917] hover:bg-black/5 rounded-md shrink-0 transition-colors ${
                onClose ? '' : 'lg:hidden'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 1-Click Inline Color Selector */}
        <div className="mt-3 pt-2.5 border-t border-[#E6E0D6]/80">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-medium text-[#57534E]">
              色分け（1クリックで設定・解除）
            </span>
            {currentColor !== 'none' && (
              <button
                type="button"
                onClick={() => onAssignColor(event.id, 'none')}
                className="text-[11px] text-[#78716C] hover:text-[#1C1917] underline underline-offset-2"
              >
                色を解除
              </button>
            )}
          </div>
          <div
            role="group"
            aria-label="出来事の色分け設定"
            className="flex flex-wrap items-center gap-1.5"
          >
            {COLOR_PALETTE.map((def) => {
              const active = currentColor === def.id;
              const label = colorLabels[def.id] || def.defaultLabel;
              return (
                <button
                  key={def.id}
                  type="button"
                  onClick={() =>
                    onAssignColor(event.id, active ? 'none' : def.id)
                  }
                  aria-pressed={active}
                  title={`${def.colorName}：${label}`}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-colors ${
                    active
                      ? 'bg-white text-[#1C1917] border-[#1C1917] font-semibold ring-1 ring-[#1C1917]'
                      : 'bg-white/90 text-[#44403C] border-[#D6CEBE] hover:border-[#1C1917]'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                    style={{ backgroundColor: def.swatchHex }}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Study Reading Body */}
      <div className="p-5 space-y-5">
        {/* 1. Overview */}
        <p className="text-sm leading-relaxed text-[#1C1917]">
          {event.description || '説明の記載はありません。'}
        </p>

        {/* 2. Causes & Consequences */}
        {(event.causes.length > 0 || event.consequences.length > 0) && (
          <div className="space-y-4 pt-4 border-t border-[#E6E0D6]">
            {event.causes.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-[#78716C] mb-1.5">
                  なぜ起きたか（原因・背景）
                </h3>
                <ul className="space-y-1.5 text-sm text-[#1C1917] leading-relaxed list-disc pl-4 marker:text-[#9A3412]">
                  {event.causes.map((cause, idx) => (
                    <li key={idx}>{cause}</li>
                  ))}
                </ul>
              </div>
            )}

            {event.consequences.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-[#78716C] mb-1.5">
                  どうなったか（結果・影響）
                </h3>
                <ul className="space-y-1.5 text-sm text-[#1C1917] leading-relaxed list-disc pl-4 marker:text-[#1E3A8A]">
                  {event.consequences.map((consequence, idx) => (
                    <li key={idx}>{consequence}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 3. Connected Events */}
        {allRelated.length > 0 && (
          <div className="pt-4 border-t border-[#E6E0D6]">
            <h3 className="text-xs font-semibold text-[#78716C] mb-2">
              つながりのある出来事
            </h3>
            <ul className="space-y-1.5">
              {allRelated.map((rel) => (
                <li key={rel.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEvent(rel.id)}
                    className="w-full text-left px-3 py-2 rounded-md border border-[#E6E0D6] hover:border-[#9A3412] hover:bg-[#FBF9F5] transition-colors flex items-center justify-between gap-2 group"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-mono tabular-nums text-[#78716C] mr-2">
                        {rel.date}
                      </span>
                      <span className="text-sm font-medium text-[#1C1917] group-hover:text-[#9A3412] transition-colors">
                        {rel.title}
                      </span>
                    </div>
                    <ArrowRight
                      className="w-3.5 h-3.5 text-[#78716C] group-hover:text-[#9A3412] shrink-0"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 4. People with Portraits */}
        {event.people.length > 0 && (
          <div className="pt-4 border-t border-[#E6E0D6]">
            <h3 className="text-xs font-semibold text-[#78716C] mb-2">
              関係人物
            </h3>
            <ul className="space-y-2">
              {event.people.map((person) => {
                const profile = personProfiles[person];
                return (
                  <li
                    key={person}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PersonAvatar
                        name={person}
                        photoUrl={profile?.photoUrl}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#1C1917] truncate">
                          {person}
                        </div>
                        {profile?.note && (
                          <div className="text-[11px] text-[#78716C] truncate">
                            {profile.note}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEditPersonPhoto(person)}
                      aria-label={`${person} の顔写真を登録・変更`}
                      title="顔写真を登録・変更"
                      className="p-1.5 text-[#78716C] hover:text-[#1C1917] hover:bg-[#F4F0E8] rounded transition-colors shrink-0"
                    >
                      <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* 5. Quiet Source Footer */}
        {event.source && (
          <div className="pt-3 border-t border-[#E6E0D6] text-[11px] text-[#78716C]">
            出典: {event.source}
          </div>
        )}
      </div>
    </article>
  );
}

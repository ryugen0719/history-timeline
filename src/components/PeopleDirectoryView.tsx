import { useMemo, useState } from 'react';
import { Camera, Globe, Loader2, Search, Users } from 'lucide-react';
import {
  COLOR_PALETTE,
  type ColorLabelsMap,
  type EventColorsMap,
  type HistoricalEvent,
  type PersonProfilesMap,
} from '../types/timeline';
import { extractPeopleDirectory } from '../utils/timelineParser';
import { PersonAvatar } from './PersonAvatar';

interface PeopleDirectoryViewProps {
  events: HistoricalEvent[];
  eventColors: EventColorsMap;
  colorLabels: ColorLabelsMap;
  personProfiles: PersonProfilesMap;
  isFetchingWiki: boolean;
  onFetchMissingWikiPortraits: () => void;
  onEditPersonPhoto: (personName: string) => void;
  onJumpToEvent: (eventId: string) => void;
}

export function PeopleDirectoryView({
  events,
  eventColors,
  colorLabels,
  personProfiles,
  isFetchingWiki,
  onFetchMissingWikiPortraits,
  onEditPersonPhoto,
  onJumpToEvent,
}: PeopleDirectoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyWithPhoto, setOnlyWithPhoto] = useState(false);

  const allPeople = useMemo(() => extractPeopleDirectory(events), [events]);

  const filteredPeople = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allPeople.filter((person) => {
      if (onlyWithPhoto && !personProfiles[person.name]?.photoUrl) {
        return false;
      }
      if (!q) return true;
      const note = personProfiles[person.name]?.note ?? '';
      return (
        person.name.toLowerCase().includes(q) ||
        note.toLowerCase().includes(q) ||
        person.places.some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [allPeople, onlyWithPhoto, personProfiles, searchQuery]);

  const registeredCount = useMemo(
    () =>
      allPeople.filter((p) => Boolean(personProfiles[p.name]?.photoUrl)).length,
    [allPeople, personProfiles]
  );

  const missingCount = allPeople.length - registeredCount;

  if (allPeople.length === 0) {
    return (
      <div className="bg-white border border-[#E6E0D6] rounded-lg p-12 text-center">
        <h2 className="text-lg font-serif font-semibold text-[#1C1917] mb-2">
          登録されている人物データがありません
        </h2>
        <p className="text-sm text-[#57534E]">
          「people」配列に人物名が含まれるJSONデータを読み込むと、人物名鑑が表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="people-directory-view">
      {/* Directory Header & Controls */}
      <div className="bg-white border border-[#E6E0D6] rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <div className="inline-flex items-center gap-2 text-base font-serif font-bold text-[#1C1917]">
            <Users className="w-4 h-4 text-[#9A3412]" aria-hidden="true" />
            <span>人物名鑑</span>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#57534E]">
            {allPeople.length}名（写真登録 {registeredCount}名）
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1 sm:flex-none">
            <Search
              className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <label htmlFor="people-search-input" className="sr-only">
              人物名や場所で検索
            </label>
            <input
              id="people-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="人物名・メモ・場所で検索..."
              className="w-full h-9 pl-9 pr-3 text-xs sm:text-sm bg-[#FBF9F5] border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
            />
          </div>

          <button
            type="button"
            onClick={() => setOnlyWithPhoto((v) => !v)}
            aria-pressed={onlyWithPhoto}
            className={`h-9 px-3 text-xs font-medium rounded-md border whitespace-nowrap transition-colors ${
              onlyWithPhoto
                ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                : 'bg-white text-[#57534E] border-[#D6CEBE] hover:text-[#1C1917]'
            }`}
          >
            写真登録済みのみ
          </button>

          {(missingCount > 0 || isFetchingWiki) && (
            <button
              type="button"
              onClick={onFetchMissingWikiPortraits}
              disabled={isFetchingWiki}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] disabled:opacity-70 rounded-md whitespace-nowrap transition-colors"
            >
              {isFetchingWiki ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9A3412]" aria-hidden="true" />
              ) : (
                <Globe className="w-3.5 h-3.5 text-[#9A3412]" aria-hidden="true" />
              )}
              {isFetchingWiki ? 'Wikipediaから取得中...' : 'Wikipediaから画像補完'}
            </button>
          )}
        </div>
      </div>

      {/* People Grid */}
      {filteredPeople.length === 0 ? (
        <div className="bg-white border border-[#E6E0D6] rounded-lg p-10 text-center text-sm text-[#57534E]">
          条件に一致する人物が見つかりませんでした。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredPeople.map((person) => {
            const profile = personProfiles[person.name];
            const hasPhoto = Boolean(profile?.photoUrl);

            return (
              <article
                key={person.name}
                className="bg-white border border-[#E6E0D6] rounded-lg p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <PersonAvatar
                        name={person.name}
                        photoUrl={profile?.photoUrl}
                        size="lg"
                      />
                      <div className="min-w-0">
                        <h2 className="text-lg font-serif font-bold text-[#1C1917] truncate">
                          {person.name}
                        </h2>
                        <div className="text-xs font-mono tabular-nums text-[#78716C] mt-0.5">
                          {person.firstDate === person.lastDate
                            ? person.firstDate
                            : `${person.firstDate} – ${person.lastDate}`}{' '}
                          · {person.events.length}件
                        </div>
                        {profile?.note && (
                          <p className="text-xs text-[#44403C] mt-1 line-clamp-2">
                            {profile.note}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onEditPersonPhoto(person.name)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                      {hasPhoto ? '写真を変更' : '顔写真を登録'}
                    </button>
                  </div>

                  {person.places.length > 0 && (
                    <div className="text-xs text-[#57534E]">
                      <span className="text-[#78716C] mr-1.5">関係地:</span>
                      {person.places.join('・')}
                    </div>
                  )}
                </div>

                {/* Associated events */}
                <div className="pt-3 border-t border-[#E6E0D6]">
                  <h3 className="text-[11px] font-semibold text-[#78716C] mb-1.5">
                    関連する出来事
                  </h3>
                  <ul className="space-y-1">
                    {person.events.slice(0, 3).map((ev) => {
                      const colorId = eventColors[ev.id];
                      const colorDef = colorId
                        ? COLOR_PALETTE.find((c) => c.id === colorId)
                        : undefined;
                      return (
                        <li key={ev.id}>
                          <button
                            type="button"
                            onClick={() => onJumpToEvent(ev.id)}
                            className="w-full text-left text-xs py-1 px-2 -mx-2 rounded hover:bg-[#FBF9F5] text-[#1C1917] hover:text-[#9A3412] transition-colors flex items-center gap-2"
                          >
                            {colorDef && (
                              <span
                                className="w-2 h-2 rounded-[2px] shrink-0"
                                style={{ backgroundColor: colorDef.swatchHex }}
                                title={
                                  colorLabels[colorDef.id] ||
                                  colorDef.defaultLabel
                                }
                              />
                            )}
                            <span className="font-mono tabular-nums text-[#78716C] shrink-0">
                              {ev.date}
                            </span>
                            <span className="truncate font-medium">
                              {ev.title}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                    {person.events.length > 3 && (
                      <li className="text-[11px] text-[#78716C] pt-0.5">
                        ほか {person.events.length - 3} 件
                      </li>
                    )}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

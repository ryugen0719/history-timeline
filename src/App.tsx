import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EventDetailPanel } from './components/EventDetailPanel';
import { FilterToolbar } from './components/FilterToolbar';
import { Header } from './components/Header';
import { ImportModal } from './components/ImportModal';
import { PeopleDirectoryView } from './components/PeopleDirectoryView';
import { PersonPhotoModal } from './components/PersonPhotoModal';
import { PlaceTimelineView } from './components/PlaceTimelineView';
import { TimelineView } from './components/TimelineView';
import { SAMPLE_DATASETS } from './data/sampleDatasets';
import {
  COLOR_PALETTE,
  DEFAULT_COLOR_LABELS,
  IMPORTANCE_COLOR_LABELS,
  LEGACY_DEFAULT_COLOR_LABELS,
  STUDY_COLOR_LABELS,
  type AssignedColorId,
  type ColorId,
  type ColorLabelsMap,
  type EventCategory,
  type EventColorsMap,
  type HistoricalDatabase,
  type PersonProfile,
  type PersonProfilesMap,
  type TimelineFilters,
  type TimelineGroupMode,
  type ViewMode,
} from './types/timeline';
import {
  autoAssignColorsByCategory,
  autoAssignColorsByImportance,
  countEventsByColor,
  extractPeopleDirectory,
  filterEvents,
  mergeHistoricalDatabases,
  parseHistoricalJson,
  sortEventsChronologically,
  toggleSelectedEventId,
} from './utils/timelineParser';
import {
  fetchWikipediaPortraitsBatch,
  mergeWikipediaPortraits,
} from './utils/wikipediaPortrait';

const STORAGE_KEY_DB = 'history_timeline_archive_db_v1';
const STORAGE_KEY_TITLE = 'history_timeline_archive_title_v1';
const STORAGE_KEY_PEOPLE = 'history_timeline_archive_people_v1';
const STORAGE_KEY_COLORS = 'history_timeline_archive_colors_v1';
const STORAGE_KEY_COLOR_LABELS = 'history_timeline_archive_color_labels_v1';
const STORAGE_KEY_WIKI_CHECKED = 'history_timeline_archive_wiki_checked_v1';

const DEFAULT_FILTERS: TimelineFilters = {
  search: '',
  category: 'all',
  importance: 'all',
  certainty: 'all',
  place: 'all',
  color: 'all',
  sortOrder: 'asc',
};

const ALL_CATEGORIES: EventCategory[] = [
  'politics',
  'diplomacy',
  'economy',
  'military',
  'society',
  'culture',
  'religion',
  'science',
];

function loadInitialState(): { db: HistoricalDatabase; title: string } {
  try {
    const savedJson = localStorage.getItem(STORAGE_KEY_DB);
    const savedTitle = localStorage.getItem(STORAGE_KEY_TITLE);
    if (savedJson) {
      const parsed = parseHistoricalJson(savedJson);
      if (parsed.ok && parsed.data) {
        return {
          db: parsed.data,
          title: savedTitle || '保存された歴史年表',
        };
      }
    }
  } catch {
    // Fallback to sample dataset if localStorage is unavailable
  }
  return {
    db: SAMPLE_DATASETS[0].data,
    title: SAMPLE_DATASETS[0].name,
  };
}

function loadJsonFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const initial = useMemo(() => loadInitialState(), []);
  const [database, setDatabase] = useState<HistoricalDatabase>(initial.db);
  const [datasetTitle, setDatasetTitle] = useState<string>(initial.title);
  const [activeView, setActiveView] = useState<ViewMode>('timeline');
  const [groupMode, setGroupMode] = useState<TimelineGroupMode>('era');
  const [filters, setFilters] = useState<TimelineFilters>(DEFAULT_FILTERS);
  const [personProfiles, setPersonProfiles] = useState<PersonProfilesMap>(() =>
    loadJsonFromStorage<PersonProfilesMap>(STORAGE_KEY_PEOPLE, {})
  );
  const [eventColors, setEventColors] = useState<EventColorsMap>(() =>
    loadJsonFromStorage<EventColorsMap>(STORAGE_KEY_COLORS, {})
  );
  const [colorLabels, setColorLabels] = useState<ColorLabelsMap>(() => {
    const saved = loadJsonFromStorage<Partial<ColorLabelsMap>>(
      STORAGE_KEY_COLOR_LABELS,
      {}
    );
    const merged: ColorLabelsMap = { ...DEFAULT_COLOR_LABELS };
    for (const def of COLOR_PALETTE) {
      const val = saved[def.id];
      if (val && val !== LEGACY_DEFAULT_COLOR_LABELS[def.id]) {
        merged[def.id] = val;
      }
    }
    return merged;
  });

  const [selectedEventId, setSelectedEventId] = useState<string | null>(() => {
    const sorted = sortEventsChronologically(initial.db.events, 'asc');
    return sorted[0]?.id ?? null;
  });
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [isPlacesDetailOpen, setIsPlacesDetailOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingPersonName, setEditingPersonName] = useState<string | null>(
    null
  );
  const [isFetchingWiki, setIsFetchingWiki] = useState(false);

  useEffect(() => {
    if (!isPlacesDetailOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPlacesDetailOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlacesDetailOpen]);

  const wikiCheckedRef = useRef<Set<string>>(
    new Set(loadJsonFromStorage<string[]>(STORAGE_KEY_WIKI_CHECKED, []))
  );
  const personProfilesRef = useRef<PersonProfilesMap>(personProfiles);
  personProfilesRef.current = personProfiles;

  // Persist dataset & user customizations
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DB, JSON.stringify(database));
      localStorage.setItem(STORAGE_KEY_TITLE, datasetTitle);
    } catch {
      // Ignore storage quota errors
    }
  }, [database, datasetTitle]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PEOPLE, JSON.stringify(personProfiles));
    } catch {
      // Ignore storage quota errors
    }
  }, [personProfiles]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COLORS, JSON.stringify(eventColors));
    } catch {
      // Ignore storage quota errors
    }
  }, [eventColors]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_COLOR_LABELS,
        JSON.stringify(colorLabels)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [colorLabels]);

  const runWikipediaFetch = useCallback(
    async (targetNames: string[]) => {
      if (targetNames.length === 0) return;
      setIsFetchingWiki(true);
      try {
        const { portraits, completed } = await fetchWikipediaPortraitsBatch(
          targetNames
        );
        if (completed) {
          for (const name of targetNames) {
            wikiCheckedRef.current.add(name);
          }
          try {
            localStorage.setItem(
              STORAGE_KEY_WIKI_CHECKED,
              JSON.stringify(Array.from(wikiCheckedRef.current))
            );
          } catch {
            // Ignore storage quota errors
          }
        }
        if (Object.keys(portraits).length > 0) {
          setPersonProfiles((prev) => mergeWikipediaPortraits(prev, portraits));
        }
      } finally {
        setIsFetchingWiki(false);
      }
    },
    []
  );

  // Automatically fetch Wikipedia portraits for newly appearing people who don't have photos yet
  useEffect(() => {
    const people = extractPeopleDirectory(database.events);
    const missingUnchecked = people
      .map((p) => p.name)
      .filter(
        (name) =>
          !personProfilesRef.current[name]?.photoUrl &&
          !wikiCheckedRef.current.has(name)
      );

    if (missingUnchecked.length > 0) {
      void runWikipediaFetch(missingUnchecked);
    }
  }, [database.events, runWikipediaFetch]);

  const handleFetchMissingWikiPortraits = () => {
    const people = extractPeopleDirectory(database.events);
    const missing = people
      .map((p) => p.name)
      .filter((name) => !personProfiles[name]?.photoUrl);
    if (missing.length > 0) {
      void runWikipediaFetch(missing);
    }
  };

  const eventsBeforeColorFilter = useMemo(
    () =>
      filterEvents(
        database.events,
        { ...filters, color: 'all' },
        eventColors
      ),
    [database.events, filters, eventColors]
  );

  const colorCounts = useMemo(
    () => countEventsByColor(eventsBeforeColorFilter, eventColors),
    [eventsBeforeColorFilter, eventColors]
  );

  const filteredEvents = useMemo(
    () => filterEvents(database.events, filters, eventColors),
    [database.events, filters, eventColors]
  );

  const availableCategories = useMemo(() => {
    const present = new Set<EventCategory>();
    for (const ev of database.events) {
      for (const cat of ev.category) {
        present.add(cat);
      }
    }
    return ALL_CATEGORIES.filter((c) => present.has(c));
  }, [database.events]);

  const selectedEvent = useMemo(
    () =>
      selectedEventId
        ? database.events.find((e) => e.id === selectedEventId) ?? null
        : null,
    [database.events, selectedEventId]
  );

  const handleSelectEvent = (eventId: string) => {
    const nextId = toggleSelectedEventId(selectedEventId, eventId);
    setSelectedEventId(nextId);
    if (nextId === null) {
      setIsPlacesDetailOpen(false);
      setIsMobileDetailOpen(false);
      return;
    }
    if (activeView === 'places') {
      setIsPlacesDetailOpen(true);
    } else {
      setIsMobileDetailOpen(true);
    }
  };

  const handleChangeView = (nextView: ViewMode) => {
    setActiveView(nextView);
    if (nextView !== 'places') {
      setIsPlacesDetailOpen(false);
    }
  };

  const handleJumpToEventFromPeople = (eventId: string) => {
    setSelectedEventId(eventId);
    setActiveView('timeline');
    setIsMobileDetailOpen(true);
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const handleAssignColor = (eventId: string, colorId: ColorId) => {
    setEventColors((prev) => {
      const next = { ...prev };
      if (colorId === 'none') {
        delete next[eventId];
      } else {
        next[eventId] = colorId;
      }
      return next;
    });
  };

  const handleUpdateColorLabel = (
    colorId: AssignedColorId,
    label: string
  ) => {
    setColorLabels((prev) => ({
      ...prev,
      [colorId]: label,
    }));
  };

  const handleAutoAssignByCategory = () => {
    setEventColors(autoAssignColorsByCategory(database.events));
    setColorLabels(DEFAULT_COLOR_LABELS);
    if (filters.color !== 'all') {
      setFilters((prev) => ({ ...prev, color: 'all' }));
    }
  };

  const handleAutoAssignByImportance = () => {
    setEventColors(autoAssignColorsByImportance(database.events));
    setColorLabels(IMPORTANCE_COLOR_LABELS);
    if (filters.color !== 'all') {
      setFilters((prev) => ({ ...prev, color: 'all' }));
    }
  };

  const handleApplyLabelPreset = (preset: 'category' | 'study' | 'importance') => {
    if (preset === 'category') {
      setColorLabels(DEFAULT_COLOR_LABELS);
    } else if (preset === 'importance') {
      setColorLabels(IMPORTANCE_COLOR_LABELS);
    } else {
      setColorLabels(STUDY_COLOR_LABELS);
    }
  };

  const handleClearAllColors = () => {
    setEventColors({});
    if (filters.color !== 'all') {
      setFilters((prev) => ({ ...prev, color: 'all' }));
    }
  };

  const handleSavePersonProfile = (
    name: string,
    profile: PersonProfile | null
  ) => {
    wikiCheckedRef.current.add(name);
    setPersonProfiles((prev) => {
      const next = { ...prev };
      if (!profile) {
        delete next[name];
      } else {
        next[name] = profile;
      }
      return next;
    });
  };

  const handleApplyDatabase = (
    incoming: HistoricalDatabase,
    mode: 'replace' | 'merge',
    title?: string
  ) => {
    const nextDb =
      mode === 'merge'
        ? mergeHistoricalDatabases(database, incoming)
        : incoming;

    setDatabase(nextDb);
    if (title) {
      setDatasetTitle(mode === 'merge' ? `${datasetTitle} + ${title}` : title);
    }
    setFilters(DEFAULT_FILTERS);
    const sorted = sortEventsChronologically(nextDb.events, 'asc');
    setSelectedEventId(sorted[0]?.id ?? null);
    setIsMobileDetailOpen(false);
    setIsPlacesDetailOpen(false);
  };

  const handleExportJson = () => {
    const payload = JSON.stringify(database, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'historical-timeline.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] text-[#1C1917]">
      <Header
        activeView={activeView}
        onChangeView={handleChangeView}
        onOpenImport={() => setIsImportOpen(true)}
      />

      {activeView !== 'people' && (
        <FilterToolbar
          datasetTitle={datasetTitle}
          totalCount={database.events.length}
          filteredCount={filteredEvents.length}
          activeView={activeView}
          groupMode={groupMode}
          onChangeGroupMode={setGroupMode}
          availableCategories={availableCategories}
          filters={filters}
          colorCounts={colorCounts}
          colorLabels={colorLabels}
          onUpdateColorLabel={handleUpdateColorLabel}
          onApplyLabelPreset={handleApplyLabelPreset}
          onAutoAssignByCategory={handleAutoAssignByCategory}
          onAutoAssignByImportance={handleAutoAssignByImportance}
          onClearAllColors={handleClearAllColors}
          onChangeFilters={setFilters}
          onResetFilters={handleResetFilters}
          onExportJson={handleExportJson}
          onOpenImport={() => setIsImportOpen(true)}
        />
      )}

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeView === 'people' ? (
          <PeopleDirectoryView
            events={database.events}
            eventColors={eventColors}
            colorLabels={colorLabels}
            personProfiles={personProfiles}
            isFetchingWiki={isFetchingWiki}
            onFetchMissingWikiPortraits={handleFetchMissingWikiPortraits}
            onEditPersonPhoto={setEditingPersonName}
            onJumpToEvent={handleJumpToEventFromPeople}
          />
        ) : activeView === 'places' ? (
          <PlaceTimelineView
            events={filteredEvents}
            allEvents={database.events}
            selectedEventId={selectedEvent?.id ?? null}
            eventColors={eventColors}
            colorLabels={colorLabels}
            personProfiles={personProfiles}
            onSelectEvent={handleSelectEvent}
            onClearSelection={() => setSelectedEventId(null)}
            onResetFilters={handleResetFilters}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            <div className="lg:col-span-7 xl:col-span-8 min-w-0">
              <TimelineView
                events={filteredEvents}
                allEvents={database.events}
                selectedEventId={selectedEvent?.id ?? null}
                groupMode={groupMode}
                eventColors={eventColors}
                colorLabels={colorLabels}
                personProfiles={personProfiles}
                onSelectEvent={handleSelectEvent}
                onClearSelection={() => setSelectedEventId(null)}
                onAutoAssignByCategory={handleAutoAssignByCategory}
                onAutoAssignByImportance={handleAutoAssignByImportance}
                onResetFilters={handleResetFilters}
              />
            </div>

            {/* Desktop sticky detail inspector */}
            <aside
              aria-label="出来事の詳細インスペクター"
              className="hidden lg:block lg:col-span-5 xl:col-span-4 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto archival-scroll"
            >
              <EventDetailPanel
                event={selectedEvent}
                allEvents={database.events}
                eventColors={eventColors}
                colorLabels={colorLabels}
                personProfiles={personProfiles}
                onAssignColor={handleAssignColor}
                onEditPersonPhoto={setEditingPersonName}
                onSelectEvent={setSelectedEventId}
              />
            </aside>
          </div>
        )}
      </main>

      {/* Mobile slide-over detail drawer for Timeline view */}
      {isMobileDetailOpen && selectedEvent && activeView === 'timeline' && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-[#1C1917]/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMobileDetailOpen(false);
          }}
        >
          <div className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto archival-scroll rounded-t-xl sm:rounded-lg shadow-xl">
            <EventDetailPanel
              event={selectedEvent}
              allEvents={database.events}
              eventColors={eventColors}
              colorLabels={colorLabels}
              personProfiles={personProfiles}
              onAssignColor={handleAssignColor}
              onEditPersonPhoto={setEditingPersonName}
              onSelectEvent={setSelectedEventId}
              onCloseMobile={() => setIsMobileDetailOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Slide-over detail drawer for Full-Width Places view */}
      {isPlacesDetailOpen && selectedEvent && activeView === 'places' && (
        <div
          className="fixed inset-0 z-40 bg-[#1C1917]/35 flex justify-end items-end sm:items-stretch"
          role="dialog"
          aria-modal="true"
          aria-label="出来事の詳細"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPlacesDetailOpen(false);
          }}
        >
          <div className="w-full sm:max-w-[440px] max-h-[88vh] sm:max-h-screen sm:h-full bg-[#FBF9F5] border-l border-[#E6E0D6] shadow-2xl overflow-y-auto archival-scroll p-3 sm:p-4 rounded-t-xl sm:rounded-none">
            <EventDetailPanel
              event={selectedEvent}
              allEvents={database.events}
              eventColors={eventColors}
              colorLabels={colorLabels}
              personProfiles={personProfiles}
              onAssignColor={handleAssignColor}
              onEditPersonPhoto={setEditingPersonName}
              onSelectEvent={setSelectedEventId}
              onClose={() => setIsPlacesDetailOpen(false)}
            />
          </div>
        </div>
      )}

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onExportJson={handleExportJson}
        onApplyDatabase={handleApplyDatabase}
      />

      <PersonPhotoModal
        personName={editingPersonName}
        currentProfile={
          editingPersonName ? personProfiles[editingPersonName] : undefined
        }
        onSave={handleSavePersonProfile}
        onClose={() => setEditingPersonName(null)}
      />
    </div>
  );
}

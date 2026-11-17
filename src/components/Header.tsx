import type { ViewMode } from '../types/timeline';

interface HeaderProps {
  activeView: ViewMode;
  onChangeView: (view: ViewMode) => void;
  onOpenImport: () => void;
}

const NAV_ITEMS: Array<{ id: ViewMode; label: string }> = [
  { id: 'timeline', label: '年表' },
  { id: 'places', label: '地域別' },
  { id: 'map', label: 'マップ' },
  { id: 'people', label: '人物' },
];

export function Header({
  activeView,
  onChangeView,
  onOpenImport,
}: HeaderProps) {
  return (
    <header className="md:sticky md:top-0 z-30 bg-[#FBF9F5]/95 backdrop-blur-sm border-b border-[#E6E0D6]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4 md:gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onChangeView('timeline')}
          className="text-lg font-serif font-bold tracking-tight text-[#1C1917] whitespace-nowrap shrink-0 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9A3412]"
        >
          歴史年表
        </button>

        {/* Zone 2 (Desktop): 3 clean single-line navigation tabs */}
        <nav
          aria-label="表示モード"
          className="hidden md:flex items-center gap-8"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeView(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9A3412] ${
                  isActive
                    ? 'text-[#1C1917]'
                    : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-[#9A3412]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Quiet secondary action for loading data */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onOpenImport}
            className="px-3 py-1.5 text-xs sm:text-sm font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:border-[#1C1917] rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9A3412]"
          >
            データ読込
          </button>
        </div>
      </div>

      {/* Mobile view switcher row */}
      <nav
        aria-label="モバイル表示モード"
        className="md:hidden border-t border-[#E6E0D6] px-4 flex items-center justify-around gap-4 bg-[#FBF9F5]"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeView(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative py-2 px-3 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                isActive ? 'text-[#1C1917]' : 'text-[#57534E]'
              }`}
            >
              {item.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-[#9A3412]"
                />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

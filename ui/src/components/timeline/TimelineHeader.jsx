import { Minus, Plus } from 'lucide-react'

function TimelineHeader({
  heroName,
  isAuthenticated,
  isSyncingIssueStates,
  issueStatesError,
  sortOptions,
  sortDirection,
  onSortChange,
  zoomPercentage,
  onZoomIn,
  onZoomOut,
  isZoomedIn,
  isZoomedOut,
  issueFilter = 'all',
  issueFilterOptions = [],
  onIssueFilterChange,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
      <div>
        <p className="title-xs">{heroName} timeline</p>
        <p className="body-xs text-slate-500">Events sync from the IssueLine backend.</p>
        {!isAuthenticated ? (
          <p className="body-xs text-slate-400">Sign in to track which issues you own or have read.</p>
        ) : null}
        {isAuthenticated && isSyncingIssueStates ? (
          <p className="body-xs text-slate-400">Syncing your issue states...</p>
        ) : null}
        {issueStatesError ? (
          <p className="body-xs text-rose-500">Unable to sync your issue states. Please try again.</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="body-xs text-slate-500">Sort by date:</span>
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5">
            {sortOptions.map((option) => {
              const isActive = sortDirection === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onSortChange(option.value)}
                  className={`rounded-full px-3 py-1 body-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="body-xs text-slate-500">Zoom timeline:</span>
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-white">
            <button
              type="button"
              onClick={onZoomOut}
              disabled={isZoomedOut}
              aria-label="Zoom out timeline"
              className={`rounded-l-full p-2 text-slate-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                isZoomedOut ? 'cursor-not-allowed opacity-40' : 'hover:text-slate-900'
              }`}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-[3.5rem] text-center text-[11px] font-semibold text-slate-700 tabular-nums">
              {zoomPercentage}%
            </span>
            <button
              type="button"
              onClick={onZoomIn}
              disabled={isZoomedIn}
              aria-label="Zoom in timeline"
              className={`rounded-r-full p-2 text-slate-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                isZoomedIn ? 'cursor-not-allowed opacity-40' : 'hover:text-slate-900'
              }`}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        {issueFilterOptions.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="body-xs text-slate-500">Filter issues:</span>
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5">
              {issueFilterOptions.map((option) => {
                const isActive = issueFilter === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onIssueFilterChange?.(option.value)}
                    className={`rounded-full px-3 py-1 body-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default TimelineHeader

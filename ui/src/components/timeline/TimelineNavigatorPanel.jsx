import { EyeOff } from 'lucide-react'

function TimelineNavigatorPanel({
  indexMode,
  onIndexModeChange,
  indexOptions,
  anchorLookup,
  activeAnchor,
  onAnchorClick,
  onToggleVisibility,
}) {
  const anchors = anchorLookup[indexMode] ?? []
  const isPillMode = indexMode === 'year' || indexMode === 'issue'
  const containerClasses = `${
    isPillMode
      ? 'grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1 lg:max-h-[60vh] lg:grid-cols-3'
      : 'flex max-h-72 flex-col gap-2 overflow-y-auto pr-1 lg:max-h-[60vh]'
  } no-scrollbar`

  return (
    <aside className="flex w-full flex-col overflow-hidden rounded-3xl border border-slate-100/80 bg-gradient-to-b from-white/95 via-slate-50/90 to-slate-100/60 p-4 shadow-xl shadow-slate-200/70 ring-1 ring-white/60 backdrop-blur lg:sticky lg:top-6 lg:max-h-[80vh] lg:max-w-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="body-xs font-semibold uppercase tracking-wide text-slate-500">Jump to</p>
        <button
          type="button"
          onClick={onToggleVisibility}
          className="rounded-full border border-slate-200 bg-white p-1 text-slate-500 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          aria-label="Hide timeline index"
        >
          <EyeOff className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 inline-flex w-full rounded-full border border-slate-200 bg-white/80 p-0.5 shadow-inner">
        {indexOptions.map((option) => {
          const isActive = indexMode === option.value
          const hasAnchors = (anchorLookup[option.value] ?? []).length > 0
          return (
            <button
              key={option.value}
              type="button"
              disabled={!hasAnchors}
              onClick={() => onIndexModeChange(option.value)}
              className={`flex-1 rounded-full px-3 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/40'
                  : hasAnchors
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'cursor-not-allowed text-slate-300'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      <div className="mt-4 flex-1 overflow-hidden">
        <div className={containerClasses}>
          {anchors.length ? (
            anchors.map((anchor) => {
              const isActive = activeAnchor === anchor.key
              const baseClasses = isPillMode
                ? 'flex flex-col items-center justify-center text-center'
                : 'flex w-full flex-col text-left'
              const activeClasses = isActive
                ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/30'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-900/40 hover:text-slate-900'
              const countBadgeClasses = isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'

              return (
                <button
                  key={anchor.key}
                  type="button"
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => onAnchorClick(anchor)}
                  className={`group relative overflow-hidden rounded-2xl border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${baseClasses} ${activeClasses}`}
                >
                  <div className={isPillMode ? 'space-y-1' : 'w-full space-y-1 pr-8'}>
                    <span className={isPillMode ? 'text-sm font-semibold' : 'font-semibold text-slate-800'}>
                      {anchor.label}
                    </span>
                    {!isPillMode && indexMode === 'stage' && anchor.summary ? (
                      <p className="text-[11px] font-normal leading-snug text-slate-500">
                        {anchor.summary}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] ${countBadgeClasses} ${
                      isPillMode ? '' : 'absolute right-3 top-2'
                    }`}
                  >
                    {anchor.count}
                  </span>
                </button>
              )
            })
          ) : (
            <p className="text-[11px] text-slate-400">No anchors for this view.</p>
          )}
        </div>
      </div>
    </aside>
  )
}

export default TimelineNavigatorPanel


import { EyeOff } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider.jsx'

function TimelineNavigatorPanel({
  indexMode,
  onIndexModeChange,
  indexOptions,
  anchorLookup,
  activeAnchor,
  onAnchorClick,
  onToggleVisibility,
}) {
  const { t } = useI18n()
  const anchors = anchorLookup[indexMode] ?? []
  const isPillMode = indexMode === 'year' || indexMode === 'issue'
  const isStageMode = indexMode === 'stage'
  const containerClasses = `${
    isPillMode
      ? 'grid grid-cols-3 gap-2 md:grid-cols-3'
      : 'flex flex-col gap-2'
  }`

  return (
    <aside className="flex w-full flex-col overflow-hidden rounded-3xl border border-slate-100/80 bg-linear-to-b from-white/95 via-slate-50/90 to-slate-100/60 p-4 shadow-xl shadow-slate-200/70 ring-1 ring-white/60 backdrop-blur md:h-full md:min-h-0 md:self-start md:max-w-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="body-xs font-semibold uppercase tracking-wide text-slate-500">{t('timeline.jumpTo')}</p>
        <button
          type="button"
          onClick={onToggleVisibility}
          className="rounded-full border border-slate-200 bg-white p-1 text-slate-500 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          aria-label={t('timeline.hideTimelineIndex')}
        >
          <EyeOff className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 inline-flex w-full rounded-full border border-slate-200 bg-white/85 p-0.5 shadow-inner">
        {indexOptions.map((option) => {
          const isActive = indexMode === option.value
          const hasAnchors = (anchorLookup[option.value] ?? []).length > 0
          return (
            <button
              key={option.value}
              type="button"
              disabled={!hasAnchors}
              onClick={() => onIndexModeChange(option.value)}
              className={`flex-1 rounded-full px-3 py-1.5 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 focus-visible:ring-offset-white ${
                isActive
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/40'
                  : hasAnchors
                    ? 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                    : 'cursor-not-allowed text-slate-300'
              }`}
            >
              {t(option.labelKey)}
            </button>
          )
        })}
      </div>
      <div className="mt-4 max-h-72 flex-1 overflow-y-auto pr-1 no-scrollbar md:h-full md:max-h-none md:min-h-0">
        <div className={containerClasses}>
          {anchors.length ? (
            anchors.map((anchor) => {
              const isActive = activeAnchor === anchor.key
              const baseClasses = isPillMode
                ? 'flex flex-col items-center justify-center text-center'
                : isStageMode
                  ? 'flex w-full items-start justify-between gap-3 text-left'
                  : 'flex w-full items-center justify-between gap-2 text-left'
              const activeClasses = isActive
                ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/30'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-900/40 hover:bg-slate-50 hover:text-slate-900'
              const countBadgeClasses = isActive
                ? 'bg-white/30 text-white ring-1 ring-white/40'
                : 'bg-slate-200 text-slate-900 ring-1 ring-slate-300'
              const countBadgeSizeClasses = isStageMode
                ? 'px-3 py-1 text-xs font-extrabold tracking-[0.12em]'
                : 'px-2 py-0.5 text-[10px] font-bold tracking-[0.2em]'
              const labelClasses = isPillMode
                ? isActive
                  ? 'text-sm font-semibold text-white'
                  : 'text-sm font-semibold text-slate-700'
                : isStageMode
                  ? isActive
                    ? 'text-base font-semibold leading-snug text-white'
                    : 'text-base font-semibold leading-snug text-slate-800'
                  : isActive
                    ? 'text-sm font-semibold text-white'
                    : 'text-sm font-semibold text-slate-800'
              const summaryClasses = isActive ? 'text-white/80' : 'text-slate-500'
              const buttonSizeClasses = isStageMode ? 'min-h-24 py-3' : isPillMode ? 'min-h-10 py-2' : 'min-h-9 py-2'
              const labelContainerClasses = isPillMode
                ? 'space-y-1'
                : isStageMode
                  ? 'min-w-0 flex-1 space-y-1.5'
                  : 'min-w-0 flex-1'
              const labelTextClasses = isStageMode ? `${labelClasses} block whitespace-normal break-words` : `${labelClasses} block truncate`
              const countAlignClasses = isStageMode ? 'mt-0.5' : ''

              return (
                <button
                  key={anchor.key}
                  type="button"
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => onAnchorClick(anchor)}
                  className={`group relative rounded-2xl border px-3 text-xs font-semibold leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white ${baseClasses} ${activeClasses} ${buttonSizeClasses}`}
                >
                  <div className={labelContainerClasses}>
                    <span className={labelTextClasses}>{anchor.label}</span>
                    {!isPillMode && isStageMode && anchor.summary ? (
                      <p className={`mt-1 text-[11px] font-normal leading-snug ${summaryClasses}`}>
                        {anchor.summary}
                      </p>
                    ) : null}
                  </div>
                  <span className={`shrink-0 rounded-full uppercase ${countBadgeSizeClasses} ${countBadgeClasses} ${countAlignClasses}`}>
                    {anchor.count}
                  </span>
                </button>
              )
            })
          ) : (
            <p className="text-[11px] text-slate-400">{t('timeline.noAnchorsForView')}</p>
          )}
        </div>
      </div>
    </aside>
  )
}

export default TimelineNavigatorPanel

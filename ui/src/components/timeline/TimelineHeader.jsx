import { useEffect, useState } from 'react'
import { BookOpen, CheckCircle2, Minus, Plus } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider.jsx'

function TimelineHeader({
  heroName,
  timelineLogoSrc = null,
  timelineLogoAlt = null,
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
  publicationFilter = 'all',
  publicationFilterOptions = [],
  onPublicationFilterChange,
  collectionFilters = { ownedOnly: false, readOnly: false },
  onCollectionFilterChange,
}) {
  const { t } = useI18n()
  const [logoVisible, setLogoVisible] = useState(Boolean(timelineLogoSrc))

  useEffect(() => {
    setLogoVisible(Boolean(timelineLogoSrc))
  }, [timelineLogoSrc])

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
      <div>
        {timelineLogoSrc && logoVisible ? (
          <img
            src={timelineLogoSrc}
            alt={timelineLogoAlt ?? t('timeline.heroTimelineTitle', { heroName })}
            className="mb-2 h-12 w-auto max-w-full object-contain sm:h-14 sm:max-w-[320px]"
            loading="lazy"
            onError={() => setLogoVisible(false)}
          />
        ) : (
          <p className="title-xs">{t('timeline.heroTimelineTitle', { heroName })}</p>
        )}
        <p className="body-xs text-slate-500">{t('timeline.eventsSyncFromBackend')}</p>
        {!isAuthenticated ? (
          <p className="body-xs text-slate-400">{t('timeline.signInToTrackIssues')}</p>
        ) : null}
        {isAuthenticated && isSyncingIssueStates ? (
          <p className="body-xs text-slate-400">{t('timeline.syncingIssueStates')}</p>
        ) : null}
        {issueStatesError ? (
          <p className="body-xs text-rose-500">{t('timeline.issueStateSyncError')}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="body-xs text-slate-500">{t('timeline.sortByDate')}</span>
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
                  {t(option.labelKey)}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="body-xs text-slate-500">{t('timeline.zoomTimeline')}</span>
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-white">
            <button
              type="button"
              onClick={onZoomOut}
              disabled={isZoomedOut}
              aria-label={t('timeline.zoomOutTimeline')}
              className={`rounded-l-full p-2 text-slate-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                isZoomedOut ? 'cursor-not-allowed opacity-40' : 'hover:text-slate-900'
              }`}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-14 text-center text-[11px] font-semibold text-slate-700 tabular-nums">
              {zoomPercentage}%
            </span>
            <button
              type="button"
              onClick={onZoomIn}
              disabled={isZoomedIn}
              aria-label={t('timeline.zoomInTimeline')}
              className={`rounded-r-full p-2 text-slate-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                isZoomedIn ? 'cursor-not-allowed opacity-40' : 'hover:text-slate-900'
              }`}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        {publicationFilterOptions.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="body-xs text-slate-500">{t('timeline.filterPublication')}</span>
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5">
              {publicationFilterOptions.map((option) => {
                const isActive = publicationFilter === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onPublicationFilterChange?.(option.value)}
                    className={`rounded-full px-3 py-1 body-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t(option.labelKey)}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <span className="body-xs text-slate-500">{t('timeline.filterCollection')}</span>
          <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              aria-pressed={Boolean(collectionFilters?.ownedOnly)}
              aria-label={t('timeline.ownedOnly')}
              disabled={!isAuthenticated}
              title={!isAuthenticated ? t('timeline.signInToTrackIssues') : t('timeline.ownedOnly')}
              onClick={() => onCollectionFilterChange?.('ownedOnly', !collectionFilters?.ownedOnly)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                collectionFilters?.ownedOnly
                  ? 'bg-emerald-100 text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              } ${!isAuthenticated ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t('timeline.haveIt')}
            </button>
            <button
              type="button"
              aria-pressed={Boolean(collectionFilters?.readOnly)}
              aria-label={t('timeline.readOnly')}
              disabled={!isAuthenticated}
              title={!isAuthenticated ? t('timeline.signInToTrackIssues') : t('timeline.readOnly')}
              onClick={() => onCollectionFilterChange?.('readOnly', !collectionFilters?.readOnly)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                collectionFilters?.readOnly
                  ? 'bg-sky-100 text-sky-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              } ${!isAuthenticated ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              {t('timeline.readIt')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TimelineHeader

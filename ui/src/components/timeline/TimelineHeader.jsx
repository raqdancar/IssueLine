// Construeix peces visuals i derivacions de la cronologia d'issues.
import { useEffect, useState } from 'react'
import { BookOpen, CheckCircle2, Maximize2, Minimize2, Minus, Plus } from 'lucide-react'
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
  timelineOrderMode = 'publication',
  timelineOrderOptions = [],
  onTimelineOrderModeChange,
  hasCanonicalTimelineOrder = false,
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
  fullscreenEnabled = false,
  isFullscreen = false,
  onToggleFullscreen,
  showcaseMode = false,
}) {
  const { t } = useI18n()
  const [logoVisible, setLogoVisible] = useState(Boolean(timelineLogoSrc))

  // Hide broken logo assets and fall back to the text title.
  useEffect(() => {
    setLogoVisible(Boolean(timelineLogoSrc))
  }, [timelineLogoSrc])

  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 pb-4 ${
        showcaseMode ? 'rounded-2xl border border-white/55 bg-white/75 px-4 pt-4 shadow-xl backdrop-blur' : 'border-b border-slate-100'
      }`}
    >
      <div className="flex w-full flex-wrap items-start justify-between gap-3">
        <div>
          {showcaseMode ? (
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.35em] text-indigo-500">{t('timeline.showcaseMode')}</p>
          ) : null}
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
        </div>
        <div className="min-h-5 text-left md:text-right">
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
      </div>
      <div className="flex w-full flex-col items-start gap-3 md:w-auto md:items-end">
        <div className={`flex w-full flex-wrap items-center gap-3 md:w-auto md:justify-end md:gap-4 ${showcaseMode ? 'pt-1' : ''}`}>
          {fullscreenEnabled ? (
            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-pressed={isFullscreen}
              aria-label={isFullscreen ? t('timeline.exitFullscreen') : t('timeline.enterFullscreen')}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />}
              {isFullscreen ? t('timeline.exitFullscreen') : t('timeline.enterFullscreen')}
            </button>
          ) : null}
          {hasCanonicalTimelineOrder && timelineOrderOptions.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs leading-snug text-muted-foreground">{t('timeline.orderMode')}</span>
              <div className="inline-flex rounded-full border border-border bg-card p-0.5">
                {timelineOrderOptions.map((option) => {
                  const isActive = timelineOrderMode === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => onTimelineOrderModeChange?.(option.value)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold leading-snug transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isActive
                          ? 'bg-secondary text-secondary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
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
            <span className="text-xs leading-snug text-muted-foreground">{t('timeline.sortByDate')}</span>
            <div className="inline-flex rounded-full border border-border bg-card p-0.5">
              {sortOptions.map((option) => {
                const isActive = sortDirection === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onSortChange(option.value)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold leading-snug transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t(option.labelKey)}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            <span className="text-xs leading-snug text-muted-foreground">{t('timeline.zoomTimeline')}</span>
            <div className="inline-flex items-center rounded-full border border-border bg-card">
              <button
                type="button"
                onClick={onZoomOut}
                disabled={isZoomedOut}
                aria-label={t('timeline.zoomOutTimeline')}
                className={`rounded-l-full p-2 text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isZoomedOut ? 'cursor-not-allowed opacity-40' : 'hover:text-foreground'
                }`}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-14 text-center text-[11px] font-semibold text-foreground tabular-nums">
                {zoomPercentage}%
              </span>
              <button
                type="button"
                onClick={onZoomIn}
                disabled={isZoomedIn}
                aria-label={t('timeline.zoomInTimeline')}
                className={`rounded-r-full p-2 text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isZoomedIn ? 'cursor-not-allowed opacity-40' : 'hover:text-foreground'
                }`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          {publicationFilterOptions.length ? (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <span className="text-xs leading-snug text-muted-foreground">{t('timeline.filterPublication')}</span>
            <div className="inline-flex rounded-full border border-border bg-card p-0.5">
              {publicationFilterOptions.map((option) => {
                const isActive = publicationFilter === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onPublicationFilterChange?.(option.value)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold leading-snug transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t(option.labelKey)}
                  </button>
                )
              })}
            </div>
          </div>
          ) : null}
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <span className="text-xs leading-snug text-muted-foreground">{t('timeline.filterCollection')}</span>
            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-0.5">
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
                    : 'text-muted-foreground hover:text-foreground'
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
                    : 'text-muted-foreground hover:text-foreground'
                } ${!isAuthenticated ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                {t('timeline.readIt')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TimelineHeader

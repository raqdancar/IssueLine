// Construeix peces visuals i derivacions de la cronologia d'issues.
import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import TimelineStageTab from './TimelineStageTab'
import TimelineIssueToolbar from './TimelineIssueToolbar'
import { useI18n } from '@/i18n/I18nProvider.jsx'

function TimelineIssueCardDetailed({
  viewModel,
  issueState,
  showcaseMode = false,
  showcaseSide = 'left',
  showIssueStateActions = false,
  issueStateDisabled = false,
  issueStateDisabledReason,
  issueStatePending = false,
  onIssueStateToggle,
  onCoverPreview,
  onIssueSelect,
  isHighlighted = false,
  isFlashing = false,
  onEntryHighlight,
}) {
  const { t } = useI18n()
  const {
    entry,
    entryDomId,
    isLast,
    severityVariant,
    gradientStyle,
    issueDateLabel,
    stageName,
    stageSummary,
    coverImage,
    meta,
  } = viewModel

  const {
    seriesName,
    number,
    volume,
    publicationDate,
    price,
    pageCount,
    editing,
    rating,
    issueTitle,
    legacyNumber,
    legacyMatchesIssueNumber,
  } = meta
  const [coverFailed, setCoverFailed] = useState(false)

  useEffect(() => {
    setCoverFailed(false)
  }, [coverImage])

  const hasDisplayableCover = Boolean(coverImage && !coverFailed)

  const handleHighlight = () => {
    onEntryHighlight?.(entryDomId)
    onIssueSelect?.(entry)
  }
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleHighlight()
    }
  }
  const highlightClasses = isHighlighted ? 'ring-2 ring-indigo-400/70 shadow-xl shadow-indigo-200/60' : 'shadow-sm'
  const flashClasses = isFlashing ? 'animate-pulse ring-4 ring-indigo-300/60' : ''
  // Merge persistent highlight and transient flash styles for "jump to issue" navigation.
  const articleEmphasis = `${highlightClasses} ${flashClasses}`.trim()
  const isShowcaseLeft = showcaseMode && showcaseSide === 'left'
  const isShowcaseRight = showcaseMode && showcaseSide === 'right'
  const rootClasses = showcaseMode
    ? `relative w-full pl-9 md:w-[calc(50%-1.25rem)] md:pl-0 ${isShowcaseLeft ? 'md:mr-auto md:pr-7' : ''} ${isShowcaseRight ? 'md:ml-auto md:pl-7' : ''}`.trim()
    : 'relative pl-9'
  const dotClasses = showcaseMode
    ? `${isShowcaseLeft ? 'absolute left-0 top-2 h-3.5 w-3.5 rounded-full border-2 shadow-[0_0_0_2px_rgba(255,255,255,0.92),0_0_0.85rem_rgba(99,102,241,0.45)] md:left-auto md:right-0 md:top-5 md:translate-x-1/2' : ''} ${isShowcaseRight ? 'absolute left-0 top-2 h-3.5 w-3.5 rounded-full border-2 shadow-[0_0_0_2px_rgba(255,255,255,0.92),0_0_0.85rem_rgba(99,102,241,0.45)] md:top-5 md:-translate-x-1/2' : ''} ${severityVariant.dot}`.trim()
    : `absolute left-0 top-2 h-3.5 w-3.5 rounded-full border-2 shadow-[0_0_0_2px_rgba(255,255,255,0.95),0_0_0.65rem_rgba(99,102,241,0.3)] ${severityVariant.dot}`
  const showcaseDateClasses = isShowcaseLeft
    ? 'pointer-events-none absolute left-0 top-0 translate-x-[calc(100%+0.45rem)] text-left md:left-auto md:right-0 md:top-3 md:translate-x-[calc(100%+0.8rem)]'
    : 'pointer-events-none absolute left-0 top-0 translate-x-[calc(100%+0.45rem)] text-left md:top-3 md:-translate-x-[calc(100%+0.8rem)] md:text-right'
  const displayTitle = issueTitle || entry.headline
  const showHeadlineContext = Boolean(issueTitle && issueTitle !== entry.headline)

  return (
    <li id={entryDomId} className={`min-w-0 max-w-full ${rootClasses}`}>
      <span className={dotClasses} aria-hidden="true" />
      {showcaseMode ? (
        <span className={showcaseDateClasses}>
          <span className="inline-flex rounded-full border border-indigo-300/80 bg-white/94 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-[0.12em] text-indigo-900 shadow-[0_0_0.65rem_rgba(99,102,241,0.2)] md:px-3 md:py-1 md:text-[13px]">
            {issueDateLabel}
          </span>
        </span>
      ) : null}
      {showcaseMode && !isLast ? (
        <span className="absolute left-[0.44rem] top-6 block h-full w-[2px] rounded-full bg-linear-to-b from-indigo-500/80 via-indigo-300/95 to-transparent shadow-[0_0_0.45rem_rgba(99,102,241,0.35)] md:hidden" />
      ) : null}
      {!showcaseMode && !isLast ? (
        <span className="absolute left-[0.44rem] top-6 block h-full w-[2px] rounded-full bg-linear-to-b from-indigo-400 via-slate-300/95 to-transparent shadow-[0_0_0.45rem_rgba(99,102,241,0.28)]" />
      ) : null}
      <article
        role="button"
        tabIndex={0}
        onClick={handleHighlight}
        onKeyDown={handleKeyDown}
        className={`flex min-w-0 max-w-full flex-col overflow-hidden rounded-xl border ${severityVariant.panel} transition hover:-translate-y-0.5 ${articleEmphasis}`}
        style={gradientStyle}
      >
        <div className="flex min-w-0 max-w-full">
          <div className="min-w-0 max-w-full flex-1 p-3">
            <div className="flex min-w-0 max-w-full flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
                {stageName ? <TimelineStageTab label={stageName} layout="inline" /> : null}
                <span className={`inline-flex items-center gap-2 rounded-full bg-slate-900/90 px-3 py-1 text-[11px] font-semibold text-white shadow-sm ${showcaseMode ? 'hidden' : ''}`}>
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  {issueDateLabel}
                </span>
              </div>
              {seriesName || number || legacyNumber ? (
                <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
                  {seriesName || number ? (
                    <span
                      className={
                        legacyMatchesIssueNumber
                          ? 'inline-flex min-w-0 max-w-full flex-wrap items-center gap-2 rounded-xl border border-amber-300/80 bg-linear-to-r from-white via-amber-50/80 to-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm shadow-amber-100/70 sm:rounded-full'
                          : 'inline-flex min-w-0 max-w-full flex-wrap items-center gap-2 rounded-xl border border-slate-300/70 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm sm:rounded-full'
                      }
                    >
                      <span className="min-w-0 break-words [overflow-wrap:anywhere]">{seriesName ?? t('timeline.issueFallback')}</span>
                      {number ? (
                        <span
                          className="text-2xl font-black leading-none tracking-tight text-slate-900 drop-shadow-sm"
                          aria-label={t('timeline.issueLabel', { number })}
                        >
                          #{number}
                        </span>
                      ) : null}
                      {legacyMatchesIssueNumber ? (
                        <span className="rounded-full border border-indigo-200 bg-white/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-indigo-700">
                          {t('timeline.legacy')}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  {legacyNumber && !legacyMatchesIssueNumber ? (
                    <span
                      className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm"
                      aria-label={`${t('timeline.legacy')} #${legacyNumber}`}
                    >
                      {t('timeline.legacy')}
                      <span className="text-base font-black text-indigo-900">#{legacyNumber}</span>
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <div className="shrink-0">
                <div
                  className="flex w-28 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:w-32"
                  style={{ aspectRatio: '2 / 3' }}
                >
                  {hasDisplayableCover ? (
                    <button
                      type="button"
                      className="h-full w-full cursor-zoom-in md:cursor-default"
                      onClick={(event) => {
                        event.stopPropagation()
                        onCoverPreview?.(coverImage, entry.metadata?.issueLabel ?? t('common.issueCover'))
                      }}
                      aria-label={t('timeline.openCoverMobile')}
                    >
                      <img
                        src={coverImage}
                        alt={entry.metadata?.issueLabel ?? t('common.issueCover')}
                        className="h-full w-full object-contain"
                        loading="lazy"
                        onError={() => setCoverFailed(true)}
                      />
                    </button>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-slate-50 text-center">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('timeline.noCover')}</span>
                      <span className="text-[10px] text-slate-300">{t('timeline.coverAvailableSoon')}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="min-w-0 max-w-full flex-1 space-y-2">
                <div className="rounded-2xl border border-white/80 bg-white/70 px-3 py-2 shadow-inner shadow-slate-100/80">
                  {showHeadlineContext ? (
                    <p className="mb-1 break-words text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 [overflow-wrap:anywhere]">
                      {entry.headline}
                    </p>
                  ) : null}
                  <h4 className={`break-words text-lg font-black leading-tight [overflow-wrap:anywhere] sm:text-xl ${severityVariant.title}`}>
                    {displayTitle}
                  </h4>
                  {(seriesName || number) && showHeadlineContext ? (
                    <p className="mt-1 break-words text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 [overflow-wrap:anywhere]">
                      {seriesName ? seriesName : t('timeline.issueFallback')}{number ? ` #${number}` : ''}
                    </p>
                  ) : null}
                </div>
                {entry.summary ? <p className="body-sm break-words text-slate-600 [overflow-wrap:anywhere]">{entry.summary}</p> : null}
                {stageSummary ? <p className="body-xs break-words text-indigo-800/80 [overflow-wrap:anywhere]">{stageSummary}</p> : null}
                <div className="grid min-w-0 gap-1 text-slate-600 body-xs sm:grid-cols-2">
                  {seriesName ? (
                    <p className="min-w-0 break-words [overflow-wrap:anywhere]">
                      <span className="font-semibold text-slate-700">{t('timeline.series')}</span> {seriesName}
                    </p>
                  ) : null}
                  {number ? (
                    <p className="min-w-0 break-words [overflow-wrap:anywhere]">
                      <span className="font-semibold text-slate-700">{t('timeline.issue')}</span> {number}
                    </p>
                  ) : null}
                  {volume ? (
                    <p className="min-w-0 break-words [overflow-wrap:anywhere]">
                      <span className="font-semibold text-slate-700">{t('timeline.volume')}</span> {volume}
                    </p>
                  ) : null}
                  {publicationDate ? (
                    <p className="min-w-0 break-words [overflow-wrap:anywhere]">
                      <span className="font-semibold text-slate-700">{t('timeline.publication')}</span> {publicationDate}
                    </p>
                  ) : null}
                  {price ? (
                    <p className="min-w-0 break-words [overflow-wrap:anywhere]">
                      <span className="font-semibold text-slate-700">{t('timeline.price')}</span> {price}
                    </p>
                  ) : null}
                  {pageCount ? (
                    <p className="min-w-0 break-words [overflow-wrap:anywhere]">
                      <span className="font-semibold text-slate-700">{t('timeline.pages')}</span> {pageCount}
                    </p>
                  ) : null}
                  {editing ? (
                    <p className="min-w-0 break-words [overflow-wrap:anywhere]">
                      <span className="font-semibold text-slate-700">{t('timeline.editing')}</span> {editing}
                    </p>
                  ) : null}
                  {rating ? (
                    <p className="min-w-0 break-words [overflow-wrap:anywhere]">
                      <span className="font-semibold text-slate-700">{t('timeline.rating')}</span> {rating}
                    </p>
                  ) : null}
                </div>
                {entry.source_url ? (
                  <a
                    href={entry.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 body-xs font-semibold text-indigo-700 underline"
                  >
                    {t('timeline.viewOnComicsOrg')}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        {showIssueStateActions ? (
          <TimelineIssueToolbar
            issueState={issueState}
            disabled={issueStateDisabled}
            disabledReason={issueStateDisabledReason}
            pending={issueStatePending}
            onToggle={onIssueStateToggle}
            variant="light"
            className="rounded-none border-x-0 border-b-0"
          />
        ) : null}
      </article>
    </li>
  )
}

export default TimelineIssueCardDetailed

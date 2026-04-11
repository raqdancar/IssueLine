import { CalendarDays } from 'lucide-react'
import IssueStateActions from './IssueStateActions'
import TimelineStageTab from './TimelineStageTab'

function TimelineIssueCardDetailed({
  viewModel,
  issueState,
  showIssueStateActions = false,
  issueStateDisabled = false,
  issueStateDisabledReason,
  issueStatePending = false,
  onIssueStateToggle,
  isHighlighted = false,
  isFlashing = false,
  onEntryHighlight,
}) {
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

  const { seriesName, number, volume, publicationDate, price, pageCount, editing, rating, legacyNumber } = meta
  const handleHighlight = () => onEntryHighlight?.(entryDomId)
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleHighlight()
    }
  }
  const highlightClasses = isHighlighted ? 'ring-2 ring-indigo-400/70 shadow-xl shadow-indigo-200/60' : 'shadow-sm'
  const flashClasses = isFlashing ? 'animate-pulse ring-4 ring-indigo-300/60' : ''
  const articleEmphasis = `${highlightClasses} ${flashClasses}`.trim()

  return (
    <li id={entryDomId} className="relative pl-9">
      <span className={`absolute left-0 top-2 h-3 w-3 rounded-full border-2 ${severityVariant.dot}`} aria-hidden="true" />
      {!isLast ? (
        <span className="absolute left-1.5 top-6 block h-full w-px bg-gradient-to-b from-slate-200 to-transparent" />
      ) : null}
      <article
        role="button"
        tabIndex={0}
        onClick={handleHighlight}
        onKeyDown={handleKeyDown}
        className={`flex overflow-hidden rounded-xl border ${severityVariant.panel} transition hover:-translate-y-0.5 ${articleEmphasis}`}
        style={gradientStyle}
      >
        {stageName ? <TimelineStageTab label={stageName} /> : null}
        <div className="flex-1 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/90 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {issueDateLabel}
            </span>
            {seriesName || number || legacyNumber ? (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {seriesName || number ? (
                  <span className="inline-flex items-center gap-3 rounded-full border border-slate-300/70 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm">
                    <span>{seriesName ?? 'Issue'}</span>
                    {number ? (
                      <span
                        className="text-2xl font-black leading-none tracking-tight text-slate-900 drop-shadow-sm"
                        aria-label={`Issue number ${number}`}
                      >
                        #{number}
                      </span>
                    ) : null}
                  </span>
                ) : null}
                {legacyNumber ? (
                  <span
                    className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm"
                    aria-label={`Legacy numbering ${legacyNumber}`}
                  >
                    Legacy
                    <span className="text-base font-black text-indigo-900">#{legacyNumber}</span>
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <div className="shrink-0">
              <div className="flex h-32 w-24 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm sm:h-36 sm:w-28">
                {coverImage ? (
                  <img src={coverImage} alt={entry.metadata?.issueLabel ?? 'Issue cover'} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-slate-50 text-center">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">No cover</span>
                    <span className="text-[10px] text-slate-300">Available soon</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <h4 className={`title-xs ${severityVariant.title}`}>{entry.headline}</h4>
              {entry.summary ? <p className="body-sm text-slate-600">{entry.summary}</p> : null}
              {stageSummary ? <p className="body-xs text-indigo-800/80">{stageSummary}</p> : null}
              <div className="grid gap-1 text-slate-600 body-xs sm:grid-cols-2">
                {seriesName ? (
                  <p>
                    <span className="font-semibold text-slate-700">Series:</span> {seriesName}
                  </p>
                ) : null}
                {number ? (
                  <p>
                    <span className="font-semibold text-slate-700">Issue:</span> {number}
                  </p>
                ) : null}
                {volume ? (
                  <p>
                    <span className="font-semibold text-slate-700">Volume:</span> {volume}
                  </p>
                ) : null}
                {publicationDate ? (
                  <p>
                    <span className="font-semibold text-slate-700">Publication:</span> {publicationDate}
                  </p>
                ) : null}
                {price ? (
                  <p>
                    <span className="font-semibold text-slate-700">Price:</span> {price}
                  </p>
                ) : null}
                {pageCount ? (
                  <p>
                    <span className="font-semibold text-slate-700">Pages:</span> {pageCount}
                  </p>
                ) : null}
                {editing ? (
                  <p>
                    <span className="font-semibold text-slate-700">Editing:</span> {editing}
                  </p>
                ) : null}
                {rating ? (
                  <p>
                    <span className="font-semibold text-slate-700">Rating:</span> {rating}
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
                  View on comics.org
                </a>
              ) : null}
              {showIssueStateActions ? (
                <IssueStateActions
                  issueState={issueState}
                  disabled={issueStateDisabled}
                  disabledReason={issueStateDisabledReason}
                  pending={issueStatePending}
                  onToggle={onIssueStateToggle}
                />
              ) : null}
            </div>
          </div>
        </div>
      </article>
    </li>
  )
}

export default TimelineIssueCardDetailed

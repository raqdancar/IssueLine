// Render the medium-density timeline issue card layout.
import { CalendarDays } from 'lucide-react'
import IssueStateActions from './IssueStateActions'
import { useI18n } from '@/i18n/I18nProvider.jsx'

function TimelineIssueCardCompact({
  viewModel,
  issueState,
  showIssueStateActions = false,
  issueStateDisabled = false,
  issueStateDisabledReason,
  issueStatePending = false,
  onIssueStateToggle,
  onIssueSelect,
  isHighlighted = false,
  isFlashing = false,
  onEntryHighlight,
}) {
  const { t } = useI18n()
  const { entry, entryDomId, isLast, severityVariant, gradientStyle, issueDateLabel, stageName, meta } = viewModel
  const { seriesName, number, publicationDate, legacyNumber, legacyMatchesIssueNumber } = meta
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
  const highlightClasses = isHighlighted ? 'ring-2 ring-indigo-400/70 shadow-lg shadow-indigo-200/50' : 'shadow-sm'
  const flashClasses = isFlashing ? 'animate-pulse ring-4 ring-indigo-300/50' : ''
  // Reuse the same highlight contract used by other density variants.
  const articleEmphasis = `${highlightClasses} ${flashClasses}`.trim()
  const stageLabelClasses =
    'mb-2 text-center text-[10px] font-black uppercase tracking-[0.35em] text-indigo-600'

  return (
    <li id={entryDomId} className="relative pl-7">
      <span
        className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 shadow-[0_0_0_2px_rgba(255,255,255,0.95),0_0_0.65rem_rgba(99,102,241,0.28)] ${severityVariant.dot}`}
        aria-hidden="true"
      />
      {!isLast ? (
        <span className="absolute left-[0.44rem] top-5 block h-full w-[2px] rounded-full bg-gradient-to-b from-indigo-400 via-slate-300/95 to-transparent shadow-[0_0_0.4rem_rgba(99,102,241,0.24)]" />
      ) : null}
      <article
        role="button"
        tabIndex={0}
        onClick={handleHighlight}
        onKeyDown={handleKeyDown}
        className={`rounded-xl border ${severityVariant.panel} p-2.5 transition hover:-translate-y-0.5 ${articleEmphasis}`}
        style={gradientStyle}
      >
        {stageName ? (
          <div className={stageLabelClasses}>
            {stageName}
          </div>
        ) : null}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/90 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {issueDateLabel}
            </span>
            {seriesName || number || legacyNumber ? (
              <div className="flex flex-wrap items-center gap-2">
                {seriesName || number ? (
                  <span
                    className={
                      legacyMatchesIssueNumber
                        ? 'inline-flex items-center gap-2 rounded-full border border-amber-300/80 bg-linear-to-r from-white via-amber-50/80 to-indigo-50 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm shadow-amber-100/70'
                        : 'inline-flex items-center gap-2 rounded-full border border-slate-300/70 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm'
                    }
                  >
                    <span>{seriesName ?? t('timeline.issueFallback')}</span>
                    {number ? <span className="text-slate-500">#{number}</span> : null}
                    {legacyMatchesIssueNumber ? (
                      <span className="rounded-full border border-indigo-200 bg-white/80 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-indigo-700">
                        {t('timeline.legacy')}
                      </span>
                    ) : null}
                  </span>
                ) : null}
                {legacyNumber && !legacyMatchesIssueNumber ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-700 shadow-sm">
                    {t('timeline.legacy')} <span className="text-sm font-black text-indigo-900">#{legacyNumber}</span>
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <h4 className="text-sm font-semibold leading-snug text-slate-700">{entry.headline}</h4>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-slate-500">
              {seriesName ? <span className="text-slate-600">{seriesName}</span> : null}
              {number ? <span className="text-slate-500">#{number}</span> : null}
              {publicationDate ? <span>{publicationDate}</span> : null}
            </div>
          </div>
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
      </article>
    </li>
  )
}

export default TimelineIssueCardCompact




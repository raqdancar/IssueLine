import { CalendarDays } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider.jsx'

function TimelineIssueCardMicro({
  viewModel,
  issueState,
  isHighlighted = false,
  isFlashing = false,
  onEntryHighlight,
  onIssueSelect,
}) {
  const { t } = useI18n()
  const { entry, entryDomId, isLast, severityVariant, issueDateLabel, meta, stageName } = viewModel
  const { seriesName, number, publicationDate, legacyNumber } = meta
  const haveIt = Boolean(issueState?.haveIt)
  const readIt = Boolean(issueState?.readIt)
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
  const highlightClasses = isHighlighted ? 'ring-2 ring-indigo-400/60 shadow-lg shadow-indigo-200/40' : 'shadow-sm'
  const flashClasses = isFlashing ? 'animate-pulse ring-4 ring-indigo-300/60' : ''
  const borderGlow = `${highlightClasses} ${flashClasses}`.trim()
  const stageLabelClasses =
    'text-center text-[9px] font-semibold uppercase tracking-[0.35em] text-indigo-500'

  return (
    <li id={entryDomId} className="relative pl-6">
      <span className={`absolute left-0 top-1 h-2.5 w-2.5 rounded-full border ${severityVariant.dot}`} aria-hidden="true" />
      {!isLast ? (
        <span className="absolute left-[0.4rem] top-4 block h-full w-px bg-gradient-to-b from-slate-200 to-transparent" />
      ) : null}
      <article
        role="button"
        tabIndex={0}
        onClick={handleHighlight}
        onKeyDown={handleKeyDown}
        className={`rounded-lg border border-slate-200 bg-white p-2.5 ${borderGlow}`}
      >
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3 text-slate-500" aria-hidden="true" />
              {issueDateLabel}
            </span>
            {number || legacyNumber ? (
              <span className="inline-flex items-center gap-2 text-slate-500">
                {number ? <span>#{number}</span> : null}
                {legacyNumber ? <span className="text-indigo-600">{t('timeline.legacy')} #{legacyNumber}</span> : null}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-semibold leading-snug text-slate-800">{entry.headline}</p>
          {entry.summary ? <p className="mt-1 text-[11px] text-slate-500">{entry.summary}</p> : null}
          <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
            {seriesName ? <span>{seriesName}</span> : null}
            {publicationDate ? <span>{publicationDate}</span> : null}
          </div>
          {(haveIt || readIt) && (
            <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold">
              {haveIt ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">{t('timeline.have')}</span> : null}
              {readIt ? <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">{t('timeline.read')}</span> : null}
            </div>
          )}
          {stageName ? (
            <div className={stageLabelClasses}>
              {stageName}
            </div>
          ) : null}
        </div>
      </article>
    </li>
  )
}

export default TimelineIssueCardMicro




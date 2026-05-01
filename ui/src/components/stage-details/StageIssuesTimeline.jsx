// Render the horizontal timeline of issues shown inside the stage modal.
import { Timeline } from 'primereact/timeline'
import { useI18n } from '@/i18n/I18nProvider.jsx'

const formatTimelineDate = (value, locale, t) => {
  if (!value) return t('timeline.dateTba')
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(locale, { month: 'short', year: 'numeric' })
}

const resolveIssueNumberLabel = (issue, t) => {
  if (issue?.issueNumber !== null && issue?.issueNumber !== undefined && issue?.issueNumber !== '') {
    return `#${issue.issueNumber}`
  }
  return issue?.issueLabel ?? t('timeline.issueFallback')
}

// Horizontal stage timeline used inside the stage-detail modal.
function StageIssuesTimeline({ issues = [], onIssueSelect }) {
  const { t, locale } = useI18n()

  if (!issues.length) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        {t('timeline.noIssuesLogged')}
      </p>
    )
  }

  const opposite = (issue) => (
    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
      {formatTimelineDate(issue.publishedAt, locale, t)}
    </span>
  )

  // Issue card renderer for each timeline event.
  const content = (issue) => {
    const label = resolveIssueNumberLabel(issue, t)
    return (
      <div className="mt-2 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => onIssueSelect?.(issue)}
          className="group rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          aria-label={`${t('timeline.viewIssue')}: ${issue.issueLabel ?? label}`}
        >
          <div className="h-28 w-20 overflow-hidden rounded-lg bg-slate-100 sm:h-32 sm:w-24">
            {issue.coverImage ? (
              <img src={issue.coverImage} alt={issue.issueLabel ?? label} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-2 text-center">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('timeline.noCover')}</span>
              </div>
            )}
          </div>
        </button>
        <span className="text-xs font-semibold text-slate-700">{label}</span>
      </div>
    )
  }

  return (
    <div className="stage-issues-timeline-wrap">
      <Timeline value={issues} layout="horizontal" align="top" opposite={opposite} content={content} className="stage-issues-timeline" />
    </div>
  )
}

export default StageIssuesTimeline

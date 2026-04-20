import { useMemo } from 'react'
import { normalizeIntegerText } from '@/utils/numberFormatters'
import { useI18n } from '@/i18n/I18nProvider.jsx'

const formatDate = (value, locale) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
}

function IssueMetadataPanel({ issue }) {
  const { t, locale } = useI18n()

  const metadataItems = useMemo(() => {
    if (!issue) return []

    const values = [
      ['issueDetails.fields.issueTitle', issue.issue?.title],
      ['issueDetails.fields.issueNumber', issue.issue?.number],
      ['issueDetails.fields.legacyNumber', issue.issue?.legacyNumber],
      ['issueDetails.fields.seriesTitle', issue.series?.title],
      ['issueDetails.fields.volume', issue.series?.volume],
      ['issueDetails.fields.issueDate', formatDate(issue.issueDate, locale)],
      ['issueDetails.fields.publicationDate', issue.dates?.publicationDate],
      ['issueDetails.fields.coverDate', issue.dates?.coverDate],
      ['issueDetails.fields.onSaleDate', formatDate(issue.dates?.onSaleDate, locale)],
      ['issueDetails.fields.price', issue.pricing?.price],
      ['issueDetails.fields.pageCount', normalizeIntegerText(issue.pricing?.pageCount)],
      ['issueDetails.fields.stage', issue.stage?.name],
      ['issueDetails.fields.stageSummary', issue.stage?.summary],
      ['issueDetails.fields.editing', issue.credits?.editing],
      ['issueDetails.fields.rating', issue.credits?.rating],
      ['issueDetails.fields.gcdIssueId', issue.gcd?.issueId],
      ['issueDetails.fields.timelineIssueId', issue.id],
      ['issueDetails.fields.severity', issue.severity],
    ]

    return values.filter(([, value]) => value !== null && value !== undefined && value !== '')
  }, [issue, locale])

  return (
    <section className="space-y-3">
      {issue?.summary ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="body-xs font-semibold uppercase tracking-wide text-slate-500">{t('issueDetails.summaryLabel')}</p>
          <p className="body-sm mt-1 text-slate-700">{issue.summary}</p>
        </div>
      ) : null}

      {metadataItems.length ? (
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {metadataItems.map(([labelKey, value]) => (
            <div key={`${labelKey}-${value}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <dt className="body-xs font-semibold text-slate-500">{t(labelKey)}</dt>
              <dd className="body-sm mt-1 text-slate-800 break-words">{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="body-sm text-slate-500">{t('issueDetails.noMetadata')}</p>
      )}

      {issue?.sourceUrl ? (
        <a
          href={issue.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex body-sm font-semibold text-indigo-700 underline"
        >
          {t('issueDetails.openSource')}
        </a>
      ) : null}
    </section>
  )
}

export default IssueMetadataPanel

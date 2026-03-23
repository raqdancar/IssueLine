import { CalendarDays } from 'lucide-react'
import { resolveIssueCoverImage } from '@/lib/issueImages'
import { getEntryDomId } from '../utils/timeline'

const formatDate = (value) => {
  try {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return value
  }
}

function TimelineIssueCard({ entry, index, totalEntries, severityLookup, fallbackImage }) {
  const variant = severityLookup[entry.severity] ?? severityLookup.info
  const isLast = index === totalEntries - 1
  const issueLabel = entry.metadata?.issueLabel ?? entry.issue_code ?? 'Issue'
  const meta = entry.metadata ?? {}
  const coverImage = resolveIssueCoverImage(meta, fallbackImage)
  const seriesName = meta.series_name ?? meta.seriesName
  const number = meta.number
  const volume = meta.volume
  const publicationDate = meta.publication_date ?? meta.publicationDate
  const price = meta.price
  const pageCount = meta.page_count ?? meta.pageCount
  const editing = meta.editing
  const rating = meta.rating
  const stageName = meta.stage_name ?? meta.stageName ?? meta.stage?.name ?? meta.stage?.label ?? null
  const stageSummary =
    meta.stage_summary ?? meta.stageSummary ?? meta.stage?.short_summary ?? meta.stage?.summary ?? null
  const entryDomId = getEntryDomId(entry, index)

  return (
    <li key={entry.id ?? `${issueLabel}-${index}`} id={entryDomId} className="relative pl-9">
      <span className={`absolute left-0 top-2 h-3 w-3 rounded-full border-2 ${variant.dot}`} aria-hidden="true" />
      {!isLast && (
        <span className="absolute left-1.5 top-6 block h-full w-px bg-gradient-to-b from-slate-200 to-transparent" />
      )}
      <article className={`rounded-xl border ${variant.panel} p-3 shadow-sm transition hover:-translate-y-0.5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/90 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {formatDate(entry.issue_date)}
          </span>
          {seriesName || number ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-300/70 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
              <span>{seriesName ?? 'Issue'}</span>
              {number ? <span className="text-slate-500">#{number}</span> : null}
            </span>
          ) : null}
        </div>
        {stageName ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-indigo-600">
            <span className="h-px flex-1 bg-indigo-100" aria-hidden="true" />
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[10px] tracking-[0.2em] text-indigo-700">
              Stage
              <span className="tracking-normal text-indigo-900">{stageName}</span>
            </span>
            <span className="h-px flex-1 bg-indigo-100" aria-hidden="true" />
          </div>
        ) : null}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <div className="shrink-0">
            <div className="flex h-32 w-24 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm sm:h-36 sm:w-28">
              {coverImage ? (
                <img
                  src={coverImage}
                  alt={meta.issueLabel ?? 'Issue cover'}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-slate-50 text-center">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">No cover</span>
                  <span className="text-[10px] text-slate-300">Available soon</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <h4 className={`title-xs ${variant.title}`}>{entry.headline}</h4>
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
          </div>
        </div>
      </article>
    </li>
  )
}

export default TimelineIssueCard

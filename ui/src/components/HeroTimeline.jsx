import { useEffect, useMemo, useState } from 'react'
import { resolveIssueCoverImage } from '@/lib/issueImages'

const severityVariants = {
  info: {
    dot: 'border-slate-300 bg-white',
    panel: 'border-slate-200 bg-white',
    title: 'text-slate-900',
  },
  success: {
    dot: 'border-emerald-300 bg-emerald-50',
    panel: 'border-emerald-100 bg-emerald-50/60',
    title: 'text-emerald-900',
  },
  warning: {
    dot: 'border-amber-400 bg-amber-50',
    panel: 'border-amber-200 bg-amber-50/60',
    title: 'text-amber-900',
  },
  critical: {
    dot: 'border-rose-400 bg-rose-50',
    panel: 'border-rose-200 bg-rose-50/60',
    title: 'text-rose-900',
  },
}

const formatDate = (value) => {
  try {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return value
  }
}

const normalizeBaseUrl = (value) => value?.replace(/\/+$/, '')

function HeroTimeline({ slug, heroName, fallbackImage }) {
  const backendBaseUrl = normalizeBaseUrl(import.meta.env.VITE_BACKEND_URL)
  const [{ status, entries, error }, setState] = useState({
    status: backendBaseUrl ? 'idle' : 'disabled',
    entries: [],
    error: null,
  })

  useEffect(() => {
    if (!backendBaseUrl || !slug) return undefined

    const controller = new AbortController()
    setState((previous) => ({ ...previous, status: 'loading', error: null }))

    const loadTimeline = async () => {
      try {
        const response = await fetch(`${backendBaseUrl}/hero-timelines/${encodeURIComponent(slug)}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? `Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        setState({ status: 'success', entries: payload.entries ?? [], error: null })
      } catch (fetchError) {
        if (controller.signal.aborted) return
        setState({
          status: 'error',
          entries: [],
          error: fetchError.message || 'Unable to load timeline data.',
        })
      }
    }

    void loadTimeline()

    return () => controller.abort()
  }, [backendBaseUrl, slug])

  const severityLookup = useMemo(() => severityVariants, [])
  const orderedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const aDate = new Date(a.issue_date ?? 0).getTime()
      const bDate = new Date(b.issue_date ?? 0).getTime()
      return aDate - bDate
    })
  }, [entries])

  if (!slug) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 body-xs text-slate-500">
        Missing hero slug. Timeline data cannot be requested yet.
      </div>
    )
  }

  if (!backendBaseUrl) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 body-xs text-amber-800">
        Set <code>VITE_BACKEND_URL</code> in your environment to enable hero timelines.
      </div>
    )
  }

  return (
    <section className="mt-4 rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="title-xs">{heroName} timeline</p>
          <p className="body-xs text-slate-500">Events sync from the IssueLine backend.</p>
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {status === 'loading' ? (
          <p className="body-sm text-slate-500">Loading timeline...</p>
        ) : status === 'error' ? (
          <p className="body-sm text-rose-600">{error}</p>
        ) : orderedEntries.length === 0 ? (
          <p className="body-sm text-slate-500">No issues have been logged for this hero yet.</p>
        ) : (
          <ol className="space-y-4">
            {orderedEntries.map((entry, index) => {
              const variant = severityLookup[entry.severity] ?? severityLookup.info
              const isLast = index === orderedEntries.length - 1
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
              return (
                <li key={entry.id ?? `${issueLabel}-${index}`} className="relative pl-9">
                  <span
                    className={`absolute left-0 top-2 h-3 w-3 rounded-full border-2 ${variant.dot}`}
                    aria-hidden="true"
                  />
                  {!isLast && (
                    <span className="absolute left-1.5 top-6 block h-full w-px bg-gradient-to-b from-slate-200 to-transparent" />
                  )}
                  <article
                    className={`rounded-xl border ${variant.panel} p-3 shadow-sm transition hover:-translate-y-0.5`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 body-xs text-slate-500">
                      <span>{formatDate(entry.issue_date)}</span>
                      {issueLabel ? <span className="title-xs text-slate-700">{issueLabel}</span> : null}
                    </div>
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
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                No cover
                              </span>
                              <span className="text-[10px] text-slate-300">Available soon</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 space-y-2">
                        <h4 className={`title-xs ${variant.title}`}>{entry.headline}</h4>
                        {entry.summary ? <p className="body-sm text-slate-600">{entry.summary}</p> : null}
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
            })}
          </ol>
        )}
      </div>
    </section>
  )
}

export default HeroTimeline

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Eye, EyeOff } from 'lucide-react'
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
const timelineSortOptions = [
  { label: 'Newest first', value: 'desc' },
  { label: 'Oldest first', value: 'asc' },
]

const formatDate = (value) => {
  try {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return value
  }
}

const normalizeBaseUrl = (value) => value?.replace(/\/+$/, '')
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })

const resolveMonthBucket = (entry) => {
  const metadata = entry.metadata ?? {}
  const rawDate =
    entry.issue_date ||
    metadata.issueDate ||
    metadata.issue_date ||
    metadata.keyDate ||
    metadata.key_date ||
    metadata.publication_date ||
    metadata.publicationDate

  if (rawDate) {
    const parsed = new Date(rawDate)
    if (!Number.isNaN(parsed.getTime())) {
      const key = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}`
      return { key, label: monthFormatter.format(parsed) }
    }
  }

  return { key: 'unknown', label: 'Unknown date' }
}

const getEntryDomId = (entry, index) => {
  if (entry?.id) {
    return `timeline-entry-${entry.id}`
  }
  return `timeline-entry-${index}`
}

function HeroTimeline({ slug, heroName, fallbackImage }) {
  const backendBaseUrl = normalizeBaseUrl(import.meta.env.VITE_BACKEND_URL)
  const [sortDirection, setSortDirection] = useState('desc')
  const [activeAnchor, setActiveAnchor] = useState(null)
  const [isNavigatorVisible, setIsNavigatorVisible] = useState(true)
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
    const direction = sortDirection === 'asc' ? 1 : -1
    return [...entries].sort((a, b) => {
      const aDate = new Date(a.issue_date ?? 0).getTime()
      const bDate = new Date(b.issue_date ?? 0).getTime()
      const safeADate = Number.isNaN(aDate) ? 0 : aDate
      const safeBDate = Number.isNaN(bDate) ? 0 : bDate
      if (safeADate === safeBDate) return 0
      return direction * (safeADate - safeBDate)
    })
  }, [entries, sortDirection])

  const monthAnchors = useMemo(() => {
    const orderedKeys = []
    const groups = new Map()

    orderedEntries.forEach((entry, index) => {
      const bucket = resolveMonthBucket(entry)
      if (!groups.has(bucket.key)) {
        orderedKeys.push(bucket.key)
        groups.set(bucket.key, {
          ...bucket,
          count: 0,
          targetId: getEntryDomId(entry, index),
        })
      }
      const group = groups.get(bucket.key)
      group.count += 1
    })

    return orderedKeys.map((key) => groups.get(key))
  }, [orderedEntries])

  useEffect(() => {
    if (!monthAnchors.length) {
      setActiveAnchor(null)
      return
    }
    setActiveAnchor((current) => {
      if (current && monthAnchors.some((anchor) => anchor.key === current)) {
        return current
      }
      return monthAnchors[0].key
    })
  }, [monthAnchors])

  const handleAnchorClick = (anchor) => {
    setActiveAnchor(anchor.key)
    if (typeof document === 'undefined') return
    const target = document.getElementById(anchor.targetId)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const canShowMonthNavigator = monthAnchors.length > 1

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="title-xs">{heroName} timeline</p>
          <p className="body-xs text-slate-500">Events sync from the IssueLine backend.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="body-xs text-slate-500">Sort by date:</span>
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5">
            {timelineSortOptions.map((option) => {
              const isActive = sortDirection === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setSortDirection(option.value)}
                  className={`rounded-full px-3 py-1 body-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}

          </div>
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
          <div className="flex flex-col gap-4 lg:flex-row">
            {canShowMonthNavigator && isNavigatorVisible ? (
              <aside className="rounded-2xl border border-slate-100 bg-white/80 p-3 shadow-sm backdrop-blur lg:sticky lg:top-6 lg:max-h-[80vh] lg:w-60">
                <div className="flex items-center justify-between gap-2">
                  <p className="body-xs font-semibold uppercase tracking-wide text-slate-500">Jump to</p>
                  <button
                    type="button"
                    onClick={() => setIsNavigatorVisible((value) => !value)}
                    className="rounded-full border border-slate-200 bg-white p-1 text-slate-500 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    aria-label={isNavigatorVisible ? 'Hide timeline index' : 'Show timeline index'}
                  >
                    {isNavigatorVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 lg:flex-col">
                  {monthAnchors.map((anchor) => {
                    const isActive = activeAnchor === anchor.key
                    return (
                      <button
                        key={anchor.key}
                        type="button"
                        aria-current={isActive ? 'true' : undefined}
                        onClick={() => handleAnchorClick(anchor)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                          isActive
                            ? 'border-slate-900 bg-slate-900 text-white shadow'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-900/40 hover:text-slate-900'
                        }`}
                      >
                        <span>{anchor.label}</span>
                        <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400">{anchor.count}</span>
                      </button>
                    )
                  })}
                </div>
              </aside>
            ) : null}
            <div className="flex-1">
              {canShowMonthNavigator && !isNavigatorVisible ? (
                <div className="mb-3 flex justify-start">
                  <button
                    type="button"
                    onClick={() => setIsNavigatorVisible(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    <Eye className="h-4 w-4" />
                    Show timeline index
                  </button>
                </div>
              ) : null}
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
                  const entryDomId = getEntryDomId(entry, index)
                  return (
                    <li
                      key={entry.id ?? `${issueLabel}-${index}`}
                      id={entryDomId}
                      className="relative pl-9"
                    >
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
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default HeroTimeline






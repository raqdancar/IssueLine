import { useEffect, useMemo, useState } from 'react'
import { resolveIssueCoverImage } from '@/lib/issueImages'
import { normalizeIntegerText } from '@/utils/numberFormatters'
import TimelineStageTab from './timeline/TimelineStageTab'
import CoverFullscreenViewer from './CoverFullscreenViewer'

const normalizeBaseUrl = (value) => value?.replace(/\/+$/, '')

const timelineSortOptions = [
  { label: 'Newest first', value: 'desc' },
  { label: 'Oldest first', value: 'asc' },
]


const formatDate = (value) => {
  if (!value) return 'Date TBA'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const resolveYear = (entry) => {
  if (entry.issue_date) {
    const date = new Date(entry.issue_date)
    if (!Number.isNaN(date.getTime())) {
      return String(date.getUTCFullYear())
    }
  }
  const keyDate = entry.metadata?.keyDate || entry.metadata?.key_date
  if (keyDate) {
    const yearMatch = /(\d{4})/.exec(keyDate)
    if (yearMatch) {
      return yearMatch[1]
    }
  }
  return 'Unknown'
}

const groupEntriesByYear = (entries, direction = 'desc') => {
  const groups = new Map()
  for (const entry of entries) {
    const year = resolveYear(entry)
    if (!groups.has(year)) {
      groups.set(year, [])
    }
    groups.get(year).push(entry)
  }

  const directionValue = direction === 'asc' ? 1 : -1
  const sorter = (a, b) => {
    if (a[0] === 'Unknown') return 1
    if (b[0] === 'Unknown') return -1
    return directionValue * (Number(a[0]) - Number(b[0]))
  }

  const getIssueTime = (entry) => {
    const timestamp = new Date(entry.issue_date ?? 0).getTime()
    return Number.isNaN(timestamp) ? 0 : timestamp
  }

  return Array.from(groups.entries())
    .sort(sorter)
    .map(([year, yearEntries]) => ({
      year,
      entries: [...yearEntries].sort((a, b) => {
        const result = getIssueTime(a) - getIssueTime(b)
        if (result === 0) return 0
        return directionValue * result
      }),
    }))
}

function HeroTimelineCinematic({ slug, heroName, fallbackImage }) {
  const backendBaseUrl = normalizeBaseUrl(import.meta.env.VITE_BACKEND_URL)
  const [sortDirection, setSortDirection] = useState('desc')
  const [coverViewer, setCoverViewer] = useState({ open: false, src: null, alt: '' })
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
        setState({ status: 'error', entries: [], error: fetchError.message || 'Unable to load timeline data.' })
      }
    }

    void loadTimeline()

    return () => controller.abort()
  }, [backendBaseUrl, slug])

  const openCoverViewer = (src, alt) => {
    if (!src || typeof window === 'undefined') return
    if (!window.matchMedia('(max-width: 767px)').matches) return
    setCoverViewer({ open: true, src, alt: alt ?? 'Issue cover' })
  }

  const groupedEntries = useMemo(() => groupEntriesByYear(entries, sortDirection), [entries, sortDirection])

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
    <section className="relative mt-4 overflow-hidden rounded-3xl border border-slate-900/10 bg-slate-900 p-6 text-slate-100 shadow-2xl">
      <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden>
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-indigo-500 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.35),_transparent_55%)]" />
      </div>
      <div className="relative flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Cinematic timeline</p>
          <h3 className="title-sm text-white">{heroName}</h3>
          <p className="body-xs text-slate-400">Grouped by publication year</p>
        </div>
        <div className="flex flex-col items-end gap-3 text-xs text-slate-300 sm:flex-row sm:items-center">
          <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
            {status}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Sort</span>
            <div className="inline-flex rounded-full border border-white/20 bg-white/5 p-0.5">
              {timelineSortOptions.map((option) => {
                const isActive = sortDirection === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setSortDirection(option.value)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                      isActive ? 'bg-white text-slate-900 shadow' : 'text-slate-200 hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="relative mt-6 space-y-6">
        {status === 'loading' ? (
          <p className="body-sm text-slate-300">Loading timeline...</p>
        ) : status === 'error' ? (
          <p className="body-sm text-rose-300">{error}</p>
        ) : groupedEntries.length === 0 ? (
          <p className="body-sm text-slate-300">No issues have been logged for this hero yet.</p>
        ) : (
          groupedEntries.map(({ year, entries: yearEntries }) => (
            <div key={year} className="space-y-4">
              <div className="flex items-center gap-3 text-slate-300">
                <div className="h-px flex-1 bg-slate-700/60" />
                <span className="text-sm font-semibold tracking-widest text-slate-200">{year}</span>
                <div className="h-px flex-1 bg-slate-700/60" />
              </div>
              <div className="space-y-4">
                {yearEntries.map((entry) => {
                  const meta = entry.metadata ?? {}
                  const issueLabel = meta.issueLabel ?? entry.issue_code ?? entry.headline
                  const coverImage = resolveIssueCoverImage(meta, fallbackImage)
                  const stageName =
                    meta.stage_name ?? meta.stageName ?? meta.stage?.name ?? meta.stage?.label ?? null
                  const stageSummary =
                    meta.stage_summary ?? meta.stageSummary ?? meta.stage?.short_summary ?? meta.stage?.summary ?? null
                  const pageCount = normalizeIntegerText(meta.page_count ?? meta.pageCount ?? null)
                  return (
                    <article
                      key={entry.id ?? `${issueLabel}-${entry.issue_date}`}
                      className="group relative flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/30 backdrop-blur transition duration-300 hover:border-white/30 hover:bg-white/10 md:flex-row"
                    >
                      {stageName ? <TimelineStageTab label={stageName} variant="dark" /> : null}
                      <div className="flex flex-1 flex-col gap-4 md:flex-row">
                        <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900/40 md:w-40">
                        <div className="aspect-[2/3] w-full">
                          {coverImage ? (
                            <button
                              type="button"
                              className="h-full w-full cursor-zoom-in"
                              onClick={() => openCoverViewer(coverImage, issueLabel ?? 'Issue cover')}
                              aria-label="Open cover in fullscreen on mobile"
                            >
                              <img
                                src={coverImage}
                                alt={issueLabel ?? 'Issue cover'}
                                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                loading="lazy"
                              />
                            </button>
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-slate-800/70 to-slate-900 text-center text-slate-400">
                              <span className="text-[12px] font-semibold uppercase tracking-[0.2em]">
                                Cover TBD
                              </span>
                              <span className="text-[11px] text-slate-500">Add one in Supabase</span>
                            </div>
                          )}
                        </div>
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent" />
                        <p className="absolute bottom-2 left-2 text-xs font-semibold text-slate-100">{issueLabel}</p>
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-indigo-200">
                          <span className="rounded-full border border-indigo-400/40 px-2 py-0.5">
                            {meta.series_name ?? meta.seriesName ?? 'Strange Tales'}
                          </span>
                          {meta.number ? <span>No. {meta.number}</span> : null}
                          {meta.volume ? <span>Vol. {meta.volume}</span> : null}
                        </div>
                        <h4 className="title-sm text-white">{entry.headline}</h4>
                        {entry.summary ? <p className="body-sm text-slate-200/80">{entry.summary}</p> : null}
                        {stageSummary ? (
                          <p className="text-xs text-emerald-100/80">{stageSummary}</p>
                        ) : null}
                        <dl className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                          <div>
                            <dt className="font-semibold text-slate-100">Release</dt>
                            <dd>{formatDate(entry.issue_date)}</dd>
                          </div>
                          {meta.price ? (
                            <div>
                              <dt className="font-semibold text-slate-100">Price</dt>
                              <dd>{meta.price}</dd>
                            </div>
                          ) : null}
                          {pageCount ? (
                            <div>
                              <dt className="font-semibold text-slate-100">Pages</dt>
                              <dd>{pageCount}</dd>
                            </div>
                          ) : null}
                          {meta.rating ? (
                            <div>
                              <dt className="font-semibold text-slate-100">Rating</dt>
                              <dd>{meta.rating}</dd>
                            </div>
                          ) : null}
                        </dl>
                        {entry.source_url ? (
                          <a
                            href={entry.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-200 hover:text-white"
                          >
                            View issue
                          </a>
                        ) : null}
                      </div>
                    </div>
                    </article>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
      <CoverFullscreenViewer
        open={coverViewer.open}
        src={coverViewer.src}
        alt={coverViewer.alt}
        onClose={() => setCoverViewer({ open: false, src: null, alt: '' })}
      />
    </section>
  )
}

export default HeroTimelineCinematic





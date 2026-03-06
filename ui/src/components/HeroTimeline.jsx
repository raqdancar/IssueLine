import { useEffect, useMemo, useState } from 'react'

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

function HeroTimeline({ slug, heroName }) {
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

  if (!slug) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        Missing hero slug. Timeline data cannot be requested yet.
      </div>
    )
  }

  if (!backendBaseUrl) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        Set <code>VITE_BACKEND_URL</code> in your environment to enable hero timelines.
      </div>
    )
  }

  return (
    <section className="mt-4 rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{heroName} timeline</p>
          <p className="text-xs text-slate-500">Events sync from the IssueLine backend.</p>
        </div>
        <span className="text-xs uppercase tracking-wide text-slate-400">{status}</span>
      </div>
      <div className="mt-4 space-y-4">
        {status === 'loading' ? (
          <p className="text-sm text-slate-500">Loading timeline...</p>
        ) : status === 'error' ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-slate-500">No issues have been logged for this hero yet.</p>
        ) : (
          <ol className="space-y-4">
            {entries.map((entry, index) => {
              const variant = severityLookup[entry.severity] ?? severityLookup.info
              const isLast = index === entries.length - 1
              return (
                <li key={entry.id} className="relative pl-9">
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
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>{formatDate(entry.issue_date)}</span>
                      {entry.issue_code ? <span className="font-semibold text-slate-700">{entry.issue_code}</span> : null}
                    </div>
                    <h4 className={`mt-2 text-sm font-semibold ${variant.title}`}>{entry.headline}</h4>
                    {entry.summary ? <p className="mt-1 text-sm text-slate-600">{entry.summary}</p> : null}
                    {entry.source_url ? (
                      <a
                        href={entry.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center text-xs font-semibold text-slate-700 underline"
                      >
                        View source
                      </a>
                    ) : null}
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

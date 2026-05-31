// Construeix peces visuals i derivacions de la cronologia d'issues.
import { CalendarDays, Flag, Sparkles } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider.jsx'

const densityClassMap = {
  detailed: {
    panel: 'p-4',
    title: 'text-base',
    summary: 'body-sm',
    meta: 'body-xs',
  },
  compact: {
    panel: 'p-3.5',
    title: 'text-sm',
    summary: 'text-xs',
    meta: 'text-[11px]',
  },
  micro: {
    panel: 'p-3',
    title: 'text-sm',
    summary: 'text-[11px]',
    meta: 'text-[10px]',
  },
}

function TimelineSpecialEventCard({
  viewModel,
  density = 'detailed',
  showcaseMode = false,
  isHighlighted = false,
  isFlashing = false,
}) {
  const { t } = useI18n()
  const { entry, entryDomId, isLast, issueDateLabel, stageName, stageSummary, specialEventCode, meta } = viewModel
  const { seriesName, number, publicationDate } = meta
  const densityClasses = densityClassMap[density] ?? densityClassMap.detailed
  const title = entry.headline ?? specialEventCode ?? t('timeline.specialEventFallbackTitle')

  const highlightClasses = isHighlighted ? 'ring-2 ring-amber-400/70 shadow-xl shadow-amber-200/60' : 'shadow-sm'
  const flashClasses = isFlashing ? 'animate-pulse ring-4 ring-amber-300/50' : ''
  const articleEmphasis = `${highlightClasses} ${flashClasses}`.trim()
  const rootClasses = showcaseMode
    ? 'relative w-full pl-8 md:mx-auto md:w-[min(76%,54rem)] md:px-8 md:pl-8'
    : 'relative pl-8'
  const dotClasses = showcaseMode
    ? 'absolute left-0 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-amber-300 bg-amber-100 text-amber-700 shadow-[0_0_0_2px_rgba(255,251,235,0.96),0_0_0.8rem_rgba(251,191,36,0.42)] md:left-1/2 md:top-2.5 md:-translate-x-1/2'
    : 'absolute left-0 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-amber-300 bg-amber-100 text-amber-700 shadow-[0_0_0_2px_rgba(255,251,235,0.96),0_0_0.7rem_rgba(251,191,36,0.34)]'

  return (
    <li id={entryDomId} className={`min-w-0 max-w-full ${rootClasses}`}>
      <span className={dotClasses} aria-hidden="true">
        <Sparkles className="h-2.5 w-2.5" />
      </span>
      {showcaseMode ? (
        <span className="pointer-events-none absolute left-0 top-0 translate-x-[calc(100%+0.45rem)] md:left-1/2 md:translate-x-[1.1rem]">
          <span className="inline-flex rounded-full border border-amber-300 bg-amber-50/95 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-[0.12em] text-amber-900 shadow-[0_0_0.7rem_rgba(251,191,36,0.24)] md:px-3 md:py-1 md:text-[13px]">
            {issueDateLabel}
          </span>
        </span>
      ) : null}
      {showcaseMode && !isLast ? (
        <span className="absolute left-[0.45rem] top-6 block h-full w-[2px] rounded-full bg-gradient-to-b from-amber-500/85 via-orange-300/90 to-transparent shadow-[0_0_0.45rem_rgba(251,191,36,0.34)] md:hidden" />
      ) : null}
      {!showcaseMode && !isLast ? (
        <span className="absolute left-[0.45rem] top-6 block h-full w-[2px] rounded-full bg-gradient-to-b from-amber-400 via-orange-300/90 to-transparent shadow-[0_0_0.45rem_rgba(251,191,36,0.3)]" />
      ) : null}
      <article
        className={`min-w-0 max-w-full overflow-hidden rounded-xl border border-amber-300 bg-[linear-gradient(135deg,rgba(255,251,235,1)_0%,rgba(254,243,199,0.86)_46%,rgba(255,237,213,0.92)_100%)] ${densityClasses.panel} ${articleEmphasis}`}
      >
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
              <Flag className="h-3 w-3" aria-hidden="true" />
              {t('timeline.specialEventMarker')}
            </span>
            <span className={`items-center gap-1 rounded-full bg-amber-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100 ${showcaseMode ? 'hidden' : 'inline-flex'}`}>
              <CalendarDays className="h-3 w-3" aria-hidden="true" />
              {issueDateLabel}
            </span>
            {specialEventCode ? (
              <span className="max-w-full break-words rounded-md bg-white/70 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-800 [overflow-wrap:anywhere]">
                {specialEventCode}
              </span>
            ) : null}
          </div>
          <h4 className={`break-words font-black uppercase tracking-[0.08em] text-amber-950 [overflow-wrap:anywhere] ${densityClasses.title}`}>{title}</h4>
          {entry.summary ? <p className={`break-words text-amber-900/80 [overflow-wrap:anywhere] ${densityClasses.summary}`}>{entry.summary}</p> : null}
          {stageSummary ? <p className={`break-words text-amber-900/75 [overflow-wrap:anywhere] ${densityClasses.summary}`}>{stageSummary}</p> : null}
          <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold uppercase tracking-[0.14em] text-amber-700 ${densityClasses.meta}`}>
            {stageName ? <span className="break-words [overflow-wrap:anywhere]">{stageName}</span> : null}
            {seriesName ? <span className="break-words [overflow-wrap:anywhere]">{seriesName}</span> : null}
            {number ? <span>#{number}</span> : null}
            {publicationDate ? <span>{publicationDate}</span> : null}
          </div>
        </div>
      </article>
    </li>
  )
}

export default TimelineSpecialEventCard

import { AlertTriangle, BookOpenCheck, CalendarDays, CheckCircle2, CircleDashed, Eye, LibraryBig, Search } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import SectionHeading from './SectionHeading'
import { timelinePreviewIssues } from './homeData'

const stateIcons = {
  complete: CheckCircle2,
  owned: LibraryBig,
  missing: Search,
  read: Eye,
  tracking: CircleDashed,
}

function DemoCover({ entry }) {
  return (
    <div
      className={`flex aspect-[2/3] w-24 shrink-0 items-stretch justify-center overflow-hidden rounded-xl border border-slate-200 bg-linear-to-br ${entry.coverTone} shadow-sm sm:w-28`}
    >
      {entry.type === 'gap' ? (
        <div className="flex h-full w-full flex-col items-center justify-center bg-slate-50 p-3 text-center">
          <Search className="h-7 w-7 text-red-700" aria-hidden="true" />
          <span className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-red-700">Missing</span>
          <span className="mt-1 text-xs font-black text-slate-800">#{entry.issueNumber}</span>
        </div>
      ) : (
        <div className="flex h-full w-full flex-col justify-between p-3 text-white">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/75">{entry.series}</span>
          <span className="text-3xl font-black leading-none drop-shadow">#{entry.issueNumber}</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">{entry.year}</span>
        </div>
      )}
    </div>
  )
}

function StateChip({ active, icon: Icon, label, tone }) {
  const classes = active
    ? tone
    : 'border-slate-200 bg-slate-50 text-slate-400'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${classes}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  )
}

function TimelinePreviewEntry({ entry, index }) {
  const { t } = useI18n()
  const StateIcon = stateIcons[entry.stateKey] ?? CircleDashed
  const isRight = index % 2 === 1
  const isGap = entry.type === 'gap'

  return (
    <li className={`relative md:flex ${isRight ? 'md:justify-end' : 'md:justify-start'}`}>
      <span
        className={`absolute left-4 top-6 z-1 h-4 w-4 rounded-full border-2 border-white shadow-[0_0_0_6px_rgba(220,38,38,0.12)] md:left-1/2 md:-translate-x-1/2 ${
          isGap ? 'bg-amber-400' : entry.haveIt && entry.readIt ? 'bg-linear-to-b from-emerald-500 to-sky-500' : 'bg-red-600'
        }`}
      />
      <article
        className={`group ml-12 w-[calc(100%-3rem)] overflow-hidden rounded-xl border bg-white text-slate-900 shadow-2xl shadow-slate-950/30 transition duration-300 hover:-translate-y-1 md:ml-0 md:w-[calc(50%-1.75rem)] ${
          isGap ? 'border-amber-300' : 'border-slate-200'
        }`}
      >
        <div className="flex">
          <div
            className={`flex w-9 shrink-0 items-center justify-center px-2 text-center text-[10px] font-black uppercase tracking-[0.16em] [writing-mode:vertical-rl] ${
              isGap ? 'bg-amber-100 text-amber-900' : 'bg-indigo-950 text-indigo-50'
            }`}
          >
            {t(`home.timelinePreview.stageNames.${entry.stageKey}`)}
          </div>
          <div className="min-w-0 flex-1 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {entry.date}
              </span>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${
                  isGap
                    ? 'border-amber-300 bg-amber-50 text-amber-900'
                    : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                {entry.series}
                <span className="text-xl font-black leading-none text-slate-950">#{entry.issueNumber}</span>
                {entry.legacyNumber ? (
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-indigo-700">
                    {t('timeline.legacy')}
                  </span>
                ) : null}
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <DemoCover entry={entry} />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                      isGap ? 'bg-amber-100 text-amber-900' : 'bg-indigo-50 text-indigo-700'
                    }`}
                  >
                    {isGap ? <AlertTriangle className="h-3 w-3" aria-hidden="true" /> : <StateIcon className="h-3 w-3" aria-hidden="true" />}
                    {t(`home.timelinePreview.states.${entry.stateKey}`)}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{entry.year}</span>
                </div>
                <h3 className={`text-sm font-black leading-snug ${isGap ? 'text-amber-950' : 'text-slate-900'}`}>
                  {t(`home.timelinePreview.entries.${entry.titleKey}`)}
                </h3>
                <p className="text-xs leading-5 text-slate-600">{t(`home.timelinePreview.summaries.${entry.summaryKey}`)}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <StateChip
                    active={entry.haveIt}
                    icon={LibraryBig}
                    label={t('timeline.have')}
                    tone="border-emerald-200 bg-emerald-50 text-emerald-700"
                  />
                  <StateChip
                    active={entry.readIt}
                    icon={BookOpenCheck}
                    label={t('timeline.read')}
                    tone="border-sky-200 bg-sky-50 text-sky-700"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                <span>{t('home.timelinePreview.stageCoverage')}</span>
                <span className={isGap ? 'text-amber-700' : 'text-indigo-700'}>{entry.completion}%</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${isGap ? 'bg-amber-400' : 'bg-linear-to-r from-emerald-500 via-sky-500 to-indigo-600'}`}
                  style={{ width: `${entry.completion}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </article>
    </li>
  )
}

function TimelinePreviewSection() {
  const { t } = useI18n()
  const callouts = [
    { label: t('home.timelinePreview.calloutCovers'), className: 'bg-amber-300' },
    { label: t('home.timelinePreview.calloutGaps'), className: 'bg-red-400' },
    { label: t('home.timelinePreview.calloutStages'), className: 'bg-indigo-300' },
    { label: t('home.timelinePreview.calloutProgress'), className: 'bg-emerald-300' },
  ]

  return (
    <section id="timeline-preview" className="relative overflow-hidden bg-slate-950 px-4 py-18 text-white sm:px-6 lg:px-10 lg:py-24 xl:px-16 2xl:px-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_22%,rgba(252,213,129,0.18),transparent_34%),linear-gradient(180deg,rgba(15,23,42,1),rgba(39,47,93,0.84)_46%,rgba(15,23,42,1))]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] [background-size:7rem_7rem] opacity-30" />

      <div className="relative mx-auto grid w-full max-w-400 gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center">
        <div>
          <SectionHeading
            eyebrow={t('home.timelinePreview.eyebrow')}
            title={t('home.timelinePreview.title')}
            description={t('home.timelinePreview.description')}
            className="[&_h2]:text-white [&_p:not(:first-child)]:text-slate-300 [&_p:first-child]:text-amber-200"
          />
          <ul className="mt-8 grid gap-x-8 gap-y-4 border-l border-white/15 pl-5 text-sm text-slate-200 sm:grid-cols-2">
            {callouts.map((item) => (
              <li key={item.label} className="relative flex min-w-0 items-start gap-3 border-b border-white/10 pb-3 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0.35rem_rgba(255,255,255,0.22)] ${item.className}`} aria-hidden="true" />
                <span className="leading-6 text-slate-200">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative rounded-lg border border-white/15 bg-white/10 p-4 shadow-2xl shadow-slate-950/50 backdrop-blur sm:p-6">
          <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200">{t('home.timelinePreview.demoLabel')}</p>
              <p className="mt-1 text-2xl font-black text-white">{t('home.timelinePreview.demoTitle')}</p>
            </div>
            <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-200">
              {t('home.timelinePreview.liveFeeling')}
            </span>
          </div>
          <ol className="relative space-y-7">
            <span className="absolute bottom-4 left-[1.18rem] top-4 w-[2px] rounded-full bg-linear-to-b from-amber-300 via-red-500 to-indigo-500 md:left-1/2 md:-translate-x-1/2" aria-hidden="true" />
            {timelinePreviewIssues.map((entry, index) => (
              <TimelinePreviewEntry key={`${entry.year}-${entry.issueNumber}`} entry={entry} index={index} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

export default TimelinePreviewSection

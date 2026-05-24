import { ArrowRight, CalendarRange, Layers3, LibraryBig } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import SectionHeading from './SectionHeading'
import {
  estimateCompletion,
  estimateStageCount,
  getDisplayHeroes,
  getHeroImage,
  getYearRange,
  heroAccentPalettes,
} from './homeData'

function CharacterVisual({ hero, palette, index }) {
  const image = getHeroImage(hero)

  return (
    <div className={`relative h-48 overflow-hidden bg-linear-to-br ${palette.panel}`}>
      {image ? (
        <img
          src={image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-72 saturate-125 transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 grid grid-cols-4 gap-2 p-4 opacity-90">
          {Array.from({ length: 8 }).map((_, coverIndex) => (
            <span
              key={coverIndex}
              className={`rounded-sm bg-linear-to-br ${palette.cover} shadow-lg shadow-slate-950/30`}
              style={{ transform: `translateY(${(coverIndex % 3) * 10}px)` }}
            />
          ))}
        </div>
      )}
      <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/32 to-transparent" />
      <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white backdrop-blur">
        {hero.publisher ?? 'Editorial'}
      </div>
      <div className="absolute bottom-4 left-4 right-4">
        <span className="text-xs font-bold uppercase tracking-[0.24em] text-white/70">Archive {index + 1}</span>
        <h3 className={`mt-1 text-2xl font-black leading-none ${palette.ink}`}>{hero.name}</h3>
      </div>
    </div>
  )
}

function CharacterShowcase({ heroes, heroesStatus }) {
  const { t } = useI18n()
  const displayHeroes = getDisplayHeroes(heroes)

  return (
    <section id="character-showcase" className="bg-white px-4 py-18 sm:px-6 lg:px-10 lg:py-24 xl:px-16 2xl:px-24">
      <div className="mx-auto w-full max-w-400">
        <div className="max-w-3xl">
          <SectionHeading
            eyebrow={t('home.showcase.eyebrow')}
            title={t('home.showcase.title')}
            description={t('home.showcase.description')}
          />
        </div>

        {heroesStatus?.state === 'error' ? (
          <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {heroesStatus.message}
          </p>
        ) : null}

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {displayHeroes.map((hero, index) => {
            const palette = heroAccentPalettes[index % heroAccentPalettes.length]
            const completion = estimateCompletion(hero, index)
            const issueCount = Number(hero.timelineCoverage?.count ?? 0)
            const detailHref = hero.slug && hero.hasTimelineIssues ? `/heroes/${hero.slug}` : '#timeline-preview'

            return (
              <article
                key={hero.api_id ?? hero.name}
                className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-300/70"
              >
                <CharacterVisual hero={hero} palette={palette} index={index} />
                <div className="space-y-5 p-5">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{t('home.showcase.years')}</p>
                      <p className="mt-1 font-bold text-slate-900">{getYearRange(hero)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{t('home.showcase.issues')}</p>
                      <p className="mt-1 font-bold text-slate-900">{issueCount || 24}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{t('home.showcase.stages')}</p>
                      <p className="mt-1 font-bold text-slate-900">{estimateStageCount(hero, index)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{t('home.showcase.collected')}</p>
                      <p className="mt-1 font-bold text-slate-900">{hero.collectedEditionsCount ?? index + 4}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      <span>{t('home.showcase.completion')}</span>
                      <span>{completion}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-linear-to-r from-red-600 via-amber-400 to-indigo-700" style={{ width: `${completion}%` }} />
                    </div>
                  </div>

                  <Button asChild variant="outline" className="w-full justify-between border-slate-300 bg-white">
                    <Link to={detailHref}>
                      <span className="inline-flex items-center gap-2">
                        <LibraryBig className="h-4 w-4" aria-hidden="true" />
                        {t('home.showcase.cta')}
                      </span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </article>
            )
          })}
        </div>

        <div className="mt-8 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
          <p className="inline-flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-red-700" aria-hidden="true" />
            {t('home.showcase.noteTimeline')}
          </p>
          <p className="inline-flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-red-700" aria-hidden="true" />
            {t('home.showcase.noteStages')}
          </p>
          <p className="inline-flex items-center gap-2">
            <LibraryBig className="h-4 w-4 text-red-700" aria-hidden="true" />
            {t('home.showcase.noteEditions')}
          </p>
        </div>
      </div>
    </section>
  )
}

export default CharacterShowcase

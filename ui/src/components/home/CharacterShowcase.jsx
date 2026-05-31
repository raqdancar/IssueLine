// Renderitza una seccio visual de la pagina inicial d'IssueLine.
import { ArrowRight, CalendarRange, Layers3, LibraryBig } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import { useSessionContext } from '@/lib/sessionContext.jsx'
import SectionHeading from './SectionHeading'
import {
  estimateStageCount,
  getDisplayHeroes,
  getHeroImage,
  getYearRange,
  heroAccentPalettes,
} from './homeData'

function CharacterVisual({ hero, palette, href }) {
  const image = getHeroImage(hero)

  return (
    <Link
      to={href}
      className={`relative block h-48 overflow-hidden bg-linear-to-br ${palette.panel} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2`}
    >
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
        <h3 className={`text-2xl font-black leading-none ${palette.ink}`}>{hero.name}</h3>
      </div>
    </Link>
  )
}

function CharacterShowcase({ heroes, heroesStatus }) {
  const { t } = useI18n()
  const { isAuthenticated } = useSessionContext()
  const displayHeroes = getDisplayHeroes(heroes)

  return (
    <section
      id="character-showcase"
      tabIndex={-1}
      className="scroll-mt-4 bg-white px-4 py-18 outline-none transition focus:ring-4 focus:ring-inset focus:ring-red-500/70 sm:px-6 lg:px-10 lg:py-24 xl:px-16 2xl:px-24"
    >
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
            const issueCount = Number(hero.timelineCoverage?.count ?? 0)
            const detailHref = hero.slug && hero.hasTimelineIssues ? `/heroes/${hero.slug}` : '#timeline-preview'

            return (
              <article
                key={hero.api_id ?? hero.name}
                className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-300/70"
              >
                <CharacterVisual hero={hero} palette={palette} href={detailHref} />
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
                    {isAuthenticated ? (
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{t('home.showcase.collected')}</p>
                        <p className="mt-1 font-bold text-slate-900">{hero.collectedEditionsCount ?? index + 4}</p>
                      </div>
                    ) : null}
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

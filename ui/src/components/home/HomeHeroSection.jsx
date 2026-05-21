import { ArrowDown, ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import { getDisplayHeroes, getHeroImage, heroAccentPalettes } from './homeData'

function CoverRail({ heroes, reverse = false }) {
  const railHeroes = [...heroes, ...heroes, ...heroes]

  return (
    <div
      className={`pointer-events-none flex w-max gap-4 opacity-85 ${reverse ? 'animate-[home-cover-drift-reverse_46s_linear_infinite]' : 'animate-[home-cover-drift_52s_linear_infinite]'}`}
      aria-hidden="true"
    >
      {railHeroes.map((hero, index) => {
        const palette = heroAccentPalettes[index % heroAccentPalettes.length]
        const image = getHeroImage(hero)
        return (
          <div
            key={`${hero.api_id ?? hero.name}-${index}`}
            className="h-40 w-28 shrink-0 overflow-hidden rounded-md border border-white/15 bg-slate-900 shadow-2xl shadow-slate-950/40 sm:h-52 sm:w-36"
          >
            {image ? (
              <img src={image} alt="" className="h-full w-full object-cover opacity-80 saturate-125" loading="lazy" />
            ) : (
              <div className={`flex h-full w-full flex-col justify-between bg-linear-to-br ${palette.cover} p-3`}>
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/80">IssueLine</span>
                <span className="max-w-20 text-lg font-black uppercase leading-none text-white drop-shadow sm:text-xl">
                  {hero.name}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">
                  {hero.timelineCoverage?.startYear ?? '1963'}
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function HomeHeroSection({ heroes }) {
  const { t } = useI18n()
  const displayHeroes = getDisplayHeroes(heroes)
  const primaryHero = displayHeroes.find((hero) => hero.slug && hero.hasTimelineIssues)
  const primaryHref = primaryHero?.slug ? `/heroes/${primaryHero.slug}` : '#timeline-preview'

  return (
    <section className="relative isolate min-h-[calc(88svh-4.25rem)] overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_38%_26%,rgba(213,41,65,0.28),transparent_34%),linear-gradient(115deg,rgba(15,23,42,0.96),rgba(39,47,93,0.9)_48%,rgba(56,16,28,0.92))]" />
      <div className="absolute inset-x-0 top-10 flex w-full rotate-[-7deg] flex-col gap-5 overflow-hidden opacity-55 blur-[0.2px]">
        <CoverRail heroes={displayHeroes} />
        <CoverRail heroes={displayHeroes} reverse />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.96)_0%,rgba(2,6,23,0.72)_42%,rgba(2,6,23,0.34)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] opacity-20 [background-size:64px_64px]" />

      <div className="relative z-1 mx-auto flex min-h-[calc(88svh-4.25rem)] w-full max-w-400 flex-col justify-center px-4 py-16 sm:px-6 lg:px-10 xl:px-16 2xl:px-24">
        <div className="w-full max-w-4xl py-14 sm:py-20">
          <div className="flex w-full max-w-full items-start gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-amber-100 backdrop-blur sm:inline-flex sm:w-auto sm:tracking-[0.2em]">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 whitespace-normal break-words leading-5">{t('home.hero.eyebrow')}</span>
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.92] tracking-normal text-white sm:text-6xl lg:text-7xl">
            {t('common.appName')}
          </h1>
          <p className="mt-6 max-w-2xl text-xl font-semibold leading-8 text-amber-50 sm:text-2xl">
            {t('home.hero.title')}
          </p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">{t('home.hero.subtitle')}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-red-600 text-white shadow-xl shadow-red-950/30 hover:bg-red-500">
              <Link to={primaryHref}>
                {t('home.hero.primaryCta')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <a href="#timeline-preview">{t('home.hero.secondaryCta')}</a>
            </Button>
          </div>
        </div>

        <a
          href="#character-showcase"
          className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white/80 backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 md:inline-flex"
        >
          {t('home.hero.scrollHint')}
          <ArrowDown className="h-3.5 w-3.5 animate-bounce" aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}

export default HomeHeroSection

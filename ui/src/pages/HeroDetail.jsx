// Render the HeroDetail page container.
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import HeroTimeline from '@/components/HeroTimeline'
import { TimelineInsightsSkeleton, TimelineLoadingSkeleton } from '@/components/timeline/TimelineLoadingSkeleton'
import { Button } from '@/components/ui/button'
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'
import TimelineArchiveBriefing from '@/components/hero-detail/TimelineArchiveBriefing'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import { resolveIssueCoverImage } from '@/lib/issueImages'
import { fetchHeroBySlugWithImages } from '@/lib/heroesApi.js'
import { useHeroTimelineQuery } from '@/hooks/useHeroTimeline.js'
import { useIssueStatesQuery } from '@/hooks/useIssueStates.js'
import { useSessionContext } from '@/lib/sessionContext.jsx'

const HeroTimelineCinematic = lazy(() => import('@/components/HeroTimelineCinematic'))
const HeroTimelineInsights = lazy(() => import('@/components/HeroTimelineInsights'))

const statLabelKeys = ['intelligence', 'strength', 'speed', 'durability', 'power', 'combat']
const fallbackImage =
  'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=600&q=70'

const resolveTimelineLogoBaseUrl = () => {
  const configured = import.meta.env.VITE_TIMELINE_LOGO_BASE_URL
  if (configured) return configured.replace(/\/+$/, '')
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (supabaseUrl) {
    return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/timeline-logos`
  }
  return '/timeline-logos'
}

const timelineLogoBaseUrl = resolveTimelineLogoBaseUrl()
const shuffleArray = (input) => {
  const clone = [...input]
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const tmp = clone[index]
    clone[index] = clone[randomIndex]
    clone[randomIndex] = tmp
  }
  return clone
}

function HeroDetail() {
  const { t } = useI18n()
  const { slug } = useParams()
  const [{ status, hero, error }, setState] = useState({
    status: isSupabaseConfigured ? 'idle' : 'disabled',
    hero: null,
    error: null,
  })
  const [timelineView, setTimelineView] = useState('classic')
  const [timelineLogoUnavailable, setTimelineLogoUnavailable] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !slug) {
      if (!slug) {
        setState({ status: 'error', hero: null, error: t('heroDetail.missingSlug') })
      }
      return
    }

    let active = true

    const loadHero = async () => {
      setState({ status: 'loading', hero: null, error: null })
      try {
        const heroData = await fetchHeroBySlugWithImages(supabase, slug)
        if (!active) return

        if (!heroData) {
          setState({ status: 'error', hero: null, error: t('heroDetail.heroNotFound', { slug }) })
          return
        }

        setState({
          status: 'success',
          hero: heroData,
          error: null,
        })
      } catch (error) {
        if (!active) return
        setState({ status: 'error', hero: null, error: error.message })
      }
    }

    void loadHero()

    return () => {
      active = false
    }
  }, [slug, t])

  const heroImages = hero?.heroImages ?? []
  const primaryImage = heroImages[0]
  const imageSrc = primaryImage?.public_url ?? hero?.images?.lg ?? hero?.images?.md ?? fallbackImage
  const imageAlt = primaryImage?.alt ?? hero?.name ?? t('heroDetail.heroPortrait')
  const timelineLogoSrc = hero?.slug ? `${timelineLogoBaseUrl}/${hero.slug}.png` : null
  const timelineLogoAlt = hero?.name ? `${hero.name} timeline logo` : null
  const hasTimelineLogo = Boolean(timelineLogoSrc) && !timelineLogoUnavailable
  const timelineBackdropQuery = useHeroTimelineQuery(slug, { enabled: Boolean(slug) })
  const { isAuthenticated } = useSessionContext()
  const issueStatesQuery = useIssueStatesQuery(slug, { enabled: Boolean(slug) && isAuthenticated })
  const showcaseImageSrc = hasTimelineLogo ? timelineLogoSrc : imageSrc
  const showcaseImageAlt = hasTimelineLogo ? timelineLogoAlt : imageAlt
  const alignment = hero?.alignment?.toLowerCase()
  const stats = hero?.powerstats ?? {}
  const timelineBackdropCovers = useMemo(() => {
    if (!hasTimelineLogo || timelineBackdropQuery.status !== 'success') {
      return []
    }

    const coverCandidates = timelineBackdropQuery.entries
      .map((entry) => resolveIssueCoverImage(entry?.metadata ?? {}, null))
      .filter(Boolean)

    if (!coverCandidates.length) {
      return []
    }

    const uniqueCovers = Array.from(new Set(coverCandidates))
    return shuffleArray(uniqueCovers).slice(0, 16)
  }, [hasTimelineLogo, timelineBackdropQuery.entries, timelineBackdropQuery.status])
  const animatedBackdropCovers = useMemo(
    () => (timelineBackdropCovers.length ? [...timelineBackdropCovers, ...timelineBackdropCovers] : []),
    [timelineBackdropCovers],
  )

  useEffect(() => {
    setTimelineLogoUnavailable(false)
  }, [timelineLogoSrc])

  const detailHeader = useMemo(
    () => (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">{t('heroDetail.sectionTitle')}</p>
          <h2 className="title-md">{hero?.name ?? slug}</h2>
          {hero?.publisher ? <p className="body-sm">{hero.publisher}</p> : null}
        </div>
        <Button asChild variant="outline">
          <Link to="/">{t('heroDetail.backToRoster')}</Link>
        </Button>
      </div>
    ),
    [hero?.name, hero?.publisher, slug, t],
  )

  if (!isSupabaseConfigured || !supabase) {
    return (
      <section className="w-full rounded-[32px] border border-slate-100 bg-white/85 p-6 text-slate-700 shadow-xl shadow-slate-200/70 ring-1 ring-slate-100/70 backdrop-blur supports-backdrop-filter:bg-white/70 lg:p-8">
        {detailHeader}
        <p className="mt-4 body-sm">{t('heroDetail.supabaseHint')}</p>
      </section>
    )
  }

  return (
    <section className="w-full max-w-full min-w-0 rounded-2xl border border-slate-100 bg-white/85 p-3 shadow-xl shadow-slate-200/70 ring-1 ring-slate-100/70 backdrop-blur supports-backdrop-filter:bg-white/70 sm:rounded-[32px] sm:p-6 lg:p-8">
      {detailHeader}
      <div className="mt-6">
        {status === 'loading' ? (
          <p className="body-sm text-slate-500">{t('heroDetail.loadingHeroData')}</p>
        ) : status === 'error' ? (
          <p className="body-sm text-rose-600">{error}</p>
        ) : hero ? (
          <div className="space-y-8">
            <div className="grid w-full max-w-full min-w-0 gap-6 lg:grid-cols-[minmax(160px,200px),minmax(0,1fr)] xl:gap-12">
              <aside className="space-y-6 rounded-3xl border border-slate-100 bg-white/85 p-5 text-sm text-slate-600 shadow-lg shadow-slate-200/60 ring-1 ring-white/70 backdrop-blur">
                <div
                  className={`relative mx-auto overflow-hidden ${
                    hasTimelineLogo
                      ? 'h-28 w-full max-w-none sm:h-32 lg:h-40'
                      : 'h-36 w-36 rounded-full border border-slate-200 bg-slate-100/60 shadow-inner'
                  }`}
                >
                  {hasTimelineLogo ? (
                    <>
                      {animatedBackdropCovers.length ? (
                        <div className="absolute inset-0 overflow-hidden">
                          <div className="timeline-logo-cover-track">
                            {animatedBackdropCovers.map((coverSrc, index) => (
                              <img
                                key={`${coverSrc}-${index}`}
                                src={coverSrc}
                                alt=""
                                aria-hidden="true"
                                className="timeline-logo-cover-cell"
                                loading="lazy"
                              />
                            ))}
                          </div>
                          <div className="absolute inset-0 bg-linear-to-r from-white/45 via-white/30 to-white/45" />
                          <div className="absolute inset-0 bg-linear-to-t from-white/35 via-transparent to-white/25" />
                        </div>
                      ) : null}
                      <img
                        src={showcaseImageSrc}
                        alt={showcaseImageAlt}
                        className="relative z-10 h-full w-full object-contain"
                        loading="lazy"
                        onError={() => {
                          setTimelineLogoUnavailable(true)
                        }}
                      />
                    </>
                  ) : (
                    <img
                      src={showcaseImageSrc}
                      alt={showcaseImageAlt}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
                <TimelineArchiveBriefing
                  heroName={hero.name}
                  status={timelineBackdropQuery.status}
                  errorMessage={timelineBackdropQuery.errorMessage}
                  entries={timelineBackdropQuery.entries}
                  collectedEditions={timelineBackdropQuery.collectedEditionsOverview}
                  statesByIssueId={issueStatesQuery.statesByIssueId}
                  isAuthenticated={isAuthenticated}
                />
                <div className="flex flex-col gap-5 md:flex-row md:items-start">
                  <div className="min-w-0 space-y-3 md:w-[38%] md:shrink-0">
                    {alignment ? (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
                        {t('heroDetail.alignment', { value: alignment })}
                      </span>
                    ) : null}
                    {hero.full_name ? (
                      <p className="body-sm">
                        <span className="body-xs text-slate-400">{t('heroDetail.fullName')}</span> {hero.full_name}
                      </p>
                    ) : null}
                    {hero.biography?.['place-of-birth'] ? (
                      <p className="body-sm">
                        <span className="body-xs text-slate-400">{t('heroDetail.origin')}</span> {hero.biography['place-of-birth']}
                      </p>
                    ) : null}
                    {hero.work?.occupation ? (
                      <p className="body-sm">
                        <span className="body-xs text-slate-400">{t('heroDetail.occupation')}</span> {hero.work.occupation}
                      </p>
                    ) : null}
                  </div>
                  <dl className="grid min-w-0 flex-1 grid-cols-2 gap-3 text-sm text-slate-600">
                    {statLabelKeys.map((label) => (
                      <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2 shadow-inner">
                        <dt className="eyebrow text-slate-400">{t(`heroDetail.stats.${label}`)}</dt>
                        <dd className="title-xs text-slate-800">
                          {Number.isFinite(Number(stats[label])) ? Number(stats[label]) : stats[label] ?? t('heroDetail.noStatValue')}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </aside>
              <div className="min-w-0 space-y-5">
                <Suspense fallback={<TimelineInsightsSkeleton />}>
                  <HeroTimelineInsights heroSlug={hero.slug} heroName={hero.name} />
                </Suspense>
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-100 bg-white/70 p-4 text-sm text-slate-600 shadow-inner">
                  <div>
                    <p className="eyebrow text-slate-500">{t('heroDetail.timelineStyle')}</p>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{t('heroDetail.switchLayouts')}</p>
                  </div>
                  <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm text-slate-600">
                    {[{ id: 'classic', label: t('heroDetail.classic') }, { id: 'cinematic', label: t('heroDetail.cinematic') }].map((option) => {
                      const isActive = timelineView === option.id
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setTimelineView(option.id)}
                          className={`rounded-full px-3 py-1 font-semibold transition ${
                            isActive ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-700'
                          }`}
                          aria-pressed={isActive}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="space-y-4">
                  {timelineView === 'classic' && (
                    <HeroTimeline
                      slug={hero.slug}
                      heroName={hero.name}
                      fallbackImage={imageSrc}
                      timelineLogoSrc={timelineLogoSrc}
                      timelineLogoAlt={timelineLogoAlt}
                    />
                  )}
                  {timelineView === 'cinematic' && (
                    <Suspense fallback={<TimelineLoadingSkeleton variant="dark" showNavigator={false} cardCount={4} />}>
                      <HeroTimelineCinematic
                        slug={hero.slug}
                        heroName={hero.name}
                        fallbackImage={imageSrc}
                        timelineLogoSrc={timelineLogoSrc}
                        timelineLogoAlt={timelineLogoAlt}
                      />
                    </Suspense>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="body-sm text-slate-500">{t('heroDetail.selectHeroHint')}</p>
        )}
      </div>
    </section>
  )
}

export default HeroDetail

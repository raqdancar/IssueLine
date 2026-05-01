// Render the HeroDetail page container.
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import HeroTimeline from '@/components/HeroTimeline'
import HeroTimelineCinematic from '@/components/HeroTimelineCinematic'
import HeroTimelineInsights from '@/components/HeroTimelineInsights'
import { Button } from '@/components/ui/button'
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'
import { useI18n } from '@/i18n/I18nProvider.jsx'
import { backendBaseUrl } from '@/utils/backend.js'
import { resolveIssueCoverImage } from '@/lib/issueImages'

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
  const [timelineBackdropCovers, setTimelineBackdropCovers] = useState([])

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
      const { data, error: heroError } = await supabase
        .from('superheroes')
        .select('*')
        .eq('slug', slug.toLowerCase())
        .order('api_id', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (!active) return

      if (heroError) {
        setState({ status: 'error', hero: null, error: heroError.message })
        return
      }

      if (!data) {
        setState({ status: 'error', hero: null, error: t('heroDetail.heroNotFound', { slug }) })
        return
      }

      const { data: heroImages } = await supabase
        .from('hero_images')
        .select('*')
        .eq('hero_api_id', data.api_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      setState({
        status: 'success',
        hero: { ...data, heroImages: heroImages ?? [] },
        error: null,
      })
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
  const showcaseImageSrc = hasTimelineLogo ? timelineLogoSrc : imageSrc
  const showcaseImageAlt = hasTimelineLogo ? timelineLogoAlt : imageAlt
  const alignment = hero?.alignment?.toLowerCase()
  const stats = hero?.powerstats ?? {}
  const animatedBackdropCovers = useMemo(
    () => (timelineBackdropCovers.length ? [...timelineBackdropCovers, ...timelineBackdropCovers] : []),
    [timelineBackdropCovers],
  )

  useEffect(() => {
    setTimelineLogoUnavailable(false)
  }, [timelineLogoSrc])

  useEffect(() => {
    if (!slug || !backendBaseUrl || !hasTimelineLogo) {
      setTimelineBackdropCovers([])
      return undefined
    }

    const controller = new AbortController()
    let active = true

    const loadTimelineBackdropCovers = async () => {
      try {
        const response = await fetch(`${backendBaseUrl}/hero-timelines/${encodeURIComponent(slug)}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          setTimelineBackdropCovers([])
          return
        }

        const payload = await response.json()
        const coverCandidates = (payload?.entries ?? [])
          .map((entry) => resolveIssueCoverImage(entry?.metadata ?? {}, null))
          .filter(Boolean)

        if (!active || !coverCandidates.length) {
          if (active) setTimelineBackdropCovers([])
          return
        }

        const uniqueCovers = Array.from(new Set(coverCandidates))
        const randomized = shuffleArray(uniqueCovers).slice(0, 16)
        if (active) {
          setTimelineBackdropCovers(randomized)
        }
      } catch {
        if (active) setTimelineBackdropCovers([])
      }
    }

    void loadTimelineBackdropCovers()

    return () => {
      active = false
      controller.abort()
    }
  }, [hasTimelineLogo, slug])

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
    <section className="w-full rounded-[32px] border border-slate-100 bg-white/85 p-6 shadow-xl shadow-slate-200/70 ring-1 ring-slate-100/70 backdrop-blur supports-backdrop-filter:bg-white/70 lg:p-8">
      {detailHeader}
      <div className="mt-6">
        {status === 'loading' ? (
          <p className="body-sm text-slate-500">{t('heroDetail.loadingHeroData')}</p>
        ) : status === 'error' ? (
          <p className="body-sm text-rose-600">{error}</p>
        ) : hero ? (
          <div className="space-y-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(160px,200px),1fr] xl:gap-12">
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
                <div className="space-y-4 rounded-3xl border border-slate-100 bg-linear-to-br from-white/90 via-slate-50/80 to-white/60 p-5 text-sm text-slate-600 shadow-inner">
                  <p className="text-sm font-semibold text-slate-800">{t('heroDetail.spotlightTitle')}</p>
                  <p>{t('heroDetail.spotlightP1')}</p>
                  <p>{t('heroDetail.spotlightP2')}</p>
                  <p className="font-semibold text-slate-800">{t('heroDetail.spotlightResult')}</p>
                  <p>{t('heroDetail.spotlightP3')}</p>
                  <ul className="list-disc space-y-1 pl-5 text-slate-500">
                    <li>{t('heroDetail.spotlightBullet1')}</li>
                    <li>{t('heroDetail.spotlightBullet2')}</li>
                    <li>{t('heroDetail.spotlightBullet3')}</li>
                  </ul>
                  <p className="text-slate-800">{t('heroDetail.spotlightClosing')}</p>
                </div>
                <div className="space-y-3">
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
                <dl className="grid grid-cols-2 gap-3 text-sm text-slate-600">
                  {statLabelKeys.map((label) => (
                    <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2 shadow-inner">
                      <dt className="eyebrow text-slate-400">{t(`heroDetail.stats.${label}`)}</dt>
                      <dd className="title-xs text-slate-800">
                        {Number.isFinite(Number(stats[label])) ? Number(stats[label]) : stats[label] ?? t('heroDetail.noStatValue')}
                      </dd>
                    </div>
                  ))}
                </dl>
              </aside>
              <div className="space-y-5">
                <HeroTimelineInsights heroSlug={hero.slug} heroName={hero.name} />
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
                    <HeroTimelineCinematic
                      slug={hero.slug}
                      heroName={hero.name}
                      fallbackImage={imageSrc}
                      timelineLogoSrc={timelineLogoSrc}
                      timelineLogoAlt={timelineLogoAlt}
                    />
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

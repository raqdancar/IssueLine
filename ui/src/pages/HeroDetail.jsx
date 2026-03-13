import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import HeroTimeline from '@/components/HeroTimeline'
import HeroTimelineCinematic from '@/components/HeroTimelineCinematic'
import { Button } from '@/components/ui/button'
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'

const statLabels = ['intelligence', 'strength', 'speed', 'durability', 'power', 'combat']
const fallbackImage =
  'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=600&q=70'

function HeroDetail() {
  const { slug } = useParams()
  const [{ status, hero, error }, setState] = useState({
    status: isSupabaseConfigured ? 'idle' : 'disabled',
    hero: null,
    error: null,
  })
  const [timelineView, setTimelineView] = useState('classic')

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !slug) {
      if (!slug) {
        setState({ status: 'error', hero: null, error: 'Missing hero slug in the URL.' })
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
        setState({ status: 'error', hero: null, error: `Hero with slug "${slug}" was not found.` })
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
  }, [slug])

  const heroImages = hero?.heroImages ?? []
  const primaryImage = heroImages[0]
  const imageSrc = primaryImage?.public_url ?? hero?.images?.lg ?? hero?.images?.md ?? fallbackImage
  const imageAlt = primaryImage?.alt ?? hero?.name ?? 'Hero portrait'
  const alignment = hero?.alignment?.toLowerCase()
  const stats = hero?.powerstats ?? {}

  const detailHeader = useMemo(
    () => (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Hero timeline</p>
          <h2 className="title-md">{hero?.name ?? slug}</h2>
          {hero?.publisher ? <p className="body-sm">{hero.publisher}</p> : null}
        </div>
        <Button asChild variant="outline">
          <Link to="/">Back to roster</Link>
        </Button>
      </div>
    ),
    [hero?.name, hero?.publisher, slug],
  )

  if (!isSupabaseConfigured || !supabase) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white/70 p-6 text-slate-700 shadow">
        {detailHeader}
        <p className="mt-4 body-sm">
          Configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to view hero details.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow">
      {detailHeader}
      <div className="mt-6">
        {status === 'loading' ? (
          <p className="body-sm text-slate-500">Loading hero data...</p>
        ) : status === 'error' ? (
          <p className="body-sm text-rose-600">{error}</p>
        ) : hero ? (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-[200px,1fr]">
              <img
                src={imageSrc}
                alt={imageAlt}
                className="h-52 w-52 rounded-2xl object-cover shadow-lg"
                loading="lazy"
              />
              <div className="space-y-3 text-sm text-slate-600">
                {alignment ? (
                  <span className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 eyebrow text-slate-500">
                    Alignment: {alignment}
                  </span>
                ) : null}
                {hero.full_name ? (
                  <p className="body-sm">
                    <span className="body-xs text-slate-400">Full name:</span> {hero.full_name}
                  </p>
                ) : null}
                {hero.biography?.['place-of-birth'] ? (
                  <p className="body-sm">
                    <span className="body-xs text-slate-400">Origin:</span> {hero.biography['place-of-birth']}
                  </p>
                ) : null}
                {hero.work?.occupation ? (
                  <p className="body-sm">
                    <span className="body-xs text-slate-400">Occupation:</span> {hero.work.occupation}
                  </p>
                ) : null}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm text-slate-600 sm:grid-cols-3">
              {statLabels.map((label) => (
                <div key={label} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 shadow-inner">
                  <dt className="eyebrow text-slate-400">{label}</dt>
                  <dd className="title-xs text-slate-800">
                    {Number.isFinite(Number(stats[label])) ? Number(stats[label]) : stats[label] ?? '—'}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="eyebrow text-slate-500">Timeline style</p>
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-sm text-slate-600">
                  {[
                    { id: 'classic', label: 'Classic' },
                    { id: 'cinematic', label: 'Cinematic' },
                  ].map((option) => {
                    const isActive = timelineView === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setTimelineView(option.id)}
                        className={`rounded-full px-3 py-1 font-semibold transition ${
                          isActive
                            ? 'bg-white text-slate-900 shadow'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                        aria-pressed={isActive}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {timelineView === 'classic' ? (
                <HeroTimeline slug={hero.slug} heroName={hero.name} fallbackImage={imageSrc} />
              ) : (
                <HeroTimelineCinematic slug={hero.slug} heroName={hero.name} fallbackImage={imageSrc} />
              )}
            </div>
          </div>
        ) : (
          <p className="body-sm text-slate-500">Select a hero from the roster to view their timeline.</p>
        )}
      </div>
    </section>
  )
}

export default HeroDetail

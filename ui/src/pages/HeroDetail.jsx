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
      <section className="w-full rounded-[32px] border border-slate-100 bg-white/80 p-6 text-slate-700 shadow-xl shadow-slate-200/70 ring-1 ring-slate-100/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 lg:p-8">
        {detailHeader}
        <p className="mt-4 body-sm">
          Configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to view hero details.
        </p>
      </section>
    )
  }

  return (
    <section className="w-full rounded-[32px] border border-slate-100 bg-white/80 p-6 shadow-xl shadow-slate-200/70 ring-1 ring-slate-100/70 backdrop-blur supports-[backdrop-filter]:bg-white/70 lg:p-8">
      {detailHeader}
      <div className="mt-6">
        {status === 'loading' ? (
          <p className="body-sm text-slate-500">Loading hero data...</p>
        ) : status === 'error' ? (
          <p className="body-sm text-rose-600">{error}</p>
        ) : hero ? (
          <div className="space-y-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(160px,200px),1fr] xl:gap-12">
              <aside className="space-y-6 rounded-3xl border border-slate-100 bg-white/85 p-5 text-sm text-slate-600 shadow-lg shadow-slate-200/60 ring-1 ring-white/70 backdrop-blur">
                <div className="relative mx-auto h-36 w-36 overflow-hidden rounded-full border border-slate-200 bg-slate-100/60 shadow-inner">
                  <img
                    src={imageSrc}
                    alt={imageAlt}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="space-y-4 rounded-3xl border border-slate-100 bg-gradient-to-br from-white/90 via-slate-50/80 to-white/60 p-5 text-sm text-slate-600 shadow-inner">
                  <p className="text-sm font-semibold text-slate-800">? Hero spotlight</p>
                  <p>
                    Following a character's history shouldn't feel like solving a puzzle. For decades, heroes like Doctor Strange have lived across relaunches, variant printings, crossovers, and region-specific editions.
                  </p>
                  <p>
                    What used to be a single flagship run becomes paperbacks, facsimiles, or issues tucked inside larger events, leaving fans with a fragmented timeline.
                  </p>
                  <p className="font-semibold text-slate-800">The result?</p>
                  <p>
                    A confusing reading order that's hard to follow, harder to catalog, and almost impossible to collect with confidence.
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-slate-500">
                    <li>Which issue actually contains this chapter?</li>
                    <li>Is this a new story or another reprint of the same material?</li>
                    <li>In what order should you experience every beat?</li>
                  </ul>
                  <p className="text-slate-800">
                    IssueLine restores clarity with a single, beautifully organized timeline so you can enjoy every chapter without getting lost in decades of publications.
                  </p>
                </div>
                <div className="space-y-3">
                  {alignment ? (
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
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
                <dl className="grid grid-cols-2 gap-3 text-sm text-slate-600">
                  {statLabels.map((label) => (
                    <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2 shadow-inner">
                      <dt className="eyebrow text-slate-400">{label}</dt>
                      <dd className="title-xs text-slate-800">
                        {Number.isFinite(Number(stats[label])) ? Number(stats[label]) : stats[label] ?? '—'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </aside>
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-100 bg-white/70 p-4 text-sm text-slate-600 shadow-inner">
                  <div>
                    <p className="eyebrow text-slate-500">Timeline style</p>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Switch between layouts</p>
                  </div>
                  <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm text-slate-600">
                    {[{ id: 'classic', label: 'Classic' }, { id: 'cinematic', label: 'Cinematic' }].map((option) => {
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
                    <HeroTimeline slug={hero.slug} heroName={hero.name} fallbackImage={imageSrc} />
                  )}
                  {timelineView === 'cinematic' && (
                    <HeroTimelineCinematic slug={hero.slug} heroName={hero.name} fallbackImage={imageSrc} />
                  )}
                </div>
              </div>
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















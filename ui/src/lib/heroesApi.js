// Provide shared Supabase access helpers for hero catalog/detail payloads.

const buildHeroCoverageById = (timelineRows) => {
  const coverageById = new Map()

  for (const row of timelineRows ?? []) {
    if (!row?.hero_api_id) continue

    const current = coverageById.get(row.hero_api_id) ?? {
      count: 0,
      startYear: null,
      endYear: null,
    }

    current.count += 1
    const parsedDate = row.issue_date ? new Date(row.issue_date) : null
    if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
      const year = parsedDate.getUTCFullYear()
      if (current.startYear === null || year < current.startYear) {
        current.startYear = year
      }
      if (current.endYear === null || year > current.endYear) {
        current.endYear = year
      }
    }

    coverageById.set(row.hero_api_id, current)
  }

  return coverageById
}

const buildCollectedEditionCountByHeroId = (rows) => {
  const counts = new Map()
  for (const row of rows ?? []) {
    if (!row?.hero_api_id) continue
    counts.set(row.hero_api_id, (counts.get(row.hero_api_id) ?? 0) + 1)
  }
  return counts
}

const buildImagesByHeroId = (imageRows) =>
  (imageRows ?? []).reduce((acc, image) => {
    if (!acc[image.hero_api_id]) {
      acc[image.hero_api_id] = []
    }
    acc[image.hero_api_id].push(image)
    return acc
  }, {})

const normalizeSlug = (value) => value?.trim().toLowerCase()

export const fetchHeroesOverview = async (supabaseClient) => {
  const [heroesResult, imagesResult] = await Promise.all([
    supabaseClient.from('superheroes').select('*').order('name', { ascending: true }),
    supabaseClient
      .from('hero_images')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
  ])

  if (heroesResult.error) {
    throw new Error(heroesResult.error.message)
  }
  if (imagesResult.error) {
    throw new Error(imagesResult.error.message)
  }

  const heroes = heroesResult.data ?? []
  const imagesByHeroId = buildImagesByHeroId(imagesResult.data)
  const heroApiIds = heroes.map((hero) => hero.api_id).filter(Boolean)

  if (!heroApiIds.length) {
    return heroes.map((hero) => ({
      ...hero,
      heroImages: imagesByHeroId[hero.api_id] ?? [],
      hasTimelineIssues: false,
      timelineCoverage: { count: 0, startYear: null, endYear: null },
      collectedEditionsCount: 0,
    }))
  }

  const [timelineResult, collectedEditionsResult] = await Promise.all([
    supabaseClient
      .from('hero_timelines')
      .select('hero_api_id, issue_date')
      .in('hero_api_id', heroApiIds),
    supabaseClient
      .from('collected_editions')
      .select('hero_api_id')
      .in('hero_api_id', heroApiIds),
  ])

  if (timelineResult.error) {
    throw new Error(timelineResult.error.message)
  }

  const coverageById = buildHeroCoverageById(timelineResult.data)
  const heroesWithIssues = new Set((timelineResult.data ?? []).map((row) => row.hero_api_id))

  let collectedEditionsCountByHeroId = new Map()
  if (collectedEditionsResult.error) {
    console.warn(
      'Failed to load collected editions count for hero dashboard',
      collectedEditionsResult.error.message,
    )
  } else {
    collectedEditionsCountByHeroId = buildCollectedEditionCountByHeroId(collectedEditionsResult.data)
  }

  return heroes.map((hero) => ({
    ...hero,
    heroImages: imagesByHeroId[hero.api_id] ?? [],
    hasTimelineIssues: heroesWithIssues.has(hero.api_id),
    timelineCoverage: coverageById.get(hero.api_id) ?? { count: 0, startYear: null, endYear: null },
    collectedEditionsCount: collectedEditionsCountByHeroId.get(hero.api_id) ?? 0,
  }))
}

export const fetchHeroBySlugWithImages = async (supabaseClient, slug) => {
  const normalizedSlug = normalizeSlug(slug)
  if (!normalizedSlug) return null

  const { data: heroRow, error: heroError } = await supabaseClient
    .from('superheroes')
    .select('*')
    .eq('slug', normalizedSlug)
    .order('api_id', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (heroError) {
    throw new Error(heroError.message)
  }
  if (!heroRow) {
    return null
  }

  const { data: heroImages, error: imagesError } = await supabaseClient
    .from('hero_images')
    .select('*')
    .eq('hero_api_id', heroRow.api_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (imagesError) {
    throw new Error(imagesError.message)
  }

  return {
    ...heroRow,
    heroImages: heroImages ?? [],
  }
}

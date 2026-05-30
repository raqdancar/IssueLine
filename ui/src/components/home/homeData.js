// Renderitza una seccio visual de la pagina inicial d'IssueLine.
export const fallbackHeroes = [
  {
    api_id: 'landing-doctor-strange',
    name: 'Doctor Strange',
    slug: 'doctor-strange',
    publisher: 'Marvel',
    hasTimelineIssues: true,
    timelineCoverage: { count: 92, startYear: 1963, endYear: 2024 },
    collectedEditionsCount: 14,
  },
  {
    api_id: 'landing-moon-knight',
    name: 'Moon Knight',
    slug: 'moon-knight',
    publisher: 'Marvel',
    hasTimelineIssues: true,
    timelineCoverage: { count: 64, startYear: 1975, endYear: 2024 },
    collectedEditionsCount: 9,
  },
  {
    api_id: 'landing-scarlet-witch',
    name: 'Scarlet Witch',
    slug: null,
    publisher: 'Marvel',
    hasTimelineIssues: false,
    timelineCoverage: { count: 48, startYear: 1964, endYear: 2023 },
    collectedEditionsCount: 7,
  },
  {
    api_id: 'landing-daredevil',
    name: 'Daredevil',
    slug: null,
    publisher: 'Marvel',
    hasTimelineIssues: false,
    timelineCoverage: { count: 118, startYear: 1964, endYear: 2025 },
    collectedEditionsCount: 18,
  },
]

export const heroAccentPalettes = [
  {
    panel: 'from-indigo-950 via-[#272F5D] to-rose-950',
    ink: 'text-amber-100',
    glow: 'shadow-rose-950/25',
    cover: 'from-rose-700 via-amber-400 to-indigo-900',
  },
  {
    panel: 'from-neutral-950 via-zinc-800 to-red-950',
    ink: 'text-slate-50',
    glow: 'shadow-zinc-950/25',
    cover: 'from-zinc-100 via-zinc-400 to-red-700',
  },
  {
    panel: 'from-rose-950 via-red-900 to-slate-950',
    ink: 'text-rose-50',
    glow: 'shadow-red-950/25',
    cover: 'from-red-600 via-rose-200 to-slate-900',
  },
  {
    panel: 'from-red-950 via-stone-900 to-slate-950',
    ink: 'text-orange-50',
    glow: 'shadow-stone-950/25',
    cover: 'from-red-700 via-orange-300 to-stone-950',
  },
]

export const timelinePreviewIssues = [
  {
    type: 'issue',
    year: '1963',
    date: 'Jul 10, 1963',
    series: 'Strange Tales',
    issueNumber: '110',
    stageKey: 'origin',
    stateKey: 'complete',
    titleKey: 'origin',
    summaryKey: 'origin',
    completion: 100,
    coverTone: 'from-amber-300 via-red-500 to-indigo-900',
    haveIt: true,
    readIt: true,
  },
  {
    type: 'issue',
    year: '1974',
    date: 'Jun 04, 1974',
    series: 'Doctor Strange',
    issueNumber: '1',
    stageKey: 'solo',
    stateKey: 'owned',
    titleKey: 'solo',
    summaryKey: 'solo',
    completion: 76,
    coverTone: 'from-sky-200 via-indigo-500 to-slate-950',
    haveIt: true,
    readIt: false,
  },
  {
    type: 'gap',
    year: '1988',
    date: '1988 gap',
    series: 'Doctor Strange, Sorcerer Supreme',
    issueNumber: '12 - 14',
    stageKey: 'missingArc',
    stateKey: 'missing',
    titleKey: 'missingArc',
    summaryKey: 'missingArc',
    completion: 42,
    coverTone: 'from-stone-200 via-amber-600 to-red-950',
    haveIt: false,
    readIt: false,
  },
  {
    type: 'issue',
    year: '2015',
    date: 'Nov 18, 2015',
    series: 'Doctor Strange',
    issueNumber: '390',
    legacyNumber: '390',
    stageKey: 'legacy',
    stateKey: 'read',
    titleKey: 'legacy',
    summaryKey: 'legacy',
    completion: 88,
    coverTone: 'from-fuchsia-300 via-rose-600 to-indigo-950',
    haveIt: false,
    readIt: true,
  },
  {
    type: 'issue',
    year: '2023',
    date: 'Oct 04, 2023',
    series: 'Doctor Strange',
    issueNumber: '7',
    stageKey: 'modern',
    stateKey: 'tracking',
    titleKey: 'modern',
    summaryKey: 'modern',
    completion: 61,
    coverTone: 'from-emerald-300 via-cyan-600 to-slate-950',
    haveIt: false,
    readIt: false,
  },
]

export const collectedEditionItems = [
  { key: 'omnibus', tone: 'from-red-950 via-rose-700 to-amber-300', width: 'w-24 sm:w-28' },
  { key: 'tpb', tone: 'from-indigo-950 via-sky-700 to-cyan-200', width: 'w-20 sm:w-24' },
  { key: 'gold', tone: 'from-amber-200 via-yellow-500 to-stone-950', width: 'w-24 sm:w-28' },
  { key: 'deluxe', tone: 'from-slate-950 via-zinc-700 to-zinc-100', width: 'w-20 sm:w-24' },
]

export const getHeroImage = (hero) => {
  const primaryImage = hero?.heroImages?.[0]
  return primaryImage?.public_url ?? hero?.images?.md ?? hero?.images?.sm ?? null
}

export const getYearRange = (hero, fallback = '1963 - 2026') => {
  const start = hero?.timelineCoverage?.startYear
  const end = hero?.timelineCoverage?.endYear
  if (start && end) return start === end ? `${start}` : `${start} - ${end}`
  if (start) return `${start}`
  return fallback
}

export const estimateStageCount = (hero, index = 0) => {
  const direct = Number(hero?.timelineStagesCount ?? hero?.stagesCount)
  if (Number.isFinite(direct) && direct > 0) return direct
  const coverageStageCount = Number(hero?.timelineCoverage?.stageCount)
  if (Number.isFinite(coverageStageCount) && coverageStageCount > 0) return coverageStageCount
  const issueCount = Number(hero?.timelineCoverage?.count ?? 0)
  if (issueCount > 90) return 8
  if (issueCount > 60) return 6
  if (issueCount > 25) return 4
  return 3 + (index % 3)
}

export const estimateCompletion = (hero, index = 0) => {
  const issueCount = Number(hero?.timelineCoverage?.count ?? 0)
  if (!issueCount) return [68, 54, 41, 73][index % 4]
  return Math.max(34, Math.min(96, 48 + (issueCount % 47)))
}

export const getDisplayHeroes = (heroes = []) => {
  const liveHeroes = heroes.filter((hero) => hero?.hasTimelineIssues || hero?.timelineCoverage?.count > 0)
  const source = liveHeroes.length ? liveHeroes : heroes.length ? heroes : fallbackHeroes
  return source
}

export const buildGlobalStats = (heroes = [], t) => {
  const source = heroes
  const issueCount = source.reduce((total, hero) => total + Number(hero?.timelineCoverage?.count ?? 0), 0)
  const stageCount = source.reduce((total, hero) => total + Number(hero?.timelineCoverage?.stageCount ?? 0), 0)
  const collectedEditionCount = source.reduce(
    (total, hero) => total + Number(hero?.collectedEditionsCount ?? 0),
    0,
  )

  return [
    { label: t('home.stats.heroes'), value: source.length },
    { label: t('home.stats.issues'), value: issueCount },
    { label: t('home.stats.stages'), value: stageCount },
    { label: t('home.stats.collectedEditions'), value: collectedEditionCount },
  ]
}

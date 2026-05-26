// React Query wrapper for the shared hero timeline payload.
import { useQuery } from '@tanstack/react-query'
import { fetchHeroTimeline } from '@/lib/heroTimelineApi.js'
import { isBackendConfigured } from '@/utils/backend.js'

export const heroTimelineQueryKey = (heroSlug) => ['hero-timeline', heroSlug ?? 'unknown']

export const useHeroTimelineQuery = (heroSlug, { enabled = true } = {}) => {
  const canFetchTimeline = Boolean(enabled && heroSlug && isBackendConfigured)
  const queryKey = heroTimelineQueryKey(heroSlug)
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchHeroTimeline({ slug: heroSlug, signal }),
    enabled: canFetchTimeline,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })

  const payload = query.data ?? {}
  const status = !canFetchTimeline
    ? 'disabled'
    : query.isLoading
      ? 'loading'
      : query.isError
        ? 'error'
        : query.isSuccess
          ? 'success'
          : 'idle'

  return {
    ...query,
    status,
    entries: payload.entries ?? [],
    collectedEditionsOverview: payload.collectedEditionsOverview ?? [],
    hero: payload.hero ?? null,
    errorMessage: query.error?.message ?? null,
    canFetchTimeline,
    queryKey,
  }
}

// Provide hero catalog loading state for dashboard pages.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchHeroesOverview } from '@/lib/heroesApi.js'
import { supabase } from '@/lib/supabaseClient'

export const useHeroesCatalog = ({ t }) => {
  const query = useQuery({
    queryKey: ['heroes-catalog'],
    queryFn: () => fetchHeroesOverview(supabase),
    enabled: Boolean(supabase),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })

  const heroes = query.data ?? []
  const heroesStatus = useMemo(() => {
    if (!supabase) {
      return {
        state: 'idle',
        message: t('app.configureSupabaseToLoadHeroes'),
      }
    }
    if (query.isError) {
      return {
        state: 'error',
        message: query.error?.message ?? 'Unexpected error.',
      }
    }
    if (query.isFetching) {
      return {
        state: 'loading',
        message: t('app.loadingHeroes'),
      }
    }
    return {
      state: 'success',
      message: heroes.length ? t('app.loadedHeroes', { count: heroes.length }) : t('app.noHeroesFound'),
    }
  }, [heroes.length, query.error, query.isError, query.isFetching, t])

  return {
    heroes,
    heroesStatus,
  }
}

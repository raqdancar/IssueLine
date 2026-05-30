// Encapsula estat, efectes i consultes reutilitzables del frontend.
/**
 * Hooks de React Query per consultar i mutar l'estat d'issues d'un personatge.
 *
 * Aquest fitxer centralitza:
 * - lectura d'estats (`en possessiÃ³`, `llegit`, formats de recopilatori),
 * - mutacions amb actualitzaciÃ³ optimista de UI,
 * - sincronitzaciÃ³ de canvis amb la cachÃ© de React Query.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionContext } from '@/lib/sessionContext.jsx'
import {
  fetchIssueStates,
  markStageIssuesRead,
  patchIssueState,
  toggleCollectedEditionReadStatus,
} from '@/lib/issueStatesApi.js'
import { isBackendConfigured } from '@/utils/backend.js'

const issueStatesQueryKey = (heroSlug) => ['issue-states', heroSlug ?? 'unknown']
const EMPTY_STATE_INDEX = Object.freeze({})

const buildStateIndex = (input) => {
  const source = Array.isArray(input)
    ? input
    : input && typeof input === 'object'
      ? Object.values(input)
      : []

  const byId = {}
  for (const state of source) {
    if (!state || state.issueId == null) continue
    byId[state.issueId] = state
  }
  return byId
}

const stateIndexToArray = (index) => Object.values(index ?? {})

/**
 * Consulta els estats d'issues per un personatge i els indexa per `issueId`.
 *
 * @param {string} heroSlug Slug del personatge.
 * @param {{enabled?: boolean}} options Control d'activaciÃ³ de la query.
 * @returns {{statesByIssueId:Object, canFetchStates:boolean} & import('@tanstack/react-query').UseQueryResult}
 */

export const useIssueStatesQuery = (heroSlug, { enabled = true } = {}) => {
  const { session } = useSessionContext()
  const accessToken = session?.access_token ?? null
  const canFetch = Boolean(enabled && accessToken && isBackendConfigured && heroSlug)

  const query = useQuery({
    queryKey: issueStatesQueryKey(heroSlug),
    queryFn: () => fetchIssueStates({ heroSlug, accessToken }),
    enabled: canFetch,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    select: (payload) => buildStateIndex(payload),
    placeholderData: [],
  })

  return {
    ...query,
    statesByIssueId: query.data ?? EMPTY_STATE_INDEX,
    canFetchStates: canFetch,
    queryKey: issueStatesQueryKey(heroSlug),
  }
}

/**
 * MutaciÃ³ per actualitzar l'estat d'una issue individual.
 *
 * Inclou estrategia optimista per evitar latencia visual:
 * - aplica el canvi a cache abans de la resposta,
 * - fa rollback automatic en cas d'error,
 * - invalida la query per absorbir propagacions de backend.
 *
 * @param {string} heroSlug Slug del personatge.
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */

export const useIssueStateMutation = (heroSlug) => {
  const queryClient = useQueryClient()
  const { session } = useSessionContext()
  const accessToken = session?.access_token ?? null
  const authorized = Boolean(accessToken && isBackendConfigured)
  const queryKey = issueStatesQueryKey(heroSlug)

  return useMutation({
    mutationFn: async ({ issueId, patch }) => {
      if (!authorized) {
        throw new Error('Sign in to update issue states.')
      }
      return patchIssueState({ issueId, patch, accessToken })
    },
    onMutate: async ({ issueId, patch }) => {
      // S'atura temporalment la query per evitar que una resposta antiga
      // sobrescrigui l'estat optimista que es mostrara immediatament a UI.
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      const optimistic = buildStateIndex(previous)
      const currentState = optimistic[issueId] ?? { issueId, haveIt: false, readIt: false, collectedEditionIds: [] }

      const nextHaveIt = patch.haveIt ?? currentState.haveIt
      const nextState = {
        ...currentState,
        ...patch,
        collectedEditionIds: nextHaveIt
          ? patch.collectedEditionIds ?? currentState.collectedEditionIds ?? []
          : [],
        updatedAt: new Date().toISOString(),
      }

      if (!nextState.haveIt && !nextState.readIt) {
        delete optimistic[issueId]
      } else {
        optimistic[issueId] = nextState
      }

      queryClient.setQueryData(queryKey, stateIndexToArray(optimistic))
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, (current) => {
        const next = buildStateIndex(current)
        if (!data.haveIt && !data.readIt) {
          delete next[data.issueId]
        } else {
          next[data.issueId] = data
        }
        return stateIndexToArray(next)
      })
      void queryClient.invalidateQueries({ queryKey })
    },
  })
}

/**
 * MutaciÃ³ per marcar una etapa de cronologia completa com a `llegida`.
 *
 * @param {string} heroSlug Slug del personatge.
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */

export const useStageReadMutation = (heroSlug) => {
  const queryClient = useQueryClient()
  const { session } = useSessionContext()
  const accessToken = session?.access_token ?? null
  const authorized = Boolean(accessToken && isBackendConfigured)
  const queryKey = issueStatesQueryKey(heroSlug)

  return useMutation({
    mutationFn: async ({ stageKey }) => {
      if (!authorized) {
        throw new Error('Sign in to update issue states.')
      }
      if (!stageKey) {
        throw new Error('Missing stage identifier.')
      }
      return markStageIssuesRead({ heroSlug, stageKey, accessToken })
    },
    onMutate: async ({ issueIds = [] }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      if (!issueIds?.length) {
        return { previous }
      }
      const optimistic = buildStateIndex(previous)
      const timestamp = new Date().toISOString()
      issueIds.forEach((issueId) => {
        if (!issueId) return
        const current = optimistic[issueId] ?? { issueId, haveIt: false, readIt: false, collectedEditionIds: [] }
        optimistic[issueId] = { ...current, readIt: true, updatedAt: timestamp }
      })
      queryClient.setQueryData(queryKey, stateIndexToArray(optimistic))
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSuccess: (data) => {
      const states = data?.states ?? []
      queryClient.setQueryData(queryKey, (current) => {
        const next = buildStateIndex(current)
        states.forEach((state) => {
          next[state.issueId] = state
        })
        return stateIndexToArray(next)
      })
    },
  })
}

export const useCollectedEditionReadMutation = (heroSlug) => {
  const queryClient = useQueryClient()
  const { session } = useSessionContext()
  const accessToken = session?.access_token ?? null
  const authorized = Boolean(accessToken && isBackendConfigured)
  const queryKey = issueStatesQueryKey(heroSlug)

  return useMutation({
    mutationFn: async ({ collectedEditionId, readIt }) => {
      if (!authorized) {
        throw new Error('Sign in to update issue states.')
      }
      if (!collectedEditionId) {
        throw new Error('Missing collected edition identifier.')
      }
      return toggleCollectedEditionReadStatus({ heroSlug, collectedEditionId, readIt, accessToken })
    },
    onMutate: async ({ issueIds = [], readIt }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      if (!issueIds?.length) {
        return { previous }
      }

      const optimistic = buildStateIndex(previous)
      const timestamp = new Date().toISOString()
      issueIds.forEach((issueId) => {
        if (!issueId) return
        const current = optimistic[issueId] ?? { issueId, haveIt: false, readIt: false, collectedEditionIds: [] }
        const nextState = { ...current, readIt: Boolean(readIt), updatedAt: timestamp }
        if (!nextState.haveIt && !nextState.readIt) {
          delete optimistic[issueId]
        } else {
          optimistic[issueId] = nextState
        }
      })
      queryClient.setQueryData(queryKey, stateIndexToArray(optimistic))
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSuccess: (data) => {
      const states = data?.states ?? []
      const stateByIssueId = buildStateIndex(states)
      const affectedIssueIds = data?.issueIds ?? []

      queryClient.setQueryData(queryKey, (current) => {
        const next = buildStateIndex(current)
        affectedIssueIds.forEach((issueId) => {
          const state = stateByIssueId[issueId]
          if (!state || (!state.haveIt && !state.readIt)) {
            delete next[issueId]
          } else {
            next[issueId] = state
          }
        })
        return stateIndexToArray(next)
      })
      void queryClient.invalidateQueries({ queryKey })
    },
  })
}

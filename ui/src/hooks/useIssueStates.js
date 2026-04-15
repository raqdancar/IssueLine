import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionContext } from '@/lib/sessionContext.jsx'
import { fetchIssueStates, markStageIssuesRead, patchIssueState } from '@/lib/issueStatesApi.js'
import { isBackendConfigured } from '@/utils/backend.js'

const issueStatesQueryKey = (heroSlug) => ['issue-states', heroSlug ?? 'unknown']

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
    statesByIssueId: query.data ?? {},
    canFetchStates: canFetch,
    queryKey: issueStatesQueryKey(heroSlug),
  }
}

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
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      const optimistic = buildStateIndex(previous)
      const currentState = optimistic[issueId] ?? { issueId, haveIt: false, readIt: false }

      const nextState = {
        ...currentState,
        ...patch,
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
    },
  })
}

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
        const current = optimistic[issueId] ?? { issueId, haveIt: false, readIt: false }
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

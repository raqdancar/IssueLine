import { useQuery } from '@tanstack/react-query'
import { fetchIssueDetails } from '@/lib/issueDetailsApi.js'
import { isBackendConfigured } from '@/utils/backend.js'

export const issueDetailsQueryKey = (heroSlug, issueId) => ['issue-details', heroSlug ?? 'unknown', issueId ?? 'unknown']

export const useIssueDetailsQuery = ({ heroSlug, issueId, enabled = true }) => {
  const canFetch = Boolean(enabled && isBackendConfigured && heroSlug && issueId)

  return useQuery({
    queryKey: issueDetailsQueryKey(heroSlug, issueId),
    queryFn: ({ signal }) => fetchIssueDetails({ heroSlug, issueId, signal }),
    enabled: canFetch,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })
}

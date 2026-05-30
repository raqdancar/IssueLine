// Gestiona la integracio amb GCD i la normalitzacio de dades editorials.
import { gcdGet } from './client.js'

const normalizeIssueUrls = (seriesResults) => {
  const urls = []
  for (const series of seriesResults ?? []) {
    for (const issueUrl of series?.active_issues ?? []) {
      if (issueUrl) {
        urls.push(issueUrl)
      }
    }
  }
  return urls
}

export const fetchSeriesIssues = async ({ seriesResults, limit = 40 }) => {
  if (!Array.isArray(seriesResults) || limit <= 0) {
    return []
  }

  const issueUrls = normalizeIssueUrls(seriesResults).slice(0, limit)
  const issues = []
  for (const issueUrl of issueUrls) {
    const issue = await gcdGet(issueUrl)
    issues.push(issue)
  }
  return issues
}

export const getIssueById = async (issueId) => {
  if (!issueId) {
    throw new Error('issueId is required.')
  }
  return gcdGet(`issue/${issueId}/`)
}

export const getIssueByUrl = async (issueUrl) => {
  if (!issueUrl) {
    throw new Error('issueUrl is required.')
  }
  return gcdGet(issueUrl)
}

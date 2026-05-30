// Construeix peces visuals i derivacions de la cronologia d'issues.
const textIncludes = (value, keyword) => {
  if (typeof value !== 'string') return false
  return value.toLowerCase().includes(keyword)
}

const textEquals = (value, keyword) => {
  if (typeof value !== 'string') return false
  return value.toLowerCase() === keyword
}

const isAnnualLike = (value) => textIncludes(value, 'annual')

const isSpecialLike = (value) => textIncludes(value, 'special')

const extractIssueTextCandidates = (entry) => {
  const metadata = entry?.metadata ?? {}
  return [
    entry?.issue_code,
    metadata.issue_code,
    metadata.issueCode,
    metadata.issueLabel,
    metadata.issue_label,
    metadata.series_name,
    metadata.seriesName,
    entry?.headline,
  ]
}

const extractSpecialEventTextCandidates = (entry) => {
  const metadata = entry?.metadata ?? {}
  return [
    entry?.issue_code,
    metadata.issue_code,
    metadata.issueCode,
    metadata.issueLabel,
    metadata.issue_label,
  ]
}

export const isAnnualIssueEntry = (entry) => {
  if (!entry) return false
  const metadata = entry.metadata ?? {}
  // Prefer explicit metadata flags, then fall back to textual heuristics.
  if (metadata.issue_category === 'annual' || metadata.issueCategory === 'annual') return true
  if (metadata.special_issue_type === 'annual' || metadata.specialIssueType === 'annual') return true
  if (metadata.special_issue && metadata.issueLabel && isAnnualLike(metadata.issueLabel)) return true

  return extractIssueTextCandidates(entry).some((value) => isAnnualLike(value))
}

export const isSpecialTimelineEventEntry = (entry) => {
  if (!entry) return false
  const metadata = entry.metadata ?? {}

  // Special milestones may arrive as explicit categories or plain "Special" issue_code labels.
  if (textEquals(metadata.issue_category, 'special') || textEquals(metadata.issueCategory, 'special')) return true
  if (textEquals(metadata.special_issue_type, 'special') || textEquals(metadata.specialIssueType, 'special')) return true
  if ((entry.special_issue || entry.specialIssue || metadata.special_issue || metadata.specialIssue) && !isAnnualIssueEntry(entry)) {
    return true
  }

  return extractSpecialEventTextCandidates(entry).some((value) => isSpecialLike(value))
}

export const isSpecialIssueEntry = (entry) => {
  if (!entry) return false
  if (isSpecialTimelineEventEntry(entry)) return true
  if (entry.special_issue || entry.specialIssue) return true

  const metadata = entry.metadata ?? {}
  if (metadata.special_issue || metadata.specialIssue) return true
  if (metadata.issue_category === 'annual' || metadata.issueCategory === 'annual') return true

  return extractIssueTextCandidates(entry).some((value) => isAnnualLike(value) || isSpecialLike(value))
}

export const hasSpecialIssueCode = (entry) => isSpecialIssueEntry(entry)

// Resolve target hero issues and create collected-edition link records.
import {
  getCollectedEditionById,
  getExistingCollectedEditionLinks,
  getHeroIssuesByGcdIssueIds,
  getHeroIssuesForHero,
  insertCollectedEditionIssueLinks,
} from '../repository.js'

const extractIssueNumber = (value) => {
  if (value === null || value === undefined) return null
  const match = String(value).match(/\d+/)
  if (!match) return null
  const numeric = Number(match[0])
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null
}

const resolveTargetsByGcd = async ({ heroApiId, selector }) => {
  const rows = await getHeroIssuesByGcdIssueIds({ heroApiId, gcdIssueIds: selector })
  const foundByGcd = new Map(rows.map((row) => [Number(row.gcd_issue_id), row]))
  const missing = selector.filter((gcdIssueId) => !foundByGcd.has(gcdIssueId))
  return {
    resolvedRows: rows,
    missing,
    ambiguous: [],
  }
}

const resolveTargetsByNumber = async ({ heroApiId, selector }) => {
  const rows = await getHeroIssuesForHero({ heroApiId })
  const grouped = new Map()

  for (const row of rows) {
    const issueNumber = extractIssueNumber(row.number)
    if (!issueNumber) continue
    if (!grouped.has(issueNumber)) {
      grouped.set(issueNumber, [])
    }
    grouped.get(issueNumber).push(row)
  }

  const resolvedRows = []
  const missing = []
  const ambiguous = []

  for (const issueNumber of selector) {
    const matches = grouped.get(issueNumber) ?? []
    if (!matches.length) {
      missing.push(issueNumber)
      continue
    }
    // Surface ambiguous number matches so operator can decide intentionally.
    if (matches.length > 1) {
      ambiguous.push({
        issueNumber,
        candidates: matches.map((item) => ({
          id: item.id,
          gcdIssueId: item.gcd_issue_id,
          seriesName: item.series_name,
          number: item.number,
          title: item.title,
        })),
      })
      continue
    }
    resolvedRows.push(matches[0])
  }

  return {
    resolvedRows,
    missing,
    ambiguous,
  }
}

const resolveTargetRows = async ({ heroApiId, mode, selector }) => {
  if (mode === 'gcd') {
    return resolveTargetsByGcd({ heroApiId, selector })
  }
  return resolveTargetsByNumber({ heroApiId, selector })
}

export const linkCollectedEditionToIssues = async ({
  collectedEditionId,
  mode,
  selector,
  notes = null,
}) => {
  const collectedEdition = await getCollectedEditionById(collectedEditionId)
  if (!collectedEdition) {
    throw new Error(`Collected edition "${collectedEditionId}" was not found.`)
  }

  const resolution = await resolveTargetRows({
    heroApiId: collectedEdition.hero_api_id,
    mode,
    selector,
  })

  // Deduplicate target rows before checking existing links and inserting new ones.
  const uniqueRows = new Map(resolution.resolvedRows.map((row) => [row.id, row]))
  const heroIssueIds = Array.from(uniqueRows.keys())

  const existing = await getExistingCollectedEditionLinks({
    collectedEditionId: collectedEdition.id,
    heroIssueIds,
  })

  const toCreate = heroIssueIds.filter((id) => !existing.has(id))
  const inserted = await insertCollectedEditionIssueLinks({
    collectedEditionId: collectedEdition.id,
    heroIssueIds: toCreate,
    notes,
  })

  return {
    collectedEdition,
    mode,
    selector,
    matched: uniqueRows.size,
    created: inserted.length,
    alreadyLinked: existing.size,
    missing: resolution.missing,
    ambiguous: resolution.ambiguous,
    linkedIssues: Array.from(uniqueRows.values()),
  }
}

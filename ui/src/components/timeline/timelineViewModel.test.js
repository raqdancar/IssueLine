import { describe, expect, it } from 'vitest'
import { buildTimelineViewModel } from './timelineViewModel'

const t = (key, values = {}) => {
  if (key === 'timeline.issueLabel') return `#${values.number}`
  if (key === 'timeline.uncategorizedStage') return 'Uncategorized'
  return key
}

const createEntry = (overrides) => ({
  id: overrides.id,
  headline: overrides.headline ?? `Issue ${overrides.id}`,
  issue_code: overrides.issueCode ?? String(overrides.id),
  issue_date: overrides.issueDate,
  metadata: {
    number: overrides.number ?? overrides.issueCode ?? String(overrides.id),
    stage_name: overrides.stageName,
    stage_summary: overrides.stageSummary,
    timeline_order: overrides.timelineOrder,
    issue_category: overrides.issueCategory,
    gcdIssueId: overrides.gcdIssueId ?? overrides.id,
  },
})

describe('buildTimelineViewModel', () => {
  it('uses canonical timeline order when available and builds navigator anchors', () => {
    const entries = [
      createEntry({ id: '3', issueDate: '2020-03-01', stageName: 'Finale', timelineOrder: 3 }),
      createEntry({ id: '1', issueDate: '2020-01-01', stageName: 'Origins', timelineOrder: 1 }),
      createEntry({ id: '2', issueDate: '2020-02-01', stageName: 'Origins', timelineOrder: 2 }),
    ]

    const viewModel = buildTimelineViewModel({
      entries,
      sortDirection: 'desc',
      timelineOrderMode: 'canonical',
      publicationFilter: 'all',
      collectionFilters: { ownedOnly: false, readOnly: false },
      issueStatesById: {},
      t,
    })

    expect(viewModel.hasCanonicalTimelineOrder).toBe(true)
    expect(viewModel.orderedEntries.map((entry) => entry.id)).toEqual(['1', '2', '3'])
    expect(viewModel.monthAnchors).toHaveLength(3)
    expect(viewModel.stageAnchors).toEqual([
      {
        key: 'origins',
        label: 'Origins',
        summary: null,
        count: 2,
        targetId: 'timeline-entry-1',
      },
      {
        key: 'finale',
        label: 'Finale',
        summary: null,
        count: 1,
        targetId: 'timeline-entry-3',
      },
    ])
    expect(viewModel.issueAnchorsByStage.map((stage) => stage.label)).toEqual(['Origins', 'Finale'])
    expect(viewModel.canShowNavigator).toBe(true)
  })

  it('filters annual, owned and read entries without mutating original order', () => {
    const entries = [
      createEntry({ id: '1', issueDate: '2020-01-01', stageName: 'Main', issueCategory: 'regular' }),
      createEntry({ id: '2', issueDate: '2020-02-01', stageName: 'Main', issueCategory: 'annual' }),
      createEntry({ id: '3', issueDate: '2020-03-01', stageName: 'Main', issueCategory: 'annual' }),
    ]

    const viewModel = buildTimelineViewModel({
      entries,
      sortDirection: 'asc',
      timelineOrderMode: 'publication',
      publicationFilter: 'annuals',
      collectionFilters: { ownedOnly: true, readOnly: true },
      issueStatesById: {
        2: { haveIt: true, readIt: false },
        3: { haveIt: true, readIt: true },
      },
      t,
    })

    expect(viewModel.filteredEntries.map((entry) => entry.id)).toEqual(['3'])
    expect(entries.map((entry) => entry.id)).toEqual(['1', '2', '3'])
  })
})

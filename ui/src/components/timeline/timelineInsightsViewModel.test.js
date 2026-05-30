import { describe, expect, it } from 'vitest'
import {
  ALL_FILTER_VALUE,
  buildCollectedEditionFormatGroups,
  buildFilteredCollectedEditions,
  buildFilterOptions,
  buildStageCoverageMap,
  buildStageGroups,
  isCollectedEditionOwned,
  isCollectedEditionRead,
  resolveTimelineRange,
} from './timelineInsightsViewModel'

const t = (key, values = {}) => {
  if (key === 'timeline.issueLabel') return `#${values.number}`
  if (key === 'timeline.uncategorizedStage') return 'Uncategorized'
  if (key === 'timeline.dateTba') return 'TBA'
  if (key === 'timeline.yearTba') return 'TBA'
  if (key === 'timeline.issueFallback') return 'Issue'
  return key
}

const entries = [
  {
    id: '1',
    issue_code: '1',
    issue_date: '2021-01-15',
    metadata: { number: '1', stage_name: 'Arrival', stage_summary: 'First arc' },
  },
  {
    id: '2',
    issue_code: '2',
    issue_date: '2021-03-15',
    metadata: { number: '2', stage_name: 'Arrival' },
  },
  {
    id: '3',
    issue_code: '3',
    issue_date: '2022-01-15',
    metadata: { number: '3', stage_name: 'Aftermath' },
  },
]

describe('timeline insights view model', () => {
  it('groups stages with read progress and date ranges', () => {
    const groups = buildStageGroups(entries, { 1: { readIt: true }, 2: { readIt: false }, 3: { readIt: true } }, t, 'en-US')

    expect(groups.map((group) => group.name)).toEqual(['Arrival', 'Aftermath'])
    expect(groups[0]).toMatchObject({
      key: 'arrival',
      summary: 'First arc',
      issueCount: 2,
      readCount: 1,
      yearLabel: '2021',
    })
    expect(groups[0].issueItems.map((issue) => issue.label)).toEqual(['1', '2'])
    expect(groups[1].yearLabel).toBe('2022')
  })

  it('builds stable filters and applies collected-edition filters', () => {
    const editions = [
      { id: 'a', printLanguage: 'Castellano', format: 'hardcover' },
      { id: 'b', printLanguage: 'English', format: 'tpb' },
      { id: 'c', printLanguage: 'English', format: 'tpb' },
    ]

    expect(buildFilterOptions(editions, (edition) => ({ value: edition.format, label: edition.format }))).toEqual([
      { value: 'hardcover', label: 'hardcover' },
      { value: 'tpb', label: 'tpb' },
    ])
    expect(
      buildFilteredCollectedEditions({
        collectedEditions: editions,
        collectedLanguageFilter: 'en',
        collectedFormatFilter: 'tpb',
      }).map((edition) => edition.id),
    ).toEqual(['b', 'c'])
    expect(
      buildFilteredCollectedEditions({
        collectedEditions: editions,
        collectedLanguageFilter: ALL_FILTER_VALUE,
        collectedFormatFilter: ALL_FILTER_VALUE,
      }),
    ).toHaveLength(3)
  })

  it('groups collected editions by publication type', () => {
    const groups = buildCollectedEditionFormatGroups([
      { id: 'a', format: 'tpb' },
      { id: 'b', format: 'omnibus' },
      { id: 'c', format: 'tpb' },
      { id: 'd' },
    ])

    expect(groups.map((group) => group.label)).toEqual(['Omnibus', 'TPB', 'Unknown'])
    expect(groups.find((group) => group.key === 'tpb')?.editions.map((edition) => edition.id)).toEqual(['a', 'c'])
  })

  it('resolves timeline coverage and collected edition ownership/read state', () => {
    expect(buildStageCoverageMap([{ key: 'arrival', count: 2 }, { key: 'empty' }, null])).toEqual({
      arrival: 2,
      empty: 0,
    })
    expect(resolveTimelineRange(entries, t)).toMatchObject({ startYear: 2021, endYear: 2022, label: '2021 - 2022' })

    const edition = {
      id: 10,
      issues: [{ timelineIssueId: '1' }, { timelineIssueId: '2' }],
    }
    const statesByIssueId = {
      1: { haveIt: true, readIt: true, collectedEditionIds: ['10'] },
      2: { haveIt: true, readIt: true, collectedEditionIds: [10] },
    }

    expect(isCollectedEditionOwned({ edition, statesByIssueId })).toBe(true)
    expect(isCollectedEditionRead({ edition, statesByIssueId })).toBe(true)
  })
})

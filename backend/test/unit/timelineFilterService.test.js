import test from 'node:test'
import assert from 'node:assert/strict'

import { buildTimelineVisibilityPlan } from '../../src/modules/gcd/importCli/timelineFilterService.js'

const makeEntry = ({
  gcdIssueId,
  number = '1',
  issueDate = '2020-01-01',
  issueCode = '1',
  headline = 'Sample Headline',
  issueLabel = 'Sample #1',
  seriesName = 'Sample Series',
  cover = null,
  coverImagePath = null,
} = {}) => ({
  issueDate,
  issueCode,
  headline,
  metadata: {
    gcdIssueId,
    number,
    issueLabel,
    seriesName,
    cover,
    coverImagePath,
  },
})

test('returns entries unchanged when variant filtering is disabled', () => {
  const entries = [makeEntry({ gcdIssueId: 1001 }), makeEntry({ gcdIssueId: 1002, number: '2', issueCode: '2' })]
  const result = buildTimelineVisibilityPlan({
    entries,
    excludeVariantsFromTimeline: false,
  })

  assert.equal(result.variantFilteringApplied, false)
  assert.deepEqual(result.selectedEntries, entries)
  assert.deepEqual(result.excludedEntries, [])
})

test('keeps only canonical entry when duplicates share canonical key and one is variant-tagged', () => {
  const canonical = makeEntry({
    gcdIssueId: 2001,
    issueLabel: 'Sample #1',
    issueCode: '1',
    headline: 'Sample 1',
  })
  const variant = makeEntry({
    gcdIssueId: 2002,
    issueLabel: 'Sample #1 Variant Cover',
    issueCode: '1 Variant',
    headline: 'Sample 1 Variant',
  })

  const result = buildTimelineVisibilityPlan({
    entries: [variant, canonical],
    excludeVariantsFromTimeline: true,
  })

  assert.equal(result.variantFilteringApplied, true)
  assert.equal(result.selectedEntries.length, 1)
  assert.equal(result.excludedEntries.length, 1)
  assert.equal(result.selectedEntries[0].metadata.gcdIssueId, 2001)
  assert.equal(result.excludedEntries[0].metadata.gcdIssueId, 2002)
})

test('excludes second and third printings even when they are the only candidate for that issue number', () => {
  const secondPrinting = makeEntry({
    gcdIssueId: 2501,
    issueLabel: 'Sample #1 Second Printing',
    issueCode: '1 [Second Printing]',
    headline: 'Sample 1 Second Printing',
  })
  const thirdPrinting = makeEntry({
    gcdIssueId: 2502,
    number: '2',
    issueLabel: 'Sample #2 Third Printing',
    issueCode: '2 [Third Printing]',
    headline: 'Sample 2 Third Printing',
  })
  const canonical = makeEntry({
    gcdIssueId: 2503,
    number: '3',
    issueLabel: 'Sample #3',
    issueCode: '3',
    headline: 'Sample 3',
  })

  const result = buildTimelineVisibilityPlan({
    entries: [secondPrinting, thirdPrinting, canonical],
    excludeVariantsFromTimeline: true,
  })

  assert.equal(result.variantFilteringApplied, true)
  assert.deepEqual(
    result.selectedEntries.map((entry) => entry.metadata.gcdIssueId),
    [2503],
  )
  assert.deepEqual(
    result.excludedEntries.map((entry) => entry.metadata.gcdIssueId),
    [2501, 2502],
  )
})

test('breaks score ties by lowest gcdIssueId', () => {
  const a = makeEntry({
    gcdIssueId: 3002,
    issueLabel: 'Sample #5',
    issueCode: '5',
  })
  const b = makeEntry({
    gcdIssueId: 3001,
    issueLabel: 'Sample #5',
    issueCode: '5',
  })

  const result = buildTimelineVisibilityPlan({
    entries: [a, b],
    excludeVariantsFromTimeline: true,
  })

  assert.equal(result.selectedEntries.length, 1)
  assert.equal(result.excludedEntries.length, 1)
  assert.equal(result.selectedEntries[0].metadata.gcdIssueId, 3001)
})

test('separates entries with different canonical keys', () => {
  const issue1 = makeEntry({
    gcdIssueId: 4001,
    number: '1',
    issueCode: '1',
    issueDate: '2020-01-01',
  })
  const issue2 = makeEntry({
    gcdIssueId: 4002,
    number: '2',
    issueCode: '2',
    issueDate: '2020-01-01',
  })

  const result = buildTimelineVisibilityPlan({
    entries: [issue1, issue2],
    excludeVariantsFromTimeline: true,
  })

  assert.equal(result.selectedEntries.length, 2)
  assert.equal(result.excludedEntries.length, 0)
})

test('handles non-array or empty entries safely', () => {
  const resultFromNull = buildTimelineVisibilityPlan({
    entries: null,
    excludeVariantsFromTimeline: true,
  })
  assert.deepEqual(resultFromNull.selectedEntries, [])
  assert.deepEqual(resultFromNull.excludedEntries, [])
  assert.equal(resultFromNull.variantFilteringApplied, true)

  const resultFromEmpty = buildTimelineVisibilityPlan({
    entries: [],
    excludeVariantsFromTimeline: false,
  })
  assert.deepEqual(resultFromEmpty.selectedEntries, [])
  assert.deepEqual(resultFromEmpty.excludedEntries, [])
  assert.equal(resultFromEmpty.variantFilteringApplied, false)
})

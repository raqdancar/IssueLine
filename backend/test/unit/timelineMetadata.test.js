import test from 'node:test'
import assert from 'node:assert/strict'

import { compactLinkedTimelineMetadata } from '../../src/modules/hero/timelineMetadata.js'

test('compactLinkedTimelineMetadata removes canonical issue copies from linked rows', () => {
  assert.deepEqual(
    compactLinkedTimelineMetadata({
      gcdIssueId: 12345,
      issueLabel: 'Doctor Strange #1',
      number: '1',
      seriesName: 'Doctor Strange',
      coverImagePath: 'covers/doctor-strange/12345.jpg',
      publicationDate: '2015-12',
      stageName: 'Modern era',
      stage_name: 'Modern era',
      legacyNumber: 381,
    }),
    {
      gcdIssueId: 12345,
      stageName: 'Modern era',
      stage_name: 'Modern era',
      legacyNumber: 381,
    }
  )
})

test('compactLinkedTimelineMetadata preserves null and non-object metadata', () => {
  assert.equal(compactLinkedTimelineMetadata(null), null)
  assert.equal(compactLinkedTimelineMetadata(undefined), null)
  assert.equal(compactLinkedTimelineMetadata('legacy'), 'legacy')
})

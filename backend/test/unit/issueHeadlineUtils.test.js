import test from 'node:test'
import assert from 'node:assert/strict'

import { buildIssueHeadline } from '../../src/utils/issueHeadlineUtils.js'

test('buildIssueHeadline uses series + normalized number when both exist', () => {
  assert.equal(
    buildIssueHeadline({
      seriesName: 'Doctor Strange (1968 series)',
      number: '#17',
      issueCode: '17A',
      fallback: 'Fallback',
    }),
    'Doctor Strange 1968 #17'
  )
})

test('buildIssueHeadline falls back to issueCode when number is missing', () => {
  assert.equal(
    buildIssueHeadline({
      seriesName: 'Doctor Strange',
      number: '',
      issueCode: '#Annual 2',
    }),
    'Doctor Strange #Annual 2'
  )
})

test('buildIssueHeadline returns series only when no issue code exists', () => {
  assert.equal(
    buildIssueHeadline({
      seriesName: 'Moon Knight',
      number: '',
      issueCode: '',
    }),
    'Moon Knight'
  )
})

test('buildIssueHeadline returns generic issue label when only code exists', () => {
  assert.equal(
    buildIssueHeadline({
      seriesName: '',
      number: '',
      issueCode: '#7B',
    }),
    'Issue #7B'
  )
})

test('buildIssueHeadline uses fallback or default issue label', () => {
  assert.equal(
    buildIssueHeadline({
      seriesName: '',
      number: '',
      issueCode: '',
      fallback: 'Custom fallback',
    }),
    'Custom fallback'
  )
  assert.equal(
    buildIssueHeadline({
      seriesName: '',
      number: '',
      issueCode: '',
    }),
    'Issue'
  )
})


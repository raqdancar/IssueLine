import test from 'node:test'
import assert from 'node:assert/strict'

import { coerceSeriesSlugSource, normalizeSeriesName } from '../../src/utils/seriesNameUtils.js'

test('normalizeSeriesName applies known overrides', () => {
  assert.equal(normalizeSeriesName('Doctor Strange (1968 series)'), 'Doctor Strange 1968')
  assert.equal(normalizeSeriesName('Doctor Strange (1974 series)'), 'Doctor Strange 1974')
})

test('normalizeSeriesName trims arbitrary input and preserves regular names', () => {
  assert.equal(normalizeSeriesName('  Spider-Man  '), 'Spider-Man')
  assert.equal(normalizeSeriesName(''), '')
})

test('normalizeSeriesName keeps null/undefined semantics', () => {
  assert.equal(normalizeSeriesName(null), null)
  assert.equal(normalizeSeriesName(undefined), null)
})

test('coerceSeriesSlugSource returns normalized value when possible', () => {
  assert.equal(coerceSeriesSlugSource('Doctor Strange (1968 series)'), 'Doctor Strange 1968')
  assert.equal(coerceSeriesSlugSource('  X-Men  '), 'X-Men')
})

test('coerceSeriesSlugSource falls back to empty string for nullish input', () => {
  assert.equal(coerceSeriesSlugSource(null), '')
  assert.equal(coerceSeriesSlugSource(undefined), '')
})


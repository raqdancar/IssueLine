import test from 'node:test'
import assert from 'node:assert/strict'

import { coerceIsoDate, extractIssueIdFromUrl, mapIssueToTimelineEntry, pickBestDate } from '../../src/modules/gcd/issueMapper.js'

test('coerceIsoDate normalizes partial dates', () => {
  assert.equal(coerceIsoDate('2020-05-00'), '2020-05-01')
  assert.equal(coerceIsoDate('2020-00-00'), '2020-01-01')
  assert.equal(coerceIsoDate('2020-00-15'), '2020-01-15')
  assert.equal(coerceIsoDate('2020-05'), '2020-05-01')
  assert.equal(coerceIsoDate('2020'), '2020-01-01')
})

test('coerceIsoDate returns null for invalid input', () => {
  assert.equal(coerceIsoDate('not-a-date'), null)
  assert.equal(coerceIsoDate(''), null)
  assert.equal(coerceIsoDate(null), null)
})

test('pickBestDate prioritizes key_date, then on_sale_date, then publication_date', () => {
  assert.equal(
    pickBestDate({
      key_date: '2022-01-01',
      on_sale_date: '2022-02-01',
      publication_date: '2022-03-01',
    }),
    '2022-01-01'
  )
  assert.equal(
    pickBestDate({
      key_date: null,
      on_sale_date: '2022-02-01',
      publication_date: '2022-03-01',
    }),
    '2022-02-01'
  )
  assert.equal(
    pickBestDate({
      key_date: null,
      on_sale_date: null,
      publication_date: '2022-03-01',
    }),
    '2022-03-01'
  )
})

test('extractIssueIdFromUrl parses valid GCD issue URLs', () => {
  assert.equal(extractIssueIdFromUrl('https://www.comics.org/api/issue/12345/'), 12345)
  assert.equal(extractIssueIdFromUrl('/api/issue/67890/'), 67890)
  assert.equal(extractIssueIdFromUrl('https://www.comics.org/api/series/824/'), null)
})

test('mapIssueToTimelineEntry builds a timeline entry from a valid issue payload', () => {
  const entry = mapIssueToTimelineEntry({
    id: 12345,
    descriptor: '1',
    number: '1',
    series_name: 'Doctor Strange (1968 series)',
    key_date: '1968-07-00',
    on_sale_date: null,
    publication_date: '1968-07',
    notes: ' First appearance in this run ',
    api_url: 'https://www.comics.org/api/issue/12345/?format=json',
    cover: 'https://static.example.com//media//w100//cover.jpg',
    cover_image_path: 'covers/doctor_strange_1968/12345.jpg',
    page_count: '32',
  })

  assert.ok(entry)
  assert.equal(entry.issueDate, '1968-07-01')
  assert.equal(entry.severity, 'info')
  assert.equal(entry.summary, 'First appearance in this run')
  assert.equal(entry.sourceUrl, 'https://www.comics.org/api/issue/12345/')
  assert.equal(entry.metadata.gcdIssueId, 12345)
  assert.equal(entry.metadata.seriesName, 'Doctor Strange 1968')
  assert.equal(entry.metadata.coverImagePath, 'covers/doctor_strange_1968/12345.jpg')
  assert.equal(entry.metadata.cover, 'https://static.example.com/media/w200/cover.jpg')
})

test('mapIssueToTimelineEntry returns null when no usable issue date exists', () => {
  const entry = mapIssueToTimelineEntry({
    id: 1,
    descriptor: '1',
    number: '1',
    series_name: 'Example Series',
    key_date: null,
    on_sale_date: null,
    publication_date: 'invalid-date',
    api_url: 'https://www.comics.org/api/issue/1/?format=json',
  })

  assert.equal(entry, null)
})

test('mapIssueToTimelineEntry falls back to api_url issue id and publication summary when notes are empty', () => {
  const entry = mapIssueToTimelineEntry({
    descriptor: '',
    number: '12',
    series_name: 'Sample Series',
    key_date: null,
    on_sale_date: '2021-04-15',
    publication_date: '2021-04',
    notes: '   ',
    api_url: 'https://www.comics.org/api/issue/55555/?format=json',
    cover: 'https://cdn.example.com/media/w100/sample.jpg',
  })

  assert.ok(entry)
  assert.equal(entry.issueDate, '2021-04-15')
  assert.equal(entry.metadata.gcdIssueId, 55555)
  assert.equal(entry.summary, '2021-04')
  assert.equal(entry.sourceUrl, 'https://www.comics.org/api/issue/55555/')
})

import test from 'node:test'
import assert from 'node:assert/strict'

import { collapseExtraSlashes, normalizeCoverUrl } from '../../src/modules/gcd/coverUtils.js'

test('collapseExtraSlashes collapses repeated slashes and preserves single leading slash', () => {
  assert.equal(collapseExtraSlashes('/a///b//c'), '/a/b/c')
  assert.equal(collapseExtraSlashes('////a//b'), '/a/b')
  assert.equal(collapseExtraSlashes('a//b//c'), 'a/b/c')
})

test('collapseExtraSlashes returns input when value is falsy', () => {
  assert.equal(collapseExtraSlashes(''), '')
  assert.equal(collapseExtraSlashes(null), null)
  assert.equal(collapseExtraSlashes(undefined), undefined)
})

test('normalizeCoverUrl normalizes URL path and rewrites size token', () => {
  const input = 'https://cdn.example.com//media///w100//covers//x.jpg'
  const output = normalizeCoverUrl(input)
  assert.equal(output, 'https://cdn.example.com/media/w200/covers/x.jpg')
})

test('normalizeCoverUrl supports custom size token', () => {
  const input = 'https://cdn.example.com/media/w320/covers/x.jpg'
  const output = normalizeCoverUrl(input, 'w640')
  assert.equal(output, 'https://cdn.example.com/media/w640/covers/x.jpg')
})

test('normalizeCoverUrl handles non-URL strings via fallback normalization', () => {
  const input = 'not-a-valid-url://foo//w100//bar.jpg'
  const output = normalizeCoverUrl(input)
  assert.equal(output, 'not-a-valid-url://foo/w200/bar.jpg')
})

test('normalizeCoverUrl returns null for empty raw input', () => {
  assert.equal(normalizeCoverUrl(''), null)
  assert.equal(normalizeCoverUrl(null), null)
  assert.equal(normalizeCoverUrl(undefined), null)
})


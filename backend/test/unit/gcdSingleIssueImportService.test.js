import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeGcdIssueIdInput } from '../../src/modules/gcd/importCli/issueIdentifierUtils.js'

test('normalizeGcdIssueIdInput accepts positive numeric IDs', () => {
  assert.equal(normalizeGcdIssueIdInput('12345'), 12345)
  assert.equal(normalizeGcdIssueIdInput(67890), 67890)
})

test('normalizeGcdIssueIdInput extracts ID from issue URL', () => {
  assert.equal(normalizeGcdIssueIdInput('https://www.comics.org/api/issue/54321/'), 54321)
  assert.equal(normalizeGcdIssueIdInput('https://www.comics.org/issue/22222/'), 22222)
})

test('normalizeGcdIssueIdInput rejects invalid values', () => {
  assert.throws(() => normalizeGcdIssueIdInput(''), /required/i)
  assert.throws(() => normalizeGcdIssueIdInput('abc'), /Invalid GCD issue identifier/i)
  assert.throws(() => normalizeGcdIssueIdInput('-5'), /Invalid GCD issue identifier/i)
  assert.throws(() => normalizeGcdIssueIdInput('0'), /positive integer/i)
})

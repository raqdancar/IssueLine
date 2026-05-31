import test from 'node:test'
import assert from 'node:assert/strict'

import { hasAdminRole, requireAdminRequest } from '../../src/middlewares/authorizeAdmin.js'

const createResponse = () => {
  const response = {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.payload = payload
      return this
    },
  }
  return response
}

test('hasAdminRole accepts explicit Supabase app_metadata admin roles', () => {
  assert.equal(hasAdminRole({ role: 'admin' }), true)
  assert.equal(hasAdminRole({ roles: ['editor', 'admin'] }), true)
})

test('hasAdminRole rejects missing or non-admin roles', () => {
  assert.equal(hasAdminRole(), false)
  assert.equal(hasAdminRole({ role: 'editor' }), false)
  assert.equal(hasAdminRole({ roles: ['editor'] }), false)
})

test('requireAdminRequest rejects unauthenticated requests', () => {
  const response = createResponse()
  let nextCalled = false

  requireAdminRequest({}, response, () => {
    nextCalled = true
  })

  assert.equal(response.statusCode, 401)
  assert.deepEqual(response.payload, { error: 'Authentication is required.' })
  assert.equal(nextCalled, false)
})

test('requireAdminRequest rejects authenticated non-admin users', () => {
  const response = createResponse()
  let nextCalled = false

  requireAdminRequest({ user: { appMetadata: { role: 'editor' } } }, response, () => {
    nextCalled = true
  })

  assert.equal(response.statusCode, 403)
  assert.deepEqual(response.payload, { error: 'Administrator role is required.' })
  assert.equal(nextCalled, false)
})

test('requireAdminRequest allows authenticated admins', () => {
  const response = createResponse()
  let nextCalled = false

  requireAdminRequest({ user: { appMetadata: { role: 'admin' } } }, response, () => {
    nextCalled = true
  })

  assert.equal(response.statusCode, null)
  assert.equal(response.payload, null)
  assert.equal(nextCalled, true)
})

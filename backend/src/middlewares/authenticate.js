// Defineix middleware compartit per al tractament de peticions del backend.
import { supabaseServiceClient } from '../lib/supabaseClient.js'

const parseBearerToken = (authorizationHeader = '') => {
  const trimmed = authorizationHeader.trim()
  if (!trimmed.toLowerCase().startsWith('bearer ')) {
    return null
  }
  const token = trimmed.slice(7).trim()
  return token || null
}

export const authenticateRequest = async (req, res, next) => {
  try {
    const token = parseBearerToken(req.get('authorization'))
    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization bearer token.' })
    }

    const { data, error } = await supabaseServiceClient.auth.getUser(token)
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired session.' })
    }

    req.user = {
      id: data.user.id,
      email: data.user.email,
      appMetadata: data.user.app_metadata ?? {},
      userMetadata: data.user.user_metadata ?? {},
    }

    return next()
  } catch (error) {
    return next(error)
  }
}

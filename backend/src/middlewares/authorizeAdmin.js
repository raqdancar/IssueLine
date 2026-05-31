// Restringeix operacions editorials a usuaris amb rol administratiu.
export const hasAdminRole = (appMetadata = {}) => {
  if (appMetadata.role === 'admin') return true
  return Array.isArray(appMetadata.roles) && appMetadata.roles.includes('admin')
}

export const requireAdminRequest = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication is required.' })
  }

  if (!hasAdminRole(req.user.appMetadata)) {
    return res.status(403).json({ error: 'Administrator role is required.' })
  }

  return next()
}

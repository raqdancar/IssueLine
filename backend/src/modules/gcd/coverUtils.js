// Gestiona la integracio amb GCD i la normalitzacio de dades editorials.
export const collapseExtraSlashes = (value) => {
  if (!value) return value
  return value.replace(/\/{2,}/g, '/').replace(/^\/+/, '/')
}

export const normalizeCoverUrl = (raw, sizeToken = 'w200') => {
  if (!raw) return null
  try {
    const url = new URL(raw)
    const normalizedPath = collapseExtraSlashes(url.pathname)
    url.pathname = normalizedPath.replace(/\/w\d+\//, `/${sizeToken}/`)
    return url.toString()
  } catch {
    const placeholder = raw.replace('://', '__SCHEME__')
    const collapsed = placeholder.replace(/\/{2,}/g, '/').replace('__SCHEME__', '://')
    return collapsed.replace(/\/w\d+\//, `/${sizeToken}/`)
  }
}

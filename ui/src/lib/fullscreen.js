// Agrupa funcions compartides per accedir a dades i normalitzar informacio.

const getFullscreenElement = (doc) => doc?.fullscreenElement ?? doc?.webkitFullscreenElement ?? null

export const canUseFullscreen = (element) =>
  Boolean(element && (element.requestFullscreen || element.webkitRequestFullscreen))

export const isElementFullscreen = (element, doc = typeof document !== 'undefined' ? document : null) =>
  Boolean(element && doc && getFullscreenElement(doc) === element)

export const requestElementFullscreen = async (element) => {
  if (!element) return false
  if (typeof element.requestFullscreen === 'function') {
    await element.requestFullscreen()
    return true
  }
  if (typeof element.webkitRequestFullscreen === 'function') {
    element.webkitRequestFullscreen()
    return true
  }
  return false
}

export const exitDocumentFullscreen = async (doc = typeof document !== 'undefined' ? document : null) => {
  if (!doc) return false
  if (typeof doc.exitFullscreen === 'function') {
    await doc.exitFullscreen()
    return true
  }
  if (typeof doc.webkitExitFullscreen === 'function') {
    doc.webkitExitFullscreen()
    return true
  }
  return false
}

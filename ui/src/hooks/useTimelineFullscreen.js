// Encapsula estat, efectes i consultes reutilitzables del frontend.
import { useCallback, useEffect, useState } from 'react'
import { canUseFullscreen, exitDocumentFullscreen, isElementFullscreen, requestElementFullscreen } from '@/lib/fullscreen.js'

export const useTimelineFullscreen = (containerRef) => {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenEnabled, setFullscreenEnabled] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const syncFullscreenState = () => {
      const element = containerRef.current
      setIsFullscreen(isElementFullscreen(element, document))
      setFullscreenEnabled(canUseFullscreen(element))
    }

    syncFullscreenState()
    document.addEventListener('fullscreenchange', syncFullscreenState)
    document.addEventListener('webkitfullscreenchange', syncFullscreenState)
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState)
    }
  }, [containerRef])

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return
    const element = containerRef.current
    if (!element) return

    if (isElementFullscreen(element, document)) {
      await exitDocumentFullscreen(document)
      return
    }
    await requestElementFullscreen(element)
  }, [containerRef])

  return {
    isFullscreen,
    fullscreenEnabled,
    toggleFullscreen,
  }
}

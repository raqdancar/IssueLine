// Encapsula estat, efectes i consultes reutilitzables del frontend.
import { useCallback, useEffect, useState } from 'react'
import {
  canUseFullscreen,
  exitDocumentFullscreen,
  isElementFullscreen,
  isTimelineFullscreenViewport,
  requestElementFullscreen,
} from '@/lib/fullscreen.js'

export const useTimelineFullscreen = (containerRef) => {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenEnabled, setFullscreenEnabled] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const syncFullscreenState = () => {
      const element = containerRef.current
      const isElementActive = isElementFullscreen(element, document)
      const isAllowedViewport = isTimelineFullscreenViewport(window)
      setIsFullscreen(isElementActive)
      setFullscreenEnabled(isAllowedViewport && canUseFullscreen(element))
      if (isElementActive && !isAllowedViewport) {
        void exitDocumentFullscreen(document)
      }
    }

    syncFullscreenState()
    document.addEventListener('fullscreenchange', syncFullscreenState)
    document.addEventListener('webkitfullscreenchange', syncFullscreenState)
    window.addEventListener('resize', syncFullscreenState)
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState)
      window.removeEventListener('resize', syncFullscreenState)
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
    if (!isTimelineFullscreenViewport(window)) return
    await requestElementFullscreen(element)
  }, [containerRef])

  return {
    isFullscreen,
    fullscreenEnabled,
    toggleFullscreen,
  }
}

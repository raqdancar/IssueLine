// Stateful controls for the main hero timeline.
import { useEffect, useMemo, useState } from 'react'
import { useTimelineFullscreen } from '@/hooks/useTimelineFullscreen.js'
import {
  COMPACT_DENSITY_THRESHOLD,
  MAX_ZOOM_LEVEL,
  MICRO_DENSITY_THRESHOLD,
  MIN_ZOOM_LEVEL,
} from '@/components/timeline/constants'

export const useTimelineControls = ({ sectionRef, resetKey }) => {
  const [sortDirection, setSortDirection] = useState('desc')
  const [timelineOrderMode, setTimelineOrderMode] = useState('canonical')
  const [indexMode, setIndexMode] = useState('month')
  const [publicationFilter, setPublicationFilter] = useState('all')
  const [collectionFilters, setCollectionFilters] = useState({
    ownedOnly: false,
    readOnly: false,
  })
  const [zoomLevel, setZoomLevel] = useState(1)
  const { isFullscreen, fullscreenEnabled, toggleFullscreen } = useTimelineFullscreen(sectionRef)

  useEffect(() => {
    setPublicationFilter('all')
    setCollectionFilters({ ownedOnly: false, readOnly: false })
  }, [resetKey])

  const updateCollectionFilter = (key, nextValue) => {
    setCollectionFilters((current) => ({ ...current, [key]: nextValue }))
  }

  const adjustZoomLevel = (delta) => {
    setZoomLevel((current) => {
      const next = Number((current + delta).toFixed(2))
      if (next < MIN_ZOOM_LEVEL) return MIN_ZOOM_LEVEL
      if (next > MAX_ZOOM_LEVEL) return MAX_ZOOM_LEVEL
      return next
    })
  }

  const zoom = useMemo(() => {
    const timelineDensity =
      zoomLevel <= MICRO_DENSITY_THRESHOLD ? 'micro' : zoomLevel <= COMPACT_DENSITY_THRESHOLD ? 'compact' : 'detailed'

    return {
      zoomLevel,
      zoomPercentage: Math.round(zoomLevel * 100),
      isZoomedOut: zoomLevel <= MIN_ZOOM_LEVEL + 0.001,
      isZoomedIn: zoomLevel >= MAX_ZOOM_LEVEL - 0.001,
      timelineDensity,
      timelineListSpacing:
        timelineDensity === 'micro' ? 'space-y-1.5' : timelineDensity === 'compact' ? 'space-y-2' : 'space-y-4',
    }
  }, [zoomLevel])

  return {
    sortDirection,
    setSortDirection,
    timelineOrderMode,
    setTimelineOrderMode,
    indexMode,
    setIndexMode,
    publicationFilter,
    setPublicationFilter,
    collectionFilters,
    updateCollectionFilter,
    adjustZoomLevel,
    isFullscreen,
    fullscreenEnabled,
    toggleFullscreen,
    ...zoom,
  }
}

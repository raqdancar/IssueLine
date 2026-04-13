import { useMemo } from 'react'
import TimelineIssueCard from '../TimelineIssueCard'
import { hasSpecialIssueCode } from './utils'
import { getStageKey } from '../../utils/timeline'

const resolveTrackableIssueId = (entry) => {
  if (!entry) return null
  const metadata = entry.metadata ?? {}
  return entry.id ?? metadata.issue_id ?? metadata.issueId ?? null
}

const buildStageCompletionIndex = (entries = [], issueStates = {}) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return {}
  }

  const index = {}

  entries.forEach((entry) => {
    const stage = getStageKey(entry)
    if (!stage) return

    const issueId = resolveTrackableIssueId(entry)
    if (!issueId) return

    if (!index[stage.key]) {
      index[stage.key] = { issueCount: 0, readCount: 0, isComplete: false }
    }

    const bucket = index[stage.key]
    bucket.issueCount += 1
    if (issueStates?.[issueId]?.readIt) {
      bucket.readCount += 1
    }
    bucket.isComplete = bucket.issueCount > 0 && bucket.readCount >= bucket.issueCount
  })

  return index
}

function TimelineList({
  entries,
  zoomLevel,
  listSpacingClass,
  timelineDensity,
  severityLookup,
  fallbackImage,
  issueStatesById,
  canUseIssueStateActions,
  issueStateDisabled,
  issueStateDisabledReason,
  pendingIssueId,
  onIssueStateToggle,
  highlightedEntryDomId,
  flashEntryDomId,
  onEntryHighlight,
}) {
  const stageCompletionByKey = useMemo(
    () => buildStageCompletionIndex(entries, issueStatesById ?? {}),
    [entries, issueStatesById],
  )

  return (
    <div className="timeline-zoom-container overflow-x-auto">
      <div className="timeline-zoom-content" style={{ zoom: zoomLevel }}>
        <ol className={`pt-4 ${listSpacingClass}`}>
          {entries.map((entry, index) => {
            const hideIssueStateActions = hasSpecialIssueCode(entry)
            const showIssueStateActions =
              timelineDensity !== 'micro' && entry.id && canUseIssueStateActions && !hideIssueStateActions
            const issueState = entry.id ? issueStatesById[entry.id] : undefined

            return (
              <TimelineIssueCard
                key={entry.id ?? `${entry.issue_code ?? 'issue'}-${index}`}
                entry={entry}
                index={index}
                totalEntries={entries.length}
                severityLookup={severityLookup}
                fallbackImage={fallbackImage}
                issueState={issueState}
                showIssueStateActions={Boolean(showIssueStateActions)}
                issueStateDisabled={issueStateDisabled}
                issueStateDisabledReason={issueStateDisabledReason}
                issueStatePending={pendingIssueId === entry.id}
                density={timelineDensity}
                highlightedEntryDomId={highlightedEntryDomId}
                flashEntryDomId={flashEntryDomId}
                onEntryHighlight={onEntryHighlight}
                stageCompletionByKey={stageCompletionByKey}
                onIssueStateToggle={(field, nextValue) =>
                  entry.id ? onIssueStateToggle(entry.id, field, nextValue) : undefined
                }
              />
            )
          })}
        </ol>
      </div>
    </div>
  )
}

export default TimelineList




// Render timeline entries with density-aware cards and state wiring.
import TimelineIssueCard from '../TimelineIssueCard'
import { hasSpecialIssueCode } from './utils'

function TimelineList({
  entries,
  zoomLevel,
  listSpacingClass,
  timelineDensity,
  severityLookup,
  issueStatesById,
  canUseIssueStateActions,
  issueStateDisabled,
  issueStateDisabledReason,
  pendingIssueId,
  onIssueStateToggle,
  highlightedEntryDomId,
  flashEntryDomId,
  onEntryHighlight,
  onCoverPreview,
  onIssueSelect,
}) {
  return (
    <div className="timeline-zoom-container overflow-x-auto">
      <div className="timeline-zoom-content" style={{ zoom: zoomLevel }}>
        <ol className={`pt-4 ${listSpacingClass}`}>
          {entries.map((entry, index) => {
            // Hide collection actions for annual/special placeholders to avoid invalid state updates.
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
                issueState={issueState}
                showIssueStateActions={Boolean(showIssueStateActions)}
                issueStateDisabled={issueStateDisabled}
                issueStateDisabledReason={issueStateDisabledReason}
                issueStatePending={pendingIssueId === entry.id}
                density={timelineDensity}
                highlightedEntryDomId={highlightedEntryDomId}
                flashEntryDomId={flashEntryDomId}
                onEntryHighlight={onEntryHighlight}
                onCoverPreview={onCoverPreview}
                onIssueSelect={onIssueSelect}
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




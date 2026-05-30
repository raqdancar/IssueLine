// Construeix peces visuals i derivacions de la cronologia d'issues.
import TimelineIssueCard from '../TimelineIssueCard'
import { hasSpecialIssueCode } from './utils'

function TimelineList({
  entries,
  zoomLevel,
  listSpacingClass,
  timelineDensity,
  showcaseMode = false,
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
  const useAlternatingShowcase = showcaseMode && timelineDensity === 'detailed'

  return (
    <div className="timeline-zoom-container overflow-x-auto">
      <div className="timeline-zoom-content" style={{ zoom: zoomLevel }}>
        <ol className={`relative pt-4 ${listSpacingClass} ${useAlternatingShowcase ? 'md:space-y-7' : ''}`}>
          {useAlternatingShowcase ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-[3px] -translate-x-1/2 rounded-full bg-linear-to-b from-indigo-500/35 via-fuchsia-400/80 to-cyan-400/45 shadow-[0_0_1.1rem_rgba(99,102,241,0.45)] md:block"
            />
          ) : null}
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
                showcaseMode={useAlternatingShowcase}
                showcaseSide={index % 2 === 0 ? 'left' : 'right'}
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




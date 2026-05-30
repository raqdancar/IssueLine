// Construeix peces visuals i derivacions de la cronologia d'issues.
import TimelineNavigatorPanel from './TimelineNavigatorPanel'
import TimelineNavigatorToggle from './TimelineNavigatorToggle'
import TimelineList from './TimelineList'

function TimelineFullscreenShowcase({
  canShowNavigator,
  isNavigatorVisible,
  indexMode,
  onIndexModeChange,
  indexOptions,
  anchorLookup,
  issueAnchorsByStage,
  activeAnchor,
  onAnchorClick,
  onHideNavigator,
  onShowNavigator,
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
  highlightedEntryDomId,
  flashEntryDomId,
  onEntryHighlight,
  onCoverPreview,
  onIssueSelect,
  onIssueStateToggle,
}) {
  return (
    <div className="relative rounded-2xl border border-white/55 bg-white/62 p-3 shadow-xl backdrop-blur sm:p-4">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-indigo-300/25 via-sky-200/15 to-transparent" />
        <div className="absolute -left-20 top-24 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-pink-300/10 blur-3xl" />
      </div>
      <div className="relative flex flex-col gap-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.4rem)] md:grid md:h-[calc(100vh-13rem)] md:min-h-[38rem] md:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] md:items-start md:overflow-hidden md:pb-0">
        {canShowNavigator && isNavigatorVisible ? (
          <TimelineNavigatorPanel
            indexMode={indexMode}
            onIndexModeChange={onIndexModeChange}
            indexOptions={indexOptions}
            anchorLookup={anchorLookup}
            issueAnchorsByStage={issueAnchorsByStage}
            activeAnchor={activeAnchor}
            onAnchorClick={onAnchorClick}
            onToggleVisibility={onHideNavigator}
          />
        ) : null}
        <div className={`min-w-0 flex-1 md:h-full md:overflow-y-auto md:pr-1 ${!canShowNavigator || !isNavigatorVisible ? 'md:col-span-2' : ''}`}>
          {canShowNavigator && !isNavigatorVisible ? (
            <TimelineNavigatorToggle onClick={onShowNavigator} showcaseMode />
          ) : null}
          <TimelineList
            entries={entries}
            zoomLevel={zoomLevel}
            listSpacingClass={listSpacingClass}
            timelineDensity={timelineDensity}
            showcaseMode
            severityLookup={severityLookup}
            issueStatesById={issueStatesById}
            canUseIssueStateActions={canUseIssueStateActions}
            issueStateDisabled={issueStateDisabled}
            issueStateDisabledReason={issueStateDisabledReason}
            pendingIssueId={pendingIssueId}
            highlightedEntryDomId={highlightedEntryDomId}
            flashEntryDomId={flashEntryDomId}
            onEntryHighlight={onEntryHighlight}
            onCoverPreview={onCoverPreview}
            onIssueSelect={onIssueSelect}
            onIssueStateToggle={onIssueStateToggle}
          />
        </div>
      </div>
    </div>
  )
}

export default TimelineFullscreenShowcase

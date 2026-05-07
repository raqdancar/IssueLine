// Select and render the timeline issue card variant for the active density mode.
import { useMemo } from 'react'
import TimelineIssueCardDetailed from './timeline/TimelineIssueCardDetailed'
import TimelineIssueCardCompact from './timeline/TimelineIssueCardCompact'
import TimelineIssueCardMicro from './timeline/TimelineIssueCardMicro'
import TimelineSpecialEventCard from './timeline/TimelineSpecialEventCard'
import { createIssueCardViewModel } from './timeline/issueCardViewModel'
import { useI18n } from '@/i18n/I18nProvider.jsx'

const densityComponents = {
  detailed: TimelineIssueCardDetailed,
  compact: TimelineIssueCardCompact,
  micro: TimelineIssueCardMicro,
}

function TimelineIssueCard(props) {
  const { t, locale } = useI18n()
  const {
    entry,
    index,
    totalEntries,
    severityLookup,
    issueState,
    density = 'detailed',
    highlightedEntryDomId = null,
    flashEntryDomId = null,
    onEntryHighlight,
    ...rest
  } = props

  // Normalize issue data once so all density components consume the same shape.
  const viewModel = useMemo(
    () =>
      createIssueCardViewModel({
        entry,
        index,
        totalEntries,
        severityLookup,
        issueState,
        t,
        locale,
      }),
    [entry, index, totalEntries, severityLookup, issueState, t, locale],
  )

  const isHighlighted = viewModel.entryDomId === highlightedEntryDomId
  const isFlashing = flashEntryDomId === viewModel.entryDomId

  if (viewModel.isSpecialEvent) {
    return (
      <TimelineSpecialEventCard
        {...rest}
        viewModel={viewModel}
        density={density}
        isHighlighted={isHighlighted}
        isFlashing={isFlashing}
        onEntryHighlight={onEntryHighlight}
      />
    )
  }

  // Fallback to detailed layout if an unknown density value is passed.
  const SelectedComponent = densityComponents[density] ?? TimelineIssueCardDetailed

  return (
    <SelectedComponent
      {...rest}
      issueState={issueState}
      viewModel={viewModel}
      isHighlighted={isHighlighted}
      isFlashing={isFlashing}
      onEntryHighlight={onEntryHighlight}
    />
  )
}

export default TimelineIssueCard





import { useMemo } from 'react'
import TimelineIssueCardDetailed from './timeline/TimelineIssueCardDetailed'
import TimelineIssueCardCompact from './timeline/TimelineIssueCardCompact'
import TimelineIssueCardMicro from './timeline/TimelineIssueCardMicro'
import { createIssueCardViewModel } from './timeline/issueCardViewModel'

const densityComponents = {
  detailed: TimelineIssueCardDetailed,
  compact: TimelineIssueCardCompact,
  micro: TimelineIssueCardMicro,
}

function TimelineIssueCard(props) {
  const {
    entry,
    index,
    totalEntries,
    severityLookup,
    fallbackImage,
    issueState,
    density = 'detailed',
    highlightedEntryDomId = null,
    flashEntryDomId = null,
    onEntryHighlight,
    ...rest
  } = props

  const viewModel = useMemo(
    () =>
      createIssueCardViewModel({
        entry,
        index,
        totalEntries,
        severityLookup,
        fallbackImage,
        issueState,
      }),
    [entry, index, totalEntries, severityLookup, fallbackImage, issueState],
  )

  const SelectedComponent = densityComponents[density] ?? TimelineIssueCardDetailed

  const isHighlighted = viewModel.entryDomId === highlightedEntryDomId
  const isFlashing = flashEntryDomId === viewModel.entryDomId

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

import { useMemo } from 'react'
import TimelineIssueCardDetailed from './timeline/TimelineIssueCardDetailed'
import TimelineIssueCardCompact from './timeline/TimelineIssueCardCompact'
import TimelineIssueCardMicro from './timeline/TimelineIssueCardMicro'
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
        t,
        locale,
      }),
    [entry, index, totalEntries, severityLookup, fallbackImage, issueState, t, locale],
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





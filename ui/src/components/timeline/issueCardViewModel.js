// Build the normalized view model consumed by all timeline issue card densities.
import { resolveIssueCoverImage } from '@/lib/issueImages'
import { normalizeIntegerText } from '@/utils/numberFormatters'
import { getEntryDomId, getStageKey } from '../../utils/timeline'
import { isSpecialTimelineEventEntry } from './utils'

const formatDate = (value, locale, t) => {
  try {
    if (!value) return t('timeline.dateTba')
    return new Date(value).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return value
  }
}

const dualStateVariant = {
  dot: 'border-transparent bg-[linear-gradient(180deg,rgba(16,185,129,0.9),rgba(14,165,233,0.9))]',
  panel: 'border-slate-200 bg-white',
  title: 'text-slate-900',
}

const haveItVariant = {
  dot: 'border-emerald-300 bg-emerald-100',
  panel: 'border-emerald-200 bg-emerald-50/70',
  title: 'text-emerald-900',
}

const readItVariant = {
  dot: 'border-sky-300 bg-sky-100',
  panel: 'border-sky-200 bg-sky-50/70',
  title: 'text-sky-900',
}

export function createIssueCardViewModel({
  entry,
  index,
  totalEntries,
  severityLookup,
  issueState,
  t,
  locale,
}) {
  // Blend base severity with collection/read states so one card can show both contexts.
  const baseVariant = severityLookup[entry.severity] ?? severityLookup.info
  const hasHaveIt = Boolean(issueState?.haveIt)
  const hasReadIt = Boolean(issueState?.readIt)

  const severityVariant =
    hasHaveIt && hasReadIt
      ? dualStateVariant
      : hasHaveIt
        ? { ...baseVariant, ...haveItVariant }
        : hasReadIt
          ? { ...baseVariant, ...readItVariant }
          : baseVariant

  const gradientStyle =
    hasHaveIt && hasReadIt
      ? {
          backgroundImage:
            'linear-gradient(90deg, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0.18) 50%, rgba(14,165,233,0.18) 50%, rgba(14,165,233,0.18) 100%)',
        }
      : undefined

  const isLast = index === totalEntries - 1
  const issueLabel = entry.metadata?.issueLabel ?? entry.issue_code ?? t('timeline.issueFallback')
  const meta = entry.metadata ?? {}
  // For timeline cards, show "No cover" when missing instead of a generic fallback image.
  const coverImage = resolveIssueCoverImage(meta, null)
  const isSpecialEvent = isSpecialTimelineEventEntry(entry)
  const specialEventCode = entry.issue_code ?? meta.issue_code ?? meta.issueCode ?? meta.issueLabel ?? null

  const seriesName = meta.series_name ?? meta.seriesName ?? null
  const number = meta.number ?? null
  const volume = meta.volume ?? null
  const publicationDate = meta.publication_date ?? meta.publicationDate ?? null
  const price = meta.price ?? null
  const pageCount = normalizeIntegerText(meta.page_count ?? meta.pageCount ?? null)
  const editing = meta.editing ?? null
  const rating = meta.rating ?? null
  const legacyNumber = entry.legacy_number ?? meta.legacy_number ?? meta.legacyNumber ?? null
  const legacyMatchesIssueNumber =
    Boolean(number && legacyNumber) && normalizeIntegerText(number) === normalizeIntegerText(legacyNumber)
  const stageIdentity = getStageKey(entry)
  const stageName = stageIdentity?.label ?? null
  const stageKey = stageIdentity?.key ?? null
  const stageSummary =
    meta.stage_summary ?? meta.stageSummary ?? meta.stage?.short_summary ?? meta.stage?.summary ?? null

  return {
    entry,
    entryDomId: getEntryDomId(entry, index),
    isLast,
    issueLabel,
    headline: entry.headline,
    summary: entry.summary,
    issueDateLabel: formatDate(entry.issue_date, locale, t),
    severityVariant,
    gradientStyle,
    stageKey,
    stageName,
    stageSummary,
    coverImage,
    isSpecialEvent,
    specialEventCode,
    meta: {
      seriesName,
      number,
      volume,
      publicationDate,
      price,
      pageCount,
      editing,
      rating,
      legacyNumber,
      legacyMatchesIssueNumber,
    },
  }
}


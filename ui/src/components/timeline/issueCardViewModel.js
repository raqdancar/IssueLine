import { resolveIssueCoverImage } from '@/lib/issueImages'
import { normalizeIntegerText } from '@/utils/numberFormatters'
import { getEntryDomId } from '../../utils/timeline'

const formatDate = (value) => {
  try {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
  fallbackImage,
  issueState,
}) {
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
  const issueLabel = entry.metadata?.issueLabel ?? entry.issue_code ?? 'Issue'
  const meta = entry.metadata ?? {}
  const coverImage = resolveIssueCoverImage(meta, fallbackImage)

  const seriesName = meta.series_name ?? meta.seriesName ?? null
  const number = meta.number ?? null
  const volume = meta.volume ?? null
  const publicationDate = meta.publication_date ?? meta.publicationDate ?? null
  const price = meta.price ?? null
  const pageCount = normalizeIntegerText(meta.page_count ?? meta.pageCount ?? null)
  const editing = meta.editing ?? null
  const rating = meta.rating ?? null
  const stageName = meta.stage_name ?? meta.stageName ?? meta.stage?.name ?? meta.stage?.label ?? null
  const stageSummary =
    meta.stage_summary ?? meta.stageSummary ?? meta.stage?.short_summary ?? meta.stage?.summary ?? null

  return {
    entry,
    entryDomId: getEntryDomId(entry, index),
    isLast,
    issueLabel,
    headline: entry.headline,
    summary: entry.summary,
    issueDateLabel: formatDate(entry.issue_date),
    severityVariant,
    gradientStyle,
    stageName,
    stageSummary,
    coverImage,
    meta: {
      seriesName,
      number,
      volume,
      publicationDate,
      price,
      pageCount,
      editing,
      rating,
    },
  }
}

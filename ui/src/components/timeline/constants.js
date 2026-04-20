export const severityVariants = {
  info: {
    dot: 'border-slate-300 bg-white',
    panel: 'border-slate-200 bg-white',
    title: 'text-slate-900',
  },
  success: {
    dot: 'border-emerald-300 bg-emerald-50',
    panel: 'border-emerald-100 bg-emerald-50/60',
    title: 'text-emerald-900',
  },
  warning: {
    dot: 'border-amber-400 bg-amber-50',
    panel: 'border-amber-200 bg-amber-50/60',
    title: 'text-amber-900',
  },
  critical: {
    dot: 'border-rose-400 bg-rose-50',
    panel: 'border-rose-200 bg-rose-50/60',
    title: 'text-rose-900',
  },
}

export const timelineSortOptions = [
  { labelKey: 'timeline.newestFirst', value: 'desc' },
  { labelKey: 'timeline.oldestFirst', value: 'asc' },
]

export const timelineIssueFilterOptions = [
  { labelKey: 'timeline.allIssues', value: 'all' },
  { labelKey: 'timeline.annualsOnly', value: 'annuals' },
]

export const indexModeOptions = [
  { labelKey: 'timeline.indexMonths', value: 'month' },
  { labelKey: 'timeline.indexYears', value: 'year' },
  { labelKey: 'timeline.indexStages', value: 'stage' },
  { labelKey: 'timeline.indexIssues', value: 'issue' },
]

export const MIN_ZOOM_LEVEL = 0.85
export const MAX_ZOOM_LEVEL = 1.3
export const ZOOM_STEP = 0.05
export const COMPACT_DENSITY_THRESHOLD = 0.97
export const MICRO_DENSITY_THRESHOLD = 0.9

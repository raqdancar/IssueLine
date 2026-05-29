// Render the stage marker used by timeline cards.
import { useI18n } from '@/i18n/I18nProvider.jsx'

const variantClasses = {
  light: {
    inline: 'border-indigo-200 bg-indigo-50/90 text-indigo-800 shadow-indigo-100/70',
    rail: 'bg-indigo-50/70 ring-indigo-100/80',
    line: 'from-indigo-500 via-indigo-300 to-transparent',
    dot: 'bg-indigo-600 ring-indigo-100',
  },
  dark: {
    inline: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-50 shadow-black/20',
    rail: 'bg-emerald-400/10 ring-emerald-300/25',
    line: 'from-emerald-300 via-emerald-200/70 to-transparent',
    dot: 'bg-emerald-200 ring-emerald-900/20',
  },
}

function TimelineStageTab({ label, variant = 'light', layout = 'rail' }) {
  const { t } = useI18n()

  if (!label) {
    return null
  }

  const variantClass = variantClasses[variant] ?? variantClasses.light

  if (layout === 'inline') {
    return (
      <span
        className={`inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] shadow-sm ${variantClass.inline}`}
        aria-label={t('timeline.stageLabel', { label })}
        title={label}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-75" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
    )
  }

  return (
    <div
      className={`relative w-3 shrink-0 self-stretch overflow-hidden shadow-inner ring-1 transition sm:w-3.5 ${variantClass.rail}`}
      aria-label={t('timeline.stageLabel', { label })}
      title={label}
    >
      <span
        className={`absolute bottom-3 left-1/2 top-3 w-1 -translate-x-1/2 rounded-full bg-linear-to-b ${variantClass.line}`}
        aria-hidden="true"
      />
      <span
        className={`absolute left-1/2 top-5 h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-2 ${variantClass.dot}`}
        aria-hidden="true"
      />
    </div>
  )
}

export default TimelineStageTab

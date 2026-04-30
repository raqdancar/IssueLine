import { Eye } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider.jsx'

function TimelineNavigatorToggle({ onClick }) {
  const { t } = useI18n()

  return (
    <div className="mb-3 flex justify-start md:sticky md:top-0 md:z-20 md:pb-2 md:pt-1 md:bg-linear-to-b md:from-white md:to-white/75">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        <Eye className="h-4 w-4" />
        {t('timeline.showTimelineIndex')}
      </button>
    </div>
  )
}

export default TimelineNavigatorToggle

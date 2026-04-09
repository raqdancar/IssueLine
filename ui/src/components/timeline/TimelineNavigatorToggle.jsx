import { Eye } from 'lucide-react'

function TimelineNavigatorToggle({ onClick }) {
  return (
    <div className="mb-3 flex justify-start">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        <Eye className="h-4 w-4" />
        Show timeline index
      </button>
    </div>
  )
}

export default TimelineNavigatorToggle
